require('dotenv').config();

const defaultProvider = 'ollama';
const configuredProvider = (process.env.LLM_PROVIDER || defaultProvider).toLowerCase();

const { availableProviders } = require('../services/llm/llmFactory');

const finalProvider = availableProviders.includes(configuredProvider)
  ? configuredProvider
  : defaultProvider;

if (process.env.LLM_PROVIDER && !availableProviders.includes(configuredProvider)) {
  console.warn(`[LLM Config] Warning: configured provider "${configuredProvider}" is invalid. Falling back to "${defaultProvider}".`);
}

const modelByProvider = {
  ollama: process.env.AI_MODEL,
  siliconflow: process.env.SILICONFLOW_MODEL || 'openai/gpt-oss-20b',
};

module.exports = {
  defaultProvider: finalProvider,
  modelByProvider,
};
