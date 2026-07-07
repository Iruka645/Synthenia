const { query } = require('../../db/pool');

class DecayWorker {
  async runDecay() {
    console.log('[Memory Decay] Starting memory decay job...');
    try {
      // 1. Create semantic_facts_archive if not exists
      await query(
        `CREATE TABLE IF NOT EXISTS semantic_facts_archive (
          id INT PRIMARY KEY,
          fact_text TEXT,
          category VARCHAR(50),
          importance_score FLOAT,
          confidence FLOAT,
          source_session_id INT,
          access_count INT,
          last_accessed_at TIMESTAMP,
          created_at TIMESTAMP,
          archived_at TIMESTAMP DEFAULT NOW()
        )`
      );

      // 2. Decay importance_score of facts not accessed for more than 60 days
      const decayResult = await query(
        `UPDATE semantic_facts
         SET importance_score = importance_score * 0.9
         WHERE (last_accessed_at < NOW() - INTERVAL '60 days' OR (last_accessed_at IS NULL AND created_at < NOW() - INTERVAL '60 days'))
           AND superseded_by IS NULL
         RETURNING id`
      );
      console.log(`[Memory Decay] Decayed importance score for ${decayResult.rowCount} facts.`);

      // 3. Find facts with importance_score < 0.1 to archive
      const toArchiveResult = await query(
        `SELECT id, fact_text, category, importance_score, confidence, source_session_id, access_count, last_accessed_at, created_at
         FROM semantic_facts
         WHERE importance_score < 0.1 AND superseded_by IS NULL`
      );

      const toArchive = toArchiveResult.rows;
      console.log(`[Memory Decay] Found ${toArchive.length} facts to archive.`);

      if (toArchive.length > 0) {
        for (const fact of toArchive) {
          // Move to archive
          await query(
            `INSERT INTO semantic_facts_archive (id, fact_text, category, importance_score, confidence, source_session_id, access_count, last_accessed_at, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO NOTHING`,
            [fact.id, fact.fact_text, fact.category, fact.importance_score, fact.confidence, fact.source_session_id, fact.access_count, fact.last_accessed_at, fact.created_at]
          );
          console.log(`[Memory Decay] Archived fact to DB buffer: "${fact.fact_text}"`);
        }

        // Batch delete from main table
        const ids = toArchive.map(fact => fact.id);
        await query(
          `DELETE FROM semantic_facts WHERE id = ANY($1::int[])`,
          [ids]
        );
        console.log(`[Memory Decay] Batch deleted ${toArchive.length} archived facts from active semantic_facts.`);
      }

      // 4. Episodic Pruning
      // Delete messages from sessions that are consolidated and older than 90 days
      const pruneResult = await query(
        `DELETE FROM messages
         WHERE session_id IN (
           SELECT id FROM sessions
           WHERE consolidated = TRUE AND ended_at < NOW() - INTERVAL '90 days'
         )`
      );
      console.log(`[Memory Decay] Pruned ${pruneResult.rowCount} old episodic messages.`);

      // 5. Memory Retrieval Log Cleanup (Item 13)
      // Delete retrieval log entries older than 30 days
      const logPruneResult = await query(
        `DELETE FROM memory_retrieval_log 
         WHERE retrieved_at < NOW() - INTERVAL '30 days'`
      );
      console.log(`[Memory Decay] Pruned ${logPruneResult.rowCount} old memory retrieval log entries.`);

      console.log('[Memory Decay] Memory decay job complete!');
    } catch (error) {
      console.error('[Memory Decay] Error during memory decay:', error);
    }
  }
}

module.exports = new DecayWorker();
