const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateAndPublish } = require('../src/services/tts/neural/outputValidator');
const {
  PublishedAudioStore,
  createPublishedAudioMiddleware,
} = require('../src/services/tts/neural/publishedAudioStore');

function validMonoWav(marker = 0) {
  const sampleRate = 16000;
  const dataBytes = 1600;
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
  buffer[buffer.length - 1] = marker;
  return buffer;
}

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    headersSent: false,
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; this.headersSent = true; return this; },
    end() { this.headersSent = true; return this; },
  };
}

async function publish(store, stagingRoot, publishedRoot, stagingName, bytes) {
  await fs.promises.writeFile(path.join(stagingRoot, stagingName), bytes);
  return validateAndPublish(stagingName, {
    stagingRoot,
    publishedRoot,
    registerPublished: (meta) => store.register(meta),
  });
}

test('verified audio middleware serves registered bytes and never falls through reserved names', async (t) => {
  const stagingRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-store-stage-'));
  const publishedRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-store-final-'));
  t.after(() => Promise.all([
    fs.promises.rm(stagingRoot, { recursive: true, force: true }),
    fs.promises.rm(publishedRoot, { recursive: true, force: true }),
  ]));
  const store = new PublishedAudioStore({ stagingRoot, publishedRoot });
  await store.initialize();
  const middleware = createPublishedAudioMiddleware(store);
  const sourceBytes = validMonoWav(11);
  const result = await publish(store, stagingRoot, publishedRoot, 'normal.wav', sourceBytes);

  let nextCalls = 0;
  const response = makeResponse();
  await middleware({ params: { filename: result.filename }, headers: {} }, response, () => { nextCalls += 1; });
  assert.equal(nextCalls, 0);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'audio/wav');
  assert.deepEqual(response.body, sourceBytes);
  assert.equal(fs.existsSync(path.join(stagingRoot, 'normal.wav')), false);

  const unknown = makeResponse();
  await middleware({
    params: { filename: 'tts_neural_pub_00000000-0000-4000-8000-000000000002.wav' },
    headers: {},
  }, unknown, () => { nextCalls += 1; });
  assert.equal(unknown.statusCode, 404);
  assert.equal(nextCalls, 0);

  const malformedReserved = makeResponse();
  await middleware({
    params: { filename: 'tts_neural_pub_malformed.wav' },
    headers: {},
  }, malformedReserved, () => { nextCalls += 1; });
  assert.equal(malformedReserved.statusCode, 404);
  assert.equal(nextCalls, 0);

  const legacy = makeResponse();
  await middleware({ params: { filename: 'legacy.mp3' }, headers: {} }, legacy, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  await store.shutdown();
});

test('late public replacement is neither served nor deleted and restart registrations fail closed', async (t) => {
  const stagingRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-store-swap-stage-'));
  const publishedRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-store-swap-final-'));
  const externalRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-store-swap-external-'));
  t.after(() => Promise.all([
    fs.promises.rm(stagingRoot, { recursive: true, force: true }),
    fs.promises.rm(publishedRoot, { recursive: true, force: true }),
    fs.promises.rm(externalRoot, { recursive: true, force: true }),
  ]));
  const store = new PublishedAudioStore({ stagingRoot, publishedRoot });
  await store.initialize();
  const middleware = createPublishedAudioMiddleware(store);
  const result = await publish(store, stagingRoot, publishedRoot, 'swap.wav', validMonoWav(21));
  const publishedPath = path.join(publishedRoot, result.filename);
  const verifiedBackup = path.join(publishedRoot, 'verified-backup.wav');
  const external = path.join(externalRoot, 'external.wav');
  const replacementBytes = validMonoWav(99);
  await fs.promises.writeFile(external, replacementBytes);
  await fs.promises.rename(publishedPath, verifiedBackup);
  await fs.promises.copyFile(external, publishedPath);

  let nextCalls = 0;
  const response = makeResponse();
  await middleware({ params: { filename: result.filename }, headers: {} }, response, () => { nextCalls += 1; });
  assert.equal(nextCalls, 0);
  assert.equal(response.statusCode, 404);
  assert.equal(response.body, undefined);
  assert.deepEqual(await fs.promises.readFile(external), replacementBytes);
  assert.deepEqual(await fs.promises.readFile(publishedPath), replacementBytes);

  const restartedStore = new PublishedAudioStore({ stagingRoot, publishedRoot });
  const restartedMiddleware = createPublishedAudioMiddleware(restartedStore);
  const restartedResponse = makeResponse();
  await restartedMiddleware({ params: { filename: result.filename }, headers: {} }, restartedResponse, () => { nextCalls += 1; });
  assert.equal(restartedResponse.statusCode, 404);
  assert.equal(nextCalls, 0);
  assert.deepEqual(await fs.promises.readFile(external), replacementBytes);
});

test('retention removes registered neural and staging files without touching legacy audio', async (t) => {
  const stagingRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-store-clean-stage-'));
  const publishedRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-store-clean-final-'));
  t.after(() => Promise.all([
    fs.promises.rm(stagingRoot, { recursive: true, force: true }),
    fs.promises.rm(publishedRoot, { recursive: true, force: true }),
  ]));
  const store = new PublishedAudioStore({ stagingRoot, publishedRoot });
  await store.initialize();
  const result = await publish(store, stagingRoot, publishedRoot, 'retained.wav', validMonoWav(33));
  const abandoned = path.join(stagingRoot, 'abandoned.wav');
  const legacy = path.join(publishedRoot, 'legacy.mp3');
  await fs.promises.writeFile(abandoned, validMonoWav(44));
  await fs.promises.writeFile(legacy, 'legacy');

  const removed = await store.cleanup({
    publishedCutoff: Date.now() + 1,
    stagingCutoff: Date.now() + 1,
  });
  assert.equal(removed, 2);
  assert.equal(fs.existsSync(path.join(publishedRoot, result.filename)), false);
  assert.equal(fs.existsSync(abandoned), false);
  assert.equal(fs.existsSync(legacy), true);
  await store.shutdown();
});
