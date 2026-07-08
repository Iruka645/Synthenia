const OllamaProvider = require('./providers/ollamaProvider');
const SiliconFlowProvider = require('./providers/siliconflowProvider');

const providers = {
  ollama: OllamaProvider,
  siliconflow: SiliconFlowProvider,
};

function createLLMProvider(name) {
  const ProviderClass = providers[name.toLowerCase()];
  if (!ProviderClass) {
    throw new Error(`Unknown LLM provider: ${name}. Available: ${Object.keys(providers).join(', ')}`);
  }
  return new ProviderClass();
}

module.exports = {
  createLLMProvider,
  availableProviders: Object.keys(providers),
};
