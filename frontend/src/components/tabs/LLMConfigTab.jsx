import React, { useState, useEffect } from 'react';
import { updateLLMConfig, testLLMProvider, resetConfigKey, getConfig } from '../../services/api';
import ConfigSlider from '../ui/ConfigSlider';

export const LLMConfigTab = ({ config, onConfigChange, apiKey }) => {
  const [activeProvider, setActiveProvider] = useState(config['llm.currentProvider'] || 'ollama');
  const [modelByProvider, setModelByProvider] = useState(config['llm.modelByProvider'] || { ollama: '', siliconflow: '' });
  const [modelParams, setModelParams] = useState(config['llm.modelParams'] || { temperature: 0.8, top_p: 0.9, num_predict: 300 });

  // Custom model text inputs
  const [ollamaModelInput, setOllamaModelInput] = useState(config['llm.modelByProvider']?.ollama || 'gemma4:12b');
  const [siliconflowModelInput, setSiliconflowModelInput] = useState(config['llm.modelByProvider']?.siliconflow || 'openai/gpt-oss-20b');

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Sync state with incoming config prop
  useEffect(() => {
    if (config) {
      setActiveProvider(config['llm.currentProvider'] || 'ollama');
      setModelByProvider(config['llm.modelByProvider'] || { ollama: '', siliconflow: '' });
      setOllamaModelInput(config['llm.modelByProvider']?.ollama || 'gemma4:12b');
      setSiliconflowModelInput(config['llm.modelByProvider']?.siliconflow || 'openai/gpt-oss-20b');
      setModelParams(config['llm.modelParams'] || { temperature: 0.8, top_p: 0.9, num_predict: 300 });
    }
  }, [config]);

  const handleSave = async (updatedProvider = activeProvider) => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const data = {
      provider: updatedProvider,
      modelParams,
      modelByProvider: {
        ollama: ollamaModelInput.trim(),
        siliconflow: siliconflowModelInput.trim()
      }
    };

    try {
      await updateLLMConfig(data, apiKey);
      setSuccessMsg('บันทึกการตั้งค่า LLM สำเร็จ');
      onConfigChange(); // Refresh parent state
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('[LLMConfigTab] Save failed:', err);
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = async (provider) => {
    if (provider === 'siliconflow') {
      const confirmedSession = sessionStorage.getItem('siliconflow_confirmed');
      if (!confirmedSession) {
        const confirmSwitch = window.confirm(
          '⚠️ คำเตือน: การเปลี่ยนไปใช้ SiliconFlow (Cloud Provider) จะส่งผลต่อค่าใช้จ่ายจริงจากการใช้งาน API key ของคุณ\n\nต้องการดำเนินการต่อหรือไม่?'
        );
        if (!confirmSwitch) return;
        sessionStorage.setItem('siliconflow_confirmed', 'true');
      }
    }

    setActiveProvider(provider);
    await handleSave(provider);
  };

  const handleReset = async (key) => {
    const confirmReset = window.confirm(`ต้องการรีเซ็ตคีย์ "${key}" กลับเป็นค่าเริ่มต้นจากระบบ (.env) หรือไม่?`);
    if (!confirmReset) return;

    setSaving(true);
    setError(null);
    try {
      await resetConfigKey(key, apiKey);
      setSuccessMsg('รีเซ็ตการตั้งค่ากลับเป็นค่าเริ่มต้นแล้ว');
      onConfigChange();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการรีเซ็ตการตั้งค่า');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      // Test the currently chosen active provider (or the one saved)
      const data = await testLLMProvider(activeProvider);
      setTestResult(data);
    } catch (err) {
      console.error('[LLMConfigTab] Test failed:', err);
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดขณะส่งข้อความทดสอบไปยัง LLM');
    } finally {
      setTesting(false);
    }
  };

  // SiliconFlow cost calculation helper
  // input ~100-250 tokens, output ≤500 tokens -> ~$0.000052 to $0.0001
  const showCostWarning = activeProvider === 'siliconflow';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>🤖 การตั้งค่าโมเดลสมอง (LLM Configuration)</h3>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
          จัดการผู้ให้บริการ LLM, เลือกรุ่นโมเดล และปรับค่าพารามิเตอร์การประมวลผลความคิดของ Syn
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

      {/* Provider Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>เลือกผู้ให้บริการหลัก (LLM Provider)</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            onClick={() => handleProviderChange('ollama')}
            disabled={saving}
            style={{
              padding: '16px',
              background: activeProvider === 'ollama' ? 'rgba(var(--accent-rgb), 0.15)' : 'rgba(255,255,255,0.02)',
              border: activeProvider === 'ollama' ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              color: 'var(--text-h)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '24px' }}>🏠</span>
            <span>Ollama (Local Offline)</span>
            <span style={{ fontSize: '10px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>
              รันในคอมพิวเตอร์ของคุณ ฟรี ไร้ขีดจำกัด
            </span>
          </button>

          <button
            onClick={() => handleProviderChange('siliconflow')}
            disabled={saving}
            style={{
              padding: '16px',
              background: activeProvider === 'siliconflow' ? 'rgba(var(--accent-rgb), 0.15)' : 'rgba(255,255,255,0.02)',
              border: activeProvider === 'siliconflow' ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              color: 'var(--text-h)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '24px' }}>☁️</span>
            <span>SiliconFlow (Cloud API)</span>
            <span style={{ fontSize: '10px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>
              ตอบไว ฉลาด แม่นยำ (มีค่าใช้จ่าย API)
            </span>
          </button>
        </div>
      </div>

      {/* SiliconFlow Cost Box */}
      {showCostWarning && (
        <div style={{
          background: 'rgba(253, 126, 20, 0.08)',
          border: '1px solid rgba(253, 126, 20, 0.2)',
          borderRadius: '12px',
          padding: '12px 16px',
          color: '#ffd8a8',
          fontSize: '12px',
          lineHeight: '1.5'
        }}>
          💡 <strong>ประมาณการต้นทุน SiliconFlow:</strong><br />
          อ้างอิงปริมาณประมวลผลปัจจุบัน (คำสั่งนำเข้าความทรงจำ ~100-250 token, คำตอบ ≤500 token)
          จะตกอยู่ที่ประมาณ <strong>$0.000052 – $0.0001 ต่อแชท (ประมาณ 0.0019 - 0.0036 บาท)</strong>
        </div>
      )}

      {/* Model By Provider inputs */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>ตั้งค่าโมเดลประจำผู้ให้บริการ (Model Registry)</span>
          <button 
            onClick={() => handleReset('llm.modelByProvider')}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer' }}
          >
            🔄 รีเซ็ตโมเดลทั้งหมด
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Ollama Active Model</label>
          <input
            type="text"
            value={ollamaModelInput}
            onChange={(e) => setOllamaModelInput(e.target.value)}
            placeholder="e.g. gemma4:12b"
            style={{
              background: 'rgba(10, 10, 15, 0.6)',
              color: 'var(--text-h)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>SiliconFlow Active Model</label>
          <input
            type="text"
            value={siliconflowModelInput}
            onChange={(e) => setSiliconflowModelInput(e.target.value)}
            placeholder="e.g. openai/gpt-oss-20b"
            style={{
              background: 'rgba(10, 10, 15, 0.6)',
              color: 'var(--text-h)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
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
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>ปรับแต่งความคิกคักและจินตนาการ (Generation Parameters)</span>
          <button 
            onClick={() => handleReset('llm.modelParams')}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer' }}
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
          onChange={(val) => setModelParams({ ...modelParams, temperature: val })}
          helpText="ค่าน้อย = ตอบตรงตัวตน มีระเบียบ / ค่ามาก = คำตอบแปลกใหม่ อารมณ์ลื่นไหล แต่อาจพูดจานอกลู่นอกทาง"
        />

        <ConfigSlider
          label="Top P (กรองขอบเขตคำศัพท์)"
          min={0.0}
          max={1.0}
          step={0.05}
          value={modelParams.top_p}
          onChange={(val) => setModelParams({ ...modelParams, top_p: val })}
          helpText="สัดส่วนความน่าจะเป็นในการประเมินความสมเหตุสมผลของชุดคำพูดก่อนส่งออก"
        />

        <ConfigSlider
          label="Max Tokens to Output (ความยาวคำพูดสูงสุด)"
          min={50}
          max={1000}
          step={50}
          value={modelParams.num_predict}
          onChange={(val) => setModelParams({ ...modelParams, num_predict: val })}
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
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
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
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>ผลการทดสอบ LLM (ข้อความส่งตรวจ: "สวัสดี")</span>
            <span style={{
              fontSize: '11px',
              color: 'var(--accent)',
              fontWeight: 700,
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '2px 6px',
              borderRadius: '4px'
            }}>
              Latency: {testResult.latency} ms
            </span>
          </div>

          <div style={{ fontSize: '13px', display: 'flex', gap: '8px', marginTop: '4px' }}>
            <span style={{
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#a5d8ff',
              height: 'fit-content'
            }}>
              {testResult.emotion}
            </span>
            <span style={{ lineHeight: '1.5', color: '#e9ecef' }}>"{testResult.reply}"</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LLMConfigTab;
