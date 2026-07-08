const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const consolidationWorker = require('../services/memory/consolidationWorker');
const decayWorker = require('../services/memory/decayWorker');
const configService = require('../services/config/configService');

function initScheduler() {
  console.log('[Scheduler] Initializing cron jobs...');

  // 1. Run memory consolidation every day at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    const autoConsolidate = await configService.get('memory.autoConsolidation', true);
    if (autoConsolidate !== false) {
      console.log('[Scheduler] Triggering scheduled memory consolidation...');
      await consolidationWorker.runConsolidation();
    } else {
      console.log('[Scheduler] Scheduled memory consolidation is disabled by config.');
    }
  });

  // 2. Run memory decay job every Sunday at 4:00 AM
  cron.schedule('0 4 * * 0', async () => {
    const autoConsolidate = await configService.get('memory.autoConsolidation', true);
    if (autoConsolidate !== false) {
      console.log('[Scheduler] Triggering scheduled memory decay...');
      await decayWorker.runDecay();
    } else {
      console.log('[Scheduler] Scheduled memory decay is disabled by config.');
    }
  });

  // 3. Run audio cleanup job every day at 2:00 AM
  cron.schedule('0 2 * * *', () => {
    console.log('[Scheduler] Triggering scheduled audio cleanup...');
    try {
      const audioDir = path.join(__dirname, '..', '..', '..', 'audio');
      if (fs.existsSync(audioDir)) {
        const files = fs.readdirSync(audioDir);
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // keep last 24 hours
        let count = 0;
        files.forEach(file => {
          const filePath = path.join(audioDir, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile() && stat.mtimeMs < cutoff) {
            fs.unlinkSync(filePath);
            count++;
          }
        });
        console.log(`[Scheduler] Audio cleanup complete. Deleted ${count} files.`);
      } else {
        console.warn(`[Scheduler] Audio directory not found at: ${audioDir}`);
      }
    } catch (err) {
      console.error('[Scheduler] Error cleaning up audio files:', err.message);
    }
  });

  console.log('[Scheduler] Scheduled memory jobs registered.');
}

module.exports = { initScheduler };
