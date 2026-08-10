const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SidecarClient, sanitizedEnvironment } = require('../src/services/tts/neural/sidecarClient');
const { validateOutput } = require('../src/services/tts/neural/outputValidator');

const fakeScript = path.resolve(__dirname, 'fixtures', 'fake-tts-sidecar.js');

function makeClient(audioRoot, mode = 'normal', overrides = {}) {
  return new SidecarClient({
    id: 'jaitts-f5tts',
    label: 'Fake JaiTTS',
    command: process.execPath,
    args: [fakeScript],
    cwd: __dirname,
    env: {
      TTS_AUDIO_ROOT: audioRoot,
      TTS_FAKE_MODE: mode,
      TTS_FAKE_DELAY_MS: '80',
    },
  }, {
    limits: {
      startupTimeoutMs: overrides.startupTimeoutMs || 2000,
      requestTimeoutMs: overrides.requestTimeoutMs || 1000,
      shutdownTimeoutMs: 500,
      maxProtocolLineBytes: 4096,
    },
  });
}

test('SidecarClient performs bounded JSONL load, synthesis, WAV validation, and shutdown', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-sidecar-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const client = makeClient(root);
  t.after(() => client.stop());

  await client.start();
  assert.equal(client.getStatus().state, 'ready');
  const output = 'tts_test.wav';
  const response = await client.request('synthesize', {
    providerId: 'jaitts-f5tts',
    text: 'test payload',
    outputName: output,
  });
  assert.equal(response.output, output);
  const result = await validateOutput(output, { audioRoot: root });
  assert.equal(result.filename, output);
  assert.ok(result.durationSeconds > 0);
});

test('SidecarClient fails closed and stops on malformed or unexpected protocol fields', async (t) => {
  for (const mode of ['malformed', 'unexpected_field']) {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), `synthenia-${mode}-`));
    t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
    const client = makeClient(root, mode);
    await client.start();
    await assert.rejects(
      client.request('synthesize', {
        providerId: 'jaitts-f5tts', text: 'payload', outputName: `tts_${mode}.wav`,
      }),
      (error) => error.code === 'SIDECAR_PROTOCOL_ERROR',
    );
    await client.stop();
  }
});

test('SidecarClient timeout drains the child before rejecting ownership', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-hang-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const client = makeClient(root, 'hang', { requestTimeoutMs: 40 });
  await client.start();
  await assert.rejects(
    client.request('synthesize', {
      providerId: 'jaitts-f5tts', text: 'payload', outputName: 'tts_hang.wav',
    }),
    (error) => error.code === 'TTS_TIMEOUT',
  );
  assert.equal(client.child, null);
});

test('SidecarClient rejects failed readiness and does not expose raw child errors', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-load-fail-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const client = makeClient(root, 'load_fail');
  await assert.rejects(client.start(), (error) => error.code === 'SIDECAR_START_FAILED');
  await client.stop();
});

test('SidecarClient bounds startup readiness and crash recovery ownership', async (t) => {
  const startupRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-load-hang-'));
  const crashRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-crash-'));
  t.after(() => Promise.all([
    fs.promises.rm(startupRoot, { recursive: true, force: true }),
    fs.promises.rm(crashRoot, { recursive: true, force: true }),
  ]));

  const startupClient = makeClient(startupRoot, 'load_hang', { startupTimeoutMs: 40 });
  await assert.rejects(startupClient.start(), (error) => error.code === 'TTS_TIMEOUT');
  assert.equal(startupClient.child, null);

  const crashClient = makeClient(crashRoot, 'crash');
  await crashClient.start();
  await assert.rejects(
    crashClient.request('synthesize', {
      providerId: 'jaitts-f5tts', text: 'payload', outputName: 'tts_crash.wav',
    }),
    (error) => error.code === 'SIDECAR_EXITED',
  );
  assert.equal(crashClient.child, null);
});

test('SidecarClient kills a late producer before it can settle or publish output', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-late-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const client = makeClient(root, 'late', { requestTimeoutMs: 30 });
  await client.start();
  await assert.rejects(
    client.request('synthesize', {
      providerId: 'jaitts-f5tts', text: 'payload', outputName: 'tts_late.wav',
    }),
    (error) => error.code === 'TTS_TIMEOUT',
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(fs.existsSync(path.join(root, 'tts_late.wav')), false);
  assert.equal(client.child, null);
});

test('sidecar environment allowlist excludes application secrets', () => {
  const env = sanitizedEnvironment({
    CONTROL_PANEL_API_KEY: 'must-not-pass',
    TTS_AUDIO_ROOT: 'D:\\safe-audio',
    TTS_FAKE_MODE: 'normal',
  });
  assert.equal(env.CONTROL_PANEL_API_KEY, undefined);
  assert.equal(env.TTS_AUDIO_ROOT, 'D:\\safe-audio');
  assert.equal(env.TTS_FAKE_MODE, 'normal');
});
