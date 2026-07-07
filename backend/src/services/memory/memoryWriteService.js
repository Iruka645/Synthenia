const { query } = require('../../db/pool');
const embeddingService = require('./embeddingService');

class MemoryWriteService {
  constructor() {
    this._activeSessionId = null;
  }

  async getOrCreateActiveSession() {
    try {
      if (this._activeSessionId) return this._activeSessionId;

      // Find session where ended_at is null
      const result = await query(
        `SELECT id FROM sessions 
         WHERE ended_at IS NULL 
         ORDER BY id DESC 
         LIMIT 1`
      );

      if (result.rows.length > 0) {
        this._activeSessionId = result.rows[0].id;
        return this._activeSessionId;
      }

      // Create new session if none is active
      const insertResult = await query(
        `INSERT INTO sessions (started_at, message_count) 
         VALUES (NOW(), 0) 
         RETURNING id`
      );
      this._activeSessionId = insertResult.rows[0].id;
      return this._activeSessionId;
    } catch (error) {
      console.error('Error in getOrCreateActiveSession:', error);
      throw error;
    }
  }

  async saveMessage(role, content, emotionTag = null, precalculatedEmbedding = null) {
    if (!content || !content.trim()) return null;

    try {
      const sessionId = await this.getOrCreateActiveSession();
      
      // Calculate or use precalculated embedding for the message content
      const embedding = precalculatedEmbedding || await embeddingService.getEmbedding(content);
      const embeddingStr = JSON.stringify(embedding);

      // Save message to messages table
      const insertResult = await query(
        `INSERT INTO messages (session_id, role, content, emotion_tag, embedding, created_at)
         VALUES ($1, $2, $3, $4, $5::vector, NOW())
         RETURNING id`,
        [sessionId, role, content.trim(), emotionTag, embeddingStr]
      );

      // Increment message count for current session
      await query(
        `UPDATE sessions 
         SET message_count = message_count + 1 
         WHERE id = $1`,
        [sessionId]
      );

      return insertResult.rows[0].id;
    } catch (error) {
      console.error('Error saving message in memoryWriteService:', error);
      // Fail silently or log error, don't crash conversation loop
      return null;
    }
  }

  async endCurrentSession() {
    try {
      const result = await query(
        `SELECT id FROM sessions 
         WHERE ended_at IS NULL 
         ORDER BY id DESC 
         LIMIT 1`
      );

      if (result.rows.length > 0) {
        const sessionId = result.rows[0].id;
        await query(
          `UPDATE sessions 
           SET ended_at = NOW() 
           WHERE id = $1`,
          [sessionId]
        );
        console.log(`Session ${sessionId} has been ended.`);
        this._activeSessionId = null; // invalidate cache
        return sessionId;
      }
      this._activeSessionId = null; // ensure cache is reset
      return null;
    } catch (error) {
      console.error('Error ending current session:', error);
      return null;
    }
  }
}

module.exports = new MemoryWriteService();
