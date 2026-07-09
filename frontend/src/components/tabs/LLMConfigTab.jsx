import React, { useState, useEffect } from 'react';
import { updateLLMConfig, testLLMProvider, resetConfigKey } from '../../services/api';
import ConfigSlider from '../ui/ConfigSlider';
import { useUI } from '../../contexts/UIContext';

export const LLMConfigTab = ({ config, onConfigChange }) => {
  const { showConfirm } = useUI();
  const [modelParams, setModelParams] = useState(config['llm.modelParams'] || { temperature: 0.8, top_p: 0.9, num_predict: 300 });

  // Custom model text inputs
  const [ollamaModelInput, setOllamaModelInput] = useState(config['llm.modelByProvider']?.ollama || 'gemma4:12b');

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  // Track whether the user has unsaved local edits
  const [isDirty, setIsDirty] = useState(false);

  // Sync state with incoming config prop
  useEffect(() => {
    if (config && !isDirty) {
      setOllamaModelInput(config['llm.modelByProvider']?.ollama || 'gemma4:12b');
      setModelParams(config['llm.modelParams'] || { temperature: 0.8, top_p: 0.9, num_predict: 300 });
    }
  }, [config, isDirty]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const data = {
      provider: 'ollama',
      modelParams,
      modelByProvider: {
        ollama: ollamaModelInput.trim()
      }
    };

    try {
      await updateLLMConfig(data);
      setIsDirty(false); // edits persisted to server
      setSuccessMsg('บันทึกการตั้งค่า LLM สำเร็จ');
      onConfigChange(); // Refresh parent state
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('[LLMConfigTab] Save failed:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
    } finally {
      setSaving(false);
    }
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
      setIsDirty(false);
      setSuccessMsg('รีเซ็ตการตั้งค่ากลับเป็นค่าเริ่มต้นแล้ว');
      onConfigChange();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาดในการรีเซ็ตการตั้งค่า');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const data = await testLLMProvider('ollama');
      setTestResult(data);
    } catch (err) {
      console.error('[LLMConfigTab] Test failed:', err);
      setError(err.message || 'เกิดข้อผิดพลาดขณะส่งข้อความทดสอบไปยัง LLM');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>🤖 การตั้งค่าโมเดลสมอง (LLM Configuration)</h3>
        <p style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.8, marginTop: '4px' }}>
          จัดการโมเดล Ollama และปรับค่าพารามิเตอร์การประมวลผลความคิดของ Syn
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

      {/* Provider Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)', opacity: 0.95 }}>ผู้ให้บริการหลัก (LLM Provider)</span>
        <div style={{
          padding: '16px',
          background: 'rgba(var(--accent-rgb), 0.1)',
          border: '2px solid var(--accent)',
          borderRadius: '16px',
          color: 'var(--text-h)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{ fontSize: '24px' }}>🏠</span>
          <span style={{ fontWeight: 700 }}>Ollama (Local Offline)</span>
          <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text)', opacity: 0.8 }}>
            รันในคอมพิวเตอร์ของคุณ ฟรี ไร้ขีดจำกัด
          </span>
        </div>
      </div>

      {/* Model Registry inputs */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)', opacity: 0.95 }}>ตั้งค่าโมเดลประจำผู้ให้บริการ (Model Registry)</span>
          <button 
            onClick={() => handleReset('llm.modelByProvider')}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
          >
            🔄 รีเซ็ตโมเดล
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.8 }}>Ollama Active Model</label>
          <input
            type="text"
            value={ollamaModelInput}
            onChange={(e) => { setOllamaModelInput(e.target.value); setIsDirty(true); }}
            placeholder="e.g. gemma4:12b"
            style={{
              background: 'var(--bg)',
              color: 'var(--text-h)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Parameters configuration */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)', opacity: 0.95 }}>ปรับแต่งความคิกคักและจินตนาการ (Generation Parameters)</span>
          <button 
            onClick={() => handleReset('llm.modelParams')}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
          >
            🔄 รีเซ็ตค่าพารามิเตอร์
          </button>
        </div>

        <ConfigSlider
          label="Temperature (ความยืดหยุ่นทางความคิด)"
          min={0.0}
          max={2.0}
          step={0.1}
          value={modelParams.temperature}
          onChange={(val) => { setModelParams({ ...modelParams, temperature: val }); setIsDirty(true); }}
          helpText="ค่าน้อย = ตอบตรงตัวตน มีระเบียบ / ค่ามาก = คำตอบแปลกใหม่ อารมณ์ลื่นไหล แต่อาจพูดจานอกลู่นอกทาง"
        />

        <ConfigSlider
          label="Top P (กรองขอบเขตคำศัพท์)"
          min={0.0}
          max={1.0}
          step={0.05}
          value={modelParams.top_p}
          onChange={(val) => { setModelParams({ ...modelParams, top_p: val }); setIsDirty(true); }}
          helpText="สัดส่วนความน่าจะเป็นในการประเมินความสมเหตุสมผลของชุดคำพูดก่อนส่งออก"
        />

        <ConfigSlider
          label="Max Tokens to Output (ความยาวคำพูดสูงสุด)"
          min={50}
          max={1000}
          step={50}
          value={modelParams.num_predict}
          onChange={(val) => { setModelParams({ ...modelParams, num_predict: val }); setIsDirty(true); }}
          valueSuffix=" tokens"
          helpText="ขีดจำกัดความยาวประโยคในการประมวลผลคำตอบ (300 tokens ปลอดภัยสุด)"
        />
      </div>

      {/* Action panel */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
        <button
          onClick={() => handleSave()}
          disabled={saving}
          style={{
            flex: 2,
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
          {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการตั้งค่า LLM ทั้งหมด'}
        </button>

        <button
          onClick={handleTest}
          disabled={testing}
          style={{
            flex: 1,
            padding: '14px',
            background: 'var(--code-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-h)',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: testing ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {testing ? '⏳ กำลังส่งทดสอบ...' : '⚡ ทดสอบโมเดล'}
        </button>
      </div>

      {/* Test Response Preview */}
      {testResult && (
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.8, fontWeight: 600 }}>ผลการทดสอบ LLM (ข้อความส่งตรวจ: "สวัสดี")</span>
            <span style={{
              fontSize: '11px',
              color: 'var(--accent)',
              fontWeight: 700,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              padding: '2px 6px',
              borderRadius: '4px'
            }}>
              Latency: {testResult.latency} ms
            </span>
          </div>

          <div style={{ fontSize: '13px', display: 'flex', gap: '8px', marginTop: '4px' }}>
            <span style={{
              background: 'var(--accent-bg)',
              border: '1px solid var(--accent-border)',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              color: 'var(--accent)',
              height: 'fit-content',
              fontWeight: 600
            }}>
              {testResult.emotion}
            </span>
            <span style={{ lineHeight: '1.5', color: 'var(--text-h)' }}>"{testResult.reply}"</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LLMConfigTab;
