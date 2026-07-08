import React from 'react';
import TTSProviderSelector from '../TTSProviderSelector';

export const TTSConfigTab = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>🔊 เสียงพูดสังเคราะห์ (TTS Configuration)</h3>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
          เลือกระบบผู้ให้บริการสังเคราะห์ประโยคเสียงพูดของ Syn
        </p>
      </div>

      <TTSProviderSelector />
    </div>
  );
};

export default TTSConfigTab;
