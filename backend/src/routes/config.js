const express = require('express');
const router = express.Router();
const configService = require('../services/config/configService');
const llmManager = require('../services/llm/index');
const ttsManager = require('../services/tts/index');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { query } = require('../db/pool');
const llmConfig = require('../config/llmConfig');
const ttsConfig = require('../config/ttsConfig');

// GET /api/config -> snapshot of all keys (no auth, read-only)
router.get('/', async (req, res) => {
  try {
    const dbConfig = await configService.getAll();
    const responseConfig = {
      'llm.currentProvider': dbConfig['llm.currentProvider'] !== undefined ? dbConfig['llm.currentProvider'] : llmConfig.defaultProvider,
      'tts.currentProvider': dbConfig['tts.currentProvider'] !== undefined ? dbConfig['tts.currentProvider'] : ttsConfig.defaultProvider,
      'voiceConversion.enabled': dbConfig['voiceConversion.enabled'] !== undefined ? dbConfig['voiceConversion.enabled'] : (process.env.VOICE_CONVERSION_ENABLED === 'true'),
      'voiceConversion.pitch': dbConfig['voiceConversion.pitch'] !== undefined ? dbConfig['voiceConversion.pitch'] : (process.env.VOICE_CONVERSION_PITCH ? parseInt(process.env.VOICE_CONVERSION_PITCH, 10) : 0),
      'voiceConversion.indexRate': dbConfig['voiceConversion.indexRate'] !== undefined ? dbConfig['voiceConversion.indexRate'] : (process.env.VOICE_CONVERSION_INDEX_RATE ? parseFloat(process.env.VOICE_CONVERSION_INDEX_RATE) : 0.4),
      'llm.modelParams': dbConfig['llm.modelParams'] !== undefined ? dbConfig['llm.modelParams'] : { temperature: 0.8, top_p: 0.9, num_predict: 300 },
      'llm.modelByProvider': dbConfig['llm.modelByProvider'] !== undefined ? dbConfig['llm.modelByProvider'] : { ollama: process.env.AI_MODEL || 'gemma4:12b', siliconflow: process.env.SILICONFLOW_MODEL || 'openai/gpt-oss-20b' },
      'memory.autoConsolidation': dbConfig['memory.autoConsolidation'] !== undefined ? dbConfig['memory.autoConsolidation'] : true,
      'siliconFlowRequestCount': llmManager.siliconFlowRequestCount
    };
    res.json(responseConfig);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/config/audit-log -> list of audit log entries (no auth)
router.get('/audit-log', async (req, res) => {
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
router.get('/fallback-events', (req, res) => {
  try {
    res.json(llmManager.fallbackEvents || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/config/history/:key -> history for a specific key (no auth)
router.get('/history/:key', async (req, res) => {
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
        return res.status(400).json({ error: 'modelParams ต้องเป็น object' });
      }
      const { temperature, top_p, num_predict } = modelParams;
      if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
        return res.status(400).json({ error: 'temperature ต้องอยู่ระหว่าง 0.0 ถึง 2.0' });
      }
      if (top_p !== undefined && (typeof top_p !== 'number' || top_p < 0 || top_p > 1)) {
        return res.status(400).json({ error: 'top_p ต้องอยู่ระหว่าง 0.0 ถึง 1.0' });
      }
      if (num_predict !== undefined && (typeof num_predict !== 'number' || num_predict <= 0)) {
        return res.status(400).json({ error: 'num_predict ต้องเป็นตัวเลขมากกว่า 0' });
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
        return res.status(400).json({ error: 'modelByProvider ต้องเป็น object' });
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
        return res.status(400).json({ error: 'enabled ต้องเป็น boolean' });
      }
      await configService.set('voiceConversion.enabled', enabled, changedBy);
    }

    if (pitch !== undefined) {
      const pitchVal = parseInt(pitch, 10);
      if (isNaN(pitchVal) || pitchVal < -12 || pitchVal > 12) {
        return res.status(400).json({ error: 'pitch ต้องอยู่ระหว่าง -12 ถึง 12' });
      }
      await configService.set('voiceConversion.pitch', pitchVal, changedBy);
    }

    if (indexRate !== undefined) {
      const rateVal = parseFloat(indexRate);
      if (isNaN(rateVal) || rateVal < 0.0 || rateVal > 1.0) {
        return res.status(400).json({ error: 'indexRate ต้องอยู่ระหว่าง 0.0 ถึง 1.0' });
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
        return res.status(400).json({ error: 'autoConsolidation ต้องเป็น boolean' });
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

  try {
    await configService.delete(key, changedBy);
    res.json({ status: 'ok', message: `ล้างการตั้งค่าของคีย์ "${key}" แล้ว กลับไปใช้ค่าเริ่มต้นจาก .env` });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/config/verify-key (auth)
router.post('/verify-key', apiKeyAuth, (req, res) => {
  res.json({ status: 'ok', message: 'API key is valid' });
});

module.exports = router;
