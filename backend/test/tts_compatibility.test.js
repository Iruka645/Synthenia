const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ttsFactory = require('../src/services/tts/ttsFactory');
const { TTSManager } = require('../src/services/tts/index');
const { TTSError } = require('../src/services/tts/neural/contracts');
const { validateOutput, removeOutput } = require('../src/services/tts/neural/outputValidator');
const ttsRoutes = require('../src/routes/tts');

function managerHarness(options = {}) {
  const calls = [];
  const synthesize = options.synthesize || {};
  const factory = {
    availableProviders: ['gtts', 'piper', 'jaitts-f5tts', 'vachaspeech-0.6b'],
    createTTSProvider(name) {
      calls.push(`create:${name}`);
      return {
        async synthesize(text) {
          calls.push(`synthesize:${name}:${Array.from(text).length}`);
          const behavior = synthesize[name];
          if (behavior instanceof Error) throw behavior;
          if (typeof behavior === 'function') return behavior(text);
          return behavior || `${name}.wav`;
        },
      };
    },
    getProviderMetadata() {
      return this.availableProviders.map((id) => ({ id, label: id, kind: id.includes('tts') ? 'neural' : 'legacy', state: 'ready' }));
    },
  };
  const config = {
    values: { ...(options.configValues || {}) },
    async get(key, fallback = null) {
      return Object.hasOwn(this.values, key) ? this.values[key] : fallback;
    },
    async getAll() { return {}; },
    async set(key, value) {
      calls.push(`set:${key}:${value}`);
      if (options.persistError) throw options.persistError;
      this.values[key] = value;
    },
  };
  const controller = options.controller || {
    isNeuralProvider: (id) => id === 'jaitts-f5tts' || id === 'vachaspeech-0.6b',
    getStatus: (id) => ({ id, label: id, state: 'not_installed', active: false }),
    getStatuses: () => [
      { id: 'jaitts-f5tts', label: 'JaiTTS', state: 'not_installed', active: false },
      { id: 'vachaspeech-0.6b', label: 'Vacha', state: 'not_installed', active: false },
    ],
    async switchTo(id) { calls.push(`switch:${id}`); },
    async deactivate() { calls.push('deactivate'); },
    async shutdown() { calls.push('shutdown'); },
  };
  const voiceConversion = {
    async convert(filename) {
      calls.push(`rvc:${filename}`);
      return options.convertedFilename || filename;
    },
  };
  const manager = new TTSManager({
    factory,
    configService: config,
    neuralController: controller,
    voiceConversionService: voiceConversion,
    defaultProvider: options.defaultProvider || 'gtts',
  });
  return { manager, calls, config, controller };
}

function validMonoWav(seconds = 0.05) {
  const sampleRate = 16000;
  const dataBytes = Math.floor(sampleRate * seconds) * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
}

test('factory retains legacy providers and exposes inert neural providers as not installed', () => {
  assert.deepEqual(ttsFactory.availableProviders, [
    'gtts', 'piper', 'jaitts-f5tts', 'vachaspeech-0.6b',
  ]);
  const metadata = ttsFactory.getProviderMetadata();
  assert.equal(metadata.find((item) => item.id === 'gtts').state, 'ready');
  assert.equal(metadata.find((item) => item.id === 'gtts').installed, true);
  assert.equal(metadata.find((item) => item.id === 'jaitts-f5tts').state, 'not_installed');
  assert.equal(metadata.find((item) => item.id === 'jaitts-f5tts').installed, false);
  const neural = ttsFactory.createTTSProvider('jaitts-f5tts');
  assert.equal(neural.providerId, 'jaitts-f5tts');
});

test('normal generation falls back to gTTS exactly once and applies RVC after fallback', async () => {
  const { manager, calls } = managerHarness({
    defaultProvider: 'piper',
    synthesize: { piper: new Error('private upstream detail'), gtts: 'fallback.mp3' },
    configValues: { 'tts.gttsFallbackEnabled': true, 'voiceConversion.enabled': true },
    convertedFilename: 'converted.wav',
  });
  const output = await manager.generate('ข้อความทดสอบ');
  assert.equal(output, 'converted.wav');
  assert.equal(calls.filter((item) => item === 'create:gtts').length, 1);
  assert.deepEqual(calls.filter((item) => item.startsWith('rvc:')), ['rvc:fallback.mp3']);
});

test('fallback can be disabled and preview never substitutes another provider', async () => {
  const failure = new Error('upstream detail');
  const disabled = managerHarness({
    defaultProvider: 'piper',
    synthesize: { piper: failure },
    configValues: { 'tts.gttsFallbackEnabled': false },
  });
  await assert.rejects(disabled.manager.generate('test'), (error) => error.code === 'TTS_SYNTHESIS_FAILED');
  assert.equal(disabled.calls.includes('create:gtts'), false);

  const preview = managerHarness({ synthesize: { piper: failure } });
  const gttsCreationsBeforePreview = preview.calls.filter((item) => item === 'create:gtts').length;
  await assert.rejects(preview.manager.preview('test', 'piper'), (error) => error === failure);
  assert.equal(
    preview.calls.filter((item) => item === 'create:gtts').length,
    gttsCreationsBeforePreview,
  );
});

test('provider switch commits only after readiness and persistence', async () => {
  const failed = managerHarness({ persistError: new Error('db unavailable') });
  await assert.rejects(
    failed.manager.switchProvider('jaitts-f5tts'),
    (error) => error.code === 'TTS_PERSIST_FAILED',
  );
  assert.equal(failed.manager.getCurrentProvider(), 'gtts');
  assert.deepEqual(failed.calls.filter((item) => item.startsWith('switch:') || item === 'deactivate'), [
    'switch:jaitts-f5tts', 'deactivate',
  ]);

  const success = managerHarness();
  assert.equal(await success.manager.switchProvider('jaitts-f5tts'), 'jaitts-f5tts');
  assert.equal(success.manager.getCurrentProvider(), 'jaitts-f5tts');
  assert.ok(success.calls.indexOf('switch:jaitts-f5tts') < success.calls.indexOf('set:tts.currentProvider:jaitts-f5tts'));
});

test('preview requires an active ready neural provider and enforces input bounds', async () => {
  const { manager } = managerHarness();
  await assert.rejects(manager.preview('test', 'jaitts-f5tts'), (error) => error.code === 'TTS_NOT_READY');
  await assert.rejects(manager.generate('x'.repeat(1001)), (error) => error.code === 'TTS_INVALID_INPUT');
});

test('detailed status route is additive while legacy list/current routes remain present', () => {
  const routePaths = ttsRoutes.stack.map((layer) => layer.route?.path).filter(Boolean);
  assert.ok(routePaths.includes('/current'));
  assert.ok(routePaths.includes('/list'));
  assert.ok(routePaths.includes('/status'));
  assert.ok(routePaths.includes('/switch'));
  assert.ok(routePaths.includes('/preview'));
});

test('output validation accepts contained PCM WAV and rejects traversal, malformed, and oversized output', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-output-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  await fs.promises.writeFile(path.join(root, 'valid.wav'), validMonoWav());
  assert.equal((await validateOutput('valid.wav', { audioRoot: root })).filename, 'valid.wav');
  await assert.rejects(validateOutput('../escape.wav', { audioRoot: root }), (error) => error.code === 'TTS_INVALID_OUTPUT');

  await fs.promises.writeFile(path.join(root, 'bad.wav'), 'not a wave file');
  await assert.rejects(validateOutput('bad.wav', { audioRoot: root }), (error) => error.code === 'TTS_INVALID_OUTPUT');
  assert.equal(await removeOutput('bad.wav', { audioRoot: root }), true);

  const large = path.join(root, 'large.wav');
  await fs.promises.writeFile(large, validMonoWav());
  await fs.promises.truncate(large, 26 * 1024 * 1024);
  await assert.rejects(validateOutput('large.wav', { audioRoot: root }), (error) => error.code === 'TTS_INVALID_OUTPUT');

  await fs.promises.writeFile(path.join(root, 'too-long.wav'), validMonoWav(121));
  await assert.rejects(validateOutput('too-long.wav', { audioRoot: root }), (error) => error.code === 'TTS_INVALID_OUTPUT');
});

test('manager shutdown delegates to the neural ownership boundary', async () => {
  const { manager, calls } = managerHarness();
  await manager.shutdown();
  assert.ok(calls.includes('shutdown'));
});

test('typed TTS errors expose sanitized messages rather than causes', () => {
  const error = new TTSError('TTS_SWITCH_FAILED', { cause: new Error('D:\\secret\\model path') });
  assert.equal(error.message.includes('secret'), false);
  assert.equal(error.httpStatus, 503);
});
