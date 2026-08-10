const buckets = new Map();

function rateLimit({ windowMs = 60_000, limit = 30 } = {}) {
  return (req, res, next) => {
    const identity = req.headers['x-api-key'] || req.ip || 'local';
    const key = `${identity}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) bucket = { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
    }
    return next();
  };
}

function createSemaphore(max) {
  let active = 0;
  const queue = [];
  return async function withLimit(task) {
    if (active >= max) {
      await new Promise((resolve, reject) => queue.push({ resolve, reject }));
    }
    active += 1;
    try { return await task(); }
    finally {
      active -= 1;
      const next = queue.shift();
      if (next) next.resolve();
    }
  };
}

const chatLimit = rateLimit({ limit: 30 });
const sttLimit = rateLimit({ limit: 10 });
const expensiveLimit = rateLimit({ limit: 5 });
const ttsSwitchLimit = rateLimit({ limit: 5 });
const chatSlots = createSemaphore(2);
const audioSlots = createSemaphore(1);

module.exports = {
  rateLimit,
  chatLimit,
  sttLimit,
  expensiveLimit,
  ttsSwitchLimit,
  chatSlots,
  audioSlots,
};
