const express = require('express');
const router = express.Router();
const ttsManager = require('../services/tts/index');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { expensiveLimit, ttsSwitchLimit } = require('../middleware/rateLimits');

function sendTTSError(res, error, fallbackStatus = 500) {
  const status = Number.isInteger(error.httpStatus) ? error.httpStatus : fallbackStatus;
  const code = typeof error.code === 'string' ? error.code : 'TTS_SYNTHESIS_FAILED';
  const message = typeof error.code === 'string' ? error.message : 'TTS request failed.';
  return res.status(status).json({ error: message, code });
}

router.get('/current', (req, res) => {
  try {
    res.json({ provider: ttsManager.getCurrentProvider() });
  } catch (error) {
    sendTTSError(res, error);
  }
});

router.get('/list', (req, res) => {
  try {
    res.json({ providers: ttsManager.getAvailableProviders() });
  } catch (error) {
    sendTTSError(res, error);
  }
});

// Pure observation: this route never starts, loads, installs, or downloads a provider.
router.get('/status', (req, res) => {
  try {
    res.json({ providers: ttsManager.getProviderStatuses() });
  } catch (error) {
    sendTTSError(res, error);
  }
});

router.post('/switch', apiKeyAuth, ttsSwitchLimit, async (req, res) => {
  const { provider } = req.body || {};
  if (typeof provider !== 'string' || !provider.trim()) {
    return res.status(400).json({ error: 'Provider is required.', code: 'TTS_UNKNOWN_PROVIDER' });
  }
  try {
    const active = await ttsManager.switchProvider(provider, 'control-panel');
    return res.json({ status: 'ok', provider: active });
  } catch (error) {
    return sendTTSError(res, error, 400);
  }
});

router.post('/preview', apiKeyAuth, expensiveLimit, async (req, res) => {
  const { text, provider, voiceConversion, pitch, indexRate } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Preview text is required.', code: 'TTS_INVALID_INPUT' });
  }
  if (provider !== undefined && (typeof provider !== 'string' || !provider.trim())) {
    return res.status(400).json({ error: 'Provider must be a non-empty string.', code: 'TTS_UNKNOWN_PROVIDER' });
  }
  const providerName = typeof provider === 'string' && provider.trim()
    ? provider.trim().toLowerCase()
    : ttsManager.getCurrentProvider();

  try {
    const result = await ttsManager.preview(text, providerName, {
      voiceConversion: voiceConversion === true,
      pitch: pitch !== undefined ? Number(pitch) : 0,
      indexRate: indexRate !== undefined ? Number(indexRate) : 0.4,
    });
    const audioUrl = `${req.protocol}://${req.get('host')}/audio/${encodeURIComponent(result.filename)}`;
    return res.json({
      provider: result.provider,
      audioUrl,
      voiceConversionEnabled: result.voiceConversionEnabled,
    });
  } catch (error) {
    console.error(`[TTS Preview] provider=${providerName} code=${error.code || 'TTS_SYNTHESIS_FAILED'}`);
    return sendTTSError(res, error);
  }
});

module.exports = router;
