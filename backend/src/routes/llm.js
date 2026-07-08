const express = require('express');
const router = express.Router();
const llmManager = require('../services/llm/index');
const apiKeyAuth = require('../middleware/apiKeyAuth');

router.get('/current', (req, res) => {
  res.json({ provider: llmManager.getCurrentProvider() });
});

router.get('/list', (req, res) => {
  res.json({ providers: llmManager.getAvailableProviders() });
});

// Mutating route — ต้องยืนยันตัวตน เพราะสลับไป cloud LLM มีค่าใช้จ่ายจริง
router.post('/switch', apiKeyAuth, async (req, res) => {
  const { provider } = req.body;
  if (!provider) {
    return res.status(400).json({ error: 'ต้องระบุชื่อ provider ใน request body' });
  }
  try {
    const active = await llmManager.switchProvider(provider, 'control-panel');
    res.json({ status: 'ok', provider: active });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/llm/test -> ทดสอบ LLM
router.post('/test', async (req, res) => {
  const { provider } = req.body;
  const providerName = provider ? provider.trim().toLowerCase() : llmManager.getCurrentProvider();

  try {
    const { createLLMProvider } = require('../services/llm/llmFactory');
    const llmConfig = require('../config/llmConfig');
    const configService = require('../services/config/configService');

    const startTime = Date.now();
    const providerInstance = createLLMProvider(providerName);
    
    // Load model and options
    const savedModelByProvider = await configService.get('llm.modelByProvider') || {};
    const model = savedModelByProvider[providerName] || llmConfig.modelByProvider[providerName];
    
    const savedModelParams = await configService.get('llm.modelParams') || {};
    const activeOptions = {
      temperature: savedModelParams.temperature !== undefined ? savedModelParams.temperature : 0.8,
      top_p: savedModelParams.top_p !== undefined ? savedModelParams.top_p : 0.9,
      num_predict: savedModelParams.num_predict !== undefined ? savedModelParams.num_predict : 300,
      model
    };

    const replyObj = await providerInstance.chat([{ role: 'user', content: 'สวัสดี' }], activeOptions);
    const latency = Date.now() - startTime;
    
    res.json({ reply: replyObj.reply, emotion: replyObj.emotion, latency });
  } catch (error) {
    console.error(`[LLM Test Error] ${providerName}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
