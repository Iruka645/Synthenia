import React, { useState, useEffect } from 'react';
import { updateVoiceConversionConfig, resetConfigKey } from '../../services/api';
import { getSafeTTSErrorMessage } from '../../services/ttsContracts';
import ConfigSlider from '../ui/ConfigSlider';
import ConfigToggle from '../ui/ConfigToggle';
import { useUI } from '../../contexts/UIContext';
import { useTTSProvider } from '../../contexts/TTSProviderContext';

const PREVIEW_SOURCE = 'voice-conversion-tab';

export const VoiceConversionTab = ({ config, onConfigChange }) => {
  const { showConfirm } = useUI();
  const {
    playing,
    previewReady,
    playTest,
    stopPreview,
  } = useTTSProvider();
  const [enabled, setEnabled] = useState(config['voiceConversion.enabled'] || false);
  const [pitch, setPitch] = useState(config['voiceConversion.pitch'] || 0);
  const [indexRate, setIndexRate] = useState(config['voiceConversion.indexRate'] || 0.4);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  // Preview States
  const [testText, setTestText] = useState('สวัสดีค่ะ เสียงของฉันแปลกไปหรือเปล่าคะ?');
  const [playError, setPlayError] = useState(null);

  useEffect(() => {
    if (config && !isDirty) {
      setEnabled(config['voiceConversion.enabled'] || false);
      setPitch(config['voiceConversion.pitch'] || 0);
      setIndexRate(config['voiceConversion.indexRate'] || 0.4);
    }
  }, [config, isDirty]);

  useEffect(() => () => {
    stopPreview(PREVIEW_SOURCE);
  }, [stopPreview]);

  const handleSave = async (updatedEnabled = enabled) => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const data = {
      enabled: updatedEnabled,
      pitch,
      indexRate
    };

    try {
      await updateVoiceConversionConfig(data);
      setSuccessMsg('บันทึกการตั้งค่า Voice Conversion สำเร็จ');
      setIsDirty(false); // Clear dirty flag on success
      onConfigChange();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      console.error('[VoiceConversionTab] save failed code=CONFIG_SAVE_FAILED');
      setError('ไม่สามารถบันทึกการตั้งค่า Voice Conversion ได้');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleChange = async (val) => {
    setEnabled(val);
    await handleSave(val);
  };

  const handleReset = async (key) => {
    const confirmReset = await showConfirm(
      'รีเซ็ตการตั้งค่า',
      `ต้องการรีเซ็ตคีย์ "${key}" กลับเป็นค่าเริ่มต้นจากระบบ (.env) หรือไม่?`
    );
    if (!confirmReset) return;

    setSaving(true);
    setError(null);
    try {
      await resetConfigKey(key);
      setSuccessMsg('รีเซ็ตการตั้งค่าเรียบร้อยแล้ว');
      setIsDirty(false); // Clear dirty flag on success
      onConfigChange();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      console.error('[VoiceConversionTab] reset failed code=CONFIG_RESET_FAILED');
      setError('ไม่สามารถรีเซ็ตการตั้งค่า Voice Conversion ได้');
    } finally {
      setSaving(false);
    }
  };

  const handlePlayPreview = async () => {
    if (!testText.trim() || playing) return;
    setPlayError(null);

    try {
      await playTest(testText, {
        voiceConversion: true,
        pitch,
        indexRate,
        source: PREVIEW_SOURCE,
      });
    } catch (previewError) {
      if (previewError?.code !== 'TTS_ABORTED') {
        setPlayError(getSafeTTSErrorMessage(previewError, 'ไม่สามารถแปลงเสียงทดสอบได้'));
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>🎙️ การแปลงโมเดลเสียง (Voice Conversion)</h3>
        <p style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.8, marginTop: '4px' }}>
          ปรับแต่งเสียงพูดของ Syn ผ่าน RVC (Retrieval-based Voice Conversion) ให้เป็นน้ำเสียงเด็กผู้หญิงน่ารักอย่างสมบูรณ์แบบ
        </p>
      </div>

      {successMsg && (
        <div style={{ fontSize: '13px', color: '#51cf66', background: 'rgba(81,207,102,0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(81,207,102,0.15)' }}>
          ✅ {successMsg}
        </div>
      )}

      {error && (
        <div style={{ fontSize: '13px', color: '#ff6b6b', background: 'rgba(255,107,107,0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,107,107,0.15)' }}>
          ⚠️ {error}
        </div>
      )}

      {/* RVC Enable Toggle */}
      <ConfigToggle
        label="เปิดใช้งาน Voice Conversion (เสียงคาแรคเตอร์ซิน)"
        checked={enabled}
        onChange={handleToggleChange}
        disabled={saving}
      />

      {/* Pitch Slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text)', opacity: 0.8 }}>ค่า Pitch Shift คีย์เสียง</span>
          <button 
            onClick={() => handleReset('voiceConversion.pitch')}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
          >
            🔄 รีเซ็ต Pitch
          </button>
        </div>
        <ConfigSlider
          label="ปรับระดับคีย์เสียง (Pitch Shift)"
          min={-12}
          max={12}
          step={1}
          value={pitch}
          onChange={(val) => { setPitch(val); setIsDirty(true); }}
          valueSuffix=" semitones"
          helpText="ปรับแต่งความทุ้ม/แหลมของเสียง (-12 คีย์ชายทุ้ม / 0 เสียงตาม provider / +12 คีย์หญิงแหลมสูง)"
        />
      </div>

      {/* Index Rate Slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text)', opacity: 0.8 }}>ค่า Index Rate ความเสมือน</span>
          <button 
            onClick={() => handleReset('voiceConversion.indexRate')}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
          >
            🔄 รีเซ็ต Index
          </button>
        </div>
        <ConfigSlider
          label="อัตราความคล้ายโมเดลต้นแบบ (Index Rate)"
          min={0.0}
          max={1.0}
          step={0.05}
          value={indexRate}
          onChange={(val) => { setIndexRate(val); setIsDirty(true); }}
          helpText="ค่าน้อย = ได้อารมณ์เสียงพูดที่ลื่นไหลเป็นธรรมชาติกว่า / ค่ามาก = เลียนแบบโมเดลเป๊ะแต่อาจพังหุ่นยนต์"
        />
      </div>

      {/* Save Button */}
      <button
        onClick={() => handleSave()}
        disabled={saving}
        style={{
          padding: '14px',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: 700,
          cursor: saving ? 'not-allowed' : 'pointer',
          transition: 'opacity 0.2s',
          boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)'
        }}
      >
        {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกระดับและคีย์เสียง'}
      </button>

      {/* Voice conversion Preview tester */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginTop: '10px'
      }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)', opacity: 0.95 }}>🎙️ ทดลองฟังเสียงแปลงสด (Voice Conversion Preview)</span>
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          rows={2}
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-h)',
            padding: '10px',
            fontSize: '13px',
            resize: 'none',
            outline: 'none'
          }}
        />

        {playError && (
          <span style={{ fontSize: '11px', color: '#ff6b6b' }}>⚠️ {playError}</span>
        )}

        <button
          onClick={handlePlayPreview}
          disabled={playing || !previewReady || !testText.trim()}
          title={previewReady ? 'สังเคราะห์และแปลงเสียงทดสอบ' : 'provider ปัจจุบันยังไม่พร้อมทดสอบเสียง'}
          style={{
            padding: '10px 14px',
            background: playing ? 'var(--code-bg)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: playing || !previewReady || !testText.trim() ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>{playing ? '⏳ กำลังประมวลผลเสียงพูด...' : '▶ สังเคราะห์และแปลงเสียง'}</span>
        </button>
      </div>
    </div>
  );
};

export default VoiceConversionTab;
