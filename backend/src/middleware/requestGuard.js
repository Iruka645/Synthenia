const crypto = require('crypto');

function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = String(id).slice(0, 128);
  res.setHeader('x-request-id', req.id);
  next();
}

function errorHandler(err, req, res, _next) {
  const status = Number.isInteger(err.status) ? err.status : 500;
  const code = err.code || (status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR');
  console.error(`[${req.id || 'unknown'}] ${err.stack || err.message || err}`);
  res.status(status).json({
    error: {
      code,
      message: status < 500 ? (err.publicMessage || err.message) : 'Internal server error',
      requestId: req.id,
    },
  });
}

function notFound(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

module.exports = { requestId, errorHandler, notFound };
