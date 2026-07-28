const test = require('node:test');
const assert = require('node:assert/strict');

test('security defaults bind local mode to loopback and expose bounded limits', () => {
  const config = require('../src/config/securityConfig');
  assert.equal(config.mode, 'local');
  assert.ok(['127.0.0.1', 'localhost'].includes(config.host));
  assert.ok(config.maxAudioBytes > 0);
  assert.ok(config.allowedOrigins.includes('http://localhost:6060'));
});

test('request id middleware preserves a safe incoming id and returns it', () => {
  const { requestId } = require('../src/middleware/requestGuard');
  const headers = {};
  const req = { headers: { 'x-request-id': 'test-request-123' } };
  const res = { setHeader: (key, value) => { headers[key] = value; } };
  let called = false;
  requestId(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(req.id, 'test-request-123');
  assert.equal(headers['x-request-id'], 'test-request-123');
});

test('origin guard rejects an origin outside the configured allowlist', () => {
  const originGuard = require('../src/middleware/originGuard');
  const middleware = originGuard(['http://localhost:6060']);
  let status;
  const res = {
    status(value) { status = value; return this; },
    json() { return this; }
  };
  middleware({ headers: { origin: 'http://evil.invalid' } }, res, () => {
    throw new Error('unexpectedly allowed origin');
  });
  assert.equal(status, 403);
});
