// These values mirror the public Phase 1 contract. Server validation remains authoritative.
export const VISION_MODES = Object.freeze(['manual', 'periodic'])

export const VISION_STATUSES = Object.freeze([
  'idle',
  'active',
  'analyzing',
  'busy',
  'degraded',
  'hidden',
  'ended',
  'disconnected',
  'stopped',
  'error'
])

const ERROR_DEFINITIONS = Object.freeze({
  VISION_BUSY: { message: 'Screen analysis is already running.', retryable: true },
  VISION_TIMEOUT: { message: 'Screen analysis timed out.', retryable: true },
  VISION_ABORTED: { message: 'Screen analysis was stopped.', retryable: true },
  VISION_HIDDEN: { message: 'Screen analysis stopped while the page was hidden.', retryable: true },
  VISION_STREAM_ENDED: { message: 'The selected screen source ended.', retryable: true },
  VISION_DISCONNECTED: { message: 'The selected screen source disconnected.', retryable: true },
  VISION_ANALYSIS_FAILED: { message: 'Screen analysis is unavailable.', retryable: true },
  VISION_INVALID_IMAGE: { message: 'The selected image could not be analyzed.', retryable: false },
  VISION_INVALID_CONTRACT: { message: 'Screen analysis request was invalid.', retryable: false }
})

export function isVisionMode(value) {
  return VISION_MODES.includes(value)
}

export function normalizeVisionError(error) {
  const code = typeof error?.code === 'string' && ERROR_DEFINITIONS[error.code]
    ? error.code
    : 'VISION_ANALYSIS_FAILED'
  const definition = ERROR_DEFINITIONS[code]
  return Object.freeze({
    code,
    message: definition.message,
    retryable: definition.retryable
  })
}

export function normalizeVisionState(state = {}) {
  const status = VISION_STATUSES.includes(state.status) ? state.status : 'idle'
  const mode = isVisionMode(state.mode) ? state.mode : null
  const delayMs = Number.isInteger(state.delayMs) && state.delayMs >= 0 ? state.delayMs : null
  const error = state.errorCode ? normalizeVisionError({ code: state.errorCode }) : null
  return Object.freeze({
    status,
    mode,
    active: Boolean(state.active),
    inFlight: Boolean(state.inFlight),
    delayMs,
    outcome: typeof state.outcome === 'string' ? state.outcome : null,
    errorCode: error?.code ?? null
  })
}

export function createVisionError(code) {
  const error = new Error(code)
  error.code = code
  return error
}
