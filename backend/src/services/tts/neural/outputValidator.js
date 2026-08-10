const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { LIMITS, TTSError } = require('./contracts');

const DEFAULT_AUDIO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', 'audio');

function assertSafeFilename(filename) {
  if (typeof filename !== 'string' || !filename || filename.length > 180
    || filename !== path.basename(filename) || /[\\/]/.test(filename)
    || path.extname(filename).toLowerCase() !== '.wav') {
    throw new TTSError('TTS_INVALID_OUTPUT');
  }
  return filename;
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`)
    && relative !== '..' && !path.isAbsolute(relative);
}

async function readAt(handle, length, position) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  if (bytesRead !== length) throw new TTSError('TTS_INVALID_OUTPUT');
  return buffer;
}

function assertStableRegularFile(stat, limits) {
  if (!stat || !stat.isFile() || stat.isSymbolicLink()
    || stat.nlink !== 1n || stat.dev < 0n || stat.ino <= 0n
    || stat.size <= 0n || stat.size > BigInt(limits.maxOutputBytes)) {
    throw new TTSError('TTS_INVALID_OUTPUT');
  }
}

function hasSameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function assertSameSnapshot(left, right) {
  if (!hasSameIdentity(left, right) || left.size !== right.size || left.nlink !== right.nlink) {
    throw new TTSError('TTS_INVALID_OUTPUT');
  }
}

async function inspectPcmWav(handle, fileSize, limits) {
  const riff = await readAt(handle, 12, 0);
  if (riff.toString('ascii', 0, 4) !== 'RIFF'
    || riff.toString('ascii', 8, 12) !== 'WAVE'
    || riff.readUInt32LE(4) + 8 !== fileSize) {
    throw new TTSError('TTS_INVALID_OUTPUT');
  }

  let offset = 12;
  let chunks = 0;
  let format = null;
  let dataBytes = null;
  while (offset + 8 <= fileSize) {
    chunks += 1;
    if (chunks > 1024) throw new TTSError('TTS_INVALID_OUTPUT');
    const header = await readAt(handle, 8, offset);
    const id = header.toString('ascii', 0, 4);
    const chunkSize = header.readUInt32LE(4);
    const dataOffset = offset + 8;
    const nextOffset = dataOffset + chunkSize + (chunkSize % 2);
    if (nextOffset > fileSize) throw new TTSError('TTS_INVALID_OUTPUT');

    if (id === 'fmt ' && format === null) {
      if (chunkSize < 16) throw new TTSError('TTS_INVALID_OUTPUT');
      const fmt = await readAt(handle, 16, dataOffset);
      format = {
        audioFormat: fmt.readUInt16LE(0),
        channels: fmt.readUInt16LE(2),
        sampleRate: fmt.readUInt32LE(4),
        byteRate: fmt.readUInt32LE(8),
        blockAlign: fmt.readUInt16LE(12),
        bitsPerSample: fmt.readUInt16LE(14),
      };
    } else if (id === 'data' && dataBytes === null) {
      dataBytes = chunkSize;
    }
    offset = nextOffset;
  }

  if (!format || !dataBytes || offset !== fileSize || format.audioFormat !== 1
    || format.channels !== 1 || format.sampleRate < 8000 || format.sampleRate > 96000
    || ![8, 16, 24, 32].includes(format.bitsPerSample)) {
    throw new TTSError('TTS_INVALID_OUTPUT');
  }
  const expectedAlign = format.channels * (format.bitsPerSample / 8);
  if (format.blockAlign !== expectedAlign
    || format.byteRate !== format.sampleRate * expectedAlign
    || dataBytes % format.blockAlign !== 0) {
    throw new TTSError('TTS_INVALID_OUTPUT');
  }
  const durationSeconds = dataBytes / format.byteRate;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0
    || durationSeconds > limits.maxOutputSeconds) {
    throw new TTSError('TTS_INVALID_OUTPUT');
  }
  return { durationSeconds, sizeBytes: fileSize };
}

async function assertPathStillMatches(candidate, realRoot, openedStat, limits) {
  const currentStat = await fs.promises.lstat(candidate, { bigint: true });
  assertStableRegularFile(currentStat, limits);
  assertSameSnapshot(currentStat, openedStat);
  const currentRealPath = await fs.promises.realpath(candidate);
  if (!isContained(realRoot, currentRealPath)) throw new TTSError('TTS_INVALID_OUTPUT');
}

async function openValidatedOutput(filename, options = {}) {
  const limits = { ...LIMITS, ...options.limits };
  const audioRoot = path.resolve(options.audioRoot || DEFAULT_AUDIO_ROOT);
  assertSafeFilename(filename);
  await fs.promises.mkdir(audioRoot, { recursive: true });

  const candidate = path.resolve(audioRoot, filename);
  if (!isContained(audioRoot, candidate)) throw new TTSError('TTS_INVALID_OUTPUT');
  let handle;
  try {
    const beforeStat = await fs.promises.lstat(candidate, { bigint: true });
    assertStableRegularFile(beforeStat, limits);
    const [realRoot, realCandidate] = await Promise.all([
      fs.promises.realpath(audioRoot),
      fs.promises.realpath(candidate),
    ]);
    if (!isContained(realRoot, realCandidate)) throw new TTSError('TTS_INVALID_OUTPUT');

    const openFlags = Number.isInteger(fs.constants.O_NOFOLLOW)
      ? fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW
      : fs.constants.O_RDONLY;
    handle = await fs.promises.open(candidate, openFlags);
    const openedStat = await handle.stat({ bigint: true });
    assertStableRegularFile(openedStat, limits);
    assertSameSnapshot(beforeStat, openedStat);

    if (typeof options.testHooks?.afterOpen === 'function') {
      await options.testHooks.afterOpen({ candidate });
    }

    await assertPathStillMatches(candidate, realRoot, openedStat, limits);
    const fileSize = Number(openedStat.size);
    const metrics = await inspectPcmWav(handle, fileSize, limits);
    const finalOpenedStat = await handle.stat({ bigint: true });
    assertStableRegularFile(finalOpenedStat, limits);
    assertSameSnapshot(openedStat, finalOpenedStat);
    await assertPathStillMatches(candidate, realRoot, finalOpenedStat, limits);
    return {
      filename,
      candidate,
      realRoot,
      handle,
      stat: finalOpenedStat,
      metrics,
      limits,
    };
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    if (error instanceof TTSError) throw error;
    throw new TTSError('TTS_INVALID_OUTPUT');
  }
}

async function validateOutput(filename, options = {}) {
  const opened = await openValidatedOutput(filename, options);
  try {
    return { filename, ...opened.metrics };
  } finally {
    await opened.handle.close().catch(() => {});
  }
}

async function copyAndHash(source, destination, sizeBytes) {
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.alloc(Math.min(64 * 1024, sizeBytes));
  let position = 0;
  while (position < sizeBytes) {
    const wanted = Math.min(buffer.length, sizeBytes - position);
    const { bytesRead } = await source.read(buffer, 0, wanted, position);
    if (bytesRead !== wanted) throw new TTSError('TTS_INVALID_OUTPUT');
    hash.update(buffer.subarray(0, bytesRead));
    let written = 0;
    while (written < bytesRead) {
      const result = await destination.write(buffer, written, bytesRead - written, position + written);
      if (result.bytesWritten <= 0) throw new TTSError('TTS_INVALID_OUTPUT');
      written += result.bytesWritten;
    }
    position += bytesRead;
  }
  return hash.digest('hex');
}

async function hashHandle(handle, sizeBytes) {
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.alloc(Math.min(64 * 1024, sizeBytes));
  let position = 0;
  while (position < sizeBytes) {
    const wanted = Math.min(buffer.length, sizeBytes - position);
    const { bytesRead } = await handle.read(buffer, 0, wanted, position);
    if (bytesRead !== wanted) throw new TTSError('TTS_INVALID_OUTPUT');
    hash.update(buffer.subarray(0, bytesRead));
    position += bytesRead;
  }
  return hash.digest('hex');
}

function rootsAreSeparated(first, second) {
  return first !== second && !isContained(first, second) && !isContained(second, first);
}

async function validateAndPublish(stagingName, options = {}) {
  const stagingRoot = path.resolve(options.stagingRoot || path.join(path.dirname(DEFAULT_AUDIO_ROOT), 'audio-staging', 'neural'));
  const publishedRoot = path.resolve(options.publishedRoot || DEFAULT_AUDIO_ROOT);
  const registerPublished = options.registerPublished;
  const publishedName = options.publishedName || `tts_neural_pub_${crypto.randomUUID()}.wav`;
  assertSafeFilename(publishedName);
  if (typeof registerPublished !== 'function') throw new TypeError('registerPublished is required');
  await Promise.all([
    fs.promises.mkdir(stagingRoot, { recursive: true }),
    fs.promises.mkdir(publishedRoot, { recursive: true }),
  ]);
  const [realStagingRoot, realPublishedRoot] = await Promise.all([
    fs.promises.realpath(stagingRoot),
    fs.promises.realpath(publishedRoot),
  ]);
  if (!rootsAreSeparated(realStagingRoot, realPublishedRoot)) {
    throw new TTSError('TTS_INVALID_OUTPUT');
  }

  const publishedCandidate = path.resolve(publishedRoot, publishedName);
  if (!isContained(publishedRoot, publishedCandidate)) throw new TTSError('TTS_INVALID_OUTPUT');

  let source;
  try {
    source = await openValidatedOutput(stagingName, {
      audioRoot: stagingRoot,
      limits: options.limits,
      testHooks: options.testHooks,
    });
  } catch (error) {
    await removeStaging(stagingName, { stagingRoot });
    throw error;
  }

  let publishedHandle;
  let publishedStat;
  let publishedIdentity;
  let registered = false;
  try {
    const flags = fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL;
    publishedHandle = await fs.promises.open(publishedCandidate, flags, 0o600);
    const createdStat = await publishedHandle.stat({ bigint: true });
    publishedIdentity = { dev: createdStat.dev, ino: createdStat.ino };
    const sizeBytes = Number(source.stat.size);
    const sourceSha256 = await copyAndHash(source.handle, publishedHandle, sizeBytes);
    await publishedHandle.sync();

    publishedStat = await publishedHandle.stat({ bigint: true });
    assertStableRegularFile(publishedStat, source.limits);
    if (publishedStat.size !== source.stat.size) throw new TTSError('TTS_INVALID_OUTPUT');
    await assertPathStillMatches(publishedCandidate, realPublishedRoot, publishedStat, source.limits);
    const publishedMetrics = await inspectPcmWav(publishedHandle, sizeBytes, source.limits);
    const publishedSha256 = await hashHandle(publishedHandle, sizeBytes);
    if (publishedSha256 !== sourceSha256
      || publishedMetrics.sizeBytes !== source.metrics.sizeBytes
      || publishedMetrics.durationSeconds !== source.metrics.durationSeconds) {
      throw new TTSError('TTS_INVALID_OUTPUT');
    }
    if (typeof options.testHooks?.afterPublishedBeforeRegister === 'function') {
      await options.testHooks.afterPublishedBeforeRegister({
        stagingCandidate: source.candidate,
        publishedCandidate,
        publishedName,
      });
    }

    const finalHandleStat = await publishedHandle.stat({ bigint: true });
    assertStableRegularFile(finalHandleStat, source.limits);
    assertSameSnapshot(publishedStat, finalHandleStat);
    await assertPathStillMatches(publishedCandidate, realPublishedRoot, finalHandleStat, source.limits);
    const finalSha256 = await hashHandle(publishedHandle, sizeBytes);
    if (finalSha256 !== sourceSha256) throw new TTSError('TTS_INVALID_OUTPUT');

    await registerPublished({
      filename: publishedName,
      sha256: finalSha256,
      sizeBytes,
      durationSeconds: publishedMetrics.durationSeconds,
      dev: finalHandleStat.dev,
      ino: finalHandleStat.ino,
      createdAtMs: Date.now(),
    });
    registered = true;
    return {
      filename: publishedName,
      sha256: finalSha256,
      sizeBytes,
      durationSeconds: publishedMetrics.durationSeconds,
    };
  } catch (error) {
    if (error instanceof TTSError) throw error;
    throw new TTSError('TTS_INVALID_OUTPUT');
  } finally {
    if (publishedHandle) await publishedHandle.close().catch(() => {});
    await source.handle.close().catch(() => {});
    await removeStaging(stagingName, { stagingRoot });
    if (!registered && publishedIdentity) {
      await removePublished(publishedName, {
        publishedRoot,
        expectedIdentity: publishedIdentity,
      });
    }
  }
}

async function removeOutput(filename, options = {}) {
  try {
    const audioRoot = path.resolve(options.audioRoot || DEFAULT_AUDIO_ROOT);
    assertSafeFilename(filename);
    const candidate = path.resolve(audioRoot, filename);
    if (!isContained(audioRoot, candidate)) return false;
    const stat = await fs.promises.lstat(candidate, { bigint: true }).catch(() => null);
    if (!stat || (!stat.isFile() && !stat.isSymbolicLink())) return false;
    if (options.expectedIdentity && (stat.isSymbolicLink()
      || stat.dev !== options.expectedIdentity.dev || stat.ino !== options.expectedIdentity.ino)) {
      return false;
    }
    await fs.promises.unlink(candidate);
    return true;
  } catch {
    return false;
  }
}

function removeStaging(filename, options = {}) {
  return removeOutput(filename, { audioRoot: options.stagingRoot });
}

function removePublished(filename, options = {}) {
  return removeOutput(filename, {
    audioRoot: options.publishedRoot,
    expectedIdentity: options.expectedIdentity,
  });
}

module.exports = {
  DEFAULT_AUDIO_ROOT,
  assertSafeFilename,
  validateOutput,
  validateAndPublish,
  removeOutput,
  removeStaging,
  removePublished,
};
