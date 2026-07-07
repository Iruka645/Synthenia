const { createTTSProvider, availableProviders } = require('./ttsFactory');
const ttsConfig = require('../../config/ttsConfig');
const voiceConversionService = require('../voiceConversionService');

let currentProviderName = ttsConfig.defaultProvider;
let currentProviderInstance = createTTSProvider(currentProviderName);

class TTSManager {
  async generate(text) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error("Text input to TTS cannot be empty.");
    }
    
    try {
      console.log(`[TTS Manager] Synthesizing text using provider: ${currentProviderName}`);
      let audioFilename = await currentProviderInstance.synthesize(text.trim());
      
      if (process.env.VOICE_CONVERSION_ENABLED === 'true') {
        const pitch = process.env.VOICE_CONVERSION_PITCH ? parseInt(process.env.VOICE_CONVERSION_PITCH, 10) : 0;
        const indexRate = process.env.VOICE_CONVERSION_INDEX_RATE ? parseFloat(process.env.VOICE_CONVERSION_INDEX_RATE) : 0.4;
        audioFilename = await voiceConversionService.convert(audioFilename, pitch, indexRate);
      }
      
      return audioFilename;
    } catch (error) {
      console.error(`[TTS Manager] Synthesis failed using provider ${currentProviderName}:`, error.message);
      
      // Fallback to gTTS if the primary provider failed and it isn't already gTTS
      if (currentProviderName !== 'gtts') {
        console.warn(`[TTS Manager] Attempting fallback to gTTS...`);
        try {
          const fallbackProvider = createTTSProvider('gtts');
          let audioFilename = await fallbackProvider.synthesize(text.trim());
          
          if (process.env.VOICE_CONVERSION_ENABLED === 'true') {
            const pitch = process.env.VOICE_CONVERSION_PITCH ? parseInt(process.env.VOICE_CONVERSION_PITCH, 10) : 0;
            const indexRate = process.env.VOICE_CONVERSION_INDEX_RATE ? parseFloat(process.env.VOICE_CONVERSION_INDEX_RATE) : 0.4;
            audioFilename = await voiceConversionService.convert(audioFilename, pitch, indexRate);
          }
          
          return audioFilename;
        } catch (fallbackError) {
          console.error(`[TTS Manager] Fallback to gTTS also failed:`, fallbackError.message);
        }
      }
      throw error;
    }
  }

  switchProvider(name) {
    if (!name || typeof name !== 'string') {
      throw new Error("Provider name must be a non-empty string.");
    }
    const cleanName = name.trim().toLowerCase();
    if (!availableProviders.includes(cleanName)) {
      throw new Error(`Provider "${name}" is not supported. Supported: ${availableProviders.join(', ')}`);
    }
    
    currentProviderInstance = createTTSProvider(cleanName);
    currentProviderName = cleanName;
    console.log(`[TTS Manager] Switched active provider to: ${cleanName}`);
    return cleanName;
  }

  getCurrentProvider() {
    return currentProviderName;
  }

  getAvailableProviders() {
    return availableProviders;
  }
}

module.exports = new TTSManager();
