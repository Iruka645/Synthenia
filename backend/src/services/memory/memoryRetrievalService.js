const { query } = require('../../db/pool');
const embeddingService = require('./embeddingService');

class MemoryRetrievalService {
  async retrieve(userMessage, topK = 5, precalculatedEmbedding = null) {
    if (!userMessage || !userMessage.trim()) return [];

    try {
      // 1. Get embedding for current user message
      const queryEmbedding = precalculatedEmbedding || await embeddingService.getEmbedding(userMessage);
      const embeddingStr = JSON.stringify(queryEmbedding);

      // 2. Hybrid search on active semantic_facts
      // Get top 20 similar facts based on vector cosine distance
      const factsResult = await query(
        `SELECT id, fact_text, category, importance_score, created_at,
                (1 - (embedding <=> $1::vector)) AS similarity
         FROM semantic_facts
         WHERE superseded_by IS NULL
         ORDER BY embedding <=> $1::vector ASC
         LIMIT 20`,
        [embeddingStr]
      );

      let facts = factsResult.rows;

      // 3. Re-rank using the formula:
      // score = (similarity * 0.6) + (importance_score * 0.3) + (recency_factor * 0.1)
      const now = new Date();
      facts = facts.map(fact => {
        const similarity = parseFloat(fact.similarity || 0);
        const importance = parseFloat(fact.importance_score || 0.5);
        
        // Calculate recency factor (exponential decay over 30 days)
        const createdDate = new Date(fact.created_at);
        const diffTime = Math.abs(now - createdDate);
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        const recencyFactor = Math.exp(-diffDays / 30);

        const score = (similarity * 0.6) + (importance * 0.3) + (recencyFactor * 0.1);
        
        return {
          ...fact,
          similarity,
          recencyFactor,
          score
        };
      });

      // Sort by score descending
      facts.sort((a, b) => b.score - a.score);

      // Filter top results
      let retrievedFacts = facts.slice(0, topK);

      // Check if top similarity is below threshold (0.5) or no facts retrieved
      const topSimilarity = retrievedFacts.length > 0 ? retrievedFacts[0].similarity : 0;
      let usedFallback = false;
      let fallbackMessages = [];

      if (topSimilarity < 0.5 || retrievedFacts.length === 0) {
        // Fallback: Query episodic messages directly
        const msgResult = await query(
          `SELECT m.content, m.role, m.created_at, (1 - (m.embedding <=> $1::vector)) AS similarity
           FROM messages m
           ORDER BY m.embedding <=> $1::vector ASC
           LIMIT 5`,
          [embeddingStr]
        );
        
        fallbackMessages = msgResult.rows.filter(m => parseFloat(m.similarity) >= 0.5);
        if (fallbackMessages.length > 0) {
          usedFallback = true;
        }
      }

      // Update access stats for retrieved semantic facts
      if (retrievedFacts.length > 0) {
        const factIds = retrievedFacts.map(f => f.id);
        await query(
          `UPDATE semantic_facts
           SET access_count = access_count + 1,
               last_accessed_at = NOW()
           WHERE id = ANY($1::int[])`,
          [factIds]
        );

        // 4. Log retrieval log
        await query(
          `INSERT INTO memory_retrieval_log (query_text, retrieved_fact_ids)
           VALUES ($1, $2)`,
          [userMessage.trim(), factIds]
        );
      } else {
        await query(
          `INSERT INTO memory_retrieval_log (query_text, retrieved_fact_ids)
           VALUES ($1, '{}')`,
          [userMessage.trim()]
        );
      }

      return {
        facts: retrievedFacts,
        usedFallback,
        fallbackMessages
      };
    } catch (error) {
      console.error('Error retrieving memories:', error);
      return { facts: [], usedFallback: false, fallbackMessages: [] };
    }
  }

  async getLatestReflectiveSummary() {
    try {
      const result = await query(
        `SELECT summary_text FROM reflective_summary
         ORDER BY version DESC, id DESC
         LIMIT 1`
      );
      if (result.rows.length > 0) {
        return result.rows[0].summary_text;
      }
      return null;
    } catch (error) {
      console.error('Error getting latest reflective summary:', error);
      return null;
    }
  }
}

module.exports = new MemoryRetrievalService();
