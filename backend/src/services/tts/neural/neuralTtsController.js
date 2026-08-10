const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { SidecarClient } = require('./sidecarClient');
const {
  validateAndPublish,
  removeOutput,
  DEFAULT_AUDIO_ROOT,
} = require('./outputValidator');
const {
  DEFAULT_STAGING_ROOT,
  PublishedAudioStore,
  publishedAudioStore,
} = require('./publishedAudioStore');
const {
  LIMITS,
  TTSError,
  toTTSError,
  normalizeText,
} = require('./contracts');
const { DEFAULT_DESCRIPTORS } = require('./providerDescriptors');

class NeuralTTSController {
  constructor(options = {}) {
    this.audioRoot = path.resolve(options.audioRoot || DEFAULT_AUDIO_ROOT);
    const customStagingRoot = path.join(
      path.dirname(this.audioRoot),
      `${path.basename(this.audioRoot)}-staging`,
      'neural',
    );
    this.stagingRoot = path.resolve(options.stagingRoot
      || (this.audioRoot === DEFAULT_AUDIO_ROOT ? DEFAULT_STAGING_ROOT : customStagingRoot));
    this.limits = { ...LIMITS, ...options.limits };
    this.clientFactory = options.clientFactory
      || ((descriptor) => new SidecarClient(descriptor, { limits: this.limits }));
    this.publishedStore = options.publishedStore
      || (this.audioRoot === DEFAULT_AUDIO_ROOT && this.stagingRoot === DEFAULT_STAGING_ROOT
        ? publishedAudioStore
        : new PublishedAudioStore({
          publishedRoot: this.audioRoot,
          stagingRoot: this.stagingRoot,
          limits: this.limits,
        }));
    if (options.outputPublisher) {
      this.outputPublisher = options.outputPublisher;
    } else if (options.outputValidator) {
      // Compatibility seam for model-free controller unit tests.
      this.outputPublisher = async (filename, publishOptions) => {
        await options.outputValidator(filename, {
          audioRoot: publishOptions.stagingRoot,
          limits: publishOptions.limits,
        });
        return { filename };
      };
    } else {
      this.outputPublisher = validateAndPublish;
    }
    this.requiresStagingDirectory = !options.outputValidator;
    this.outputRemover = options.outputRemover || removeOutput;
    this.publicationHooks = options.publicationHooks;
    this.registry = new Map();
    this.states = new Map();
    this.activeProviderId = null;
    this.client = null;
    this.activeJob = null;
    this.queue = [];
    this.switching = false;
    this.transitionCount = 0;
    this.shuttingDown = false;
    this.switchChain = Promise.resolve();
    for (const descriptor of options.descriptors || DEFAULT_DESCRIPTORS) {
      this.registerProvider(descriptor);
    }
  }

  registerProvider(descriptor) {
    if (!descriptor || typeof descriptor.id !== 'string' || typeof descriptor.label !== 'string') {
      throw new TypeError('Neural provider descriptor requires id and label.');
    }
    this.registry.set(descriptor.id, { ...descriptor });
    const installation = this._getInstallState(descriptor);
    this.states.set(descriptor.id, {
      state: installation.state,
      errorCode: installation.errorCode,
    });
  }

  isNeuralProvider(providerId) {
    return this.registry.has(providerId);
  }

  _isInstalled(descriptor) {
    return this._getInstallState(descriptor).installed;
  }

  _getInstallState(descriptor) {
    try {
      if (typeof descriptor.getInstallState === 'function') {
        const result = descriptor.getInstallState();
        if (!result || typeof result.installed !== 'boolean'
          || !['not_installed', 'unavailable'].includes(result.state)) {
          throw new TypeError('Invalid install state.');
        }
        return {
          installed: result.installed,
          state: result.installed ? 'unavailable' : result.state,
          errorCode: result.errorCode,
        };
      }
      if (typeof descriptor.isInstalled === 'function') {
        const installed = descriptor.isInstalled() === true;
        return { installed, state: installed ? 'unavailable' : 'not_installed' };
      }
      const installed = typeof descriptor.command === 'string' && path.isAbsolute(descriptor.command);
      return { installed, state: installed ? 'unavailable' : 'not_installed' };
    } catch {
      return { installed: false, state: 'unavailable', errorCode: 'TTS_INSTALL_INVALID' };
    }
  }

  _runtimeDescriptor(descriptor) {
    return {
      ...descriptor,
      env: {
        ...(descriptor.env || {}),
        TTS_AUDIO_ROOT: this.stagingRoot,
      },
    };
  }

  _setState(providerId, state, errorCode) {
    if (!this.registry.has(providerId)) return;
    this.states.set(providerId, { state, errorCode });
  }

  getStatus(providerId) {
    const descriptor = this.registry.get(providerId);
    if (!descriptor) throw new TTSError('TTS_UNKNOWN_PROVIDER');
    const dynamic = this.states.get(providerId) || {};
    const installation = this._getInstallState(descriptor);
    let state = dynamic.state;
    if (!['loading', 'ready', 'busy', 'failed'].includes(state)) {
      state = installation.state;
      dynamic.errorCode = installation.errorCode;
    }
    return {
      id: descriptor.id,
      label: descriptor.label,
      state,
      installed: installation.installed,
      active: this.activeProviderId === providerId && ['ready', 'busy'].includes(state),
      errorCode: dynamic.errorCode || undefined,
    };
  }

  getStatuses() {
    return [...this.registry.keys()].map((id) => this.getStatus(id));
  }

  async switchTo(providerId) {
    this.transitionCount += 1;
    this.switching = true;
    const operation = this.switchChain.then(
      () => this._switchToInternal(providerId),
      () => this._switchToInternal(providerId),
    );
    const run = operation.finally(() => {
      this.transitionCount -= 1;
      this.switching = this.transitionCount > 0;
    });
    this.switchChain = run.catch(() => {});
    return run;
  }

  async _switchToInternal(providerId) {
    if (this.shuttingDown) throw new TTSError('TTS_SHUTTING_DOWN');
    const target = this.registry.get(providerId);
    if (!target) throw new TTSError('TTS_UNKNOWN_PROVIDER');
    const installation = this._getInstallState(target);
    if (!installation.installed) {
      const code = installation.errorCode || 'TTS_NOT_INSTALLED';
      this._setState(providerId, installation.state, code);
      throw new TTSError(code);
    }
    if (this.activeProviderId === providerId && this.client?.state === 'ready') return providerId;

    const previousId = this.activeProviderId;
    const previousDescriptor = previousId ? this.registry.get(previousId) : null;
    this._setState(providerId, 'loading');
    try {
      if (this.requiresStagingDirectory) {
        await fs.promises.mkdir(this.stagingRoot, { recursive: true });
      }
      await this._waitForDrain(this.limits.startupTimeoutMs);
      if (this.client) await this._stopClient(this.client);
      this.client = null;
      this.activeProviderId = null;
      if (previousId) this._setState(previousId, 'unavailable');

      const targetClient = this.clientFactory(this._runtimeDescriptor(target));
      this.client = targetClient;
      await targetClient.start();
      this.activeProviderId = providerId;
      this._setState(providerId, 'ready');
      return providerId;
    } catch (error) {
      const failedClient = this.client;
      this.client = null;
      this.activeProviderId = null;
      if (failedClient) await this._stopClient(failedClient);
      this._setState(providerId, 'failed', toTTSError(error, 'TTS_SWITCH_FAILED').code);

      if (previousDescriptor && this._isInstalled(previousDescriptor)) {
        try {
          const restored = this.clientFactory(this._runtimeDescriptor(previousDescriptor));
          await restored.start();
          this.client = restored;
          this.activeProviderId = previousId;
          this._setState(previousId, 'ready');
        } catch (restoreError) {
          this.client = null;
          this.activeProviderId = null;
          this._setState(previousId, 'failed', toTTSError(restoreError, 'TTS_SWITCH_FAILED').code);
        }
      }
      throw toTTSError(error, 'TTS_SWITCH_FAILED');
    }
  }

  async deactivate() {
    this.transitionCount += 1;
    this.switching = true;
    const operation = this.switchChain.then(
      () => this._deactivateInternal(),
      () => this._deactivateInternal(),
    );
    const run = operation.finally(() => {
      this.transitionCount -= 1;
      this.switching = this.transitionCount > 0;
    });
    this.switchChain = run.catch(() => {});
    return run;
  }

  async _deactivateInternal() {
    await this._waitForDrain(this.limits.startupTimeoutMs);
    const previousId = this.activeProviderId;
    if (this.client) await this._stopClient(this.client);
    this.client = null;
    this.activeProviderId = null;
    if (previousId) this._setState(previousId, 'unavailable');
  }

  async _stopClient(client) {
    try { await client.unload(this.limits.shutdownTimeoutMs); } catch { /* force stop follows */ }
    try { await client.stop(); } catch { /* isolated child failure */ }
  }

  async _waitForDrain(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (this.activeJob || this.queue.length > 0) {
      if (Date.now() >= deadline) throw new TTSError('TTS_TIMEOUT');
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  async synthesize(providerId, text, options = {}) {
    const normalizedText = normalizeText(text);
    if (this.shuttingDown) return Promise.reject(new TTSError('TTS_SHUTTING_DOWN'));
    if (this.switching || providerId !== this.activeProviderId
      || !this.client || !['ready', 'busy'].includes(this.states.get(providerId)?.state)) {
      return Promise.reject(new TTSError('TTS_NOT_READY'));
    }
    if (options.signal?.aborted) return Promise.reject(new TTSError('TTS_ABORTED'));
    if (this.activeJob && this.queue.length >= this.limits.maxWaiting) {
      return Promise.reject(new TTSError('TTS_BUSY'));
    }

    return new Promise((resolve, reject) => {
      const job = {
        providerId,
        text: normalizedText,
        signal: options.signal,
        deadline: Date.now() + this.limits.requestTimeoutMs,
        resolve,
        reject,
        settled: false,
        abortListener: null,
      };
      if (job.signal) {
        job.abortListener = () => {
          if (this.activeJob === job) return;
          const index = this.queue.indexOf(job);
          if (index >= 0) this.queue.splice(index, 1);
          this._settleJob(job, null, new TTSError('TTS_ABORTED'));
        };
        job.signal.addEventListener('abort', job.abortListener, { once: true });
      }
      this.queue.push(job);
      this._pump();
    });
  }

  _settleJob(job, value, error) {
    if (job.settled) return;
    job.settled = true;
    if (job.signal && job.abortListener) {
      job.signal.removeEventListener('abort', job.abortListener);
    }
    if (error) job.reject(error);
    else job.resolve(value);
  }

  _pump() {
    if (this.activeJob || this.shuttingDown) return;
    const job = this.queue.shift();
    if (!job) return;
    if (Date.now() >= job.deadline) {
      this._settleJob(job, null, new TTSError('TTS_TIMEOUT'));
      queueMicrotask(() => this._pump());
      return;
    }
    this.activeJob = job;
    this._setState(job.providerId, 'busy');
    this._runJob(job)
      .then((filename) => this._settleJob(job, filename, null))
      .catch((error) => this._settleJob(job, null, error))
      .finally(() => {
        this.activeJob = null;
        if (this.activeProviderId === job.providerId && !this.switching && !this.shuttingDown) {
          if (this.client?.state === 'ready') this._setState(job.providerId, 'ready');
          else this._setState(job.providerId, 'failed', this.client?.lastErrorCode || 'SIDECAR_EXITED');
        }
        this._pump();
      });
  }

  _newOutputName(providerId) {
    const safeProvider = providerId.replace(/[^a-z0-9-]/g, '');
    return `tts_${safeProvider}_${crypto.randomUUID()}.wav`;
  }

  async _runJob(job) {
    const outputName = this._newOutputName(job.providerId);
    let attempt = 0;
    try {
      while (attempt < 2) {
        const remaining = job.deadline - Date.now();
        if (remaining <= 0) throw new TTSError('TTS_TIMEOUT');
        try {
          const response = await this.client.request('synthesize', {
            providerId: job.providerId,
            text: job.text,
            outputName,
          }, { timeoutMs: remaining, signal: job.signal });
          if (response.output !== outputName) throw new TTSError('TTS_INVALID_OUTPUT');
          const published = await this.outputPublisher(outputName, {
            stagingRoot: this.stagingRoot,
            publishedRoot: this.audioRoot,
            limits: this.limits,
            registerPublished: (meta) => this.publishedStore.register(meta),
            testHooks: this.publicationHooks,
          });
          if (!published || typeof published.filename !== 'string') {
            throw new TTSError('TTS_INVALID_OUTPUT');
          }
          return published.filename;
        } catch (error) {
          const normalized = toTTSError(error);
          await this.outputRemover(outputName, { audioRoot: this.stagingRoot });
          const restartable = ['SIDECAR_EXITED', 'SIDECAR_PROTOCOL_ERROR', 'SIDECAR_START_FAILED']
            .includes(normalized.code);
          if (attempt === 0 && restartable && Date.now() < job.deadline && !job.signal?.aborted) {
            attempt += 1;
            await this._restartActive(job.providerId);
            continue;
          }
          throw normalized;
        }
      }
      throw new TTSError('TTS_SYNTHESIS_FAILED');
    } catch (error) {
      await this.outputRemover(outputName, { audioRoot: this.stagingRoot });
      throw error;
    }
  }

  async _restartActive(providerId) {
    const descriptor = this.registry.get(providerId);
    if (!descriptor || providerId !== this.activeProviderId) throw new TTSError('TTS_NOT_READY');
    const previous = this.client;
    this._setState(providerId, 'loading');
    if (previous) await this._stopClient(previous);
    const replacement = this.clientFactory(this._runtimeDescriptor(descriptor));
    this.client = replacement;
    try {
      await replacement.start();
    } catch (error) {
      await this._stopClient(replacement);
      this._setState(providerId, 'failed', toTTSError(error, 'SIDECAR_START_FAILED').code);
      throw error;
    }
    this._setState(providerId, 'busy');
  }

  async shutdown() {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.switching = true;
    for (const job of this.queue.splice(0)) {
      this._settleJob(job, null, new TTSError('TTS_SHUTTING_DOWN'));
    }
    if (this.client) await this.client.stop().catch(() => {});
    const deadline = Date.now() + this.limits.shutdownTimeoutMs;
    while (this.activeJob && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    if (this.activeJob) {
      this._settleJob(this.activeJob, null, new TTSError('TTS_SHUTTING_DOWN'));
      this.activeJob = null;
    }
    const previousId = this.activeProviderId;
    this.client = null;
    this.activeProviderId = null;
    if (previousId) this._setState(previousId, 'unavailable');
    await this.publishedStore.cleanup({ stagingCutoff: Date.now() + 1 }).catch(() => {});
    await this.publishedStore.shutdown().catch(() => {});
  }
}

const neuralTtsController = new NeuralTTSController();

module.exports = neuralTtsController;
module.exports.NeuralTTSController = NeuralTTSController;
module.exports.DEFAULT_DESCRIPTORS = DEFAULT_DESCRIPTORS;
