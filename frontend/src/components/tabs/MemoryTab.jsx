import React, { useState, useEffect } from 'react';
import { getMemoryStats, triggerConsolidate, triggerDecay, updateMemoryConfig, resetConfigKey } from '../../services/api';
import ConfigToggle from '../ui/ConfigToggle';

export const MemoryTab = ({ config, onConfigChange, apiKey }) => {
  const [stats, setStats] = useState(null);
  const [autoConsolidation, setAutoConsolidation] = useState(config['memory.autoConsolidation'] !== false);

  const [loadingStats, setLoadingStats] = useState(false);
  const [triggering, setTriggering] = useState(null); // 'consolidate' | 'decay'
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const data = await getMemoryStats();
      setStats(data);
    } catch (err) {
      console.error('[MemoryTab] Failed to fetch stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (config) {
      setAutoConsolidation(config['memory.autoConsolidation'] !== false);
    }
  }, [config]);

  const handleToggleAutoConsolidation = async (val) => {
    setAutoConsolidation(val);
    setError(null);
    setMsg(null);
    try {
      await updateMemoryConfig({ autoConsolidation: val }, apiKey);
      setMsg(`บันทึกสถานะการรันอัตโนมัติเป็น: ${val ? 'เปิด' : 'ปิด'}`);
      onConfigChange();
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกค่า');
    }
  };

  const handleManualTrigger = async (type) => {
    const confirmTrigger = window.confirm(
      type === 'consolidate'
        ? 'ต้องการเริ่มจัดเก็บข้อมูลความทรงจำเป็นข้อเท็จจริง (Consolidate Memory) ในขณะนี้เลยหรือไม่?'
        : 'ต้องการรันล้างลดระดับความสำคัญของความทรงจำที่ไม่ได้ใช้นาน (Memory Decay) ตอนนี้เลยหรือไม่?'
    );
    if (!confirmTrigger) return;

    setTriggering(type);
    setError(null);
    setMsg(null);

    try {
      let res;
      if (type === 'consolidate') {
        res = await triggerConsolidate(apiKey);
      } else {
        res = await triggerDecay(apiKey);
      }
      setMsg(res.message || 'รันสำเร็จ');
      setTimeout(() => setMsg(null), 5000);
      
      // Reload stats after short delay
      setTimeout(fetchStats, 2000);
    } catch (err) {
      console.error(`[MemoryTab] Trigger ${type} failed:`, err);
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดขณะสั่งการประมวลผลความทรงจำ');
    } finally {
      setTriggering(null);
    }
  };

  const handleReset = async () => {
    const confirmReset = window.confirm('ต้องการรีเซ็ตการตั้งค่าการจัดเก็บอัตโนมัติกลับเป็นเปิดใช้งานหรือไม่?');
    if (!confirmReset) return;

    setError(null);
    try {
      await resetConfigKey('memory.autoConsolidation', apiKey);
      setMsg('รีเซ็ตการจัดเก็บอัตโนมัติสำเร็จ');
      onConfigChange();
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการรีเซ็ตค่า');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>🧠 การจัดการระบบความทรงจำ (Memory Dashboard)</h3>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
          ติดตามสถิติความจำถาวร ควบคุมตารางรันบีบอัดสรุปเหตุการณ์ และตรวจสอบสิทธิ์โควต้า Gemini TTS
        </p>
      </div>

      {msg && (
        <div style={{ fontSize: '13px', color: '#51cf66', background: 'rgba(81,207,102,0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(81,207,102,0.15)' }}>
          ✅ {msg}
        </div>
      )}

      {error && (
        <div style={{ fontSize: '13px', color: '#ff6b6b', background: 'rgba(255,107,107,0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,107,107,0.15)' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Quota Gemini TTS */}
      {stats && stats.ttsQuota && (
        <div style={{
          background: 'rgba(25, 113, 194, 0.08)',
          border: '1px solid rgba(25, 113, 194, 0.2)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#a5d8ff' }}>💎 Gemini TTS Quota Usage (Pacific Time RPD)</span>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Gemini 3.1 TTS Preview</span>
              <span style={{ fontSize: '18px', fontWeight: 700 }}>
                {stats.ttsQuota.gemini31} / {stats.ttsQuota.limitPerModel} <span style={{ fontSize: '11px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>reqs</span>
              </span>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                <div style={{
                  width: `${(stats.ttsQuota.gemini31 / stats.ttsQuota.limitPerModel) * 100}%`,
                  height: '100%',
                  background: stats.ttsQuota.gemini31 >= stats.ttsQuota.limitPerModel ? '#ff6b6b' : 'var(--accent)'
                }} />
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Gemini 2.5 TTS Preview</span>
              <span style={{ fontSize: '18px', fontWeight: 700 }}>
                {stats.ttsQuota.gemini25} / {stats.ttsQuota.limitPerModel} <span style={{ fontSize: '11px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>reqs</span>
              </span>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
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

      {/* Memory Database Stats */}
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
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>สถิติตารางหน่วยความจำ (Memory Database Metrics)</span>
          <button 
            onClick={fetchStats}
            disabled={loadingStats}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer' }}
          >
            {loadingStats ? '🔄 กำลังดึงข้อมูล...' : '🔄 รีเฟรชสถิติ'}
          </button>
        </div>

        {stats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>{stats.factsActive}</span>
              <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>ข้อเท็จจริงใช้งานอยู่ (Facts)</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#e9ecef' }}>{stats.sessionsTotal}</span>
              <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>จำนวนเซสชัน (Sessions)</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#e9ecef' }}>{stats.messagesTotal}</span>
              <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>จำนวนข้อความ (Messages)</span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '12px' }}>
            กำลังโหลดสถิติความจำ...
          </div>
        )}

        {stats && stats.sessionsUnconsolidated > 0 && (
          <div style={{
            background: 'rgba(253, 126, 20, 0.06)',
            border: '1px solid rgba(253, 126, 20, 0.15)',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '11.5px',
            color: '#ffd8a8'
          }}>
            ℹ️ มีประวัติบทสนทนาที่ยังไม่ได้สรุปบีบอัดเป็นข้อเท็จจริงจำนวน <strong>{stats.sessionsUnconsolidated} เซสชัน</strong> (ต้องการสะสมอย่างน้อย 4 เทิร์นการส่งบทสนทนาเพื่อประมวลผล)
          </div>
        )}
      </div>

      {/* Auto Consolidation Toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <ConfigToggle
          label="เปิดรันบีบอัดอัตโนมัติรายวัน (Auto Cron Jobs)"
          checked={autoConsolidation}
          onChange={handleToggleAutoConsolidation}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
            บีบอัดประวัติบทสนทนาทุกตี 3 / เสื่อมความสำคัญความจำทุกตี 4 ของเช้าวันอาทิตย์
          </span>
          <button 
            onClick={handleReset}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '10px', cursor: 'pointer', padding: 0 }}
          >
            รีเซ็ตค่าเริ่มต้น
          </button>
        </div>
      </div>

      {/* Manual Action Box */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>สั่งการรันงานระบบความจำแบบทันที (Manual Worker Triggers)</span>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            onClick={() => handleManualTrigger('consolidate')}
            disabled={triggering !== null}
            style={{
              padding: '12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              color: 'var(--text-h)',
              cursor: triggering !== null ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>{triggering === 'consolidate' ? '⏳' : '📥'}</span>
            <span>บีบอัดสรุปความจำ (Consolidate)</span>
          </button>

          <button
            onClick={() => handleManualTrigger('decay')}
            disabled={triggering !== null}
            style={{
              padding: '12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              color: 'var(--text-h)',
              cursor: triggering !== null ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>{triggering === 'decay' ? '⏳' : '🍂'}</span>
            <span>ประเมินความสำคัญลดหล่น (Decay & Archive)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemoryTab;
