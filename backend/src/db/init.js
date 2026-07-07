const { pool } = require('./pool');

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
  embedding VECTOR(1024),
  importance_score FLOAT DEFAULT 0.5,
  confidence FLOAT DEFAULT 1.0,
  source_session_id INT REFERENCES sessions(id),
  access_count INT DEFAULT 0,
  last_accessed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  superseded_by INT REFERENCES semantic_facts(id)
);

CREATE INDEX IF NOT EXISTS idx_facts_embedding ON semantic_facts
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_facts_category ON semantic_facts(category);
CREATE INDEX IF NOT EXISTS idx_facts_active ON semantic_facts(superseded_by) WHERE superseded_by IS NULL;

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
`;

async function initDb() {
  const client = await pool.connect();
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

    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_facts_category ON semantic_facts(category);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_facts_active ON semantic_facts(superseded_by) WHERE superseded_by IS NULL;');
      await client.query('CREATE INDEX IF NOT EXISTS idx_facts_embedding ON semantic_facts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);');
      console.log('✔ semantic_facts indexes verified.');
    } catch (idxErr) {
      console.warn('⚠️ Warning creating semantic_facts ivfflat index:', idxErr.message);
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

    console.log('🎉 Database initialization complete!');
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initDb();
