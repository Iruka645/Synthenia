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
    this.inFlight = false;
  }

  log(fields) {
    const payload = Object.freeze({ ...fields });
    if (typeof this.logger === 'function') this.logger(payload);
    else if (this.logger && typeof this.logger.info === 'function') this.logger.info(payload);
  }

  async analyze({ bytes, metadata, requestId, signal } = {}) {
    if (this.inFlight) throw new VisionError('VISION_BUSY', 'vision analysis is already in flight', { retryable: true });
    const startedAt = this.clock();
    const validated = validateCaptureRequest({ bytes, metadata, now: startedAt });
    this.inFlight = true;
    let frame = validated.bytes;
    let controller;
    let timeoutHandle;
    let externalAbortHandler;
    let timedOut = false;
    const logBase = {
      requestId: safeRequestId(requestId),
      mode: validated.metadata.mode,
      byteCount: validated.image.byteLength,
      width: validated.image.width,
      height: validated.image.height,
    };

    try {
      controller = this.createAbortController();
      if (!controller || !controller.signal || typeof controller.abort !== 'function') {
        throw new VisionError('VISION_ABORT_UNAVAILABLE', 'abort controller is unavailable');
      }

      let rejectAbort;
      const abortPromise = new Promise((_, reject) => { rejectAbort = reject; });
      if (signal) {
        if (signal.aborted) {
          controller.abort();
          rejectAbort(new VisionError('VISION_ABORTED', 'vision analysis was aborted', { retryable: true }));
        } else {
          externalAbortHandler = () => {
            controller.abort();
            rejectAbort(new VisionError('VISION_ABORTED', 'vision analysis was aborted', { retryable: true }));
          };
          signal.addEventListener('abort', externalAbortHandler, { once: true });
        }
      }

      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = this.setTimer(() => {
          timedOut = true;
          controller.abort();
          reject(new VisionError('VISION_TIMEOUT', 'vision analysis timed out', { retryable: true }));
        }, this.analysisTimeoutMs);
      });
      const analysisPromise = Promise.resolve().then(() => this.analyzer({
        bytes: frame,
        metadata: validated.metadata,
        signal: controller.signal,
      }));
      const providerResult = await Promise.race([analysisPromise, timeoutPromise, abortPromise]);
      const analysisMs = Math.max(0, Math.round(this.clock() - startedAt));
      const observation = normalizeObservation({
        metadata: validated.metadata,
        result: providerResult,
        observedAt: this.clock(),
        analysisMs,
        now: this.clock(),
      });
      this.store.set(observation);
      this.log({ ...logBase, outcome: 'ok', elapsedMs: analysisMs });
      return observation;
    } catch (error) {
      const elapsedMs = Math.max(0, Math.round(this.clock() - startedAt));
      let safeError;
      if (timedOut || (error && error.code === 'VISION_TIMEOUT')) {
        safeError = new VisionError('VISION_TIMEOUT', 'vision analysis timed out', { retryable: true });
      } else if (error && error.code === 'VISION_ABORTED') {
        safeError = error;
      } else if (isAbortError(error)) {
        safeError = new VisionError('VISION_ABORTED', 'vision analysis was aborted', { retryable: true });
      } else if (error && error.code && error.name === 'VisionValidationError') {
        safeError = error;
      } else if (error && error.code === 'VISION_BUSY') {
        safeError = error;
      } else {
        safeError = new VisionError('VISION_ANALYSIS_FAILED', 'vision analysis failed', { retryable: true });
      }
      this.log({ ...logBase, outcome: safeError.code, elapsedMs });
      throw safeError;
    } finally {
      if (timeoutHandle !== undefined) this.clearTimer(timeoutHandle);
      if (signal && externalAbortHandler) signal.removeEventListener('abort', externalAbortHandler);
      if (controller && controller.signal && !controller.signal.aborted) controller.abort();
      frame = null;
      this.inFlight = false;
    }
  }
}

module.exports = { VisionCoordinator };
