import test from 'node:test'
import assert from 'node:assert/strict'
import { AdaptiveCaptureController } from '../src/utils/adaptiveCaptureController.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function createHarness(overrides = {}) {
  const scheduled = []
  const delays = []
  const canceled = []
  const states = []
  let current = 0
  const options = {
    capture: async () => ({ frame: true }),
    analyze: async () => ({ summary: 'safe observation' }),
    schedule: (callback, delay) => {
      const handle = { callback }
      scheduled.push(handle)
      delays.push(delay)
      return handle
    },
    cancelSchedule: handle => canceled.push(handle),
    clock: () => current,
    readVisibility: () => true,
    readStreamState: () => ({ ended: false, disconnected: false, error: false }),
    onStateChange: state => states.push(state),
    ...overrides
  }
  return {
    controller: new AdaptiveCaptureController(options),
    scheduled,
    delays,
    canceled,
    states,
    setTime: value => { current = value }
  }
}

test('periodic ticks and manual snapshots share one in-flight slot without a queue', async () => {
  const captureDeferred = deferred()
  const analyzeDeferred = deferred()
  let captureCalls = 0
  let analyzeCalls = 0
  const harness = createHarness({
    capture: () => { captureCalls += 1; return captureDeferred.promise },
    analyze: () => { analyzeCalls += 1; return analyzeDeferred.promise }
  })
  harness.controller.startPeriodic({ id: 'stream' })
  const periodic = harness.controller.runPeriodic()
  await new Promise(resolve => queueMicrotask(resolve))
  assert.equal(captureCalls, 1)
  assert.deepEqual(await harness.controller.runPeriodic(), { ok: false, code: 'VISION_BUSY' })
  assert.deepEqual(await harness.controller.manualSnapshot(), { ok: false, code: 'VISION_BUSY' })
  captureDeferred.resolve({ frame: true })
  await new Promise(resolve => queueMicrotask(resolve))
  assert.equal(analyzeCalls, 1)
  analyzeDeferred.resolve({ summary: 'safe observation' })
  await periodic
  assert.equal(analyzeCalls, 1)
  assert.equal(harness.scheduled.length, 2)
})

test('adaptive delay clamps at the five-second minimum, scales normally, and caps at one minute', async () => {
  for (const [elapsed, expected] of [[1_000, 5_000], [10_000, 12_500], [100_000, 60_000]]) {
    const times = [0, elapsed]
    const harness = createHarness({
      clock: () => times.shift() ?? elapsed,
      capture: async () => ({ frame: true }),
      analyze: async () => ({ summary: 'safe' })
    })
    harness.controller.startPeriodic({ id: 'stream' })
    await harness.controller.runPeriodic()
    assert.equal(harness.delays.at(-1), expected)
  }
})

test('stop aborts work, releases frame and stream references, cancels scheduling, and does not reschedule', async () => {
  const analyzeDeferred = deferred()
  let capturedSignal
  const releasedFrames = []
  const releasedStreams = []
  const harness = createHarness({
    capture: async ({ signal }) => {
      capturedSignal = signal
      return { frame: 'secret frame' }
    },
    analyze: () => analyzeDeferred.promise,
    releaseFrame: frame => releasedFrames.push(frame),
    releaseStream: stream => releasedStreams.push(stream)
  })
  const stream = { id: 'stream' }
  harness.controller.startPeriodic(stream)
  const running = harness.controller.runPeriodic()
  await new Promise(resolve => queueMicrotask(resolve))
  harness.controller.stop()
  assert.equal(capturedSignal.aborted, true)
  assert.deepEqual(releasedFrames, [{ frame: 'secret frame' }])
  assert.deepEqual(releasedStreams, [stream])
  analyzeDeferred.resolve({ summary: 'late result' })
  await assert.rejects(running, error => error.code === 'VISION_ABORTED')
  assert.equal(harness.scheduled.length, 1)
  assert.equal(harness.canceled.length, 1)
  assert.equal(harness.controller.state().status, 'stopped')
})

test('hidden, ended, disconnected, and error states clean up before scheduling', () => {
  for (const issue of [
    { status: 'hidden', state: { visible: false } },
    { status: 'ended', state: { ended: true } },
    { status: 'disconnected', state: { connected: false } },
    { status: 'error', state: { error: true } }
  ]) {
    const harness = createHarness({
      readVisibility: () => issue.state.visible !== false,
      readStreamState: () => issue.state
    })
    harness.controller.startPeriodic({ id: issue.status })
    assert.equal(harness.scheduled.length, 0)
    assert.equal(harness.controller.state().status, issue.status)
  }
})

test('manual snapshot works while periodic mode is off and state callbacks remain payload-free', async () => {
  const states = []
  const harness = createHarness({ onStateChange: state => states.push(state) })
  const result = await harness.controller.manualSnapshot()
  assert.deepEqual(result, { summary: 'safe observation' })
  assert.equal(harness.controller.state().status, 'idle')
  assert.equal(JSON.stringify(states).includes('safe observation'), false)
})

test('sessionless manual runs stop on hidden capture and analyze boundaries', async () => {
  for (const boundary of ['capture', 'analyze']) {
    const captureDeferred = deferred()
    const analyzeDeferred = deferred()
    const states = []
    const releasedFrames = []
    const releasedStreams = []
    let visible = true
    let capturedSignal
    let abortCalls = 0
    let analyzeCalls = 0
    const harness = createHarness({
      capture: ({ signal }) => {
        capturedSignal = signal
        return captureDeferred.promise
      },
      analyze: () => {
        analyzeCalls += 1
        return analyzeDeferred.promise
      },
      readVisibility: () => visible,
      releaseFrame: frame => releasedFrames.push(frame),
      releaseStream: stream => releasedStreams.push(stream),
      createAbortController: () => {
        const controller = new AbortController()
        const abort = controller.abort.bind(controller)
        controller.abort = () => {
          abortCalls += 1
          abort()
        }
        return controller
      },
      onStateChange: state => states.push(state)
    })
    const running = harness.controller.manualSnapshot()
    await new Promise(resolve => queueMicrotask(resolve))
    if (boundary === 'capture') {
      visible = false
      captureDeferred.resolve({ frame: 'manual-hidden-frame' })
    } else {
      captureDeferred.resolve({ frame: 'manual-hidden-frame' })
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(analyzeCalls, 1)
      visible = false
      analyzeDeferred.resolve({ summary: 'late result' })
    }
    await assert.rejects(running, error => error.code === 'VISION_HIDDEN')
    assert.equal(analyzeCalls, boundary === 'capture' ? 0 : 1)
    assert.deepEqual(releasedFrames, [{ frame: 'manual-hidden-frame' }])
    assert.deepEqual(releasedStreams, [])
    assert.equal(abortCalls, 1)
    assert.equal(capturedSignal.aborted, true)
    assert.equal(harness.scheduled.length, 0)
    assert.deepEqual(harness.controller.state(), {
      status: 'hidden',
      mode: 'manual',
      active: false,
      inFlight: false,
      delayMs: null,
      outcome: 'VISION_HIDDEN',
      errorCode: 'VISION_HIDDEN'
    })
    assert.equal(states.some(state => state.outcome === 'completed'), false)
  }
})

test('raw capture and analyzer failures expose only a new typed public error', async () => {
  const sensitive = 'provider-response: SCREEN_SECRET_R2_005'
  for (const boundary of ['capture', 'analyze']) {
    const releasedFrames = []
    const states = []
    const rawError = new Error(sensitive)
    rawError.cause = { response: sensitive, custom: 'private' }
    const harness = createHarness({
      capture: boundary === 'capture'
        ? async () => { throw rawError }
        : async () => ({ frame: 'error-frame' }),
      analyze: boundary === 'analyze'
        ? async () => { throw rawError }
        : async () => ({ summary: 'unused' }),
      releaseFrame: frame => releasedFrames.push(frame),
      onStateChange: state => states.push(state)
    })
    const rejection = harness.controller.manualSnapshot()
    await assert.rejects(rejection, error => {
      assert.notEqual(error, rawError)
      assert.equal(error.code, 'VISION_ANALYSIS_FAILED')
      assert.equal(error.message.includes(sensitive), false)
      assert.equal(Object.prototype.hasOwnProperty.call(error, 'cause'), false)
      return true
    })
    const serialized = JSON.stringify({ state: harness.controller.state(), states })
    assert.equal(serialized.includes(sensitive), false)
    assert.deepEqual(harness.controller.state(), {
      status: 'error',
      mode: 'manual',
      active: false,
      inFlight: false,
      delayMs: null,
      outcome: 'VISION_ANALYSIS_FAILED',
      errorCode: 'VISION_ANALYSIS_FAILED'
    })
    assert.deepEqual(releasedFrames, boundary === 'analyze' ? [{ frame: 'error-frame' }] : [])
    assert.equal(harness.scheduled.length, 0)
  }
})

test('hidden, ended, disconnected, and stream-error states invalidate each generation after capture and analyze', async () => {
  for (const issue of [
    { status: 'hidden', code: 'VISION_HIDDEN', apply: state => { state.visible = false } },
    { status: 'ended', code: 'VISION_STREAM_ENDED', apply: state => { state.ended = true } },
    { status: 'disconnected', code: 'VISION_DISCONNECTED', apply: state => { state.connected = false } },
    { status: 'error', code: 'VISION_ANALYSIS_FAILED', apply: state => { state.error = true } }
  ]) {
    for (const boundary of ['capture', 'analyze']) {
      const captureDeferred = deferred()
      const analyzeDeferred = deferred()
      const streamState = { visible: true, ended: false, connected: true, error: false }
      let capturedSignal
      let analyzeCalls = 0
      const releasedFrames = []
      const releasedStreams = []
      const harness = createHarness({
        capture: ({ signal }) => {
          capturedSignal = signal
          return captureDeferred.promise
        },
        analyze: () => {
          analyzeCalls += 1
          return analyzeDeferred.promise
        },
        readVisibility: () => streamState.visible,
        readStreamState: () => streamState,
        releaseFrame: frame => releasedFrames.push(frame),
        releaseStream: stream => releasedStreams.push(stream)
      })
      const stream = { id: `${issue.status}-${boundary}` }
      harness.controller.startPeriodic(stream)
      const running = harness.controller.runPeriodic()
      await new Promise(resolve => queueMicrotask(resolve))
      if (boundary === 'capture') {
        issue.apply(streamState)
        captureDeferred.resolve({ frame: `${issue.status}-frame` })
      } else {
        captureDeferred.resolve({ frame: `${issue.status}-frame` })
        await new Promise(resolve => setImmediate(resolve))
        assert.equal(analyzeCalls, 1)
        issue.apply(streamState)
        analyzeDeferred.resolve({ summary: 'late result' })
      }
      await assert.rejects(running, error => error.code === issue.code)
      assert.equal(capturedSignal.aborted, true)
      assert.equal(analyzeCalls, boundary === 'capture' ? 0 : 1)
      assert.deepEqual(releasedFrames, [{ frame: `${issue.status}-frame` }])
      assert.deepEqual(releasedStreams, [stream])
      assert.equal(harness.scheduled.length, 1)
      assert.equal(harness.controller.state().status, issue.status)
    }
  }
})

test('stop during capture and analyze is generation-owned, idempotent, and never reschedules', async () => {
  for (const boundary of ['capture', 'analyze']) {
    const captureDeferred = deferred()
    const analyzeDeferred = deferred()
    const releasedFrames = []
    const releasedStreams = []
    let capturedSignal
    const harness = createHarness({
      capture: ({ signal }) => {
        capturedSignal = signal
        return captureDeferred.promise
      },
      analyze: () => analyzeDeferred.promise,
      releaseFrame: frame => releasedFrames.push(frame),
      releaseStream: stream => releasedStreams.push(stream)
    })
    const stream = { id: `stop-${boundary}` }
    harness.controller.startPeriodic(stream)
    const running = harness.controller.runPeriodic()
    await new Promise(resolve => queueMicrotask(resolve))
    if (boundary === 'capture') {
      harness.controller.stop()
      harness.controller.stop()
      captureDeferred.resolve({ frame: 'late-capture-frame' })
    } else {
      captureDeferred.resolve({ frame: 'analyze-frame' })
      await new Promise(resolve => queueMicrotask(() => queueMicrotask(resolve)))
      harness.controller.stop()
      harness.controller.stop()
      analyzeDeferred.resolve({ summary: 'late analyze result' })
    }
    await assert.rejects(running, error => error.code === 'VISION_ABORTED')
    assert.equal(capturedSignal.aborted, true)
    assert.deepEqual(releasedFrames, [boundary === 'capture' ? { frame: 'late-capture-frame' } : { frame: 'analyze-frame' }])
    assert.deepEqual(releasedStreams, [stream])
    assert.equal(harness.scheduled.length, 1)
    assert.equal(harness.canceled.length, 1)
    assert.equal(harness.controller.state().status, 'stopped')
  }
})

test('stale timer callbacks are no-ops and cannot schedule or mutate a later generation', async () => {
  let captureCalls = 0
  const harness = createHarness({ capture: async () => { captureCalls += 1; return { frame: true } } })
  harness.controller.startPeriodic({ id: 'first' })
  const staleTimer = harness.scheduled[0]
  harness.controller.startPeriodic({ id: 'second' })
  staleTimer.callback()
  assert.equal(captureCalls, 0)
  assert.equal(harness.scheduled.length, 2)
  harness.scheduled[1].callback()
  await new Promise(resolve => queueMicrotask(resolve))
  assert.equal(captureCalls, 1)
})

test('new start, manual snapshot, and periodic tick stay busy while an old run is unsettled', async () => {
  const captureDeferred = deferred()
  const analyzeDeferred = deferred()
  let captureCalls = 0
  let analyzeCalls = 0
  const harness = createHarness({
    capture: () => { captureCalls += 1; return captureDeferred.promise },
    analyze: () => { analyzeCalls += 1; return analyzeDeferred.promise }
  })
  harness.controller.startPeriodic({ id: 'first' })
  const running = harness.controller.runPeriodic()
  await new Promise(resolve => queueMicrotask(resolve))
  assert.equal(harness.controller.startPeriodic({ id: 'replacement' }).errorCode, 'VISION_BUSY')
  assert.deepEqual(await harness.controller.manualSnapshot(), { ok: false, code: 'VISION_BUSY' })
  assert.deepEqual(await harness.controller.runPeriodic(), { ok: false, code: 'VISION_BUSY' })
  captureDeferred.resolve({ frame: 'frame' })
  await new Promise(resolve => queueMicrotask(resolve))
  analyzeDeferred.resolve({ summary: 'done' })
  await running
  assert.equal(captureCalls, 1)
  assert.equal(analyzeCalls, 1)
})

test('current-generation analyzer rejection releases resources and prevents rescheduling', async () => {
  const releasedFrames = []
  const releasedStreams = []
  const harness = createHarness({
    capture: async () => ({ frame: 'error-frame' }),
    analyze: async () => { throw new Error('provider detail') },
    releaseFrame: frame => releasedFrames.push(frame),
    releaseStream: stream => releasedStreams.push(stream)
  })
  const stream = { id: 'error-stream' }
  harness.controller.startPeriodic(stream)
  await assert.rejects(harness.controller.runPeriodic())
  assert.deepEqual(releasedFrames, [{ frame: 'error-frame' }])
  assert.deepEqual(releasedStreams, [stream])
  assert.equal(harness.scheduled.length, 1)
  assert.equal(harness.controller.state().status, 'error')
})
