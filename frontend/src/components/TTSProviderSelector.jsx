import React, { useState } from 'react';
import { useTTSProvider } from '../contexts/TTSProviderContext';

export const TTSProviderSelector = React.memo(() => {
  const {
    providers,
    currentProvider,
    loading,
    error,
    testText,
    setTestText,
    playing,
    useVoiceConversion,
    setUseVoiceConversion,
    vcPitch,
    setVcPitch,
    vcIndexRate,
    setVcIndexRate,
    changeProvider,
    playTest
  } = useTTSProvider();

  const [showTest, setShowTest] = useState(false);

  const handleProviderChange = async (e) => {
    try {
      await changeProvider(e.target.value);
    } catch (err) {
      // Error will be set in the context
    }
  };

  const handlePlayTest = async () => {
    try {
      await playTest();
    } catch (err) {
      // Error will be set in the context
    }
  };

  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: '16px',
      border: '1px solid var(--border)',
      backdropFilter: 'blur(8px)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      color: 'var(--text-h)',
      fontFamily: 'Inter, sans-serif',
      boxShadow: 'var(--shadow)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-h)' }}>
          🔊 ระบบเสียงพูดสังเคราะห์ (TTS)
        </h4>
        {loading && <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 500 }}>กำลังสลับ...</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.8 }}>ผู้ให้บริการแปลงเสียง</label>
        <select
          value={currentProvider}
          onChange={handleProviderChange}
          disabled={loading}
          style={{
            background: 'var(--bg)',
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
          gap: '4px',
          fontWeight: 600
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
          background: 'var(--bg)',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          marginTop: '4px'
        }}>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            rows={2}
            placeholder="พิมพ์คำพูดทดสอบที่นี่..."
            style={{
              background: 'var(--card)',
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
              background: 'var(--card)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              marginTop: '4px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text)' }}>
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
                <span style={{ fontSize: '9px', color: 'var(--text)', opacity: 0.6, textAlign: 'right' }}>
                  (-12 คีย์ต่ำลง / 0 คีย์เดิม / +12 คีย์สูงขึ้น)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text)' }}>
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
                <span style={{ fontSize: '9px', color: 'var(--text)', opacity: 0.6, textAlign: 'right' }}>
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
              background: playing ? 'var(--border)' : 'var(--accent)',
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
});

export default TTSProviderSelector;
