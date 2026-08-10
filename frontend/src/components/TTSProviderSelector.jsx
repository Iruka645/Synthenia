import React, { useEffect, useState } from 'react';
import { useTTSProvider } from '../contexts/TTSProviderContext';

const STATE_COLORS = Object.freeze({
  not_installed: '#94a3b8',
  unavailable: '#f59e0b',
  loading: '#3b82f6',
  ready: '#10b981',
  busy: '#8b5cf6',
  failed: '#ef4444',
});

function statusColor(state) {
  return STATE_COLORS[state] || '#94a3b8';
}

export const TTSProviderSelector = React.memo(({ previewSource = 'tts-selector-default' }) => {
  const {
    providers,
    currentProvider,
    loading,
    refreshing,
    switching,
    error,
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
  } = useTTSProvider();
  const [showTest, setShowTest] = useState(false);

  useEffect(() => () => {
    stopPreview(previewSource);
  }, [previewSource, stopPreview]);

  const handleProviderChange = async (event) => {
    try {
      await changeProvider(event.target.value);
    } catch {
      // Context exposes a sanitized user-facing error and preserves the current provider.
    }
  };

  const handlePlayTest = async () => {
    try {
      await playTest(undefined, { source: previewSource });
    } catch {
      // Context owns the sanitized preview error state.
    }
  };

  return (
    <section style={{
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
      boxShadow: 'var(--shadow)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
          🔊 ระบบเสียงพูดสังเคราะห์ (TTS)
        </h4>
        <button
          type="button"
          onClick={() => fetchTTSData()}
          disabled={loading}
          title="รีเฟรชสถานะ provider"
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            padding: '5px 8px',
          }}
        >
          {refreshing ? 'กำลังตรวจสอบ…' : switching ? 'กำลังสลับ…' : '↻ ตรวจสอบ'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label htmlFor="tts-provider-select" style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.8 }}>
          ผู้ให้บริการเสียง
        </label>
        <select
          id="tts-provider-select"
          value={currentProvider}
          onChange={handleProviderChange}
          disabled={loading || playing || providers.length === 0}
          style={{
            background: 'var(--bg)',
            color: 'var(--text-h)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '10px',
            fontSize: '14px',
            outline: 'none',
            cursor: loading || playing ? 'not-allowed' : 'pointer',
            width: '100%',
          }}
        >
          {!currentProvider && <option value="">กำลังโหลด provider…</option>}
          {providers.map((provider) => (
            <option
              key={provider.id}
              value={provider.id}
              disabled={!provider.selectable && provider.id !== currentProvider}
            >
              {provider.label} — {provider.statusLabel}
            </option>
          ))}
        </select>
      </div>

      <div aria-live="polite" style={{ display: 'grid', gap: '6px' }}>
        {providers.map((provider) => (
          <div
            key={provider.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '8px minmax(0, 1fr)',
              columnGap: '8px',
              alignItems: 'start',
              padding: '7px 8px',
              borderRadius: '8px',
              background: provider.active ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg)',
              border: provider.active ? '1px solid rgba(16, 185, 129, 0.24)' : '1px solid transparent',
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              marginTop: '4px',
              borderRadius: '50%',
              background: statusColor(provider.state),
            }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>
                {provider.label}{provider.active ? ' · กำลังใช้งาน' : ''}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text)', opacity: 0.75, marginTop: '2px' }}>
                {provider.statusLabel} — {provider.statusDetail}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            fontSize: '12px',
            color: '#ff6b6b',
            background: 'rgba(255,107,107,0.1)',
            padding: '8px',
            borderRadius: '8px',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowTest((visible) => !visible)}
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
          fontWeight: 600,
        }}
      >
        {showTest ? '▼' : '▶'} ทดสอบเสียง
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
        }}>
          <textarea
            value={testText}
            onChange={(event) => setTestText(event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="พิมพ์ข้อความเสียงทดสอบ…"
            style={{
              background: 'var(--card)',
              color: 'var(--text-h)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px',
              fontSize: '13px',
              resize: 'vertical',
              outline: 'none',
            }}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={useVoiceConversion}
              onChange={(event) => setUseVoiceConversion(event.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
            />
            แปลงเสียงด้วย Voice Conversion (เสียงซิน)
          </label>

          {useVoiceConversion && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '10px',
              background: 'var(--card)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}>
              <label style={{ display: 'grid', gap: '4px', fontSize: '11px', color: 'var(--text)' }}>
                <span>Pitch Shift: {vcPitch > 0 ? `+${vcPitch}` : vcPitch} semitones</span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={vcPitch}
                  onChange={(event) => setVcPitch(Number.parseInt(event.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </label>
              <label style={{ display: 'grid', gap: '4px', fontSize: '11px', color: 'var(--text)' }}>
                <span>Index Rate: {vcIndexRate.toFixed(2)}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={vcIndexRate}
                  onChange={(event) => setVcIndexRate(Number.parseFloat(event.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={handlePlayTest}
            disabled={playing || loading || !previewReady || !testText.trim()}
            title={previewReady ? 'สร้างและเล่นเสียงทดสอบ' : 'provider ปัจจุบันยังไม่พร้อมทดสอบเสียง'}
            style={{
              padding: '8px 12px',
              background: playing || !previewReady ? 'var(--border)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: playing || !previewReady ? 'not-allowed' : 'pointer',
            }}
          >
            {playing ? '⏳ กำลังเล่นเสียง…' : '▶ ทดลองฟัง'}
          </button>
        </div>
      )}
    </section>
  );
});

export default TTSProviderSelector;
