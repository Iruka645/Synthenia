const GTTSProvider = require('./providers/gttsProvider');
const PiperProvider = require('./providers/piperProvider');

const providers = {
  gtts: GTTSProvider,
  piper: PiperProvider,
};

function createTTSProvider(name) {
  const ProviderClass = providers[name.toLowerCase()];
  if (!ProviderClass) {
    throw new Error(`Unknown TTS provider: ${name}. Available: ${Object.keys(providers).join(', ')}`);
  }
  return new ProviderClass();
}

module.exports = {
  createTTSProvider,
  availableProviders: Object.keys(providers),
};
