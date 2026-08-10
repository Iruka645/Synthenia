const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  createInstallStateChecker,
  sha256Buffer,
} = require('../src/services/tts/neural/installState');
const {
  DEFAULT_DESCRIPTORS,
  LOCAL_ROOT,
  REFERENCE_CONFIG,
} = require('../src/services/tts/neural/providerDescriptors');
const { NeuralTTSController } = require('../src/services/tts/neural/neuralTtsController');

function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synthenia-install-state-'));
  const providerRoot = path.join(root, 'provider');
  const command = path.join(providerRoot, 'venv', 'Scripts', 'python.exe');
  const receiptPath = path.join(providerRoot, 'receipts', 'install-state.json');
  const manifestPath = path.join(root, 'manifest.json');
  const lockPath = path.join(root, 'requirements.lock');
  fs.mkdirSync(path.dirname(command), { recursive: true });
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  const lock = Buffer.from('package==1.0 --hash=sha256:'.concat('0'.repeat(64), '\n'));
  fs.writeFileSync(lockPath, lock);
  const artifact = {
    relativePath: 'model/model.bin',
    sizeBytes: 10,
    sha256: 'a'.repeat(64),
  };
  const enabled = options.enabled !== false;
  const manifest = {
    schemaVersion: 1,
    provider: { id: 'provider' },
    python: { version: '3.11.15' },
    sources: [],
    artifacts: [artifact],
    dependencies: {
      lockFile: 'requirements.lock',
      sha256: sha256Buffer(lock),
    },
    security: { trustRemoteCode: false, runtimeNetwork: false },
    gates: {
      pinsVerified: enabled,
      licensesResolved: enabled,
      checksumsComplete: enabled,
      enablementAllowed: enabled,
    },
  };
  const manifestBuffer = Buffer.from(JSON.stringify(manifest));
  fs.writeFileSync(manifestPath, manifestBuffer);
  if (options.command !== false) fs.writeFileSync(command, 'not executed');
  if (options.receipt !== false) {
    fs.writeFileSync(receiptPath, JSON.stringify({
      schemaVersion: 1,
      providerId: 'provider',
      manifestSha256: sha256Buffer(manifestBuffer),
      lockSha256: sha256Buffer(lock),
      pythonVersion: '3.11.15',
      artifacts: [artifact],
    }));
  }
  const getInstallState = createInstallStateChecker({
    providerId: 'provider',
    command,
    providerRoot,
    receiptPath,
    manifestPath,
    lockPath,
  });
  return { root, getInstallState, receiptPath };
}

test('missing command or receipt is purely not_installed', (t) => {
  for (const options of [{ command: false }, { receipt: false }]) {
    const item = fixture(options);
    t.after(() => fs.rmSync(item.root, { recursive: true, force: true }));
    assert.deepEqual(item.getInstallState(), {
      installed: false,
      state: 'not_installed',
      errorCode: undefined,
    });
  }
});

test('present install with false provenance gates is unavailable', (t) => {
  const item = fixture({ enabled: false });
  t.after(() => fs.rmSync(item.root, { recursive: true, force: true }));
  assert.deepEqual(item.getInstallState(), {
    installed: false,
    state: 'unavailable',
    errorCode: 'TTS_INSTALL_INVALID',
  });
});

test('valid receipt matches the startup metadata snapshot without runtime hashing', (t) => {
  const item = fixture();
  t.after(() => fs.rmSync(item.root, { recursive: true, force: true }));
  const originalCreateHash = crypto.createHash;
  crypto.createHash = () => { throw new Error('status must not hash'); };
  try {
    assert.deepEqual(item.getInstallState(), {
      installed: true,
      state: 'unavailable',
      errorCode: undefined,
    });
  } finally {
    crypto.createHash = originalCreateHash;
  }
});

test('tampered receipt is sanitized unavailable', (t) => {
  const item = fixture();
  t.after(() => fs.rmSync(item.root, { recursive: true, force: true }));
  fs.writeFileSync(item.receiptPath, JSON.stringify({ schemaVersion: 1 }));
  assert.deepEqual(item.getInstallState(), {
    installed: false,
    state: 'unavailable',
    errorCode: 'TTS_INSTALL_INVALID',
  });
});

test('default descriptors are isolated absolute offline paths with no inherited secret fields', () => {
  assert.equal(DEFAULT_DESCRIPTORS.length, 2);
  const [jai, vacha] = DEFAULT_DESCRIPTORS;
  assert.notEqual(path.dirname(path.dirname(path.dirname(jai.command))),
    path.dirname(path.dirname(path.dirname(vacha.command))));
  for (const descriptor of DEFAULT_DESCRIPTORS) {
    assert.ok(path.isAbsolute(descriptor.command));
    assert.ok(path.isAbsolute(descriptor.args[0]));
    assert.ok(path.isAbsolute(descriptor.cwd));
    assert.equal(descriptor.env.HF_HUB_OFFLINE, '1');
    assert.equal(descriptor.env.TRANSFORMERS_OFFLINE, '1');
    assert.ok(descriptor.command.startsWith(LOCAL_ROOT));
    assert.equal(descriptor.env.TTS_REFERENCE_CONFIG, REFERENCE_CONFIG);
    assert.equal(Object.hasOwn(descriptor.env, 'PATH'), false);
    assert.equal(Object.hasOwn(descriptor.env, 'HF_TOKEN'), false);
  }
});

test('controller injects only private staging output root at activation', async (t) => {
  const audioRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'synthenia-audio-'));
  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'synthenia-staging-'));
  t.after(() => fs.rmSync(audioRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(stagingRoot, { recursive: true, force: true }));
  let runtimeDescriptor;
  const client = {
    state: 'ready',
    async start() {},
    async unload() {},
    async stop() {},
  };
  const controller = new NeuralTTSController({
    audioRoot,
    stagingRoot,
    descriptors: [{
      id: 'provider',
      label: 'Provider',
      command: path.resolve('unused.exe'),
      env: { TTS_MODEL_ROOT: path.resolve('model') },
      getInstallState: () => ({ installed: true, state: 'unavailable' }),
    }],
    clientFactory(descriptor) {
      runtimeDescriptor = descriptor;
      return client;
    },
    publishedStore: {
      register() {},
      async cleanup() {},
      async shutdown() {},
    },
  });
  await controller.switchTo('provider');
  assert.equal(runtimeDescriptor.env.TTS_AUDIO_ROOT, stagingRoot);
  assert.equal(runtimeDescriptor.env.TTS_MODEL_ROOT, path.resolve('model'));
  await controller.shutdown();
});
