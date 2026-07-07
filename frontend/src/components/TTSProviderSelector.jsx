import React, { useState, useEffect } from 'react';
import { getTTSCurrentProvider, getTTSProvidersList, switchTTSProvider, previewTTS } from '../services/api';

export const TTSProviderSelector = () => {
  const [providers, setProviders] = useState([]);
  const [currentProvider, setCurrentProvider] = useState('');
  const [loading, setLoading] = useState(false);
  const [testText, setTestText] = useState('สวัสดีค่ะ ฉันชื่อซิน ยินดีที่ได้คุยกับคุณนะ');
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [showTest, setShowTest] = useState(false);
  const [useVoiceConversion, setUseVoiceConversion] = useState(false);
  const [vcPitch, setVcPitch] = useState(0);
  const [vcIndexRate, setVcIndexRate] = useState(0.4);

  useEffect(() => {
    const fetchTTSData = async () => {
      try {
        const listData = await getTTSProvidersList();
        const currentData = await getTTSCurrentProvider();
        setProviders(listData.providers || []);
        setCurrentProvider(currentData.provider || '');
      } catch (err) {
        console.error('Failed to load TTS data:', err);
        setError('ไม่สามารถเชื่อมต่อระบบเสียงสังเคราะห์ได้');
      }
    };
    fetchTTSData();
  }, []);

  const handleProviderChange = async (e) => {
    const selected = e.target.value;
    setLoading(true);
    setError(null);
    try {
      const result = await switchTTSProvider(selected);
      setCurrentProvider(result.provider);
    } catch (err) {
      console.error('Failed to switch TTS provider:', err);
      setError('ไม่สามารถเปลี่ยนตัวแปลงเสียงได้');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayTest = async () => {
    if (!testText.trim() || playing) return;
    setPlaying(true);
    setError(null);
    try {
      const result = await previewTTS(testText, currentProvider, useVoiceConversion, vcPitch, vcIndexRate);
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
      console.error('Preview error:', err);
      setError('เกิดข้อผิดพลาดในการสร้างเสียงทดสอบ');
      setPlaying(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(30, 30, 45, 0.4)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(8px)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      color: 'var(--text-h)',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-h)' }}>
          🔊 ระบบเสียงพูดสังเคราะห์ (TTS)
        </h4>
        {loading && <span style={{ fontSize: '11px', color: 'var(--accent)' }}>กำลังสลับ...</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>ผู้ให้บริการแปลงเสียง</label>
        <select
          value={currentProvider}
          onChange={handleProviderChange}
          disabled={loading}
          style={{
            background: 'rgba(15, 15, 25, 0.8)',
            color: 'var(--text-h)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '10px',
            fontSize: '14px',
            outline: 'none',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          {providers.map((p) => {
            let label = p.toUpperCase();
            if (p.toLowerCase() === 'gtts') label = 'Google Translate TTS';
            else if (p.toLowerCase() === 'piper') label = 'Piper TTS (Offline)';
            else if (p.toLowerCase() === 'pythaitts') label = 'PyThaiTTS - Lunarlist (ONNX Offline)';
            else if (p.toLowerCase() === 'khanomtan') label = 'PyThaiTTS - KhanomTan (Offline)';
            else if (p.toLowerCase() === 'geminitts') label = 'Gemini TTS (Cloud API)';
            
            return (
              <option key={p} value={p}>
                {label}
              </option>
            );
          })}
        </select>
      </div>

      {error && (
        <div style={{ fontSize: '12px', color: '#ff6b6b', background: 'rgba(255,107,107,0.1)', padding: '8px', borderRadius: '8px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Test Section Toggle */}
      <button
        onClick={() => setShowTest(!showTest)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          fontSize: '13px',
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
          width: 'fit-content',
          marginTop: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        <span>{showTest ? '▼' : '▶'}</span> ทดสอบสังเคราะห์เสียงเดี่ยวๆ
      </button>

      {showTest && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '12px',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.05)',
          marginTop: '4px'
        }}>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            rows={2}
            placeholder="พิมพ์คำพูดทดสอบที่นี่..."
            style={{
              background: 'rgba(15, 15, 25, 0.6)',
              color: 'var(--text-h)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px',
              fontSize: '13px',
              resize: 'none',
              outline: 'none'
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', marginBottom: '2px' }}>
            <input
              type="checkbox"
              id="voice-conversion-preview"
              checked={useVoiceConversion}
              onChange={(e) => setUseVoiceConversion(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                accentColor: 'var(--accent)',
                cursor: 'pointer'
              }}
            />
            <label
              htmlFor="voice-conversion-preview"
              style={{
                fontSize: '12px',
                color: 'var(--text-h)',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              แปลงเสียงด้วย Voice Conversion (เสียงซิน)
            </label>
          </div>
          {useVoiceConversion && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              marginTop: '4px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                  <span>ปรับคีย์เสียง (Pitch Shift):</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{vcPitch > 0 ? `+${vcPitch}` : vcPitch} semitones</span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={vcPitch}
                  onChange={(e) => setVcPitch(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textAlign: 'right' }}>
                  (-12 คีย์ต่ำลง / 0 คีย์เดิม / +12 คีย์สูงขึ้น)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                  <span>ความเหมือนเสียงต้นแบบ (Index Rate):</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{vcIndexRate.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={vcIndexRate}
                  onChange={(e) => setVcIndexRate(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textAlign: 'right' }}>
                  (ค่าน้อย = เสียงเป็นธรรมชาติกว่า / ค่ามาก = เลียนแบบเสียงเป๊ะขึ้นแต่อาจจะแหบ/หุ่นยนต์)
                </span>
              </div>
            </div>
          )}
          <button
            onClick={handlePlayTest}
            disabled={playing || !testText.trim()}
            style={{
              padding: '8px 12px',
              background: playing ? 'rgba(255,255,255,0.1)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: playing ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>{playing ? '⏳ กำลังเล่นเสียง...' : '▶ ทดลองฟัง'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default TTSProviderSelector;
