import React, { useState, useEffect } from 'react';
import TTSProviderSelector from '../TTSProviderSelector';
import { getMemoryStats } from '../../services/api';

export const TTSConfigTab = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getMemoryStats();
        setStats(data);
      } catch (err) {
        console.error('[TTSConfigTab] Failed to fetch stats:', err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>🔊 เสียงพูดสังเคราะห์ (TTS Configuration)</h3>
        <p style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.8, marginTop: '4px' }}>
          เลือกระบบผู้ให้บริการสังเคราะห์ประโยคเสียงพูดของ Syn
        </p>
      </div>

      <TTSProviderSelector />

      {/* Quota Gemini TTS */}
      {stats && stats.ttsQuota && (
        <div style={{
          background: 'rgba(25, 113, 194, 0.08)',
          border: '1px solid rgba(25, 113, 194, 0.2)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginTop: '10px'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>💎 Gemini TTS Quota Usage (Pacific Time RPD)</span>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text)', opacity: 0.8 }}>Gemini 3.1 TTS Preview</span>
              <span style={{ fontSize: '18px', fontWeight: 700 }}>
                {stats.ttsQuota.gemini31} / {stats.ttsQuota.limitPerModel} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text)', opacity: 0.6 }}>reqs</span>
              </span>
              <div style={{ width: '100%', height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                <div style={{
                  width: `${(stats.ttsQuota.gemini31 / stats.ttsQuota.limitPerModel) * 100}%`,
                  height: '100%',
                  background: stats.ttsQuota.gemini31 >= stats.ttsQuota.limitPerModel ? '#ff6b6b' : 'var(--accent)'
                }} />
              </div>
            </div>

            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text)', opacity: 0.8 }}>Gemini 2.5 TTS Preview</span>
              <span style={{ fontSize: '18px', fontWeight: 700 }}>
                {stats.ttsQuota.gemini25} / {stats.ttsQuota.limitPerModel} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text)', opacity: 0.6 }}>reqs</span>
              </span>
              <div style={{ width: '100%', height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                <div style={{
                  width: `${(stats.ttsQuota.gemini25 / stats.ttsQuota.limitPerModel) * 100}%`,
                  height: '100%',
                  background: stats.ttsQuota.gemini25 >= stats.ttsQuota.limitPerModel ? '#ff6b6b' : 'var(--accent)'
                }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TTSConfigTab;
