const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  LIMITS,
  TTSError,
  normalizeSidecarResponse,
} = require('./contracts');

const ENV_ALLOWLIST = new Set([
  'PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP',
  'CUDA_VISIBLE_DEVICES', 'PYTHONUTF8', 'PYTHONIOENCODING',
  'HF_HOME', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE',
  'TTS_PROVIDER_ROOT', 'TTS_MODEL_ROOT', 'TTS_CACHE_ROOT', 'TTS_AUDIO_ROOT',
  'TTS_REFERENCE_CONFIG',
  'TTS_FAKE_MODE', 'TTS_FAKE_DELAY_MS',
]);
const INHERITED_ENV_ALLOWLIST = new Set([
  'PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP',
  'CUDA_VISIBLE_DEVICES',
]);

function sanitizedEnvironment(extra = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (INHERITED_ENV_ALLOWLIST.has(key) && typeof value === 'string') env[key] = value;
  }
  for (const [key, value] of Object.entries(extra)) {
    if (!ENV_ALLOWLIST.has(key) || typeof value !== 'string') continue;
    env[key] = value;
  }
  env.PYTHONUTF8 = '1';
  env.PYTHONIOENCODING = 'utf-8';
  return env;
}

class SidecarClient {
  constructor(descriptor, options = {}) {
    this.descriptor = { ...descriptor };
    this.spawnImpl = options.spawnImpl || spawn;
    this.limits = { ...LIMITS, ...options.limits };
    this.child = null;
    this.state = 'unavailable';
    this.stdoutBuffer = '';
    this.pending = new Map();
    this.startPromise = null;
    this.stopPromise = null;
    this.lastErrorCode = null;
  }

  getStatus() {
    return {
      state: this.state,
      errorCode: this.lastErrorCode || undefined,
    };
  }

  async start() {
    if (this.state === 'ready' && this.child) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this._startInternal();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async _startInternal() {
    const command = this.descriptor.command;
    const cwd = this.descriptor.cwd;
    if (typeof command !== 'string' || !path.isAbsolute(command)
      || !fs.existsSync(command) || (cwd && (!path.isAbsolute(cwd) || !fs.existsSync(cwd)))) {
      this.state = 'not_installed';
      throw new TTSError('TTS_NOT_INSTALLED');
    }
    this.state = 'loading';
    this.lastErrorCode = null;
    this.stdoutBuffer = '';

    let child;
    try {
      child = this.spawnImpl(command, [...(this.descriptor.args || [])], {
        cwd: cwd || path.dirname(command),
        env: sanitizedEnvironment(this.descriptor.env),
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      this.state = 'failed';
      this.lastErrorCode = 'SIDECAR_START_FAILED';
      throw new TTSError('SIDECAR_START_FAILED', { cause: error });
    }
    this.child = child;
    this._attachChild(child);

    await new Promise((resolve, reject) => {
      const onSpawn = () => {
        cleanup();
        resolve();
      };
      const onError = (error) => {
        cleanup();
        reject(new TTSError('SIDECAR_START_FAILED', { cause: error }));
      };
      const cleanup = () => {
        child.off('spawn', onSpawn);
        child.off('error', onError);
      };
      child.once('spawn', onSpawn);
      child.once('error', onError);
    });

    const response = await this.request('load', {
      providerId: this.descriptor.id,
    }, { timeoutMs: this.limits.startupTimeoutMs });
    if (!response.ok || response.state !== 'ready') {
      await this.stop();
      throw new TTSError('SIDECAR_START_FAILED');
    }
    this.state = 'ready';
  }

  _attachChild(child) {
    child.stdout.on('data', (chunk) => this._handleStdout(chunk));
    child.stderr.on('data', () => {
      // Deliberately discard raw stderr: upstream errors can contain text or paths.
    });
    child.on('error', (error) => {
      if (this.child === child) this._terminate(new TTSError('SIDECAR_EXITED', { cause: error }));
    });
    child.on('close', () => this._handleExit(child));
  }

  _handleStdout(chunk) {
    this.stdoutBuffer += chunk.toString('utf8');
    if (Buffer.byteLength(this.stdoutBuffer, 'utf8') > this.limits.maxProtocolLineBytes) {
      this._protocolFailure();
      return;
    }
    let newline = this.stdoutBuffer.indexOf('\n');
    while (newline >= 0) {
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (line) this._handleLine(line);
      if (!this.child) return;
      newline = this.stdoutBuffer.indexOf('\n');
    }
  }

  _handleLine(line) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      this._protocolFailure();
      return;
    }
    if (!parsed || typeof parsed.requestId !== 'string') {
      this._protocolFailure();
      return;
    }
    const pending = this.pending.get(parsed.requestId);
    if (!pending) {
      this._protocolFailure();
      return;
    }
    let response;
    try {
      response = normalizeSidecarResponse(parsed, parsed.requestId);
    } catch {
      this._protocolFailure();
      return;
    }
    this._settlePending(parsed.requestId, () => {
      if (!response.ok) pending.reject(new TTSError(response.error.code));
      else pending.resolve(response);
    });
  }

  _protocolFailure() {
    this.lastErrorCode = 'SIDECAR_PROTOCOL_ERROR';
    this._terminate(new TTSError('SIDECAR_PROTOCOL_ERROR'));
  }

  _settlePending(requestId, settle) {
    const pending = this.pending.get(requestId);
    if (!pending) return;
    this.pending.delete(requestId);
    clearTimeout(pending.timeout);
    if (pending.signal && pending.onAbort) {
      pending.signal.removeEventListener('abort', pending.onAbort);
    }
    settle();
  }

  _terminate(error) {
    if (!this.child) {
      for (const requestId of [...this.pending.keys()]) {
        const pending = this.pending.get(requestId);
        this._settlePending(requestId, () => pending.reject(error));
      }
      return;
    }
    for (const pending of this.pending.values()) {
      if (!pending.forcedError) pending.forcedError = error;
    }
    try { this.child.kill(); } catch { /* close handler owns settlement */ }
  }

  _handleExit(child) {
    if (this.child !== child) return;
    this.child = null;
    if (this.state !== 'not_installed') this.state = 'failed';
    const defaultError = new TTSError('SIDECAR_EXITED');
    this.lastErrorCode = this.lastErrorCode || defaultError.code;
    for (const requestId of [...this.pending.keys()]) {
      const pending = this.pending.get(requestId);
      const error = pending.forcedError || defaultError;
      this._settlePending(requestId, () => pending.reject(error));
    }
  }

  request(type, payload = {}, options = {}) {
    if (!this.child || !this.child.stdin || this.child.stdin.destroyed) {
      return Promise.reject(new TTSError('TTS_NOT_READY'));
    }
    const maximumTimeout = Math.max(this.limits.requestTimeoutMs, this.limits.startupTimeoutMs);
    const timeoutMs = Math.max(1, Math.min(
      options.timeoutMs || this.limits.requestTimeoutMs,
      maximumTimeout,
    ));
    if (options.signal?.aborted) return Promise.reject(new TTSError('TTS_ABORTED'));

    const requestId = crypto.randomUUID();
    const message = JSON.stringify({ requestId, type, ...payload });
    if (Buffer.byteLength(message, 'utf8') > this.limits.maxProtocolLineBytes) {
      return Promise.reject(new TTSError('TTS_INVALID_INPUT'));
    }

    return new Promise((resolve, reject) => {
      const pending = { resolve, reject, signal: options.signal, onAbort: null, forcedError: null };
      pending.timeout = setTimeout(() => {
        pending.forcedError = new TTSError('TTS_TIMEOUT');
        this.lastErrorCode = 'TTS_TIMEOUT';
        this._terminate(pending.forcedError);
      }, timeoutMs);
      if (options.signal) {
        pending.onAbort = () => {
          pending.forcedError = new TTSError('TTS_ABORTED');
          this._terminate(pending.forcedError);
        };
        options.signal.addEventListener('abort', pending.onAbort, { once: true });
      }
      this.pending.set(requestId, pending);
      this.child.stdin.write(`${message}\n`, 'utf8', (error) => {
        if (!error) return;
        pending.forcedError = new TTSError('SIDECAR_EXITED', { cause: error });
        this._terminate(pending.forcedError);
      });
    });
  }

  async unload(timeoutMs = this.limits.shutdownTimeoutMs) {
    if (!this.child) return;
    const response = await this.request('unload', {
      providerId: this.descriptor.id,
    }, { timeoutMs });
    if (!response.ok) throw new TTSError('TTS_SWITCH_FAILED');
    this.state = 'unavailable';
  }

  async stop() {
    if (this.stopPromise) return this.stopPromise;
    this.stopPromise = this._stopInternal();
    try {
      await this.stopPromise;
    } finally {
      this.stopPromise = null;
    }
  }

  async _stopInternal() {
    const child = this.child;
    if (!child) {
      this.state = 'unavailable';
      return;
    }
    try {
      await this.request('shutdown', {}, { timeoutMs: this.limits.shutdownTimeoutMs });
    } catch {
      // A forced process stop below is the recovery boundary.
    }
    if (this.child === child) {
      try { child.kill(); } catch { /* already stopped */ }
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, this.limits.shutdownTimeoutMs);
        child.once('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    if (this.child === child) this._handleExit(child);
    this.state = 'unavailable';
    this.lastErrorCode = null;
  }
}

module.exports = {
  SidecarClient,
  sanitizedEnvironment,
};
