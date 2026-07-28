import { createVisionError, normalizeVisionError, normalizeVisionState } from '../services/visionContracts.js'

const DEFAULTS = Object.freeze({
  baseDelayMs: 5_000,
  adaptiveFactor: 1.25,
  maxDelayMs: 60_000
})

function noop() {}

function defaultStreamState() {
  return { ended: false, disconnected: false, error: false }
}

export class AdaptiveCaptureController {
  constructor({
    capture,
    analyze,
    schedule,
    cancelSchedule,
    clock = () => Date.now(),
    readVisibility = () => true,
    readStreamState = defaultStreamState,
    releaseFrame = noop,
    releaseStream = noop,
    createAbortController = () => new AbortController(),
    onStateChange = noop,
    baseDelayMs = DEFAULTS.baseDelayMs,
    adaptiveFactor = DEFAULTS.adaptiveFactor,
    maxDelayMs = DEFAULTS.maxDelayMs
  } = {}) {
    if (typeof capture !== 'function' || typeof analyze !== 'function') throw new TypeError('capture and analyze are required')
    if (typeof schedule !== 'function' || typeof cancelSchedule !== 'function') throw new TypeError('schedule and cancelSchedule are required')
    this.capture = capture
    this.analyze = analyze
    this.schedule = schedule
    this.cancelSchedule = cancelSchedule
    this.clock = clock
    this.readVisibility = readVisibility
    this.readStreamState = readStreamState
    this.releaseFrame = releaseFrame
    this.releaseStream = releaseStream
    this.createAbortController = createAbortController
    this.onStateChange = onStateChange
    this.baseDelayMs = baseDelayMs
    this.adaptiveFactor = adaptiveFactor
    this.maxDelayMs = maxDelayMs
    this.active = false
    this.inFlight = false
    this.timer = null
    this.stream = null
    this.currentFrame = null
    this.controller = null
    this.stateValue = normalizeVisionState({ status: 'idle', active: false, inFlight: false })
  }

  emit(patch) {
    this.stateValue = normalizeVisionState({ ...this.stateValue, ...patch })
    this.onStateChange(this.stateValue)
    return this.stateValue
  }

  state() {
    return this.stateValue
  }

  clearTimer() {
    if (this.timer !== null) {
      this.cancelSchedule(this.timer)
      this.timer = null
    }
  }

  abortCurrentWork() {
    if (this.controller && !this.controller.signal.aborted) this.controller.abort()
    this.controller = null
  }

  releaseCurrentFrame() {
    if (this.currentFrame !== null) this.releaseFrame(this.currentFrame)
    this.currentFrame = null
  }

  releaseCurrentStream() {
    if (this.stream !== null) this.releaseStream(this.stream)
    this.stream = null
  }

  cleanup(status, errorCode = null) {
    this.active = false
    this.clearTimer()
    this.abortCurrentWork()
    this.releaseCurrentFrame()
    this.releaseCurrentStream()
    this.emit({ status, active: false, inFlight: this.inFlight, errorCode, outcome: errorCode ?? status })
  }

  sessionIssue() {
    if (!this.readVisibility()) return { status: 'hidden', code: 'VISION_HIDDEN' }
    const streamState = this.readStreamState(this.stream) || {}
    if (streamState.ended) return { status: 'ended', code: 'VISION_STREAM_ENDED' }
    if (streamState.disconnected || streamState.connected === false) return { status: 'disconnected', code: 'VISION_DISCONNECTED' }
    if (streamState.error) return { status: 'error', code: 'VISION_ANALYSIS_FAILED' }
    return null
  }

  scheduleNext(delayMs) {
    if (!this.active) return
    this.clearTimer()
    this.emit({ status: 'active', mode: 'periodic', delayMs, active: true, inFlight: false, outcome: 'scheduled', errorCode: null })
    this.timer = this.schedule(() => {
      this.timer = null
      void this.runPeriodic()
    }, delayMs)
  }

  startPeriodic(stream) {
    if (!stream) throw createVisionError('VISION_STREAM_REQUIRED')
    this.clearTimer()
    this.abortCurrentWork()
    this.releaseCurrentStream()
    this.stream = stream
    this.active = true
    this.emit({ status: 'active', mode: 'periodic', active: true, inFlight: false, delayMs: 0, outcome: 'started', errorCode: null })
    const issue = this.sessionIssue()
    if (issue) {
      this.cleanup(issue.status, issue.code)
      return this.state()
    }
    this.scheduleNext(0)
    return this.state()
  }

  async runPeriodic() {
    if (!this.active) return { ok: false, code: 'VISION_STOPPED' }
    const issue = this.sessionIssue()
    if (issue) {
      this.cleanup(issue.status, issue.code)
      return { ok: false, code: issue.code }
    }
    if (this.inFlight) {
      this.emit({ status: 'busy', mode: 'periodic', active: true, inFlight: true, outcome: 'busy', errorCode: 'VISION_BUSY' })
      return { ok: false, code: 'VISION_BUSY' }
    }
    return this.execute('periodic', true)
  }

  async manualSnapshot() {
    if (this.inFlight) {
      this.emit({ status: 'busy', mode: 'manual', active: this.active, inFlight: true, outcome: 'busy', errorCode: 'VISION_BUSY' })
      return { ok: false, code: 'VISION_BUSY' }
    }
    if (this.active) {
      const issue = this.sessionIssue()
      if (issue) {
        this.cleanup(issue.status, issue.code)
        return { ok: false, code: issue.code }
      }
      this.clearTimer()
    }
    return this.execute('manual', this.active)
  }

  async execute(mode, reschedulePeriodic) {
    this.inFlight = true
    const startedAt = this.clock()
    const stream = this.stream
    this.controller = this.createAbortController()
    const signal = this.controller.signal
    this.emit({ status: 'analyzing', mode, active: this.active, inFlight: true, outcome: 'started', errorCode: null })
    try {
      this.currentFrame = await this.capture({ mode, stream, signal })
      const frame = this.currentFrame
      const result = await this.analyze(frame, { mode, signal })
      if (signal.aborted) throw createVisionError('VISION_ABORTED')
      if (this.active) {
        const status = result?.degraded ? 'degraded' : 'active'
        this.emit({ status, mode, active: true, inFlight: false, outcome: 'completed', errorCode: null })
      } else this.emit({ status: 'idle', mode: null, active: false, inFlight: false, outcome: 'completed', errorCode: null })
      return result
    } catch (error) {
      if (this.active) this.cleanup('error', normalizeVisionError(error).code)
      else if (this.stateValue.status !== 'stopped' && this.stateValue.status !== 'hidden' && this.stateValue.status !== 'ended' && this.stateValue.status !== 'disconnected') {
        this.emit({ status: 'error', active: false, inFlight: true, outcome: 'error', errorCode: normalizeVisionError(error).code })
      }
      if (!this.active && signal.aborted) throw error
      throw error
    } finally {
      const elapsedMs = Math.max(0, Math.round(this.clock() - startedAt))
      this.releaseCurrentFrame()
      this.inFlight = false
      this.controller = null
      if (this.stateValue.inFlight) this.emit({ ...this.stateValue, inFlight: false })
      if (this.active && reschedulePeriodic) {
        const delayMs = Math.min(this.maxDelayMs, Math.max(this.baseDelayMs, Math.ceil(elapsedMs * this.adaptiveFactor)))
        this.scheduleNext(delayMs)
      }
    }
  }

  stop() {
    if (!this.active && this.timer === null && this.stream === null && !this.inFlight) {
      this.emit({ status: 'stopped', active: false, inFlight: false, outcome: 'stopped', errorCode: null })
      return this.state()
    }
    this.cleanup('stopped')
    return this.state()
  }
}

export function createAdaptiveCaptureController(dependencies) {
  return new AdaptiveCaptureController(dependencies)
}
