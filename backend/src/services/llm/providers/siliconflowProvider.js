const axios = require('axios');
require('dotenv').config();
const BaseLLMProvider = require('./baseLLMProvider');

const SILICONFLOW_BASE_URL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.com/v1';
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;
const CHAT_TIMEOUT_MS = 60_000; // cloud API ไม่ควรช้าเท่า local

class SiliconFlowProvider extends BaseLLMProvider {
  constructor() {
    super();
    if (!SILICONFLOW_API_KEY) {
      console.warn('[SiliconFlowProvider] ไม่พบ SILICONFLOW_API_KEY ใน .env — provider นี้จะ error เมื่อถูกเรียกใช้จริง');
    }
  }

  async chat(messages, options = {}) {
    const { model, temperature = 0.8, top_p = 0.9, num_predict = 300 } = options;

    const response = await axios.post(
      `${SILICONFLOW_BASE_URL}/chat/completions`,
      {
        model: model || process.env.SILICONFLOW_MODEL || 'openai/gpt-oss-20b',
        messages,
        temperature,
        top_p,
        max_tokens: num_predict,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${SILICONFLOW_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: CHAT_TIMEOUT_MS,
      }
    );

    const rawContent = response.data?.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error('SiliconFlow ไม่คืน content ใน response');
    }

    return this._parseContent(rawContent);
  }
}

module.exports = SiliconFlowProvider;
