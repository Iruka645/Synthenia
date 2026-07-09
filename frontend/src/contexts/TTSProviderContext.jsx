import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getTTSCurrentProvider, getTTSProvidersList, switchTTSProvider, previewTTS } from '../services/api';

const TTSProviderContext = createContext();

export const TTSProviderContextProvider = ({ children }) => {
  const [providers, setProviders] = useState([]);
  const [currentProvider, setCurrentProvider] = useState('');
  const [loading, setLoading] = useState(false);
  const [testText, setTestText] = useState('สวัสดีค่ะ ฉันชื่อซิน ยินดีที่ได้คุยกับคุณนะ');
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [useVoiceConversion, setUseVoiceConversion] = useState(false);
  const [vcPitch, setVcPitch] = useState(0);
  const [vcIndexRate, setVcIndexRate] = useState(0.4);

  const fetchTTSData = useCallback(async () => {
    setError(null);
    try {
      const listData = await getTTSProvidersList();
      const currentData = await getTTSCurrentProvider();
      setProviders(listData.providers || []);
      setCurrentProvider(currentData.provider || '');
    } catch (err) {
      console.error('[TTSProviderContext] Failed to load TTS data:', err);
      setError('ไม่สามารถเชื่อมต่อระบบเสียงสังเคราะห์ได้');
    }
  }, []);

  useEffect(() => {
    fetchTTSData();
  }, [fetchTTSData]);

  const changeProvider = useCallback(async (selected) => {
    setLoading(true);
    setError(null);
    try {
      const result = await switchTTSProvider(selected);
      setCurrentProvider(result.provider);
      return result.provider;
    } catch (err) {
      console.error('[TTSProviderContext] Failed to switch TTS provider:', err);
      setError('ไม่สามารถเปลี่ยนตัวแปลงเสียงได้');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const playTest = useCallback(async (customText) => {
    const textToPlay = customText !== undefined ? customText : testText;
    if (!textToPlay.trim() || playing) return;
    
    setPlaying(true);
    setError(null);
    try {
      const result = await previewTTS(textToPlay, currentProvider, useVoiceConversion, vcPitch, vcIndexRate);
      if (result && result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        audio.onended = () => setPlaying(false);
        audio.onerror = () => {
          setError('ไม่สามารถเล่นไฟล์เสียงพรีวิวได้');
          setPlaying(false);
        };
        await audio.play();
      } else {
        throw new Error('No audio URL returned');
      }
    } catch (err) {
      console.error('[TTSProviderContext] Preview error:', err);
      setError('เกิดข้อผิดพลาดในการสร้างเสียงทดสอบ');
      setPlaying(false);
      throw err;
    }
  }, [testText, currentProvider, useVoiceConversion, vcPitch, vcIndexRate, playing]);

  return (
    <TTSProviderContext.Provider value={{
      providers,
      currentProvider,
      loading,
      error,
      setError,
      testText,
      setTestText,
      playing,
      setPlaying,
      useVoiceConversion,
      setUseVoiceConversion,
      vcPitch,
      setVcPitch,
      vcIndexRate,
      setVcIndexRate,
      fetchTTSData,
      changeProvider,
      playTest
    }}>
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
