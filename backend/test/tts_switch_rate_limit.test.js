const test = require('node:test');
const assert = require('node:assert/strict');

const previousApiKey = process.env.CONTROL_PANEL_API_KEY;
process.env.CONTROL_PANEL_API_KEY = 'tts-switch-rate-limit-test-key';

const apiKeyAuth = require('../src/middleware/apiKeyAuth');
const { ttsSwitchLimit } = require('../src/middleware/rateLimits');
const ttsManager = require('../src/services/tts/index');
const ttsRoutes = require('../src/routes/tts');

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    finished: false,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this.finished = true; return this; },
  };
}

async function dispatch(stack, req, res, index = 0) {
  if (index >= stack.length || res.finished) return;
  let nextCalled = false;
  let nextError;
  const result = stack[index].handle(req, res, (error) => {
    nextCalled = true;
    nextError = error;
  });
  await result;
  if (nextError) throw nextError;
  if (nextCalled && !res.finished) await dispatch(stack, req, res, index + 1);
}

test('authenticated TTS switch permits five requests and rejects the sixth before manager invocation', async () => {
  const switchLayer = ttsRoutes.stack.find((layer) => layer.route?.path === '/switch');
  assert.ok(switchLayer);
  const stack = switchLayer.route.stack;
  assert.equal(stack[0].handle, apiKeyAuth);
  assert.equal(stack[1].handle, ttsSwitchLimit);

  const originalSwitchProvider = ttsManager.switchProvider;
  let managerCalls = 0;
  ttsManager.switchProvider = async (provider) => {
    managerCalls += 1;
    return provider;
  };

  try {
    const unauthorizedResponse = makeResponse();
    await dispatch(stack, {
      headers: {}, baseUrl: '/api/tts', path: '/switch', body: { provider: 'gtts' },
    }, unauthorizedResponse);
    assert.equal(unauthorizedResponse.statusCode, 401);
    assert.equal(managerCalls, 0);

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const response = makeResponse();
      await dispatch(stack, {
        headers: { 'x-api-key': 'tts-switch-rate-limit-test-key' },
        baseUrl: '/api/tts',
        path: '/switch',
        body: { provider: 'gtts' },
      }, response);
      assert.equal(response.statusCode, attempt <= 5 ? 200 : 429);
    }
    assert.equal(managerCalls, 5);
  } finally {
    ttsManager.switchProvider = originalSwitchProvider;
    if (previousApiKey === undefined) delete process.env.CONTROL_PANEL_API_KEY;
    else process.env.CONTROL_PANEL_API_KEY = previousApiKey;
  }
});
