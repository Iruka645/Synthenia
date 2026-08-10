import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getTTSCurrentProvider,
  getTTSProviderStatuses,
  previewTTS,
  switchTTSProvider,
} from '../services/api';
import {
  canPreviewTTSProvider,
  dispatchTTSProviderSwitch,
  getSafeTTSErrorCode,
  getSafeTTSErrorMessage,
  normalizeTTSProviders,
} from '../services/ttsContracts';
import { createTTSPreviewOwner } from '../services/ttsPreviewOwner';

const TTSProviderContext = createContext();

export const TTSProviderContextProvider = ({ children }) => {
  const [providers, setProviders] = useState([]);
  const [currentProvider, setCurrentProvider] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [testText, setTestText] = useState('สวัสดีค่ะ ฉันชื่อซิน ยินดีที่ได้คุยกับคุณนะ');
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [useVoiceConversion, setUseVoiceConversion] = useState(false);
  const [vcPitch, setVcPitch] = useState(0);
  const [vcIndexRate, setVcIndexRate] = useState(0.4);
  const refreshGeneration = useRef(0);
  const previewOwnerRef = useRef(null);
  const snapshotRef = useRef({ providers, currentProvider });
  snapshotRef.current = { providers, currentProvider };

  const fetchTTSData = useCallback(async ({ silent = false } = {}) => {
    const generation = refreshGeneration.current + 1;
    refreshGeneration.current = generation;
    if (!silent) setRefreshing(true);
    setError(null);
    try {
      const [statusData, currentData] = await Promise.all([
        getTTSProviderStatuses(),
        getTTSCurrentProvider(),
      ]);
      if (generation !== refreshGeneration.current) return;
      const normalized = normalizeTTSProviders(statusData?.providers);
      setProviders(normalized);
      setCurrentProvider(typeof currentData?.provider === 'string' ? currentData.provider : '');
    } catch (requestError) {
      if (generation !== refreshGeneration.current) return;
      console.error(`[TTSProviderContext] status refresh failed code=${getSafeTTSErrorCode(requestError)}`);
      setError(getSafeTTSErrorMessage(
        requestError,
        'ไม่สามารถโหลดสถานะระบบสังเคราะห์เสียงได้',
      ));
    } finally {
      if (!silent && generation === refreshGeneration.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const owner = createTTSPreviewOwner({
      getSnapshot: () => snapshotRef.current,
      requestPreview: ({
        text,
        providerId,
        voiceConversion,
        pitch,
        indexRate,
        signal,
      }) => previewTTS(text, providerId, voiceConversion, pitch, indexRate, signal),
      createAudio: (audioUrl) => new Audio(audioUrl),
      onPlayingChange: setPlaying,
      onError: setError,
      log: (message) => console.error(message),
    });
    previewOwnerRef.current = owner;
    fetchTTSData();
    return () => {
      refreshGeneration.current += 1;
      owner.dispose();
      if (previewOwnerRef.current === owner) previewOwnerRef.current = null;
    };
  }, [fetchTTSData]);

  const changeProvider = useCallback(async (selected) => {
    if (selected === currentProvider) return currentProvider;
    const previousProvider = currentProvider;
    setSwitching(true);
    setError(null);
    try {
      const result = await dispatchTTSProviderSwitch(providers, selected, switchTTSProvider);
      const nextProvider = typeof result?.provider === 'string' ? result.provider : selected;
      setCurrentProvider(nextProvider);
      await fetchTTSData({ silent: true });
      return nextProvider;
    } catch (switchError) {
      setCurrentProvider(previousProvider);
      console.error(`[TTSProviderContext] switch failed code=${getSafeTTSErrorCode(switchError)}`);
      setError(getSafeTTSErrorMessage(switchError, 'ไม่สามารถสลับระบบสังเคราะห์เสียงได้'));
      throw switchError;
    } finally {
      setSwitching(false);
    }
  }, [currentProvider, fetchTTSData, providers]);

  const previewReady = useMemo(
    () => canPreviewTTSProvider(providers, currentProvider),
    [currentProvider, providers],
  );

  const playTest = useCallback(async (customText, overrides = {}) => {
    const textToPlay = customText !== undefined ? customText : testText;
    setError(null);
    try {
      if (!previewOwnerRef.current) {
        const unavailable = new Error('TTS preview owner is unavailable');
        unavailable.code = 'TTS_NOT_READY';
        throw unavailable;
      }
      return await previewOwnerRef.current.play({
        text: textToPlay,
        voiceConversion: overrides.voiceConversion ?? useVoiceConversion,
        pitch: overrides.pitch ?? vcPitch,
        indexRate: overrides.indexRate ?? vcIndexRate,
        source: overrides.source || 'tts-selector',
      });
    } catch (previewError) {
      if (previewError?.code !== 'TTS_ABORTED') {
        setError(getSafeTTSErrorMessage(previewError, 'ไม่สามารถสร้างเสียงทดสอบได้'));
      }
      throw previewError;
    }
  }, [
    testText,
    useVoiceConversion,
    vcIndexRate,
    vcPitch,
  ]);

  const stopPreview = useCallback((source) => (
    previewOwnerRef.current?.stop(source) || false
  ), []);

  const value = useMemo(() => ({
    providers,
    currentProvider,
    loading: refreshing || switching,
    refreshing,
    switching,
    error,
    setError,
    testText,
    setTestText,
    playing,
    previewReady,
    useVoiceConversion,
    setUseVoiceConversion,
    vcPitch,
    setVcPitch,
    vcIndexRate,
    setVcIndexRate,
    fetchTTSData,
    changeProvider,
    playTest,
    stopPreview,
  }), [
    changeProvider,
    currentProvider,
    error,
    fetchTTSData,
    playTest,
    playing,
    previewReady,
    providers,
    refreshing,
    switching,
    stopPreview,
    testText,
    useVoiceConversion,
    vcIndexRate,
    vcPitch,
  ]);

  return (
    <TTSProviderContext.Provider value={value}>
      {children}
    </TTSProviderContext.Provider>
  );
};

export const useTTSProvider = () => {
  const context = useContext(TTSProviderContext);
  if (!context) {
    throw new Error('useTTSProvider must be used within a TTSProviderContextProvider');
  }
  return context;
};
