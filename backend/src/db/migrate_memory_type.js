const { query, pool } = require('./pool');
require('dotenv').config();

async function runMigration() {
  console.log('[Migration] Starting memory_type schema migration...');
  try {
    // 1. Add memory_type column to semantic_facts
    await query(`
      ALTER TABLE semantic_facts
      ADD COLUMN IF NOT EXISTS memory_type VARCHAR(30) NOT NULL DEFAULT 'episode';
    `);
    console.log('[Migration] Added memory_type column to semantic_facts (if not existed).');

    // 2. Create semantic_facts_archive if it doesn't exist, or add memory_type to it if it does
    await query(`
      CREATE TABLE IF NOT EXISTS semantic_facts_archive (
        id INT PRIMARY KEY,
        fact_text TEXT,
        category VARCHAR(50),
        memory_type VARCHAR(30),
        importance_score FLOAT,
        confidence FLOAT,
        source_session_id INT,
        access_count INT,
        last_accessed_at TIMESTAMP,
        created_at TIMESTAMP,
        archived_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[Migration] Ensured semantic_facts_archive table exists.');

    await query(`
      ALTER TABLE semantic_facts_archive
      ADD COLUMN IF NOT EXISTS memory_type VARCHAR(30);
    `);
    console.log('[Migration] Ensured memory_type column in semantic_facts_archive.');

    // 3. Create index on memory_type
    await query(`
      CREATE INDEX IF NOT EXISTS idx_facts_memory_type ON semantic_facts(memory_type);
    `);
    console.log('[Migration] Created index idx_facts_memory_type on semantic_facts.');

    // 4. Backfill existing records in semantic_facts
    const updateFacts = await query(`
      UPDATE semantic_facts
      SET memory_type = CASE
        WHEN category = 'preference' THEN 'preference'
        WHEN category IN ('event', 'running_joke') THEN 'episode'
        WHEN category = 'relationship' THEN 'relationship'
        WHEN category = 'trait' THEN 'personality'
        ELSE 'episode'
      END
      WHERE memory_type = 'episode';
    `);
    console.log(`[Migration] Backfilled ${updateFacts.rowCount} records in semantic_facts.`);

    // 5. Backfill existing records in semantic_facts_archive
    const updateArchive = await query(`
      UPDATE semantic_facts_archive
      SET memory_type = CASE
        WHEN category = 'preference' THEN 'preference'
        WHEN category IN ('event', 'running_joke') THEN 'episode'
        WHEN category = 'relationship' THEN 'relationship'
        WHEN category = 'trait' THEN 'personality'
        ELSE 'episode'
      END
      WHERE memory_type IS NULL OR memory_type = 'episode';
    `);
    console.log(`[Migration] Backfilled ${updateArchive.rowCount} records in semantic_facts_archive.`);

    console.log('[Migration] Migration completed successfully!');
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
