const express = require('express');
const router = express.Router();
const configService = require('../services/config/configService');
const llmManager = require('../services/llm/index');
const ttsManager = require('../services/tts/index');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { query } = require('../db/pool');
const llmConfig = require('../config/llmConfig');
const ttsConfig = require('../config/ttsConfig');
const { adminAuth } = require('../middleware/routePolicies');

// GET /api/config -> snapshot of all keys (no auth, read-only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const dbConfig = await configService.getAll();
    const responseConfig = {
      'llm.currentProvider': dbConfig['llm.currentProvider'] !== undefined ? dbConfig['llm.currentProvider'] : llmConfig.defaultProvider,
      'tts.currentProvider': dbConfig['tts.currentProvider'] !== undefined ? dbConfig['tts.currentProvider'] : ttsConfig.defaultProvider,
      'voiceConversion.enabled': dbConfig['voiceConversion.enabled'] !== undefined ? dbConfig['voiceConversion.enabled'] : (process.env.VOICE_CONVERSION_ENABLED === 'true'),
      'voiceConversion.pitch': dbConfig['voiceConversion.pitch'] !== undefined ? dbConfig['voiceConversion.pitch'] : (process.env.VOICE_CONVERSION_PITCH ? parseInt(process.env.VOICE_CONVERSION_PITCH, 10) : 0),
      'voiceConversion.indexRate': dbConfig['voiceConversion.indexRate'] !== undefined ? dbConfig['voiceConversion.indexRate'] : (process.env.VOICE_CONVERSION_INDEX_RATE ? parseFloat(process.env.VOICE_CONVERSION_INDEX_RATE) : 0.4),
      'llm.modelParams': dbConfig['llm.modelParams'] !== undefined ? dbConfig['llm.modelParams'] : { temperature: 0.8, top_p: 0.9, num_predict: 300 },
      'llm.modelByProvider': dbConfig['llm.modelByProvider'] !== undefined ? dbConfig['llm.modelByProvider'] : { ollama: process.env.AI_MODEL || 'gemma4:12b' },
      'memory.autoConsolidation': dbConfig['memory.autoConsolidation'] !== undefined ? dbConfig['memory.autoConsolidation'] : true,
    };
    res.json(responseConfig);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/config/audit-log -> list of audit log entries (no auth)
router.get('/audit-log', adminAuth, async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = parseInt(req.query.offset, 10) || 0;
  const cappedLimit = Math.min(Math.max(limit, 1), 100);
  const safeOffset = Math.max(offset, 0);
  try {
    const result = await query(
      `SELECT * FROM config_change_log ORDER BY changed_at DESC LIMIT $1 OFFSET $2`,
      [cappedLimit, safeOffset]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/config/fallback-events -> last 10 fallback events (no auth)
router.get('/fallback-events', adminAuth, (req, res) => {
  try {
    res.json(llmManager.fallbackEvents || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/config/history/:key -> history for a specific key (no auth)
router.get('/history/:key', adminAuth, async (req, res) => {
  const { key } = req.params;
  try {
    const result = await query(
      `SELECT * FROM config_change_log WHERE config_key = $1 ORDER BY changed_at DESC LIMIT 50`,
      [key]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/config/llm (auth)
router.patch('/llm', apiKeyAuth, async (req, res) => {
  const { provider, modelParams, modelByProvider } = req.body;
  const changedBy = 'control-panel';

  try {
    if (provider !== undefined) {
      await llmManager.switchProvider(provider, changedBy);
    }

    if (modelParams !== undefined) {
      if (typeof modelParams !== 'object' || modelParams === null) {
        return res.status(400).json({ error: 'modelParams à¸•à¹‰à¸­à¸‡à¹€à¸›à¹‡à¸™ object' });
      }
      const { temperature, top_p, num_predict } = modelParams;
      if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
        return res.status(400).json({ error: 'temperature à¸•à¹‰à¸­à¸‡à¸­à¸¢à¸¹à¹ˆà¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡ 0.0 à¸–à¸¶à¸‡ 2.0' });
      }
      if (top_p !== undefined && (typeof top_p !== 'number' || top_p < 0 || top_p > 1)) {
        return res.status(400).json({ error: 'top_p à¸•à¹‰à¸­à¸‡à¸­à¸¢à¸¹à¹ˆà¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡ 0.0 à¸–à¸¶à¸‡ 1.0' });
      }
      if (num_predict !== undefined && (typeof num_predict !== 'number' || num_predict <= 0)) {
        return res.status(400).json({ error: 'num_predict à¸•à¹‰à¸­à¸‡à¹€à¸›à¹‡à¸™à¸•à¸±à¸§à¹€à¸¥à¸‚à¸¡à¸²à¸à¸à¸§à¹ˆà¸² 0' });
      }
      
      const currentParams = await configService.get('llm.modelParams') || { temperature: 0.8, top_p: 0.9, num_predict: 300 };
      const newParams = {
        temperature: temperature !== undefined ? temperature : currentParams.temperature,
        top_p: top_p !== undefined ? top_p : currentParams.top_p,
        num_predict: num_predict !== undefined ? num_predict : currentParams.num_predict,
      };
      await configService.set('llm.modelParams', newParams, changedBy);
    }

    if (modelByProvider !== undefined) {
      if (typeof modelByProvider !== 'object' || modelByProvider === null) {
        return res.status(400).json({ error: 'modelByProvider à¸•à¹‰à¸­à¸‡à¹€à¸›à¹‡à¸™ object' });
      }
      const currentModelByProvider = await configService.get('llm.modelByProvider') || {};
      const newModelByProvider = { ...currentModelByProvider, ...modelByProvider };
      await configService.set('llm.modelByProvider', newModelByProvider, changedBy);
    }

    res.json({ status: 'ok' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/config/tts (auth)
router.patch('/tts', apiKeyAuth, async (req, res) => {
  const { provider } = req.body;
  const changedBy = 'control-panel';

  try {
    if (provider !== undefined) {
      await ttsManager.switchProvider(provider, changedBy);
    }
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/config/voice-conversion (auth)
router.patch('/voice-conversion', apiKeyAuth, async (req, res) => {
  const { enabled, pitch, indexRate } = req.body;
  const changedBy = 'control-panel';

  try {
    if (enabled !== undefined) {
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled à¸•à¹‰à¸­à¸‡à¹€à¸›à¹‡à¸™ boolean' });
      }
      await configService.set('voiceConversion.enabled', enabled, changedBy);
    }

    if (pitch !== undefined) {
      const pitchVal = parseInt(pitch, 10);
      if (isNaN(pitchVal) || pitchVal < -12 || pitchVal > 12) {
        return res.status(400).json({ error: 'pitch à¸•à¹‰à¸­à¸‡à¸­à¸¢à¸¹à¹ˆà¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡ -12 à¸–à¸¶à¸‡ 12' });
      }
      await configService.set('voiceConversion.pitch', pitchVal, changedBy);
    }

    if (indexRate !== undefined) {
      const rateVal = parseFloat(indexRate);
      if (isNaN(rateVal) || rateVal < 0.0 || rateVal > 1.0) {
        return res.status(400).json({ error: 'indexRate à¸•à¹‰à¸­à¸‡à¸­à¸¢à¸¹à¹ˆà¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡ 0.0 à¸–à¸¶à¸‡ 1.0' });
      }
      await configService.set('voiceConversion.indexRate', rateVal, changedBy);
    }

    res.json({ status: 'ok' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/config/memory (auth)
router.patch('/memory', apiKeyAuth, async (req, res) => {
  const { autoConsolidation } = req.body;
  const changedBy = 'control-panel';

  try {
    if (autoConsolidation !== undefined) {
      if (typeof autoConsolidation !== 'boolean') {
        return res.status(400).json({ error: 'autoConsolidation à¸•à¹‰à¸­à¸‡à¹€à¸›à¹‡à¸™ boolean' });
      }
      await configService.set('memory.autoConsolidation', autoConsolidation, changedBy);
    }
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/config/reset/:key (auth)
router.post('/reset/:key', apiKeyAuth, async (req, res) => {
  const { key } = req.params;
  const changedBy = 'control-panel';
  const resettableKeys = new Set(['llm.currentProvider', 'llm.modelParams', 'llm.modelByProvider', 'tts.currentProvider', 'voiceConversion.enabled', 'voiceConversion.pitch', 'voiceConversion.indexRate', 'memory.autoConsolidation']);
  if (!resettableKeys.has(key)) {
    return res.status(400).json({ error: { code: 'INVALID_CONFIG_KEY', message: 'Config key cannot be reset' } });
  }

  try {
    await configService.delete(key, changedBy);
    res.json({ status: 'ok', message: `à¸¥à¹‰à¸²à¸‡à¸à¸²à¸£à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¸‚à¸­à¸‡à¸„à¸µà¸¢à¹Œ "${key}" à¹à¸¥à¹‰à¸§ à¸à¸¥à¸±à¸šà¹„à¸›à¹ƒà¸Šà¹‰à¸„à¹ˆà¸²à¹€à¸£à¸´à¹ˆà¸¡à¸•à¹‰à¸™à¸ˆà¸²à¸ .env` });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/config/verify-key (auth)
router.post('/verify-key', apiKeyAuth, (req, res) => {
  res.json({ status: 'ok', message: 'API key is valid' });
});

module.exports = router;

