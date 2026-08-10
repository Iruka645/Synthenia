const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { LIMITS } = require('./contracts');

const RESERVED_PREFIX = 'tts_neural_pub_';
const RESERVED_PATTERN = /^tts_neural_pub_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.wav$/i;
const DEFAULT_PUBLISHED_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', 'audio');
const DEFAULT_STAGING_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', 'audio-staging', 'neural');

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

function sameIdentity(stat, meta) {
  return stat.dev === meta.dev && stat.ino === meta.ino && stat.size === BigInt(meta.sizeBytes);
}

async function readVerifiedBuffer(handle, sizeBytes) {
  const buffer = Buffer.alloc(sizeBytes);
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
    if (bytesRead <= 0) throw new Error('short read');
    offset += bytesRead;
  }
  return buffer;
}

class PublishedAudioStore {
  constructor(options = {}) {
    this.publishedRoot = path.resolve(options.publishedRoot || DEFAULT_PUBLISHED_ROOT);
    this.stagingRoot = path.resolve(options.stagingRoot || DEFAULT_STAGING_ROOT);
    this.limits = { ...LIMITS, ...options.limits };
    this.entries = new Map();
    this.initialized = false;
    this.initializePromise = null;
  }

  isReservedName(filename) {
    return typeof filename === 'string' && filename === path.basename(filename)
      && filename.toLowerCase().startsWith(RESERVED_PREFIX)
      && filename.toLowerCase().endsWith('.wav');
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initializePromise) return this.initializePromise;
    this.initializePromise = (async () => {
      await Promise.all([
        fs.promises.mkdir(this.publishedRoot, { recursive: true }),
        fs.promises.mkdir(this.stagingRoot, { recursive: true }),
      ]);
      const files = await fs.promises.readdir(this.publishedRoot).catch(() => []);
      for (const filename of files) {
        if (!this.isReservedName(filename)) continue;
        const candidate = path.resolve(this.publishedRoot, filename);
        if (!isContained(this.publishedRoot, candidate)) continue;
        await fs.promises.unlink(candidate).catch(() => {});
      }
      await this.cleanup({ stagingCutoff: Date.now() + 1 });
      this.initialized = true;
    })();
    try {
      await this.initializePromise;
    } finally {
      this.initializePromise = null;
    }
  }

  register(meta) {
    if (!meta || !RESERVED_PATTERN.test(meta.filename) || this.entries.has(meta.filename)
      || typeof meta.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(meta.sha256)
      || !Number.isInteger(meta.sizeBytes) || meta.sizeBytes <= 0
      || meta.sizeBytes > this.limits.maxOutputBytes
      || typeof meta.dev !== 'bigint' || typeof meta.ino !== 'bigint' || meta.ino <= 0n) {
      throw new Error('Invalid published audio metadata');
    }
    this.entries.set(meta.filename, {
      ...meta,
      createdAtMs: Number.isFinite(meta.createdAtMs) ? meta.createdAtMs : Date.now(),
    });
  }

  async _invalidate(filename, meta) {
    this.entries.delete(filename);
    const candidate = path.resolve(this.publishedRoot, filename);
    const stat = await fs.promises.lstat(candidate, { bigint: true }).catch(() => null);
    if (stat && stat.isFile() && !stat.isSymbolicLink() && sameIdentity(stat, meta)) {
      await fs.promises.unlink(candidate).catch(() => {});
    }
  }

  async serve(filename, req, res) {
    if (!this.isReservedName(filename)) return false;
    const meta = this.entries.get(filename);
    if (!meta) {
      res.status(404).end();
      return true;
    }

    const candidate = path.resolve(this.publishedRoot, filename);
    let handle;
    try {
      if (!isContained(this.publishedRoot, candidate)) throw new Error('outside root');
      const before = await fs.promises.lstat(candidate, { bigint: true });
      if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n
        || !sameIdentity(before, meta)) throw new Error('identity mismatch');
      const realRoot = await fs.promises.realpath(this.publishedRoot);
      const realCandidate = await fs.promises.realpath(candidate);
      if (!isContained(realRoot, realCandidate)) throw new Error('outside root');

      const flags = Number.isInteger(fs.constants.O_NOFOLLOW)
        ? fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW
        : fs.constants.O_RDONLY;
      handle = await fs.promises.open(candidate, flags);
      const opened = await handle.stat({ bigint: true });
      if (!opened.isFile() || opened.nlink !== 1n || !sameIdentity(opened, meta)) {
        throw new Error('identity mismatch');
      }
      const buffer = await readVerifiedBuffer(handle, meta.sizeBytes);
      const digest = crypto.createHash('sha256').update(buffer).digest('hex');
      const afterHandle = await handle.stat({ bigint: true });
      const afterPath = await fs.promises.lstat(candidate, { bigint: true });
      if (!sameIdentity(afterHandle, meta) || !sameIdentity(afterPath, meta)
        || afterPath.isSymbolicLink() || afterPath.nlink !== 1n || digest !== meta.sha256) {
        throw new Error('verification failed');
      }

      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Accept-Ranges', 'bytes');
      const range = typeof req.headers?.range === 'string'
        ? /^bytes=(\d+)-(\d*)$/.exec(req.headers.range) : null;
      if (range) {
        const start = Number(range[1]);
        const requestedEnd = range[2] ? Number(range[2]) : buffer.length - 1;
        const end = Math.min(requestedEnd, buffer.length - 1);
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end) {
          res.setHeader('Content-Range', `bytes */${buffer.length}`);
          res.status(416).end();
          return true;
        }
        const body = buffer.subarray(start, end + 1);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${buffer.length}`);
        res.setHeader('Content-Length', body.length);
        res.status(206).send(body);
        return true;
      }
      res.setHeader('Content-Length', buffer.length);
      res.status(200).send(buffer);
      return true;
    } catch {
      await this._invalidate(filename, meta);
      if (!res.headersSent) res.status(404).end();
      return true;
    } finally {
      if (handle) await handle.close().catch(() => {});
    }
  }

  async remove(filename) {
    const meta = this.entries.get(filename);
    if (!meta) return false;
    await this._invalidate(filename, meta);
    return true;
  }

  async cleanup({ publishedCutoff = -Infinity, stagingCutoff = -Infinity } = {}) {
    let count = 0;
    for (const [filename, meta] of [...this.entries]) {
      if (meta.createdAtMs < publishedCutoff) {
        if (await this.remove(filename)) count += 1;
      }
    }
    const stagingFiles = await fs.promises.readdir(this.stagingRoot).catch(() => []);
    for (const filename of stagingFiles) {
      if (filename !== path.basename(filename)) continue;
      const candidate = path.resolve(this.stagingRoot, filename);
      if (!isContained(this.stagingRoot, candidate)) continue;
      const stat = await fs.promises.lstat(candidate, { bigint: true }).catch(() => null);
      if (!stat || (!stat.isFile() && !stat.isSymbolicLink())) continue;
      if (Number(stat.mtimeMs) < stagingCutoff) {
        const removed = await fs.promises.unlink(candidate).then(() => true).catch(() => false);
        if (removed) count += 1;
      }
    }
    return count;
  }

  async shutdown() {
    this.entries.clear();
  }
}

function createPublishedAudioMiddleware(store) {
  return async (req, res, next) => {
    try {
      const handled = await store.serve(req.params.filename, req, res);
      if (!handled) next();
    } catch {
      if (!res.headersSent) res.status(404).end();
    }
  };
}

const publishedAudioStore = new PublishedAudioStore();

module.exports = {
  RESERVED_PREFIX,
  DEFAULT_PUBLISHED_ROOT,
  DEFAULT_STAGING_ROOT,
  PublishedAudioStore,
  publishedAudioStore,
  createPublishedAudioMiddleware,
};
