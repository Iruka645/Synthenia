const PROVIDER_IDS = Object.freeze({
  JAITTS: 'jaitts-f5tts',
  VACHA: 'vachaspeech-0.6b',
});

const PROVIDER_STATES = Object.freeze([
  'not_installed',
  'loading',
  'ready',
  'busy',
  'unavailable',
  'failed',
]);

const LIMITS = Object.freeze({
  maxInputCodePoints: 1000,
  maxWaiting: 2,
  startupTimeoutMs: 180_000,
  requestTimeoutMs: 120_000,
  shutdownTimeoutMs: 5_000,
  maxOutputBytes: 25 * 1024 * 1024,
  maxOutputSeconds: 120,
  maxProtocolLineBytes: 64 * 1024,
});

const PUBLIC_MESSAGES = Object.freeze({
  TTS_INVALID_INPUT: 'TTS text must be a non-empty string of at most 1,000 Unicode code points.',
  TTS_UNKNOWN_PROVIDER: 'The requested TTS provider is not supported.',
  TTS_NOT_INSTALLED: 'The requested TTS provider is not installed.',
  TTS_INSTALL_INVALID: 'The requested TTS provider installation is not verified.',
  TTS_NOT_READY: 'The requested TTS provider is not ready.',
  TTS_BUSY: 'The neural TTS queue is full. Please try again later.',
  TTS_TIMEOUT: 'The TTS request timed out.',
  TTS_ABORTED: 'The TTS request was cancelled.',
  TTS_SHUTTING_DOWN: 'TTS is shutting down.',
  TTS_INVALID_OUTPUT: 'The TTS provider returned invalid audio.',
  TTS_SWITCH_FAILED: 'The requested TTS provider could not be activated.',
  TTS_PERSIST_FAILED: 'The TTS provider selection could not be saved.',
  SIDECAR_PROTOCOL_ERROR: 'The local TTS process returned an invalid response.',
  SIDECAR_EXITED: 'The local TTS process stopped unexpectedly.',
  SIDECAR_START_FAILED: 'The local TTS process could not start.',
  TTS_SYNTHESIS_FAILED: 'TTS synthesis failed.',
});

const HTTP_STATUS = Object.freeze({
  TTS_INVALID_INPUT: 400,
  TTS_UNKNOWN_PROVIDER: 400,
  TTS_NOT_INSTALLED: 409,
  TTS_INSTALL_INVALID: 409,
  TTS_NOT_READY: 409,
  TTS_BUSY: 429,
  TTS_TIMEOUT: 504,
  TTS_ABORTED: 408,
  TTS_SHUTTING_DOWN: 503,
  TTS_INVALID_OUTPUT: 502,
  TTS_SWITCH_FAILED: 503,
  TTS_PERSIST_FAILED: 503,
  SIDECAR_PROTOCOL_ERROR: 502,
  SIDECAR_EXITED: 502,
  SIDECAR_START_FAILED: 503,
  TTS_SYNTHESIS_FAILED: 500,
});

class TTSError extends Error {
  constructor(code, options = {}) {
    super(PUBLIC_MESSAGES[code] || PUBLIC_MESSAGES.TTS_SYNTHESIS_FAILED, options);
    this.name = 'TTSError';
    this.code = PUBLIC_MESSAGES[code] ? code : 'TTS_SYNTHESIS_FAILED';
    this.httpStatus = HTTP_STATUS[this.code] || 500;
  }
}

function toTTSError(error, fallbackCode = 'TTS_SYNTHESIS_FAILED') {
  if (error instanceof TTSError) return error;
  return new TTSError(fallbackCode, { cause: error });
}

function normalizeText(text) {
  if (typeof text !== 'string') throw new TTSError('TTS_INVALID_INPUT');
  const normalized = text.trim();
  if (!normalized || Array.from(normalized).length > LIMITS.maxInputCodePoints) {
    throw new TTSError('TTS_INVALID_INPUT');
  }
  return normalized;
}

function assertPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function normalizeSidecarResponse(value, expectedRequestId) {
  const allowed = new Set(['requestId', 'ok', 'state', 'output', 'metrics', 'error']);
  if (!assertPlainObject(value) || !hasOnlyKeys(value, allowed)) {
    throw new TTSError('SIDECAR_PROTOCOL_ERROR');
  }
  if (value.requestId !== expectedRequestId || typeof value.ok !== 'boolean') {
    throw new TTSError('SIDECAR_PROTOCOL_ERROR');
  }
  if (value.state !== undefined && !PROVIDER_STATES.includes(value.state)) {
    throw new TTSError('SIDECAR_PROTOCOL_ERROR');
  }
  if (value.output !== undefined && typeof value.output !== 'string') {
    throw new TTSError('SIDECAR_PROTOCOL_ERROR');
  }
  if (value.metrics !== undefined) {
    const metricKeys = new Set(['durationMs', 'audioDurationSeconds', 'rtf']);
    if (!assertPlainObject(value.metrics) || !hasOnlyKeys(value.metrics, metricKeys)) {
      throw new TTSError('SIDECAR_PROTOCOL_ERROR');
    }
    for (const metric of Object.values(value.metrics)) {
      if (typeof metric !== 'number' || !Number.isFinite(metric) || metric < 0) {
        throw new TTSError('SIDECAR_PROTOCOL_ERROR');
      }
    }
  }
  if (!value.ok) {
    const errorKeys = new Set(['code', 'message']);
    if (!assertPlainObject(value.error) || !hasOnlyKeys(value.error, errorKeys)
      || typeof value.error.code !== 'string') {
      throw new TTSError('SIDECAR_PROTOCOL_ERROR');
    }
  } else if (value.error !== undefined) {
    throw new TTSError('SIDECAR_PROTOCOL_ERROR');
  }
  return value;
}

module.exports = {
  PROVIDER_IDS,
  PROVIDER_STATES,
  LIMITS,
  TTSError,
  toTTSError,
  normalizeText,
  normalizeSidecarResponse,
};
