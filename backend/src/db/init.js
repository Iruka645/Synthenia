const { Pool } = require('pg');
require('dotenv').config();

const migrationPool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const schema = `
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tier: Episodic Memory (sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  message_count INT DEFAULT 0,
  consolidated BOOLEAN DEFAULT FALSE
);

-- 3. Tier: Episodic Memory (messages)
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  emotion_tag VARCHAR(50),
  embedding VECTOR(1024),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

-- Note: In ivfflat, we can only create the index after some data exists or we can create it immediately.
-- However, if there are no vectors, ivfflat might complain or lists parameter might be adjusted. 
-- We'll try to create it, but if it fails we can fallback or use a simple index.
CREATE INDEX IF NOT EXISTS idx_messages_embedding ON messages
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 4. Tier: Semantic Memory (facts)
CREATE TABLE IF NOT EXISTS semantic_facts (
  id SERIAL PRIMARY KEY,
  fact_text TEXT NOT NULL,
  category VARCHAR(50),
  memory_type VARCHAR(30) NOT NULL DEFAULT 'episode',
  embedding VECTOR(1024),
  importance_score FLOAT DEFAULT 0.5,
  confidence FLOAT DEFAULT 1.0,
  source_session_id INT REFERENCES sessions(id),
  access_count INT DEFAULT 0,
  last_accessed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  superseded_by INT REFERENCES semantic_facts(id)
);

-- 4.5. Tier: Semantic Memory Archive
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

CREATE INDEX IF NOT EXISTS idx_facts_embedding ON semantic_facts
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_facts_category ON semantic_facts(category);
CREATE INDEX IF NOT EXISTS idx_facts_active ON semantic_facts(superseded_by) WHERE superseded_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_facts_memory_type ON semantic_facts(memory_type);

-- 5. Tier: Reflective Memory
CREATE TABLE IF NOT EXISTS reflective_summary (
  id SERIAL PRIMARY KEY,
  summary_text TEXT NOT NULL,
  version INT NOT NULL,
  based_on_sessions_count INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Audit/Retrieval logs
CREATE TABLE IF NOT EXISTS memory_retrieval_log (
  id SERIAL PRIMARY KEY,
  query_text TEXT,
  retrieved_fact_ids INT[],
  retrieved_at TIMESTAMP DEFAULT NOW()
);

-- 7. Quota tracking for Gemini TTS
CREATE TABLE IF NOT EXISTS quota_tracking (
  key VARCHAR(50) PRIMARY KEY,
  count INT DEFAULT 0,
  date_key VARCHAR(20),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 8. Control Panel: unified config storage
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 9. Control Panel: audit log
CREATE TABLE IF NOT EXISTS config_change_log (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by VARCHAR(100) DEFAULT 'system',
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_log_key ON config_change_log(config_key);
`;

async function initDb() {
  const client = await migrationPool.connect();
  try {
    console.log('Connecting to database and running migrations...');
    
    // Execute each table creation separately to handle errors gracefully
    // Especially since CREATE EXTENSION requires superuser or pgvector needs to be installed
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('✔ pgvector extension enabled.');
    } catch (err) {
      console.error('✘ Failed to enable pgvector. Make sure pgvector is installed in the Postgres container.');
      throw err;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        started_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP,
        message_count INT DEFAULT 0,
        consolidated BOOLEAN DEFAULT FALSE
      );
    `);
    console.log('✔ sessions table verified.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        session_id INT REFERENCES sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        emotion_tag VARCHAR(50),
        embedding VECTOR(1024),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✔ messages table verified.');

    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_messages_embedding ON messages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);');
      console.log('✔ messages indexes verified.');
    } catch (idxErr) {
      console.warn('⚠️ Warning creating messages ivfflat index:', idxErr.message);
      // Fallback: create normal index or proceed (sometimes ivfflat needs lists to be proportional to row count)
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS semantic_facts (
        id SERIAL PRIMARY KEY,
        fact_text TEXT NOT NULL,
        category VARCHAR(50),
        memory_type VARCHAR(30) NOT NULL DEFAULT 'episode',
        embedding VECTOR(1024),
        importance_score FLOAT DEFAULT 0.5,
        confidence FLOAT DEFAULT 1.0,
        source_session_id INT REFERENCES sessions(id),
        access_count INT DEFAULT 0,
        last_accessed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        superseded_by INT REFERENCES semantic_facts(id)
      );
    `);
    console.log('✔ semantic_facts table verified.');

    await client.query(`
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
    console.log('✔ semantic_facts_archive table verified.');

    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_facts_category ON semantic_facts(category);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_facts_active ON semantic_facts(superseded_by) WHERE superseded_by IS NULL;');
      await client.query('CREATE INDEX IF NOT EXISTS idx_facts_embedding ON semantic_facts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_facts_memory_type ON semantic_facts(memory_type);');
      console.log('✔ semantic_facts indexes verified.');
    } catch (idxErr) {
      console.warn('⚠️ Warning creating semantic_facts indexes:', idxErr.message);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS reflective_summary (
        id SERIAL PRIMARY KEY,
        summary_text TEXT NOT NULL,
        version INT NOT NULL,
        based_on_sessions_count INT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✔ reflective_summary table verified.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS memory_retrieval_log (
        id SERIAL PRIMARY KEY,
        query_text TEXT,
        retrieved_fact_ids INT[],
        retrieved_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✔ memory_retrieval_log table verified.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS quota_tracking (
        key VARCHAR(50) PRIMARY KEY,
        count INT DEFAULT 0,
        date_key VARCHAR(20),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✔ quota_tracking table verified.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✔ system_config table verified.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS config_change_log (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(100) NOT NULL,
        old_value JSONB,
        new_value JSONB,
        changed_by VARCHAR(100) DEFAULT 'system',
        changed_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_config_log_key ON config_change_log(config_key);');
    console.log('✔ config_change_log table verified.');

    console.log('🎉 Database initialization complete!');
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await migrationPool.end();
  }
}

if (require.main === module) {
  initDb();
}

module.exports = { initDb };
