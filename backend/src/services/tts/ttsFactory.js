const GTTSProvider = require('./providers/gttsProvider');
const PiperProvider = require('./providers/piperProvider');
const NeuralProvider = require('./providers/neuralProvider');
const neuralTtsController = require('./neural/neuralTtsController');
const { PROVIDER_IDS } = require('./neural/contracts');

const providers = Object.freeze({
  gtts: { label: 'Google Translate TTS', kind: 'legacy', ProviderClass: GTTSProvider },
  piper: { label: 'Piper TTS (Offline)', kind: 'legacy', ProviderClass: PiperProvider },
  [PROVIDER_IDS.JAITTS]: { label: 'JaiTTS F5-TTS', kind: 'neural' },
  [PROVIDER_IDS.VACHA]: { label: 'VachaSpeech 0.6B', kind: 'neural' },
});

const availableProviders = Object.freeze(Object.keys(providers));

function createTTSProvider(name, options = {}) {
  const cleanName = typeof name === 'string' ? name.toLowerCase() : '';
  const definition = providers[cleanName];
  if (!definition) {
    throw new Error(`Unknown TTS provider: ${name}. Available: ${Object.keys(providers).join(', ')}`);
  }
  if (definition.kind === 'neural') {
    return new NeuralProvider(cleanName, options.neuralController || neuralTtsController);
  }
  return new definition.ProviderClass();
}

function getProviderMetadata() {
  const neuralStatuses = new Map(neuralTtsController.getStatuses().map((item) => [item.id, item]));
  return availableProviders.map((id) => {
    const definition = providers[id];
    if (definition.kind === 'neural') {
      return { id, label: definition.label, kind: definition.kind, ...neuralStatuses.get(id) };
    }
    return {
      id,
      label: definition.label,
      kind: definition.kind,
      state: 'ready',
      installed: true,
      active: false,
    };
  });
}

module.exports = {
  createTTSProvider,
  getProviderMetadata,
  availableProviders,
};
