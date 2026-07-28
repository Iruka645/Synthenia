const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');
const consolidationWorker = require('../services/memory/consolidationWorker');
const decayWorker = require('../services/memory/decayWorker');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { adminAuth } = require('../middleware/routePolicies');

// GET /api/memory/stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [
      factsActiveRes,
      factsTotalRes,
      sessionsUnconsolidatedRes,
      sessionsTotalRes,
      messagesTotalRes
    ] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM semantic_facts WHERE superseded_by IS NULL`),
      query(`SELECT COUNT(*)::int AS count FROM semantic_facts`),
      query(`SELECT COUNT(*)::int AS count FROM sessions WHERE consolidated = FALSE AND ended_at IS NOT NULL AND message_count >= 4`),
      query(`SELECT COUNT(*)::int AS count FROM sessions`),
      query(`SELECT COUNT(*)::int AS count FROM messages`)
    ]);
    
    res.json({
      factsActive: factsActiveRes.rows[0].count,
      factsTotal: factsTotalRes.rows[0].count,
      sessionsUnconsolidated: sessionsUnconsolidatedRes.rows[0].count,
      sessionsTotal: sessionsTotalRes.rows[0].count,
      messagesTotal: messagesTotalRes.rows[0].count,
      ttsQuota: null
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
    res.json({ status: 'ok', message: 'à¹€à¸£à¸´à¹ˆà¸¡à¸à¸£à¸°à¸šà¸§à¸™à¸à¸²à¸£à¸ˆà¸±à¸”à¹€à¸à¹‡à¸šà¸„à¸§à¸²à¸¡à¸—à¸£à¸‡à¸ˆà¸³à¸–à¸²à¸§à¸£ (Consolidation) à¹ƒà¸™à¹€à¸šà¸·à¹‰à¸­à¸‡à¸«à¸¥à¸±à¸‡à¹à¸¥à¹‰à¸§' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/memory/decay (auth)
router.post('/decay', apiKeyAuth, async (req, res) => {
  try {
    // Run asynchronously
    decayWorker.runDecay();
    res.json({ status: 'ok', message: 'à¹€à¸£à¸´à¹ˆà¸¡à¸à¸£à¸°à¸šà¸§à¸™à¸à¸²à¸£à¸¥à¸”à¸„à¸§à¸²à¸¡à¸ªà¸³à¸„à¸±à¸à¹à¸¥à¸°à¹€à¸à¹‡à¸šà¸„à¸§à¸²à¸¡à¸—à¸£à¸‡à¸ˆà¸³à¹€à¸à¹ˆà¸² (Decay) à¹ƒà¸™à¹€à¸šà¸·à¹‰à¸­à¸‡à¸«à¸¥à¸±à¸‡à¹à¸¥à¹‰à¸§' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

