const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const GTTSProvider = require('../src/services/tts/providers/gttsProvider');
const PiperProvider = require('../src/services/tts/providers/piperProvider');
const { TTSManager } = require('../src/services/tts/index');
const { TTSError } = require('../src/services/tts/neural/contracts');

const STDERR_SENTINEL = 'RAW_STDERR_SENTINEL D:\\private\\reference-voice.wav secret request text';

function failingSpawn(stderr = STDERR_SENTINEL) {
  return () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    process.nextTick(() => {
      child.stderr.end(stderr);
      child.stdout.end();
      child.emit('close', 7);
    });
    return child;
  };
}

async function captureConsole(task) {
  const methods = ['log', 'warn', 'error'];
  const originals = new Map(methods.map((method) => [method, console[method]]));
  const entries = [];
  for (const method of methods) {
    console[method] = (...args) => entries.push(`${method}:${args.map(String).join(' ')}`);
  }
  try {
    await task(entries);
  } finally {
    for (const [method, original] of originals) console[method] = original;
  }
  return entries;
}

test('legacy providers drain child stderr without logging or returning it', async () => {
  const outwardMessages = [];
  const logs = await captureConsole(async () => {
    for (const provider of [
      new GTTSProvider({ spawnImpl: failingSpawn() }),
      new PiperProvider({ spawnImpl: failingSpawn() }),
    ]) {
      await assert.rejects(provider.synthesize('private synthesis input'), (error) => {
        outwardMessages.push(error.message);
        return error.code === 'TTS_SYNTHESIS_FAILED';
      });
    }
  });

  const observed = [...logs, ...outwardMessages].join('\n');
  assert.equal(observed.includes('RAW_STDERR_SENTINEL'), false);
  assert.equal(observed.includes('reference-voice.wav'), false);
  assert.equal(observed.includes('secret request text'), false);
  assert.deepEqual(outwardMessages, ['TTS synthesis failed.', 'TTS synthesis failed.']);
});

test('neural failure followed by a failing gTTS fallback keeps child stderr private', async () => {
  const failingNeural = {
    async synthesize() { throw new TTSError('SIDECAR_EXITED'); },
  };
  const failingGtts = new GTTSProvider({ spawnImpl: failingSpawn() });
  const factory = {
    availableProviders: ['gtts', 'jaitts-f5tts'],
    createTTSProvider(name) {
      if (name === 'gtts') return failingGtts;
      if (name === 'jaitts-f5tts') return failingNeural;
      throw new Error('unexpected provider');
    },
    getProviderMetadata: () => [],
  };
  const configService = {
    async get(key, fallback = null) {
      if (key === 'tts.gttsFallbackEnabled') return true;
      return fallback;
    },
    async getAll() { return {}; },
    async set() {},
  };
  const neuralController = {
    isNeuralProvider: (id) => id === 'jaitts-f5tts',
    getStatus: () => ({ state: 'ready', active: true }),
    getStatuses: () => [],
    async switchTo() {},
    async deactivate() {},
    async shutdown() {},
  };
  const manager = new TTSManager({ factory, configService, neuralController, defaultProvider: 'gtts' });
  manager.currentProviderName = 'jaitts-f5tts';
  manager.currentProviderInstance = failingNeural;

  let outwardMessage = '';
  const logs = await captureConsole(async () => {
    await assert.rejects(manager.generate('neural request text'), (error) => {
      outwardMessage = error.message;
      return error.code === 'SIDECAR_EXITED';
    });
  });

  const observed = [...logs, outwardMessage].join('\n');
  assert.equal(observed.includes('RAW_STDERR_SENTINEL'), false);
  assert.equal(observed.includes('reference-voice.wav'), false);
  assert.equal(observed.includes('secret request text'), false);
  assert.equal(outwardMessage, 'The local TTS process stopped unexpectedly.');
});
