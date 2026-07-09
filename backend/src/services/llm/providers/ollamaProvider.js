const { Ollama } = require('ollama');
require('dotenv').config();
const BaseLLMProvider = require('./baseLLMProvider');

const Ollama_BASE_URL = process.env.Ollama_BaseURL || "http://localhost";
const Ollama_PORT = process.env.Ollama_Port || 11434;
const CHAT_TIMEOUT_MS = 5 * 60_000; // 5 นาที — local model บางทีโหลดช้า

class OllamaProvider extends BaseLLMProvider {
  constructor() {
    super();
    this.client = new Ollama({
      host: `${Ollama_BASE_URL}:${Ollama_PORT}`,
      fetch: (url, opts) => {
        const signal = AbortSignal.timeout(CHAT_TIMEOUT_MS);
        return fetch(url, { ...opts, signal });
      },
    });
  }

  async chat(messages, options = {}) {
    const { model, temperature = 0.8, top_p = 0.9, num_predict = 300 } = options;

    const response = await this.client.chat({
      model,
      messages,
      keep_alive: '30m',
      options: { temperature, top_p, num_predict },
      stream: false,
      format: {
        type: "object",
        properties: {
          reply: { type: "string" },
          emotion: {
            type: "string",
            enum: ["neutral", "happy", "embarrassed", "sad", "thinking", "surprised", "laugh", "annoyed"],
          },
        },
        required: ["reply", "emotion"],
      },
    });

    return this._parseContent(response.message.content);
  }
}

module.exports = OllamaProvider;
