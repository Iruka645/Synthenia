const { createLLMProvider, availableProviders } = require('./llmFactory');
const llmConfig = require('../../config/llmConfig');
const configService = require('../config/configService');

const CONFIG_KEY = 'llm.currentProvider';

let currentProviderName = llmConfig.defaultProvider;
let currentProviderInstance = createLLMProvider(currentProviderName);

class LLMManager {
  constructor() {
    this.fallbackEvents = [];
    this._lastSwitchTime = 0;
  }

  // เรียกครั้งเดียวตอน server boot เพื่อ restore ค่าที่เคย switch ไว้จาก DB
  async initialize() {
    try {
      // Warm cache for all LLM settings
      await configService.getAll('llm.');

      const savedProvider = await configService.get(CONFIG_KEY);
      if (savedProvider && availableProviders.includes(savedProvider)) {
        currentProviderInstance = createLLMProvider(savedProvider);
        currentProviderName = savedProvider;
        console.log(`[LLM Manager] Restored provider from DB: ${savedProvider}`);
      } else {
        console.log(`[LLM Manager] No saved provider in DB, using .env default: ${currentProviderName}`);
      }
    } catch (err) {
      console.error('[LLM Manager] Failed to load saved provider, using .env default:', err.message);
    }
  }

  async chat(messages, options = {}) {
    const [savedModelByProvider, savedModelParams] = await Promise.all([
      configService.get('llm.modelByProvider').then(v => v || {}),
      configService.get('llm.modelParams').then(v => v || {})
    ]);

    const defaultModel = savedModelByProvider[currentProviderName] || llmConfig.modelByProvider[currentProviderName];
    const model = options.model || defaultModel;

    const temperature = options.temperature !== undefined ? options.temperature : (savedModelParams.temperature !== undefined ? savedModelParams.temperature : 0.8);
    const top_p = options.top_p !== undefined ? options.top_p : (savedModelParams.top_p !== undefined ? savedModelParams.top_p : 0.9);
    const num_predict = options.num_predict !== undefined ? options.num_predict : (savedModelParams.num_predict !== undefined ? savedModelParams.num_predict : 300);

    const activeOptions = { model, temperature, top_p, num_predict };

    try {
      console.log(`[LLM Manager] Generating chat using provider: ${currentProviderName} (model: ${model})`);
      const response = await currentProviderInstance.chat(messages, activeOptions);

      response.usedFallback = false;
      return response;
    } catch (error) {
      console.error(`[LLM Manager] Chat failed using provider ${currentProviderName}:`, error.message);
      
      // If we reach here, all providers failed. Return a charming, safe default response.
      return {
        reply: "ขอโทษนะพ่อ ตอนนี้ซินมึนๆ นิดหน่อยน่ะ... ไว้ค่อยคุยกันใหม่นะ",
        emotion: "sad",
        usedFallback: true,
        isSystemFallback: true
      };
    }
  }

  async switchProvider(name, changedBy = 'control-panel') {
    if (!name || typeof name !== 'string') {
      throw new Error('Provider name must be a non-empty string.');
    }
    const cleanName = name.trim().toLowerCase();
    if (!availableProviders.includes(cleanName)) {
      throw new Error(`Provider "${name}" is not supported. Supported: ${availableProviders.join(', ')}`);
    }

    const now = Date.now();
    if (this._lastSwitchTime && (now - this._lastSwitchTime) < 3000) {
      throw new Error('กรุณารอสักครู่ (Rate limit: 3 วินาที)');
    }
    this._lastSwitchTime = now;

    currentProviderInstance = createLLMProvider(cleanName);
    currentProviderName = cleanName;
    console.log(`[LLM Manager] Switched active provider to: ${cleanName}`);

    try {
      await configService.set(CONFIG_KEY, cleanName, changedBy);
    } catch (err) {
      // ยัง switch ใช้งานได้ในรอบนี้ แต่จะไม่รอดหลัง restart — แจ้งเตือนให้รู้
      console.error('[LLM Manager] Switched in-memory but failed to persist to DB:', err.message);
    }

    return cleanName;
  }

  getCurrentProvider() {
    return currentProviderName;
  }

  getAvailableProviders() {
    return availableProviders;
  }
}

module.exports = new LLMManager();
