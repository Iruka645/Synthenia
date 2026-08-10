const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  validateOutput,
  validateAndPublish,
  removeOutput,
} = require('../src/services/tts/neural/outputValidator');

function validMonoWav() {
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
  return buffer;
}

test('output validation accepts one-link files and rejects preexisting links', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-validator-root-'));
  const externalRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-validator-external-'));
  t.after(() => Promise.all([
    fs.promises.rm(root, { recursive: true, force: true }),
    fs.promises.rm(externalRoot, { recursive: true, force: true }),
  ]));

  await fs.promises.writeFile(path.join(root, 'valid.wav'), validMonoWav());
  assert.equal((await validateOutput('valid.wav', { audioRoot: root })).filename, 'valid.wav');

  const external = path.join(externalRoot, 'external.wav');
  const externalBytes = validMonoWav();
  await fs.promises.writeFile(external, externalBytes);

  const hardlink = path.join(root, 'hardlink.wav');
  await fs.promises.link(external, hardlink);
  await assert.rejects(
    validateOutput('hardlink.wav', { audioRoot: root }),
    (error) => error.code === 'TTS_INVALID_OUTPUT',
  );
  await removeOutput('hardlink.wav', { audioRoot: root });
  assert.deepEqual(await fs.promises.readFile(external), externalBytes);

  const symlink = path.join(root, 'symlink.wav');
  try {
    await fs.promises.symlink(external, symlink, 'file');
    await assert.rejects(
      validateOutput('symlink.wav', { audioRoot: root }),
      (error) => error.code === 'TTS_INVALID_OUTPUT',
    );
    await removeOutput('symlink.wav', { audioRoot: root });
    assert.deepEqual(await fs.promises.readFile(external), externalBytes);
  } catch (error) {
    if (error.code !== 'EPERM') throw error;
    const originalLstat = fs.promises.lstat;
    fs.promises.lstat = async (target, options) => {
      if (target === symlink) {
        return {
          isFile: () => true,
          isSymbolicLink: () => true,
          nlink: 1n,
          dev: 1n,
          ino: 1n,
          size: BigInt(externalBytes.length),
        };
      }
      return originalLstat(target, options);
    };
    try {
      await assert.rejects(
        validateOutput('symlink.wav', { audioRoot: root }),
        (validationError) => validationError.code === 'TTS_INVALID_OUTPUT',
      );
    } finally {
      fs.promises.lstat = originalLstat;
    }
    t.diagnostic('Windows denied symlink creation; the fail-closed lstat branch was exercised with a deterministic filesystem seam.');
  }
});

test('output validation detects an atomic pathname swap while retaining the opened descriptor', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-validator-swap-'));
  const externalRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-validator-swap-external-'));
  t.after(() => Promise.all([
    fs.promises.rm(root, { recursive: true, force: true }),
    fs.promises.rm(externalRoot, { recursive: true, force: true }),
  ]));

  const candidate = path.join(root, 'swap.wav');
  const replacement = path.join(root, 'replacement.wav');
  const backup = path.join(root, 'original.wav');
  const external = path.join(externalRoot, 'external.wav');
  const externalBytes = validMonoWav();
  await fs.promises.writeFile(candidate, validMonoWav());
  await fs.promises.writeFile(external, externalBytes);
  await fs.promises.copyFile(external, replacement);

  await assert.rejects(validateOutput('swap.wav', {
    audioRoot: root,
    testHooks: {
      async afterOpen() {
        await fs.promises.rename(candidate, backup);
        await fs.promises.rename(replacement, candidate);
      },
    },
  }), (error) => error.code === 'TTS_INVALID_OUTPUT');

  assert.deepEqual(await fs.promises.readFile(external), externalBytes);
  assert.equal(await removeOutput('swap.wav', { audioRoot: root }), true);
  assert.deepEqual(await fs.promises.readFile(external), externalBytes);
});

test('publication rejects a public-path swap after final validation and never registers replacement bytes', async (t) => {
  const stagingRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-publish-stage-'));
  const publishedRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-publish-final-'));
  const externalRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'synthenia-publish-external-'));
  t.after(() => Promise.all([
    fs.promises.rm(stagingRoot, { recursive: true, force: true }),
    fs.promises.rm(publishedRoot, { recursive: true, force: true }),
    fs.promises.rm(externalRoot, { recursive: true, force: true }),
  ]));

  const stagingName = 'stage.wav';
  const publishedName = 'tts_neural_pub_00000000-0000-4000-8000-000000000001.wav';
  const sourceBytes = validMonoWav();
  const replacementBytes = validMonoWav();
  replacementBytes[replacementBytes.length - 1] = 127;
  const external = path.join(externalRoot, 'external.wav');
  const originalPublished = path.join(publishedRoot, 'verified-original.wav');
  await fs.promises.writeFile(path.join(stagingRoot, stagingName), sourceBytes);
  await fs.promises.writeFile(external, replacementBytes);
  let registrations = 0;

  await assert.rejects(validateAndPublish(stagingName, {
    stagingRoot,
    publishedRoot,
    publishedName,
    registerPublished() { registrations += 1; },
    testHooks: {
      async afterPublishedBeforeRegister({ publishedCandidate }) {
        await fs.promises.rename(publishedCandidate, originalPublished);
        await fs.promises.copyFile(external, publishedCandidate);
      },
    },
  }), (error) => error.code === 'TTS_INVALID_OUTPUT');

  assert.equal(registrations, 0);
  assert.deepEqual(await fs.promises.readFile(external), replacementBytes);
  assert.deepEqual(await fs.promises.readFile(path.join(publishedRoot, publishedName)), replacementBytes);
  assert.deepEqual(await fs.promises.readFile(originalPublished), sourceBytes);
  assert.equal(fs.existsSync(path.join(stagingRoot, stagingName)), false);
});
