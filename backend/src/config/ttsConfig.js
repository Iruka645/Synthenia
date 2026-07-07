require('dotenv').config();

const defaultProvider = 'gtts';
const configuredProvider = (process.env.TTS_PROVIDER || defaultProvider).toLowerCase();

// Import factory to validate the configured provider
const { availableProviders } = require('../services/tts/ttsFactory');

const finalProvider = availableProviders.includes(configuredProvider) 
  ? configuredProvider 
  : defaultProvider;

if (process.env.TTS_PROVIDER && !availableProviders.includes(configuredProvider)) {
  console.warn(`[TTS Config] Warning: configured provider "${configuredProvider}" is invalid. Falling back to "${defaultProvider}".`);
}

module.exports = {
  defaultProvider: finalProvider,
};
