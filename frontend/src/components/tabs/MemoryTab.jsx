import React, { useState, useEffect } from 'react';
import { getMemoryStats, triggerConsolidate, triggerDecay, updateMemoryConfig, resetConfigKey } from '../../services/api';
import ConfigToggle from '../ui/ConfigToggle';
import { useUI } from '../../contexts/UIContext';

export const MemoryTab = ({ config, onConfigChange }) => {
  const { showConfirm } = useUI();
  const [stats, setStats] = useState(null);
  const [autoConsolidation, setAutoConsolidation] = useState(config['memory.autoConsolidation'] !== false);

  const [loadingStats, setLoadingStats] = useState(false);
  const [triggering, setTriggering] = useState(null); // 'consolidate' | 'decay'
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

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
    if (config && !isDirty) {
      setAutoConsolidation(config['memory.autoConsolidation'] !== false);
    }
  }, [config, isDirty]);

  const handleToggleAutoConsolidation = async (val) => {
    setAutoConsolidation(val);
    setError(null);
    setMsg(null);
    try {
      await updateMemoryConfig({ autoConsolidation: val });
      setMsg(`บันทึกสถานะการรันอัตโนมัติเป็น: ${val ? 'เปิด' : 'ปิด'}`);
      setIsDirty(false); // Clear dirty flag on success
      onConfigChange();
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกค่า');
    }
  };

  const handleManualTrigger = async (type) => {
    const confirmTrigger = await showConfirm(
      'รันการทำงานความจำ',
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
        res = await triggerConsolidate();
      } else {
        res = await triggerDecay();
      }
      setMsg(res.message || 'รันสำเร็จ');
      setTimeout(() => setMsg(null), 5000);
      
      // Reload stats after short delay
      setTimeout(fetchStats, 2000);
    } catch (err) {
      console.error(`[MemoryTab] Trigger ${type} failed:`, err);
      setError(err.message || 'เกิดข้อผิดพลาดขณะสั่งการประมวลผลความทรงจำ');
    } finally {
      setTriggering(null);
    }
  };

  const handleReset = async () => {
    const confirmReset = await showConfirm(
      'รีเซ็ตการตั้งค่า',
      'ต้องการรีเซ็ตการตั้งค่าการจัดเก็บอัตโนมัติกลับเป็นเปิดใช้งานหรือไม่?'
    );
    if (!confirmReset) return;

    setError(null);
    try {
      await resetConfigKey('memory.autoConsolidation');
      setMsg('รีเซ็ตการจัดเก็บอัตโนมัติสำเร็จ');
      setIsDirty(false); // Clear dirty flag on success
      onConfigChange();
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาดในการรีเซ็ตค่า');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>🧠 การจัดการระบบความทรงจำ (Memory Dashboard)</h3>
        <p style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.8, marginTop: '4px' }}>
          ติดตามสถิติความจำถาวร และควบคุมตารางรันเปลี่ยนรูปสรุปเหตุการณ์ความสัมพันธ์เพื่อประกอบความจำของ AI
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

      {/* Memory Database Stats */}
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
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)', opacity: 0.95 }}>สถิติตารางหน่วยความจำ (Memory Database Metrics)</span>
          <button 
            onClick={fetchStats}
            disabled={loadingStats}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
          >
            {loadingStats ? '🔄 กำลังดึงข้อมูล...' : '🔄 รีเฟรชสถิติ'}
          </button>
        </div>

        {stats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>{stats.factsActive}</span>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text)', opacity: 0.8, marginTop: '4px' }}>ข้อเท็จจริงใช้งานอยู่ (Facts)</span>
            </div>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-h)' }}>{stats.sessionsTotal}</span>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text)', opacity: 0.8, marginTop: '4px' }}>จำนวนเซสชัน (Sessions)</span>
            </div>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-h)' }}>{stats.messagesTotal}</span>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text)', opacity: 0.8, marginTop: '4px' }}>จำนวนข้อความ (Messages)</span>
            </div>
          </div>
        ) : (
          <div className="animate-pulse grid grid-cols-3 gap-3">
            <div className="h-16 bg-zinc-200 dark:bg-zinc-800 rounded-xl opacity-40" />
            <div className="h-16 bg-zinc-200 dark:bg-zinc-800 rounded-xl opacity-40" />
            <div className="h-16 bg-zinc-200 dark:bg-zinc-800 rounded-xl opacity-40" />
          </div>
        )}

        {stats && stats.sessionsUnconsolidated > 0 && (
          <div style={{
            background: 'rgba(253, 126, 20, 0.1)',
            border: '1px solid rgba(253, 126, 20, 0.3)',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '11.5px',
            color: '#fd7e14',
            fontWeight: 500
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
          onChange={(val) => {
            setIsDirty(true);
            handleToggleAutoConsolidation(val);
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text)', opacity: 0.7 }}>
            บีบอัดประวัติบทสนทนาทุกตี 3 / เสื่อมความสำคัญความจำทุกตี 4 ของเช้าวันอาทิตย์
          </span>
          <button 
            onClick={handleReset}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '10px', cursor: 'pointer', padding: 0, fontWeight: 600 }}
          >
            รีเซ็ตค่าเริ่มต้น
          </button>
        </div>
      </div>

      {/* Manual Action Box */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)', opacity: 0.95 }}>สั่งการรันงานระบบความจำแบบทันที (Manual Worker Triggers)</span>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            onClick={() => handleManualTrigger('consolidate')}
            disabled={triggering !== null}
            style={{
              padding: '12px',
              background: 'var(--code-bg)',
              border: '1px solid var(--border)',
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
              background: 'var(--code-bg)',
              border: '1px solid var(--border)',
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
