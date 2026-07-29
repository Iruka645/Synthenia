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

function once(callback) {
  let called = false
  return (...args) => {
    if (called) return
    called = true
    callback(...args)
  }
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
    this.generation = 0
    this.runSequence = 0
    this.timer = null
    this.session = null
    this.activeRun = null
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
    const record = this.timer
    if (!record) return
    this.timer = null
    record.canceled = true
    if (record.handle !== null) this.cancelSchedule(record.handle)
  }

  createSession(stream, generation) {
    const releaseStreamOnce = once(() => this.releaseStream(stream))
    return { stream, generation, releaseStreamOnce }
  }

  sessionIssue(stream) {
    if (!this.readVisibility()) return { status: 'hidden', code: 'VISION_HIDDEN' }
    const streamState = this.readStreamState(stream) || {}
    if (streamState.ended) return { status: 'ended', code: 'VISION_STREAM_ENDED' }
    if (streamState.disconnected || streamState.connected === false) return { status: 'disconnected', code: 'VISION_DISCONNECTED' }
    if (streamState.error) return { status: 'error', code: 'VISION_ANALYSIS_FAILED' }
    return null
  }

  isCurrentRun(run) {
    return this.activeRun === run && run.generation === this.generation && !run.invalidated && !run.signal.aborted
  }

  invalidateGeneration(status, errorCode = null) {
    const oldGeneration = this.generation
    this.generation += 1
    this.active = false
    this.clearTimer()

    const run = this.activeRun
    if (run && run.generation === oldGeneration) {
      run.invalidated = true
      run.abortOnce()
      run.releaseFrameOnce()
    }
    if (this.session && this.session.generation === oldGeneration) this.session.releaseStreamOnce()
    this.session = null

    this.emit({
      status,
      active: false,
      inFlight: this.inFlight,
      outcome: errorCode ?? status,
      errorCode
    })
  }

  scheduleNext(delayMs) {
    if (!this.active || !this.session) return
    const generation = this.generation
    this.clearTimer()
    this.emit({ status: 'active', mode: 'periodic', delayMs, active: true, inFlight: false, outcome: 'scheduled', errorCode: null })
    const record = { generation, handle: null, canceled: false }
    const callback = () => {
      if (this.timer === record) this.timer = null
      if (record.canceled || generation !== this.generation || !this.active || !this.session || this.session.generation !== generation) return
      void this.runPeriodic()
    }
    record.handle = this.schedule(callback, delayMs)
    if (record.canceled) this.cancelSchedule(record.handle)
    else this.timer = record
  }

  startPeriodic(stream) {
    if (!stream) throw createVisionError('VISION_STREAM_REQUIRED')
    if (this.inFlight) {
      this.emit({ status: 'busy', mode: 'periodic', active: this.active, inFlight: true, outcome: 'busy', errorCode: 'VISION_BUSY' })
      return this.state()
    }

    this.clearTimer()
    if (this.session) this.session.releaseStreamOnce()
    this.session = null
    this.generation += 1
    const generation = this.generation
    this.session = this.createSession(stream, generation)
    this.active = true
    this.emit({ status: 'active', mode: 'periodic', active: true, inFlight: false, delayMs: 0, outcome: 'started', errorCode: null })
    const issue = this.sessionIssue(stream)
    if (issue) {
      this.invalidateGeneration(issue.status, issue.code)
      return this.state()
    }
    this.scheduleNext(0)
    return this.state()
  }

  async runPeriodic() {
    if (!this.active || !this.session) return { ok: false, code: 'VISION_STOPPED' }
    if (this.inFlight) {
      this.emit({ status: 'busy', mode: 'periodic', active: true, inFlight: true, outcome: 'busy', errorCode: 'VISION_BUSY' })
      return { ok: false, code: 'VISION_BUSY' }
    }
    const issue = this.sessionIssue(this.session.stream)
    if (issue) {
      this.invalidateGeneration(issue.status, issue.code)
      return { ok: false, code: issue.code }
    }
    return this.execute('periodic', true)
  }

  async manualSnapshot() {
    if (this.inFlight) {
      this.emit({ status: 'busy', mode: 'manual', active: this.active, inFlight: true, outcome: 'busy', errorCode: 'VISION_BUSY' })
      return { ok: false, code: 'VISION_BUSY' }
    }
    if (this.active) {
      const issue = this.sessionIssue(this.session.stream)
      if (issue) {
        this.invalidateGeneration(issue.status, issue.code)
        return { ok: false, code: issue.code }
      }
      this.clearTimer()
    }
    return this.execute('manual', this.active)
  }

  makeRun(mode, reschedulePeriodic) {
    const controller = this.createAbortController()
    if (!controller || !controller.signal || typeof controller.abort !== 'function') throw createVisionError('VISION_ABORT_UNAVAILABLE')
    const session = this.session
    const run = {
      id: ++this.runSequence,
      generation: this.generation,
      mode,
      reschedulePeriodic,
      session,
      stream: session?.stream ?? null,
      controller,
      signal: controller.signal,
      frame: null,
      frameOwned: false,
      invalidated: false,
      scheduled: false,
      abortOnce: once(() => controller.abort()),
      releaseFrameOnce: null
    }
    let frameReleased = false
    run.releaseFrameOnce = () => {
      if (frameReleased || !run.frameOwned) return
      frameReleased = true
      this.releaseFrame(run.frame)
      run.frame = null
    }
    return run
  }

  ensureRunValid(run) {
    if (!this.isCurrentRun(run)) throw createVisionError('VISION_ABORTED')
    if (!this.readVisibility()) {
      this.invalidateGeneration('hidden', 'VISION_HIDDEN')
      throw createVisionError('VISION_HIDDEN')
    }
    if (run.stream) {
      const streamState = this.readStreamState(run.stream) || {}
      let streamIssue = null
      if (streamState.ended) streamIssue = { status: 'ended', code: 'VISION_STREAM_ENDED' }
      else if (streamState.disconnected || streamState.connected === false) streamIssue = { status: 'disconnected', code: 'VISION_DISCONNECTED' }
      else if (streamState.error) streamIssue = { status: 'error', code: 'VISION_ANALYSIS_FAILED' }
      if (streamIssue) {
        this.invalidateGeneration(streamIssue.status, streamIssue.code)
        throw createVisionError(streamIssue.code)
      }
    }
  }

  async execute(mode, reschedulePeriodic) {
    const run = this.makeRun(mode, reschedulePeriodic)
    this.activeRun = run
    this.inFlight = true
    const startedAt = this.clock()
    this.emit({ status: 'analyzing', mode, active: this.active, inFlight: true, outcome: 'started', errorCode: null })
    try {
      this.ensureRunValid(run)
      const frame = await this.capture({ mode, stream: run.stream, signal: run.signal })
      run.frame = frame
      run.frameOwned = true
      this.ensureRunValid(run)
      const result = await this.analyze(frame, { mode, signal: run.signal })
      this.ensureRunValid(run)
      if (this.active && run.generation === this.generation) {
        const status = result?.degraded ? 'degraded' : 'active'
        this.emit({ status, mode, active: true, inFlight: false, outcome: 'completed', errorCode: null })
      } else if (run.generation === this.generation) {
        this.emit({ status: 'idle', mode: null, active: false, inFlight: false, outcome: 'completed', errorCode: null })
      }
      return result
    } catch (error) {
      const normalized = normalizeVisionError(error)
      const current = this.isCurrentRun(run)
      if (current) {
        this.invalidateGeneration('error', normalized.code)
      }
      throw createVisionError(normalized.code)
    } finally {
      const elapsedMs = Math.max(0, Math.round(this.clock() - startedAt))
      const canReschedule = this.activeRun === run
        && run.generation === this.generation
        && !run.invalidated
        && !run.signal.aborted
        && this.active
      run.releaseFrameOnce()
      if (this.activeRun === run) {
        this.activeRun = null
        this.inFlight = false
        if (run.invalidated) this.emit({ inFlight: false })
      }
      if (canReschedule && reschedulePeriodic && !run.scheduled) {
        run.scheduled = true
        const delayMs = Math.min(this.maxDelayMs, Math.max(this.baseDelayMs, Math.ceil(elapsedMs * this.adaptiveFactor)))
        this.scheduleNext(delayMs)
      }
    }
  }

  stop() {
    const hasCurrentRun = this.activeRun && this.activeRun.generation === this.generation
    if (this.active || this.timer || this.session || hasCurrentRun) {
      this.invalidateGeneration('stopped')
      return this.state()
    }
    this.emit({ status: 'stopped', active: false, inFlight: this.inFlight, outcome: 'stopped', errorCode: null })
    return this.state()
  }
}

export function createAdaptiveCaptureController(dependencies) {
  return new AdaptiveCaptureController(dependencies)
}
