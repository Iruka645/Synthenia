const config = require('../../config/visionConfig');
const {
  VisionError,
  normalizeObservation,
  validateCaptureRequest,
} = require('../../contracts/vision');

function noOpLogger() {}

function safeRequestId(requestId) {
  return typeof requestId === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/u.test(requestId) ? requestId : 'unknown';
}

function isAbortError(error) {
  return error && (error.name === 'AbortError' || error.code === 'ABORT_ERR');
}

function cleanError(code) {
  const messages = {
    VISION_ABORTED: 'vision analysis was aborted',
    VISION_TIMEOUT: 'vision analysis timed out',
    VISION_ANALYSIS_FAILED: 'vision analysis failed',
  };
  return new VisionError(code, messages[code] || 'vision analysis failed', { retryable: true });
}

class VisionCoordinator {
  constructor({
    analyzer,
    store,
    clock = () => Date.now(),
    logger = noOpLogger,
    analysisTimeoutMs = config.analysisTimeoutMs,
    createAbortController = () => new AbortController(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = {}) {
    if (typeof analyzer !== 'function') throw new TypeError('analyzer is required');
    if (!store || typeof store.set !== 'function') throw new TypeError('store is required');
    this.analyzer = analyzer;
    this.store = store;
    this.clock = clock;
    this.logger = logger;
    this.analysisTimeoutMs = analysisTimeoutMs;
    this.createAbortController = createAbortController;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.activeFlight = null;
    this.inFlight = false;
    this.nextFlightId = 0;
  }

  log(fields) {
    const payload = Object.freeze({ ...fields });
    try {
      if (typeof this.logger === 'function') this.logger(payload);
      else if (this.logger && typeof this.logger.info === 'function') this.logger.info(payload);
    } catch {
      // Telemetry must never change the public outcome or release ownership early.
    }
  }

  async analyze({ bytes, metadata, requestId, signal } = {}) {
    if (this.activeFlight) throw new VisionError('VISION_BUSY', 'vision analysis is already in flight', { retryable: true });
    if (signal?.aborted) throw cleanError('VISION_ABORTED');

    const startedAt = this.clock();
    const validated = validateCaptureRequest({ bytes, metadata, now: startedAt });
    if (signal?.aborted) throw cleanError('VISION_ABORTED');

    return this.startFlight({ validated, requestId, signal, startedAt });
  }

  startFlight({ validated, requestId, signal, startedAt }) {
    const logBase = Object.freeze({
      requestId: safeRequestId(requestId),
      mode: validated.metadata.mode,
      byteCount: validated.image.byteLength,
      width: validated.image.width,
      height: validated.image.height,
    });
    const flight = {
      id: ++this.nextFlightId,
      state: 'RUNNING',
      startedAt,
      metadata: validated.metadata,
      frame: validated.bytes,
      logBase,
      signal,
      controller: null,
      timeoutHandle: undefined,
      externalAbortHandler: null,
      providerPromise: null,
      providerStarted: false,
      providerSettled: false,
      publicOutcome: false,
      released: false,
      resolve: null,
      reject: null,
    };

    const publicPromise = new Promise((resolve, reject) => {
      flight.resolve = resolve;
      flight.reject = reject;
    });
    this.activeFlight = flight;
    this.inFlight = true;

    try {
      flight.controller = this.createAbortController();
      if (!flight.controller || !flight.controller.signal || typeof flight.controller.abort !== 'function') {
        throw new VisionError('VISION_ABORT_UNAVAILABLE', 'abort controller is unavailable');
      }

      if (signal) {
        if (typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function') {
          throw new VisionError('VISION_ABORT_UNAVAILABLE', 'external abort signal is unavailable');
        }
        flight.externalAbortHandler = () => this.beginTerminal(flight, 'VISION_ABORTED');
        signal.addEventListener('abort', flight.externalAbortHandler, { once: true });
        if (signal.aborted) {
          this.beginTerminal(flight, 'VISION_ABORTED');
          return publicPromise;
        }
      }

      flight.timeoutHandle = this.setTimer(() => this.beginTerminal(flight, 'VISION_TIMEOUT'), this.analysisTimeoutMs);
      if (flight.state !== 'RUNNING') {
        flight.providerStarted = true;
        flight.providerSettled = true;
        this.releaseFlight(flight);
        return publicPromise;
      }

      const providerPromise = Promise.resolve().then(() => {
        if (flight.state !== 'RUNNING' || flight.controller.signal.aborted) throw cleanError('VISION_ABORTED');
        return this.analyzer({
          bytes: flight.frame,
          metadata: flight.metadata,
          signal: flight.controller.signal,
        });
      });
      flight.providerStarted = true;
      flight.providerPromise = providerPromise;
      providerPromise.then(
        value => this.settleProvider(flight, true, value),
        error => this.settleProvider(flight, false, error),
      );
    } catch (error) {
      flight.providerStarted = false;
      flight.providerSettled = true;
      this.completeFailure(flight, error, this.clock());
    }

    return publicPromise;
  }

  isOwner(flight) {
    return this.activeFlight === flight && !flight.released;
  }

  isSuccessEligible(flight) {
    return this.isOwner(flight)
      && flight.state === 'RUNNING'
      && !flight.publicOutcome
      && !flight.controller.signal.aborted;
  }

  elapsedMs(flight, completedAt) {
    return Math.max(0, Math.round(completedAt - flight.startedAt));
  }

  clearPublicHandles(flight) {
    if (flight.timeoutHandle !== undefined) {
      this.clearTimer(flight.timeoutHandle);
      flight.timeoutHandle = undefined;
    }
    if (flight.signal && flight.externalAbortHandler) {
      flight.signal.removeEventListener('abort', flight.externalAbortHandler);
      flight.externalAbortHandler = null;
    }
  }

  abortController(flight) {
    if (flight.controller && flight.controller.signal && !flight.controller.signal.aborted) {
      try {
        flight.controller.abort();
      } catch {
        // Cleanup remains idempotent even if a test double rejects abort().
      }
    }
  }

  beginTerminal(flight, code, { completedAt = this.clock(), elapsedMs = null } = {}) {
    if (!this.isOwner(flight) || flight.publicOutcome) return;
    flight.state = 'DRAINING';
    flight.publicOutcome = true;
    this.clearPublicHandles(flight);
    this.abortController(flight);
    const elapsed = elapsedMs ?? this.elapsedMs(flight, completedAt);
    const safeError = cleanError(code);
    this.log({ ...flight.logBase, outcome: safeError.code, elapsedMs: elapsed });
    flight.reject(safeError);
    if (flight.providerSettled || !flight.providerStarted) this.releaseFlight(flight);
  }

  safeProviderError(error, preserveValidation = false) {
    if (error && error.code === 'VISION_ABORTED') return cleanError('VISION_ABORTED');
    if (isAbortError(error)) return cleanError('VISION_ABORTED');
    if (preserveValidation && error && error.name === 'VisionValidationError' && typeof error.code === 'string') return error;
    return cleanError('VISION_ANALYSIS_FAILED');
  }

  settleProvider(flight, fulfilled, value) {
    if (flight.providerSettled) return;
    flight.providerSettled = true;
    flight.providerPromise = null;

    if (!this.isOwner(flight) || flight.state === 'DRAINING' || flight.publicOutcome) {
      this.releaseFlight(flight);
      return;
    }

    const completedAt = this.clock();
    const elapsedMs = this.elapsedMs(flight, completedAt);
    if (elapsedMs >= this.analysisTimeoutMs) {
      this.beginTerminal(flight, 'VISION_TIMEOUT', { completedAt, elapsedMs });
      return;
    }
    if (!this.isSuccessEligible(flight)) {
      this.beginTerminal(flight, 'VISION_ABORTED', { completedAt, elapsedMs });
      return;
    }

    if (fulfilled) {
      try {
        const observation = normalizeObservation({
          metadata: flight.metadata,
          result: value,
          observedAt: completedAt,
          analysisMs: elapsedMs,
          now: completedAt,
        });
        if (!this.isSuccessEligible(flight)) {
          this.beginTerminal(flight, 'VISION_ABORTED', { completedAt, elapsedMs });
          return;
        }
        this.store.set(observation);
        this.completeSuccess(flight, observation, completedAt, elapsedMs);
      } catch (error) {
        this.completeFailure(flight, error, completedAt, elapsedMs, true);
      }
      return;
    }
    this.completeFailure(flight, value, completedAt, elapsedMs);
  }

  completeSuccess(flight, observation, completedAt, elapsedMs) {
    if (!this.isOwner(flight) || flight.publicOutcome) return;
    flight.state = 'COMPLETING';
    flight.publicOutcome = true;
    this.clearPublicHandles(flight);
    this.abortController(flight);
    this.log({ ...flight.logBase, outcome: 'ok', elapsedMs });
    flight.resolve(observation);
    this.releaseFlight(flight);
  }

  completeFailure(flight, error, completedAt, elapsedMs = null, preserveValidation = false) {
    if (!this.isOwner(flight) || flight.publicOutcome) {
      if (flight.providerSettled && flight.state === 'DRAINING') this.releaseFlight(flight);
      return;
    }
    const elapsed = elapsedMs ?? this.elapsedMs(flight, completedAt);
    const safeError = this.safeProviderError(error, preserveValidation);
    flight.state = 'COMPLETING';
    flight.publicOutcome = true;
    this.clearPublicHandles(flight);
    this.abortController(flight);
    this.log({ ...flight.logBase, outcome: safeError.code, elapsedMs: elapsed });
    flight.reject(safeError);
    this.releaseFlight(flight);
  }

  releaseFlight(flight) {
    if (flight.released) return;
    flight.released = true;
    this.clearPublicHandles(flight);
    this.abortController(flight);
    flight.frame = null;
    flight.controller = null;
    if (this.activeFlight === flight) {
      this.activeFlight = null;
      this.inFlight = false;
    }
    flight.state = 'IDLE';
  }
}

module.exports = { VisionCoordinator };
