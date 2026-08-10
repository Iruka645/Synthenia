const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { NeuralTTSController } = require('../src/services/tts/neural/neuralTtsController');
const { SidecarClient } = require('../src/services/tts/neural/sidecarClient');
const { TTSError } = require('../src/services/tts/neural/contracts');

const fakeSidecarScript = path.resolve(__dirname, 'fixtures', 'fake-tts-sidecar.js');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function descriptor(id) {
  return { id, label: `Provider ${id}`, command: process.execPath, isInstalled: () => true };
}

class FakeClient {
  constructor(provider, shared, behavior = {}) {
    this.provider = provider;
    this.shared = shared;
    this.behavior = behavior;
    this.state = 'unavailable';
  }

  async start() {
    this.shared.starts.push(this.provider.id);
    if (this.behavior.failStart) throw new TTSError('SIDECAR_START_FAILED');
    this.state = 'ready';
  }

  async request(type, payload, options = {}) {
    assert.equal(type, 'synthesize');
    if (this.shared.failRequests > 0) {
      this.shared.failRequests -= 1;
      throw new TTSError('SIDECAR_EXITED');
    }
    this.shared.active += 1;
    this.shared.maxActive = Math.max(this.shared.maxActive, this.shared.active);
    try {
      const waitMs = this.behavior.delayMs || 15;
      await Promise.race([
        delay(waitMs),
        new Promise((resolve, reject) => {
          if (!options.signal) return;
          options.signal.addEventListener('abort', () => reject(new TTSError('TTS_ABORTED')), { once: true });
        }),
      ]);
      return { ok: true, state: 'ready', output: payload.outputName };
    } finally {
      this.shared.active -= 1;
    }
  }

  async unload() {
    if (this.behavior.failUnload) throw new Error('unload failed');
    this.state = 'unavailable';
  }

  async stop() {
    this.shared.stops.push(this.provider.id);
    this.state = 'unavailable';
  }
}

function makeHarness(options = {}) {
  const shared = { starts: [], stops: [], active: 0, maxActive: 0, failRequests: options.failRequests || 0 };
  let factoryCalls = 0;
  const behaviors = options.behaviors || {};
  const controller = new NeuralTTSController({
    descriptors: [descriptor('provider-a'), descriptor('provider-b')],
    limits: {
      maxWaiting: 2,
      requestTimeoutMs: 200,
      startupTimeoutMs: 200,
      shutdownTimeoutMs: 50,
    },
    clientFactory: (provider) => {
      factoryCalls += 1;
      return new FakeClient(provider, shared, behaviors[provider.id] || {});
    },
    outputValidator: options.outputValidator || (async () => ({ durationSeconds: 0.1 })),
    outputRemover: options.outputRemover || (async () => true),
  });
  return { controller, shared, getFactoryCalls: () => factoryCalls };
}

test('status inspection is pure and reports installed providers without starting them', () => {
  const { controller, getFactoryCalls } = makeHarness();
  const statuses = controller.getStatuses();
  assert.deepEqual(statuses.map((item) => item.state), ['unavailable', 'unavailable']);
  assert.deepEqual(statuses.map((item) => item.installed), [true, true]);
  assert.equal(getFactoryCalls(), 0);
});

test('controller allows one active plus two waiting and rejects excess work', async () => {
  const { controller, shared } = makeHarness({
    behaviors: { 'provider-a': { delayMs: 30 } },
  });
  await controller.switchTo('provider-a');
  const first = controller.synthesize('provider-a', 'หนึ่ง');
  const second = controller.synthesize('provider-a', 'สอง');
  const third = controller.synthesize('provider-a', 'สาม');
  await assert.rejects(controller.synthesize('provider-a', 'สี่'), (error) => error.code === 'TTS_BUSY');
  const results = await Promise.all([first, second, third]);
  assert.equal(results.length, 3);
  assert.equal(shared.maxActive, 1);
  await controller.shutdown();
});

test('readiness-gated switch restores the previous provider exactly once on failure', async () => {
  const { controller, shared } = makeHarness({
    behaviors: { 'provider-b': { failStart: true } },
  });
  await controller.switchTo('provider-a');
  await assert.rejects(controller.switchTo('provider-b'), (error) => error.code === 'SIDECAR_START_FAILED');
  assert.equal(controller.activeProviderId, 'provider-a');
  assert.equal(controller.getStatus('provider-a').state, 'ready');
  assert.deepEqual(shared.starts, ['provider-a', 'provider-b', 'provider-a']);
  await controller.shutdown();
});

test('switch drains admitted work and rejects new work during the transition', async () => {
  const { controller } = makeHarness({
    behaviors: { 'provider-a': { delayMs: 35 } },
  });
  await controller.switchTo('provider-a');
  const admitted = controller.synthesize('provider-a', 'งานที่รับแล้ว');
  const switching = controller.switchTo('provider-b');
  await assert.rejects(controller.synthesize('provider-a', 'งานใหม่'), (error) => error.code === 'TTS_NOT_READY');
  await admitted;
  await switching;
  assert.equal(controller.activeProviderId, 'provider-b');
  await controller.shutdown();
});

test('forced stop after unload failure still transfers ownership to the target', async () => {
  const { controller, shared } = makeHarness({
    behaviors: { 'provider-a': { failUnload: true } },
  });
  await controller.switchTo('provider-a');
  await controller.switchTo('provider-b');
  assert.equal(controller.activeProviderId, 'provider-b');
  assert.ok(shared.stops.includes('provider-a'));
  await controller.shutdown();
});

test('controller performs at most one bounded restart after a sidecar exit', async () => {
  const { controller, shared } = makeHarness({ failRequests: 1 });
  await controller.switchTo('provider-a');
  const filename = await controller.synthesize('provider-a', 'ลองใหม่');
  assert.match(filename, /^tts_provider-a_/);
  assert.deepEqual(shared.starts, ['provider-a', 'provider-a']);
  await controller.shutdown();
});

test('queued abort settles once without entering inference', async () => {
  const { controller, shared } = makeHarness({
    behaviors: { 'provider-a': { delayMs: 40 } },
  });
  await controller.switchTo('provider-a');
  const active = controller.synthesize('provider-a', 'active');
  const abortController = new AbortController();
  const waiting = controller.synthesize('provider-a', 'waiting', { signal: abortController.signal });
  abortController.abort();
  await assert.rejects(waiting, (error) => error.code === 'TTS_ABORTED');
  await active;
  assert.equal(shared.maxActive, 1);
  await controller.shutdown();
});

test('invalid output is removed and is never reported as success', async () => {
  let removals = 0;
  const { controller } = makeHarness({
    outputValidator: async () => { throw new TTSError('TTS_INVALID_OUTPUT'); },
    outputRemover: async () => { removals += 1; return true; },
  });
  await controller.switchTo('provider-a');
  await assert.rejects(controller.synthesize('provider-a', 'invalid'), (error) => error.code === 'TTS_INVALID_OUTPUT');
  assert.ok(removals >= 1);
  await controller.shutdown();
});

test('controller enforces Unicode code-point and installation boundaries', async () => {
  const missing = new NeuralTTSController({
    descriptors: [{ id: 'missing', label: 'Missing', command: null }],
  });
  await assert.rejects(missing.switchTo('missing'), (error) => error.code === 'TTS_NOT_INSTALLED');

  const { controller } = makeHarness();
  await controller.switchTo('provider-a');
  await assert.rejects(controller.synthesize('provider-a', '😀'.repeat(1001)), (error) => error.code === 'TTS_INVALID_INPUT');
  await controller.shutdown();
});

test('controller drives the real fake sidecar through validation and invalid-output cleanup', async (t) => {
  const successRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-controller-real-'));
  const invalidRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-controller-invalid-'));
  t.after(() => Promise.all([
    fs.promises.rm(successRoot, { recursive: true, force: true }),
    fs.promises.rm(invalidRoot, { recursive: true, force: true }),
  ]));

  const limits = {
    maxWaiting: 2,
    requestTimeoutMs: 2000,
    startupTimeoutMs: 2000,
    shutdownTimeoutMs: 500,
    maxProtocolLineBytes: 4096,
  };
  const makeDescriptor = (audioRoot, mode) => ({
    id: 'provider-real',
    label: 'Real fake provider',
    command: process.execPath,
    args: [fakeSidecarScript],
    cwd: __dirname,
    env: { TTS_AUDIO_ROOT: audioRoot, TTS_FAKE_MODE: mode },
    isInstalled: () => true,
  });
  const makeController = (audioRoot, mode, counter) => new NeuralTTSController({
    audioRoot,
    descriptors: [makeDescriptor(audioRoot, mode)],
    limits,
    clientFactory: (provider) => {
      counter.count += 1;
      return new SidecarClient(provider, { limits });
    },
  });

  const successClients = { count: 0 };
  const success = makeController(successRoot, 'normal', successClients);
  await success.switchTo('provider-real');
  const filename = await success.synthesize('provider-real', 'model-free success');
  assert.equal(successClients.count, 1);
  assert.match(filename, /^tts_neural_pub_/);
  assert.equal(fs.existsSync(path.join(successRoot, filename)), true);
  assert.deepEqual((await fs.promises.readdir(success.stagingRoot)).filter((name) => name.endsWith('.wav')), []);
  await success.shutdown();
  assert.equal(success.client, null);
  assert.equal(success.activeProviderId, null);

  const invalidClients = { count: 0 };
  const invalid = makeController(invalidRoot, 'invalid_wav', invalidClients);
  await invalid.switchTo('provider-real');
  let settlements = 0;
  const invalidRequest = invalid.synthesize('provider-real', 'model-free invalid').then(
    (value) => { settlements += 1; return value; },
    (error) => { settlements += 1; throw error; },
  );
  await assert.rejects(invalidRequest, (error) => error.code === 'TTS_INVALID_OUTPUT');
  assert.equal(settlements, 1);
  assert.equal(invalidClients.count, 1);
  assert.deepEqual((await fs.promises.readdir(invalidRoot)).filter((name) => name.endsWith('.wav')), []);
  assert.deepEqual((await fs.promises.readdir(invalid.stagingRoot)).filter((name) => name.endsWith('.wav')), []);
  await invalid.shutdown();
  assert.equal(invalid.client, null);
  assert.equal(invalid.activeProviderId, null);
});
