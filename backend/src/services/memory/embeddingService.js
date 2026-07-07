const { Ollama } = require('ollama');
require('dotenv').config();

const OLLAMA_HOST = `${process.env.Ollama_BaseURL || 'http://localhost'}:${process.env.Ollama_Port || 11434}`;

// สร้าง Ollama client แบบ custom เพื่อ override fetch timeout
// Default undici headers timeout = 10 วินาที ซึ่งน้อยเกินไปเมื่อ model กำลัง load หรือ server ยุ่ง
// bge-m3 ต้องการ ~30-60 วินาทีในการ load ครั้งแรก
const EMBED_TIMEOUT_MS = 120_000; // 2 นาที

const ollamaClient = new Ollama({
  host: OLLAMA_HOST,
  fetch: (url, options) => {
    // AbortSignal.timeout() จะสร้าง signal ที่ abort หลัง EMBED_TIMEOUT_MS
    // override ทับ signal เดิมของ undici ที่ timeout แค่ 10 วินาที
    const signal = AbortSignal.timeout(EMBED_TIMEOUT_MS);
    return fetch(url, { ...options, signal });
  },
});

class EmbeddingService {
  constructor() {
    this.modelName = 'bge-m3';
  }

  async getEmbedding(text) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('Text to embed cannot be empty');
    }

    try {
      const response = await ollamaClient.embed({
        model: this.modelName,
        input: text.trim(),
      });

      if (!response || !response.embeddings || response.embeddings.length === 0) {
        throw new Error('Failed to retrieve embedding from Ollama response');
      }

      // Check if it is a single embedding or array of embeddings
      let embedding = response.embeddings[0];

      // Ensure the embedding size is correct (1024)
      if (embedding.length !== 1024) {
        console.warn(`Warning: Embedding length is ${embedding.length}, expected 1024`);
      }

      return embedding;
    } catch (error) {
      console.error(`Error generating embedding with model ${this.modelName}:`, error.message);
      throw error;
    }
  }
}

module.exports = new EmbeddingService();
