const test = require('node:test');
const assert = require('node:assert/strict');
const { ShortTermObservationStore } = require('../src/services/vision/shortTermObservationStore');
const { VisionCoordinator } = require('../src/services/vision/visionCoordinator');
const config = require('../src/config/visionConfig');

const baseTime = Date.parse('2026-07-28T12:00:00.000Z');
const metadata = {
  version: 1,
  mode: 'periodic',
  mimeType: 'image/png',
  width: 1,
  height: 1,
  capturedAt: new Date(baseTime - 1_000).toISOString(),
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

function observation(summary, observedAt = baseTime) {
  return {
    version: 1,
    source: 'screen',
    trust: 'untrusted',
    mode: 'periodic',
    summary,
    capturedAt: metadata.capturedAt,
    observedAt: new Date(observedAt).toISOString(),
    expiresAt: new Date(observedAt + config.observationTtlMs).toISOString(),
    timing: { analysisMs: 5 },
    degraded: false,
  };
}

test('store retains only the latest normalized observation and eagerly expires it', () => {
  let current = baseTime;
  const store = new ShortTermObservationStore({ clock: () => current });
  store.set(observation('first', current));
  store.set(observation('  latest   summary ', current));
  assert.equal(store.getLatest().summary, 'latest summary');
  current += config.observationTtlMs;
  assert.equal(store.getLatest(), null);
  store.clear();
  store.clear();
  assert.equal(store.getLatest(), null);
});

test('coordinator is single-flight and returns typed busy without queueing', async () => {
  let release;
  let calls = 0;
  const analyzer = () => {
    calls += 1;
    return new Promise(resolve => { release = resolve; });
  };
  const store = new ShortTermObservationStore({ clock: () => baseTime });
  const coordinator = new VisionCoordinator({ analyzer, store, clock: () => baseTime });
  const first = coordinator.analyze({ bytes: png, metadata, requestId: 'first' });
  await new Promise(resolve => queueMicrotask(resolve));
  await assert.rejects(coordinator.analyze({ bytes: png, metadata, requestId: 'second' }), error => error.code === 'VISION_BUSY');
  assert.equal(calls, 1);
  release({ summary: 'screen summary', degraded: false });
  const result = await first;
  assert.equal(result.summary, 'screen summary');
  assert.equal(store.getLatest().summary, 'screen summary');
});

test('coordinator timeout aborts analysis and logs metadata only', async () => {
  let timerCallback;
  let aborted = false;
  const logs = [];
  const store = { set() { throw new Error('store must not receive timeout data'); } };
  const analyzer = ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('provider body: SCREEN_SECRET')); }, { once: true });
  });
  const coordinator = new VisionCoordinator({
    analyzer,
    store,
    clock: () => baseTime,
    logger: entry => logs.push(entry),
    setTimer: callback => { timerCallback = callback; return 7; },
    clearTimer: () => {},
  });
  const pending = coordinator.analyze({ bytes: png, metadata, requestId: 'timeout-test' });
  await new Promise(resolve => queueMicrotask(resolve));
  timerCallback();
  await assert.rejects(pending, error => error.code === 'VISION_TIMEOUT');
  assert.equal(aborted, true);
  assert.deepEqual(logs, [{
    requestId: 'timeout-test',
    mode: 'periodic',
    byteCount: png.length,
    width: 1,
    height: 1,
    outcome: 'VISION_TIMEOUT',
    elapsedMs: 0,
  }]);
  assert.equal(JSON.stringify(logs).includes('SCREEN_SECRET'), false);
});

test('coordinator stores normalized output and never gives payloads to logger', async () => {
  const logs = [];
  const stored = [];
  const coordinator = new VisionCoordinator({
    analyzer: async () => ({ summary: '  OCR-like   text ', degraded: true }),
    store: { set: value => stored.push(value) },
    clock: () => baseTime,
    logger: entry => logs.push(entry),
  });
  const result = await coordinator.analyze({ bytes: png, metadata, requestId: 'safe' });
  assert.equal(result.summary, 'OCR-like text');
  assert.equal(stored[0].summary, 'OCR-like text');
  assert.equal(Object.prototype.hasOwnProperty.call(logs[0], 'summary'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(logs[0], 'bytes'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(logs[0], 'prompt'), false);
});

test('provider errors are sanitized before metadata-only logging', async () => {
  const logs = [];
  const coordinator = new VisionCoordinator({
    analyzer: async () => { throw new Error('raw provider response with SCREEN_SECRET'); },
    store: { set() {} },
    clock: () => baseTime,
    logger: entry => logs.push(entry),
  });
  await assert.rejects(coordinator.analyze({ bytes: png, metadata, requestId: 'error-test' }), error => error.code === 'VISION_ANALYSIS_FAILED');
  assert.deepEqual(logs[0], {
    requestId: 'error-test',
    mode: 'periodic',
    byteCount: png.length,
    width: 1,
    height: 1,
    outcome: 'VISION_ANALYSIS_FAILED',
    elapsedMs: 0,
  });
  assert.equal(JSON.stringify(logs).includes('SCREEN_SECRET'), false);
});
