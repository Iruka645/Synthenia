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
};

module.exports = {
  defaultProvider: finalProvider,
  modelByProvider,
};
