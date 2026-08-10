const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_METADATA_BYTES = 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readRegularFileSnapshot(filename, includeHash = true) {
  const stats = fs.lstatSync(filename);
  if (!stats.isFile() || stats.isSymbolicLink()
    || stats.size <= 0 || stats.size > MAX_METADATA_BYTES) {
    throw new Error('invalid metadata');
  }
  const buffer = fs.readFileSync(filename);
  if (buffer.length !== stats.size) throw new Error('metadata changed');
  return { buffer, sha256: includeHash ? sha256Buffer(buffer) : undefined };
}

function parseJsonBuffer(buffer) {
  const value = JSON.parse(buffer.toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid metadata');
  }
  return value;
}

function gatesAllowEnablement(manifest) {
  const gates = manifest?.gates;
  return manifest?.schemaVersion === 1
    && manifest?.security?.trustRemoteCode === false
    && manifest?.security?.runtimeNetwork === false
    && gates?.pinsVerified === true
    && gates?.licensesResolved === true
    && gates?.checksumsComplete === true
    && gates?.enablementAllowed === true;
}

function regularAbsoluteFile(filename) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename)) return false;
  try {
    const stats = fs.lstatSync(filename);
    return stats.isFile() && !stats.isSymbolicLink();
  } catch {
    return false;
  }
}

function createInstallStateChecker(options) {
  const providerId = options.providerId;
  const command = path.resolve(options.command);
  const providerRoot = path.resolve(options.providerRoot);
  const receiptPath = path.resolve(options.receiptPath);
  const manifestPath = path.resolve(options.manifestPath);
  const lockPath = path.resolve(options.lockPath);
  let snapshot;

  try {
    const manifestFile = readRegularFileSnapshot(manifestPath);
    const lockFile = readRegularFileSnapshot(lockPath);
    const manifest = parseJsonBuffer(manifestFile.buffer);
    if (manifest?.provider?.id !== providerId
      || manifest?.dependencies?.lockFile !== path.basename(lockPath)
      || manifest?.dependencies?.sha256 !== lockFile.sha256) {
      throw new Error('invalid manifest');
    }
    snapshot = {
      manifest,
      manifestSha256: manifestFile.sha256,
      lockSha256: lockFile.sha256,
    };
  } catch {
    snapshot = null;
  }

  return function getInstallState() {
    if (!regularAbsoluteFile(command) || !regularAbsoluteFile(receiptPath)) {
      return { installed: false, state: 'not_installed', errorCode: undefined };
    }
    if (!snapshot || !gatesAllowEnablement(snapshot.manifest)) {
      return { installed: false, state: 'unavailable', errorCode: 'TTS_INSTALL_INVALID' };
    }
    let receipt;
    try {
      const providerReal = fs.realpathSync.native(providerRoot);
      const commandReal = fs.realpathSync.native(command);
      const receiptReal = fs.realpathSync.native(receiptPath);
      const relativeCommand = path.relative(providerReal, commandReal);
      const relativeReceipt = path.relative(providerReal, receiptReal);
      if (!relativeCommand || relativeCommand.startsWith('..') || path.isAbsolute(relativeCommand)
        || !relativeReceipt || relativeReceipt.startsWith('..') || path.isAbsolute(relativeReceipt)) {
        throw new Error('install path escaped');
      }
      receipt = parseJsonBuffer(readRegularFileSnapshot(receiptPath, false).buffer);
    } catch {
      return { installed: false, state: 'unavailable', errorCode: 'TTS_INSTALL_INVALID' };
    }
    const artifacts = receipt.artifacts;
    if (receipt.schemaVersion !== 1
      || receipt.providerId !== providerId
      || receipt.manifestSha256 !== snapshot.manifestSha256
      || receipt.lockSha256 !== snapshot.lockSha256
      || receipt.pythonVersion !== snapshot.manifest.python?.version
      || !Array.isArray(artifacts)
      || artifacts.length !== snapshot.manifest.artifacts.length) {
      return { installed: false, state: 'unavailable', errorCode: 'TTS_INSTALL_INVALID' };
    }
    const receiptArtifacts = new Map();
    for (const item of artifacts) {
      if (!item || typeof item.relativePath !== 'string'
        || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0
        || typeof item.sha256 !== 'string' || !SHA256_PATTERN.test(item.sha256)
        || receiptArtifacts.has(item.relativePath)) {
        return { installed: false, state: 'unavailable', errorCode: 'TTS_INSTALL_INVALID' };
      }
      receiptArtifacts.set(item.relativePath, item);
    }
    for (const artifact of snapshot.manifest.artifacts) {
      const item = receiptArtifacts.get(artifact.relativePath);
      if (!item || item.sizeBytes !== artifact.sizeBytes || item.sha256 !== artifact.sha256) {
        return { installed: false, state: 'unavailable', errorCode: 'TTS_INSTALL_INVALID' };
      }
    }
    return { installed: true, state: 'unavailable', errorCode: undefined };
  };
}

module.exports = {
  createInstallStateChecker,
  gatesAllowEnablement,
  sha256Buffer,
};
