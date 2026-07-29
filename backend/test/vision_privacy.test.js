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
const jpeg = Buffer.from(require('node:fs').readFileSync(require('node:path').join(__dirname, 'fixtures/vision/tiny-jpeg.base64'), 'utf8').trim(), 'base64');
const webp = Buffer.from(require('node:fs').readFileSync(require('node:path').join(__dirname, 'fixtures/vision/tiny-webp.base64'), 'utf8').trim(), 'base64');

function pngChunk(bytes, type) {
  let offset = 8;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const chunkType = bytes.toString('ascii', offset + 4, offset + 8);
    if (chunkType === type) return { start: offset, length };
    offset += 12 + length;
  }
  throw new Error(`missing PNG chunk ${type}`);
}

function pngCrc32(bytes, typeOffset, dataLength) {
  let crc = 0xffffffff;
  for (let offset = typeOffset; offset < typeOffset + 4 + dataLength; offset += 1) {
    crc ^= bytes[offset];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return (~crc) >>> 0;
}

function createPngChunk(type, data) {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 'ascii');
  data.copy(chunk, 8);
  chunk.writeUInt32BE(pngCrc32(chunk, 4, data.length), 8 + data.length);
  return chunk;
}

function insertPngChunk(bytes, chunk, beforeType) {
  const target = pngChunk(bytes, beforeType);
  return Buffer.concat([bytes.subarray(0, target.start), chunk, bytes.subarray(target.start)]);
}

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

test('timeout keeps an abort-ignoring analyzer in an exclusive drain until late fulfillment', async () => {
  let timerCallback;
  let releaseFirst;
  let calls = 0;
  const logs = [];
  const analyzer = () => {
    calls += 1;
    if (calls === 1) return new Promise(resolve => { releaseFirst = resolve; });
    return Promise.resolve({ summary: 'second result', degraded: false });
  };
  const coordinator = new VisionCoordinator({
    analyzer,
    store: { set() {} },
    clock: () => baseTime,
    logger: entry => logs.push(entry),
    setTimer: callback => { timerCallback = callback; return 11; },
    clearTimer: () => {},
  });
  const first = coordinator.analyze({ bytes: png, metadata, requestId: 'drain-timeout' });
  await new Promise(resolve => queueMicrotask(resolve));
  timerCallback();
  await assert.rejects(first, error => error.code === 'VISION_TIMEOUT');
  await assert.rejects(coordinator.analyze({ bytes: png, metadata, requestId: 'blocked' }), error => error.code === 'VISION_BUSY');
  assert.equal(calls, 1);
  assert.equal(logs.length, 1);
  releaseFirst({ summary: 'late SCREEN_SECRET result', degraded: false });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(logs.length, 1);
  const third = await coordinator.analyze({ bytes: png, metadata, requestId: 'after-drain' });
  assert.equal(third.summary, 'second result');
  assert.equal(calls, 2);
  assert.equal(JSON.stringify(logs).includes('SCREEN_SECRET'), false);
});

test('external abort keeps an abort-ignoring analyzer in an exclusive drain until late rejection', async () => {
  let releaseFirst;
  let calls = 0;
  const logs = [];
  const external = new AbortController();
  const analyzer = () => {
    calls += 1;
    if (calls === 1) return new Promise((_, reject) => { releaseFirst = reject; });
    return Promise.resolve({ summary: 'after abort', degraded: false });
  };
  const coordinator = new VisionCoordinator({
    analyzer,
    store: { set() {} },
    clock: () => baseTime,
    logger: entry => logs.push(entry),
    setTimer: () => 12,
    clearTimer: () => {},
  });
  const first = coordinator.analyze({ bytes: png, metadata, requestId: 'drain-abort', signal: external.signal });
  await new Promise(resolve => queueMicrotask(resolve));
  external.abort();
  await assert.rejects(first, error => error.code === 'VISION_ABORTED');
  await assert.rejects(coordinator.analyze({ bytes: png, metadata, requestId: 'blocked-abort' }), error => error.code === 'VISION_BUSY');
  assert.equal(calls, 1);
  assert.equal(logs.length, 1);
  releaseFirst(new Error('late provider SCREEN_SECRET rejection'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(logs.length, 1);
  await coordinator.analyze({ bytes: png, metadata, requestId: 'after-abort' });
  assert.equal(calls, 2);
  assert.equal(JSON.stringify(logs).includes('SCREEN_SECRET'), false);
});

test('pre-aborted requests and invalid containers never invoke the analyzer', async () => {
  let calls = 0;
  const coordinator = new VisionCoordinator({
    analyzer: async () => { calls += 1; return { summary: 'unexpected' }; },
    store: { set() {} },
    clock: () => baseTime,
  });
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(coordinator.analyze({ bytes: png, metadata, signal: aborted.signal }), error => error.code === 'VISION_ABORTED');
  await assert.rejects(coordinator.analyze({ bytes: jpeg.subarray(0, jpeg.length - 2), metadata: { ...metadata, mimeType: 'image/jpeg' } }), error => error.code === 'VISION_INVALID_IMAGE');
  await assert.rejects(coordinator.analyze({ bytes: webp.subarray(0, webp.length - 1), metadata: { ...metadata, mimeType: 'image/webp' } }), error => error.code === 'VISION_INVALID_IMAGE');
  assert.equal(calls, 0);
});

test('R2 structural mutations reject before coordinator analyzer invocation', async () => {
  let calls = 0;
  const coordinator = new VisionCoordinator({
    analyzer: async () => { calls += 1; return { summary: 'unexpected' }; },
    store: { set() {} },
    clock: () => baseTime,
  });
  const illegalPalette = insertPngChunk(png, createPngChunk('PLTE', Buffer.from([0, 0, 0])), 'IEND');
  const postScanArbitrary = Buffer.concat([jpeg.subarray(0, jpeg.length - 2), Buffer.from([0xff, 0xe0, 0x00, 0x02, 0x12, 0x34, 0xff, 0xd9])]);
  await assert.rejects(coordinator.analyze({ bytes: illegalPalette, metadata, requestId: 'illegal-palette' }), error => error.code === 'VISION_INVALID_IMAGE');
  await assert.rejects(coordinator.analyze({ bytes: postScanArbitrary, metadata: { ...metadata, mimeType: 'image/jpeg' }, requestId: 'post-scan-arbitrary' }), error => error.code === 'VISION_INVALID_IMAGE');
  assert.equal(calls, 0);
});

test('admitted capture may complete at six minutes and receives a completion-relative TTL', async () => {
  let current = baseTime;
  const stored = [];
  const coordinator = new VisionCoordinator({
    analyzer: async () => {
      current = baseTime + (6 * 60 * 1000);
      return { summary: 'slow but valid', degraded: false };
    },
    store: { set: observationValue => stored.push(observationValue) },
    clock: () => current,
  });
  const result = await coordinator.analyze({ bytes: png, metadata, requestId: 'six-minute' });
  assert.equal(result.summary, 'slow but valid');
  assert.equal(Date.parse(result.expiresAt) - Date.parse(result.observedAt), config.observationTtlMs);
  assert.equal(stored.length, 1);
});

test('admission age and future-skew boundaries remain strict, and completion timeout wins at 8 minutes', async () => {
  const exactAge = { ...metadata, capturedAt: new Date(baseTime - config.captureMaxAgeMs).toISOString() };
  const exactFuture = { ...metadata, capturedAt: new Date(baseTime + config.captureMaxFutureSkewMs).toISOString() };
  const stale = { ...metadata, capturedAt: new Date(baseTime - config.captureMaxAgeMs - 1).toISOString() };
  const tooFuture = { ...metadata, capturedAt: new Date(baseTime + config.captureMaxFutureSkewMs + 1).toISOString() };
  let current = baseTime;
  let calls = 0;
  const coordinator = new VisionCoordinator({
    analyzer: async () => { calls += 1; return { summary: 'boundary', degraded: false }; },
    store: { set() {} },
    clock: () => current,
  });
  await coordinator.analyze({ bytes: png, metadata: exactAge });
  await coordinator.analyze({ bytes: png, metadata: exactFuture });
  await assert.rejects(coordinator.analyze({ bytes: png, metadata: stale }), error => error.code === 'VISION_TIMESTAMP_STALE');
  await assert.rejects(coordinator.analyze({ bytes: png, metadata: tooFuture }), error => error.code === 'VISION_TIMESTAMP_FUTURE');
  assert.equal(calls, 2);

  current = baseTime;
  let stored = 0;
  const timeoutCoordinator = new VisionCoordinator({
    analyzer: async () => {
      current = baseTime + config.analysisTimeoutMs;
      return { summary: 'too late', degraded: false };
    },
    store: { set() { stored += 1; } },
    clock: () => current,
  });
  await assert.rejects(timeoutCoordinator.analyze({ bytes: png, metadata }), error => error.code === 'VISION_TIMEOUT');
  assert.equal(stored, 0);
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
