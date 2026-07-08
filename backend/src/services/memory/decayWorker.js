const { query } = require('../../db/pool');

class DecayWorker {
  constructor() {
    this._isRunning = false;
  }

  async runDecay() {
    if (this._isRunning) {
      console.log('[Memory Decay] Already running, skip this trigger.');
      return { skipped: true };
    }
    this._isRunning = true;

    console.log('[Memory Decay] Starting memory decay job...');
    try {
      // 1. Decay importance_score of facts not accessed for more than 60 days
      const decayResult = await query(
        `UPDATE semantic_facts
         SET importance_score = importance_score * 0.9
         WHERE (last_accessed_at < NOW() - INTERVAL '60 days' OR (last_accessed_at IS NULL AND created_at < NOW() - INTERVAL '60 days'))
           AND superseded_by IS NULL`
      );
      console.log(`[Memory Decay] Decayed importance score for ${decayResult.rowCount} facts.`);

      // 2. Find facts with importance_score < 0.1 to archive
      const toArchiveResult = await query(
        `SELECT id
         FROM semantic_facts
         WHERE importance_score < 0.1 AND superseded_by IS NULL`
      );

      const toArchive = toArchiveResult.rows;
      console.log(`[Memory Decay] Found ${toArchive.length} facts to archive.`);

      if (toArchive.length > 0) {
        const ids = toArchive.map(fact => fact.id);
        
        // Batch copy to archive table
        await query(
          `INSERT INTO semantic_facts_archive (id, fact_text, category, importance_score, confidence, source_session_id, access_count, last_accessed_at, created_at)
           SELECT id, fact_text, category, importance_score, confidence, source_session_id, access_count, last_accessed_at, created_at
           FROM semantic_facts
           WHERE id = ANY($1::int[])
           ON CONFLICT (id) DO NOTHING`,
          [ids]
        );

        // Batch delete from main table
        await query(
          `DELETE FROM semantic_facts WHERE id = ANY($1::int[])`,
          [ids]
        );
        console.log(`[Memory Decay] Batch archived and deleted ${toArchive.length} facts.`);
      }

      // 3. Episodic Pruning
      // Delete messages from sessions that are consolidated and older than 90 days
      const pruneResult = await query(
        `DELETE FROM messages
         WHERE session_id IN (
           SELECT id FROM sessions
           WHERE consolidated = TRUE AND ended_at < NOW() - INTERVAL '90 days'
         )`
      );
      console.log(`[Memory Decay] Pruned ${pruneResult.rowCount} old episodic messages.`);

      // 4. Memory Retrieval Log Cleanup
      // Delete retrieval log entries older than 30 days
      const logPruneResult = await query(
        `DELETE FROM memory_retrieval_log 
         WHERE retrieved_at < NOW() - INTERVAL '30 days'`
      );
      console.log(`[Memory Decay] Pruned ${logPruneResult.rowCount} old memory retrieval log entries.`);

      console.log('[Memory Decay] Memory decay job complete!');
    } catch (error) {
      console.error('[Memory Decay] Error during memory decay:', error);
    } finally {
      this._isRunning = false;
    }
  }
}

module.exports = new DecayWorker();
