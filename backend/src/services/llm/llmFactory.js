const OllamaProvider = require('./providers/ollamaProvider');

const providers = {
  ollama: OllamaProvider,
};

const singletons = {};

function createLLMProvider(name) {
  const lowerName = name.toLowerCase();
  const ProviderClass = providers[lowerName];
  if (!ProviderClass) {
    throw new Error(`Unknown LLM provider: ${name}. Available: ${Object.keys(providers).join(', ')}`);
  }
  
  if (!singletons[lowerName]) {
    singletons[lowerName] = new ProviderClass();
  }
  return singletons[lowerName];
}

module.exports = {
  createLLMProvider,
  availableProviders: Object.keys(providers),
};
