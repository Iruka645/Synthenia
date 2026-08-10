const path = require('path');
const { PROVIDER_IDS } = require('./contracts');
const { createInstallStateChecker } = require('./installState');

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../../..');
const SIDECAR_ROOT = path.join(REPOSITORY_ROOT, 'backend', 'tts-sidecars');
const LOCAL_ROOT = path.join(REPOSITORY_ROOT, '.local', 'tts-v2');
const REFERENCE_CONFIG = path.join(LOCAL_ROOT, 'reference', 'reference.json');

function descriptor({ id, label, directory }) {
  const providerRoot = path.join(LOCAL_ROOT, directory);
  const command = path.join(providerRoot, 'venv', 'Scripts', 'python.exe');
  const cwd = path.join(SIDECAR_ROOT, directory);
  const manifestPath = path.join(cwd, 'manifest.json');
  const lockPath = path.join(cwd, 'requirements.lock');
  const receiptPath = path.join(providerRoot, 'receipts', 'install-state.json');
  const getInstallState = createInstallStateChecker({
    providerId: id,
    command,
    providerRoot,
    receiptPath,
    manifestPath,
    lockPath,
  });
  return Object.freeze({
    id,
    label,
    command,
    args: Object.freeze([path.join(cwd, 'server.py')]),
    cwd,
    env: Object.freeze({
      HF_HOME: path.join(providerRoot, 'cache', 'huggingface'),
      HF_HUB_OFFLINE: '1',
      TRANSFORMERS_OFFLINE: '1',
      TTS_PROVIDER_ROOT: providerRoot,
      TTS_MODEL_ROOT: path.join(providerRoot, 'models'),
      TTS_CACHE_ROOT: path.join(providerRoot, 'cache'),
      TTS_REFERENCE_CONFIG: REFERENCE_CONFIG,
    }),
    getInstallState,
    isInstalled: () => getInstallState().installed,
  });
}

const DEFAULT_DESCRIPTORS = Object.freeze([
  descriptor({
    id: PROVIDER_IDS.JAITTS,
    label: 'JaiTTS F5-TTS',
    directory: 'jaitts',
  }),
  descriptor({
    id: PROVIDER_IDS.VACHA,
    label: 'VachaSpeech 0.6B',
    directory: 'vachaspeech',
  }),
]);

module.exports = {
  DEFAULT_DESCRIPTORS,
  LOCAL_ROOT,
  REFERENCE_CONFIG,
  REPOSITORY_ROOT,
  SIDECAR_ROOT,
};
