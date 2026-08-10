import { canPreviewTTSProvider, toSafeTTSError } from './ttsContracts.js';

function localError(code) {
  return toSafeTTSError({ code }, code);
}

export function createTTSPreviewOwner(options) {
  const {
    getSnapshot,
    requestPreview,
    createAudio,
    onPlayingChange = () => {},
    onError = () => {},
    log = () => {},
  } = options || {};
  if (typeof getSnapshot !== 'function'
    || typeof requestPreview !== 'function'
    || typeof createAudio !== 'function') {
    throw new TypeError('TTS preview owner requires snapshot, request, and audio factories');
  }

  let generation = 0;
  let activeAudio = null;
  let activeAbort = null;
  let activeSource = null;
  let pending = false;
  let disposed = false;

  function notifyStopped(notify) {
    if (notify) onPlayingChange(false);
  }

  function clearOwnership(currentGeneration, notify = true) {
    if (currentGeneration !== generation) return;
    if (activeAudio) {
      activeAudio.onended = null;
      activeAudio.onerror = null;
    }
    activeAudio = null;
    activeAbort = null;
    activeSource = null;
    pending = false;
    notifyStopped(notify);
  }

  function stop(source, notify = true) {
    if (source && activeSource && source !== activeSource) return false;
    if (!pending && !activeAudio) return false;
    generation += 1;
    if (activeAbort) activeAbort.abort();
    if (activeAudio) {
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.pause();
    }
    activeAudio = null;
    activeAbort = null;
    activeSource = null;
    pending = false;
    notifyStopped(notify);
    return true;
  }

  async function play({
    text,
    voiceConversion = false,
    pitch = 0,
    indexRate = 0.4,
    source = 'tts-selector',
  } = {}) {
    if (disposed) throw localError('TTS_NOT_READY');
    if (pending || activeAudio) throw localError('TTS_BUSY');
    if (typeof text !== 'string' || !text.trim()) throw localError('TTS_INVALID_INPUT');

    const snapshot = getSnapshot() || {};
    const providerId = snapshot.currentProvider;
    if (!canPreviewTTSProvider(snapshot.providers, providerId)) {
      throw localError('TTS_NOT_READY');
    }

    const currentGeneration = generation + 1;
    generation = currentGeneration;
    activeSource = source;
    pending = true;
    activeAbort = new AbortController();
    onPlayingChange(true);

    try {
      const result = await requestPreview({
        text,
        providerId,
        voiceConversion: voiceConversion === true,
        pitch,
        indexRate,
        signal: activeAbort.signal,
      });
      if (disposed || currentGeneration !== generation) throw localError('TTS_ABORTED');
      if (!result || typeof result.audioUrl !== 'string' || !result.audioUrl.trim()) {
        throw localError('TTS_SYNTHESIS_FAILED');
      }

      const audio = createAudio(result.audioUrl);
      if (!audio || typeof audio.play !== 'function' || typeof audio.pause !== 'function') {
        throw localError('TTS_SYNTHESIS_FAILED');
      }
      activeAudio = audio;
      pending = false;
      audio.onended = () => clearOwnership(currentGeneration);
      audio.onerror = () => {
        const safeError = localError('TTS_SYNTHESIS_FAILED');
        onError(safeError.message);
        log(`[TTSPreview] failed code=${safeError.code}`);
        clearOwnership(currentGeneration);
      };
      await audio.play();
      if (disposed || currentGeneration !== generation || activeAudio !== audio) {
        throw localError('TTS_ABORTED');
      }
      return { provider: providerId, audioUrl: result.audioUrl };
    } catch (error) {
      const cancelled = disposed || currentGeneration !== generation;
      clearOwnership(currentGeneration);
      const safeError = cancelled ? localError('TTS_ABORTED') : toSafeTTSError(error);
      if (safeError.code !== 'TTS_ABORTED') {
        onError(safeError.message);
        log(`[TTSPreview] failed code=${safeError.code}`);
      }
      throw safeError;
    }
  }

  function dispose() {
    disposed = true;
    stop(undefined, false);
  }

  return Object.freeze({
    play,
    stop,
    dispose,
    isPlaying: () => pending || activeAudio !== null,
  });
}
