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
  await assert.rejects(running)
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
