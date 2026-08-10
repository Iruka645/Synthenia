const ttsFactory = require('./ttsFactory');
const ttsConfig = require('../../config/ttsConfig');
const voiceConversionService = require('../voiceConversionService');
const configService = require('../config/configService');
const neuralTtsController = require('./neural/neuralTtsController');
const { normalizeText, TTSError, toTTSError } = require('./neural/contracts');

const CONFIG_KEY = 'tts.currentProvider';
const FALLBACK_CONFIG_KEY = 'tts.gttsFallbackEnabled';

class TTSManager {
  constructor(options = {}) {
    this.factory = options.factory || ttsFactory;
    this.configService = options.configService || configService;
    this.voiceConversionService = options.voiceConversionService || voiceConversionService;
    this.neuralController = options.neuralController || neuralTtsController;
    this.defaultProvider = options.defaultProvider || ttsConfig.defaultProvider;
    if (this.neuralController.isNeuralProvider(this.defaultProvider)) this.defaultProvider = 'gtts';
    this.currentProviderName = this.defaultProvider;
    this.currentProviderInstance = this.factory.createTTSProvider(this.currentProviderName, {
      neuralController: this.neuralController,
    });
    this.lastSwitchTime = 0;
    this.switchChain = Promise.resolve();
  }

  async initialize() {
    try {
      await Promise.all([
        this.configService.getAll('tts.'),
        this.configService.getAll('voiceConversion.'),
        this.configService.getAll('memory.'),
      ]);

      const savedProvider = await this.configService.get(CONFIG_KEY);
      if (savedProvider && this.factory.availableProviders.includes(savedProvider)) {
        if (this.neuralController.isNeuralProvider(savedProvider)) {
          const status = this.neuralController.getStatus(savedProvider);
          if (status.state !== 'ready') {
            console.warn(`[TTS Manager] Saved neural provider is ${status.state}; keeping safe provider ${this.currentProviderName}.`);
            return;
          }
        }
        this.currentProviderInstance = this.factory.createTTSProvider(savedProvider, {
          neuralController: this.neuralController,
        });
        this.currentProviderName = savedProvider;
        console.log(`[TTS Manager] Restored provider from DB: ${savedProvider}`);
      } else {
        console.log(`[TTS Manager] No usable saved provider in DB, using default: ${this.currentProviderName}`);
      }
    } catch (error) {
      console.error('[TTS Manager] Provider restore failed; using safe default.');
    }
  }

  async _resolveVoiceConversionSettings() {
    const [enabledVal, savedPitch, savedIndexRate] = await Promise.all([
      this.configService.get('voiceConversion.enabled'),
      this.configService.get('voiceConversion.pitch'),
      this.configService.get('voiceConversion.indexRate'),
    ]);
    return {
      enabled: enabledVal !== null ? enabledVal === true : process.env.VOICE_CONVERSION_ENABLED === 'true',
      pitch: savedPitch !== null ? parseInt(savedPitch, 10)
        : (process.env.VOICE_CONVERSION_PITCH ? parseInt(process.env.VOICE_CONVERSION_PITCH, 10) : 0),
      indexRate: savedIndexRate !== null ? parseFloat(savedIndexRate)
        : (process.env.VOICE_CONVERSION_INDEX_RATE ? parseFloat(process.env.VOICE_CONVERSION_INDEX_RATE) : 0.4),
    };
  }

  async _maybeConvert(audioFilename, override = null) {
    const settings = override || await this._resolveVoiceConversionSettings();
    if (settings.enabled) {
      return this.voiceConversionService.convert(audioFilename, settings.pitch, settings.indexRate);
    }
    return audioFilename;
  }

  async _isFallbackEnabled() {
    const configured = await this.configService.get(FALLBACK_CONFIG_KEY, null);
    if (configured !== null) return configured === true;
    return process.env.TTS_GTTS_FALLBACK_ENABLED !== 'false';
  }

  async generate(text) {
    const normalizedText = normalizeText(text);
    const providerName = this.currentProviderName;
    const providerInstance = this.currentProviderInstance;
    let baseFilename;
    try {
      console.log(`[TTS Manager] Synthesizing with provider=${providerName}`);
      baseFilename = await providerInstance.synthesize(normalizedText);
    } catch (error) {
      const normalizedError = toTTSError(error);
      console.error(`[TTS Manager] Synthesis failed provider=${providerName} code=${normalizedError.code}`);
      const mayFallback = providerName !== 'gtts'
        && normalizedError.code !== 'TTS_INVALID_INPUT'
        && normalizedError.code !== 'TTS_ABORTED'
        && normalizedError.code !== 'TTS_SHUTTING_DOWN'
        && await this._isFallbackEnabled();
      if (!mayFallback) throw normalizedError;

      console.warn(`[TTS Manager] Falling back once from provider=${providerName} to provider=gtts`);
      try {
        const fallbackProvider = this.factory.createTTSProvider('gtts');
        baseFilename = await fallbackProvider.synthesize(normalizedText);
      } catch (fallbackError) {
        console.error('[TTS Manager] gTTS fallback failed code=TTS_SYNTHESIS_FAILED');
        throw normalizedError;
      }
    }
    return this._maybeConvert(baseFilename);
  }

  async preview(text, providerName, options = {}) {
    const normalizedText = normalizeText(text);
    const cleanName = this._normalizeProviderName(providerName || this.currentProviderName);
    if (this.neuralController.isNeuralProvider(cleanName)) {
      const status = this.neuralController.getStatus(cleanName);
      if (!status.active || !['ready', 'busy'].includes(status.state)) {
        throw new TTSError('TTS_NOT_READY');
      }
    }
    const provider = this.factory.createTTSProvider(cleanName, {
      neuralController: this.neuralController,
    });
    let filename = await provider.synthesize(normalizedText);
    if (options.voiceConversion === true) {
      const pitch = Number.isInteger(options.pitch) && options.pitch >= -12 && options.pitch <= 12
        ? options.pitch : 0;
      const indexRate = typeof options.indexRate === 'number'
        && Number.isFinite(options.indexRate) && options.indexRate >= 0 && options.indexRate <= 1
        ? options.indexRate : 0.4;
      filename = await this._maybeConvert(filename, { enabled: true, pitch, indexRate });
    }
    return { provider: cleanName, filename, voiceConversionEnabled: options.voiceConversion === true };
  }

  _normalizeProviderName(name) {
    if (typeof name !== 'string' || !name.trim()) throw new TTSError('TTS_UNKNOWN_PROVIDER');
    const cleanName = name.trim().toLowerCase();
    if (!this.factory.availableProviders.includes(cleanName)) throw new TTSError('TTS_UNKNOWN_PROVIDER');
    return cleanName;
  }

  async switchProvider(name, changedBy = 'control-panel') {
    const cleanName = this._normalizeProviderName(name);
    const now = Date.now();
    if (this.lastSwitchTime && now - this.lastSwitchTime < 3000) {
      throw new TTSError('TTS_BUSY');
    }
    this.lastSwitchTime = now;

    const run = this.switchChain.then(
      () => this._switchProviderInternal(cleanName, changedBy),
      () => this._switchProviderInternal(cleanName, changedBy),
    );
    this.switchChain = run.catch(() => {});
    return run;
  }

  async _switchProviderInternal(cleanName, changedBy) {
    if (cleanName === this.currentProviderName) return cleanName;
    const previousName = this.currentProviderName;
    const targetIsNeural = this.neuralController.isNeuralProvider(cleanName);
    const previousIsNeural = this.neuralController.isNeuralProvider(previousName);

    if (targetIsNeural) await this.neuralController.switchTo(cleanName);
    else if (previousIsNeural) await this.neuralController.deactivate();
    try {
      await this.configService.set(CONFIG_KEY, cleanName, changedBy);
    } catch (error) {
      if (previousIsNeural) await this.neuralController.switchTo(previousName).catch(() => {});
      else if (targetIsNeural) await this.neuralController.deactivate().catch(() => {});
      throw new TTSError('TTS_PERSIST_FAILED', { cause: error });
    }

    this.currentProviderInstance = this.factory.createTTSProvider(cleanName, {
      neuralController: this.neuralController,
    });
    this.currentProviderName = cleanName;
    console.log(`[TTS Manager] Switched active provider to: ${cleanName}`);
    return cleanName;
  }

  getCurrentProvider() {
    return this.currentProviderName;
  }

  getAvailableProviders() {
    return [...this.factory.availableProviders];
  }

  getProviderStatuses() {
    const neuralStatuses = new Map(this.neuralController.getStatuses().map((item) => [item.id, item]));
    return this.factory.getProviderMetadata().map((metadata) => {
      const status = neuralStatuses.get(metadata.id);
      return {
        ...metadata,
        ...(status || {}),
        active: metadata.id === this.currentProviderName,
      };
    });
  }

  async shutdown() {
    await this.neuralController.shutdown();
  }
}

const ttsManager = new TTSManager();

module.exports = ttsManager;
module.exports.TTSManager = TTSManager;
