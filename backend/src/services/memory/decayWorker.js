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
      // 1. Decay importance_score of facts based on memory_type decay policy
      const DECAY_POLICY = {
        identity:    { neverDecay: true },
        goal:        { decayRate: 0.97, idleDays: 90 },
        relationship:{ decayRate: 0.95, idleDays: 90 },
        skill:       { decayRate: 0.95, idleDays: 90 },
        personality: { decayRate: 0.95, idleDays: 90 },
        preference:  { decayRate: 0.9,  idleDays: 60 },  // original policy
        episode:     { decayRate: 0.85, idleDays: 30 },
        schedule:    { decayRate: 0.7,  idleDays: 7  },  // short-term, decay fast
        temporary:   { decayRate: 0.6,  idleDays: 3  },
      };

      let totalDecayedRows = 0;
      for (const [type, policy] of Object.entries(DECAY_POLICY)) {
        if (policy.neverDecay) continue;
        const decayResult = await query(
          `UPDATE semantic_facts
           SET importance_score = importance_score * $1
           WHERE memory_type = $2
             AND superseded_by IS NULL
             AND (last_accessed_at < NOW() - ($3 || ' days')::interval
                  OR (last_accessed_at IS NULL AND created_at < NOW() - ($3 || ' days')::interval))`,
          [policy.decayRate, type, policy.idleDays]
        );
        totalDecayedRows += decayResult.rowCount;
      }
      console.log(`[Memory Decay] Decayed importance score for total of ${totalDecayedRows} facts.`);

      // 2. Find facts with importance_score < 0.1 to archive (exclude memory_type = 'identity')
      const toArchiveResult = await query(
        `SELECT id
         FROM semantic_facts
         WHERE importance_score < 0.1 AND superseded_by IS NULL AND memory_type != 'identity'`
      );

      const toArchive = toArchiveResult.rows;
      console.log(`[Memory Decay] Found ${toArchive.length} facts to archive.`);

      if (toArchive.length > 0) {
        const ids = toArchive.map(fact => fact.id);
        
        // Batch copy to archive table including memory_type
        await query(
          `INSERT INTO semantic_facts_archive (id, fact_text, category, memory_type, importance_score, confidence, source_session_id, access_count, last_accessed_at, created_at)
           SELECT id, fact_text, category, memory_type, importance_score, confidence, source_session_id, access_count, last_accessed_at, created_at
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
