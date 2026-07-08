const { createTTSProvider, availableProviders } = require('./ttsFactory');
const ttsConfig = require('../../config/ttsConfig');
const voiceConversionService = require('../voiceConversionService');
const configService = require('../config/configService');

const CONFIG_KEY = 'tts.currentProvider';

let currentProviderName = ttsConfig.defaultProvider;
let currentProviderInstance = createTTSProvider(currentProviderName);

class TTSManager {
  async initialize() {
    try {
      const savedProvider = await configService.get(CONFIG_KEY);
      if (savedProvider && availableProviders.includes(savedProvider)) {
        currentProviderInstance = createTTSProvider(savedProvider);
        currentProviderName = savedProvider;
        console.log(`[TTS Manager] Restored provider from DB: ${savedProvider}`);
      } else {
        console.log(`[TTS Manager] No saved provider in DB, using .env default: ${currentProviderName}`);
      }
    } catch (err) {
      console.error('[TTS Manager] Failed to load saved provider, using .env default:', err.message);
    }
  }

  async generate(text) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error("Text input to TTS cannot be empty.");
    }
    
    try {
      console.log(`[TTS Manager] Synthesizing text using provider: ${currentProviderName}`);
      let audioFilename = await currentProviderInstance.synthesize(text.trim());
      
      const enabledVal = await configService.get('voiceConversion.enabled');
      const isVoiceConversionEnabled = enabledVal !== null ? (enabledVal === true) : (process.env.VOICE_CONVERSION_ENABLED === 'true');

      if (isVoiceConversionEnabled) {
        const savedPitch = await configService.get('voiceConversion.pitch');
        const pitch = savedPitch !== null ? parseInt(savedPitch, 10) : (process.env.VOICE_CONVERSION_PITCH ? parseInt(process.env.VOICE_CONVERSION_PITCH, 10) : 0);
        
        const savedIndexRate = await configService.get('voiceConversion.indexRate');
        const indexRate = savedIndexRate !== null ? parseFloat(savedIndexRate) : (process.env.VOICE_CONVERSION_INDEX_RATE ? parseFloat(process.env.VOICE_CONVERSION_INDEX_RATE) : 0.4);
        
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
          
          const enabledVal = await configService.get('voiceConversion.enabled');
          const isVoiceConversionEnabled = enabledVal !== null ? (enabledVal === true) : (process.env.VOICE_CONVERSION_ENABLED === 'true');

          if (isVoiceConversionEnabled) {
            const savedPitch = await configService.get('voiceConversion.pitch');
            const pitch = savedPitch !== null ? parseInt(savedPitch, 10) : (process.env.VOICE_CONVERSION_PITCH ? parseInt(process.env.VOICE_CONVERSION_PITCH, 10) : 0);
            
            const savedIndexRate = await configService.get('voiceConversion.indexRate');
            const indexRate = savedIndexRate !== null ? parseFloat(savedIndexRate) : (process.env.VOICE_CONVERSION_INDEX_RATE ? parseFloat(process.env.VOICE_CONVERSION_INDEX_RATE) : 0.4);
            
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

  async switchProvider(name, changedBy = 'control-panel') {
    if (!name || typeof name !== 'string') {
      throw new Error("Provider name must be a non-empty string.");
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

    currentProviderInstance = createTTSProvider(cleanName);
    currentProviderName = cleanName;
    console.log(`[TTS Manager] Switched active provider to: ${cleanName}`);

    try {
      await configService.set(CONFIG_KEY, cleanName, changedBy);
    } catch (err) {
      console.error('[TTS Manager] Switched in-memory but failed to persist to DB:', err.message);
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

module.exports = new TTSManager();
