const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const consolidationWorker = require('../services/memory/consolidationWorker');
const decayWorker = require('../services/memory/decayWorker');
const configService = require('../services/config/configService');
const securityConfig = require('../config/securityConfig');
const { publishedAudioStore } = require('../services/tts/neural/publishedAudioStore');

function initScheduler() {
  console.log('[Scheduler] Initializing cron jobs...');

  // 1. Run memory consolidation every day at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    try {
      const autoConsolidate = await configService.get('memory.autoConsolidation', true);
      if (autoConsolidate !== false) {
        console.log('[Scheduler] Triggering scheduled memory consolidation...');
        await consolidationWorker.runConsolidation();
      } else {
        console.log('[Scheduler] Scheduled memory consolidation is disabled by config.');
      }
    } catch (err) {
      console.error('[Scheduler] Error in consolidation cron task:', err);
    }
  });

  // 2. Run memory decay job every Sunday at 4:00 AM
  cron.schedule('0 4 * * 0', async () => {
    try {
      const autoConsolidate = await configService.get('memory.autoConsolidation', true);
      if (autoConsolidate !== false) {
        console.log('[Scheduler] Triggering scheduled memory decay...');
        await decayWorker.runDecay();
      } else {
        console.log('[Scheduler] Scheduled memory decay is disabled by config.');
      }
    } catch (err) {
      console.error('[Scheduler] Error in decay cron task:', err);
    }
  });

  // 3. Run audio cleanup job every day at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduler] Triggering scheduled audio cleanup...');
    try {
      const audioDir = path.join(__dirname, '..', '..', '..', 'audio');
      const exists = await fs.promises.access(audioDir).then(() => true).catch(() => false);
      if (exists) {
        const files = await fs.promises.readdir(audioDir);
        const cutoff = Date.now() - securityConfig.audioRetentionHours * 60 * 60 * 1000;
        let count = await publishedAudioStore.cleanup({
          publishedCutoff: cutoff,
          stagingCutoff: cutoff,
        });
        for (const file of files) {
          if (publishedAudioStore.isReservedName(file)) continue;
          const filePath = path.join(audioDir, file);
          const stat = await fs.promises.stat(filePath);
          if (stat.isFile() && stat.mtimeMs < cutoff) {
            await fs.promises.unlink(filePath);
            count++;
          }
        }
        console.log(`[Scheduler] Audio cleanup complete. Deleted ${count} files.`);
      } else {
        console.warn(`[Scheduler] Audio directory not found at: ${audioDir}`);
      }
    } catch (err) {
      console.error('[Scheduler] Error cleaning up audio files:', err.message);
    }
  });

  // 4. Remove abandoned multipart uploads more frequently than generated audio.
  cron.schedule('*/15 * * * *', async () => {
    try {
      const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads');
      const files = await fs.promises.readdir(uploadsDir).catch(() => []);
      const cutoff = Date.now() - securityConfig.uploadRetentionMinutes * 60 * 1000;
      let count = 0;
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const stat = await fs.promises.stat(filePath).catch(() => null);
        if (stat && stat.isFile() && stat.mtimeMs < cutoff) {
          await fs.promises.unlink(filePath).catch(() => {});
          count++;
        }
      }
      if (count) console.log(`[Scheduler] Removed ${count} abandoned uploads.`);
    } catch (err) {
      console.error('[Scheduler] Error cleaning uploads:', err.message);
    }
  });

  console.log('[Scheduler] Scheduled memory jobs registered.');
}

module.exports = { initScheduler };

