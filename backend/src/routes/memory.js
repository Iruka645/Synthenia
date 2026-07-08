const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');
const consolidationWorker = require('../services/memory/consolidationWorker');
const decayWorker = require('../services/memory/decayWorker');
const apiKeyAuth = require('../middleware/apiKeyAuth');

// GET /api/memory/stats
router.get('/stats', async (req, res) => {
  try {
    const factsActiveRes = await query(`SELECT COUNT(*)::int AS count FROM semantic_facts WHERE superseded_by IS NULL`);
    const factsTotalRes = await query(`SELECT COUNT(*)::int AS count FROM semantic_facts`);
    const sessionsUnconsolidatedRes = await query(`SELECT COUNT(*)::int AS count FROM sessions WHERE consolidated = FALSE AND ended_at IS NOT NULL AND message_count >= 4`);
    const sessionsTotalRes = await query(`SELECT COUNT(*)::int AS count FROM sessions`);
    const messagesTotalRes = await query(`SELECT COUNT(*)::int AS count FROM messages`);
    
    // Get Gemini TTS Quota Status
    const GeminiTTSProvider = require('../services/tts/providers/geminittsProvider');
    const geminiProvider = new GeminiTTSProvider();
    const ttsQuota = await geminiProvider.getQuotaStatus();

    res.json({
      factsActive: factsActiveRes.rows[0].count,
      factsTotal: factsTotalRes.rows[0].count,
      sessionsUnconsolidated: sessionsUnconsolidatedRes.rows[0].count,
      sessionsTotal: sessionsTotalRes.rows[0].count,
      messagesTotal: messagesTotalRes.rows[0].count,
      ttsQuota
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/memory/consolidate (auth)
router.post('/consolidate', apiKeyAuth, async (req, res) => {
  try {
    // Run asynchronously to avoid timeout
    consolidationWorker.runConsolidation();
    res.json({ status: 'ok', message: 'เริ่มกระบวนการจัดเก็บความทรงจำถาวร (Consolidation) ในเบื้องหลังแล้ว' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/memory/decay (auth)
router.post('/decay', apiKeyAuth, async (req, res) => {
  try {
    // Run asynchronously
    decayWorker.runDecay();
    res.json({ status: 'ok', message: 'เริ่มกระบวนการลดความสำคัญและเก็บความทรงจำเก่า (Decay) ในเบื้องหลังแล้ว' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
