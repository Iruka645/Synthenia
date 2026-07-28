const express = require('express');
const router = express.Router();
const ttsManager = require('../services/tts/index');
const { createTTSProvider } = require('../services/tts/ttsFactory');
const voiceConversionService = require('../services/voiceConversionService');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { expensiveLimit } = require('../middleware/rateLimits');

// GET current active provider
router.get('/current', (req, res) => {
  try {
    const current = ttsManager.getCurrentProvider();
    res.json({ provider: current });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET list of all supported providers
router.get('/list', (req, res) => {
  try {
    const list = ttsManager.getAvailableProviders();
    res.json({ providers: list });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST switch active provider
router.post('/switch', apiKeyAuth, async (req, res) => {
  const { provider } = req.body;
  if (!provider) {
    return res.status(400).json({ error: 'à¸•à¹‰à¸­à¸‡à¸£à¸°à¸šà¸¸à¸Šà¸·à¹ˆà¸­ provider à¹ƒà¸™ request body' });
  }

  try {
    const active = await ttsManager.switchProvider(provider, 'control-panel');
    res.json({ status: 'ok', provider: active });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST preview synthesis for testing individual providers
router.post('/preview', apiKeyAuth, expensiveLimit, async (req, res) => {
  const { text, provider, voiceConversion, pitch, indexRate } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'à¸•à¹‰à¸­à¸‡à¸£à¸°à¸šà¸¸à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡ text à¸ªà¸³à¸«à¸£à¸±à¸šà¸ªà¸±à¸‡à¹€à¸„à¸£à¸²à¸°à¸«à¹Œà¹€à¸ªà¸µà¸¢à¸‡' });
  }

  const providerName = provider ? provider.trim().toLowerCase() : ttsManager.getCurrentProvider();
  
  try {
    const tempProvider = createTTSProvider(providerName);
    let audioFilename = await tempProvider.synthesize(text.trim());
    
    if (voiceConversion) {
      const finalPitch = pitch !== undefined ? parseInt(pitch, 10) : 0;
      const finalIndexRate = indexRate !== undefined ? parseFloat(indexRate) : 0.4;
      audioFilename = await voiceConversionService.convert(audioFilename, finalPitch, finalIndexRate);
    }

    const audioUrl = `${req.protocol}://${req.get('host')}/audio/${audioFilename}`;
    res.json({ provider: providerName, audioUrl, voiceConversionEnabled: !!voiceConversion });
  } catch (error) {
    console.error(`[TTS Preview Error]:`, error.message);
    res.status(500).json({ error: `à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¸ªà¸±à¸‡à¹€à¸„à¸£à¸²à¸°à¸«à¹Œà¹€à¸ªà¸µà¸¢à¸‡à¸‚à¸­à¸‡ ${providerName}: ${error.message}` });
  }
});

module.exports = router;

