import React, { useState, useEffect } from 'react';
import { getOllamaHealth, getAuditLog, getMemoryStats } from '../../services/api';

export const SystemStatusTab = ({ config, socketConnected, systemReady }) => {
  const [ollamaHealth, setOllamaHealth] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [memoryStats, setMemoryStats] = useState(null);

  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingMemory, setLoadingMemory] = useState(false);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const ollama = await getOllamaHealth();
      setOllamaHealth(ollama);
    } catch (err) {
      console.error('[SystemStatusTab] Ollama health failed:', err);
      setOllamaHealth({ status: 'error', message: 'ไม่สามารถติดต่อบริการ Ollama' });
    }
    setLoadingHealth(false);
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const logs = await getAuditLog(20);
      setAuditLogs(logs);
    } catch (err) {
      console.error('[SystemStatusTab] Failed to fetch audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchMemory = async () => {
    setLoadingMemory(true);
    try {
      const data = await getMemoryStats();
      setMemoryStats(data);
    } catch (err) {
      console.error('[SystemStatusTab] Failed to fetch memory stats:', err);
    } finally {
      setLoadingMemory(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchLogs();
    fetchMemory();
  }, []);

  // Read config settings
  const ttsProvider = config?.['tts.provider'] || 'gTTS';
  const vcEnabled = config?.['voiceConversion.enabled'] || false;
  const vcPitch = config?.['voiceConversion.pitch'] || 0;
  const vcIndexRate = config?.['voiceConversion.indexRate'] || 0.4;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>📡 สถานะการทำงานของระบบ (System Status)</h3>
          <p style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.8, marginTop: '4px' }}>
            ตรวจการตอบสนองของเซิร์ฟเวอร์ และประวัติล็อกการปรับเปลี่ยนการตั้งค่า
          </p>
        </div>
        <button
          onClick={() => { fetchHealth(); fetchLogs(); fetchMemory(); }}
          disabled={loadingHealth || loadingLogs || loadingMemory}
          style={{
            padding: '8px 16px',
            background: 'var(--code-bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-h)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {loadingHealth || loadingLogs || loadingMemory ? '⏳ รีเฟรชสด...' : '🔄 รีเฟรชสถานะ'}
        </button>
      </div>

      {/* Grid Status Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        
        {/* Service Connections health */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)', opacity: 0.95 }}>🔌 การเชื่อมต่อเครือข่าย (Connection status)</span>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>สัญญาณ WebSocket (Socket.io)</span>
              <span style={{
                color: socketConnected ? '#51cf66' : '#ff6b6b',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: socketConnected ? '#51cf66' : '#ff6b6b', display: 'inline-block' }}></span>
                {socketConnected ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>สถานะโมเดล Ollama (Local LLM)</span>
              <span style={{
                color: systemReady ? '#51cf66' : '#ffd8a8',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: systemReady ? '#51cf66' : '#ffd8a8', display: 'inline-block' }}></span>
                {systemReady ? 'READY' : 'PRELOADING'}
              </span>
            </div>
          </div>
        </div>

        {/* Active Configurations */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)', opacity: 0.95 }}>🔊 บริการเสียงพูดสังเคราะห์ (TTS & RVC)</span>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>ตัวแปลงเสียง (TTS Voice Provider)</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{ttsProvider.toUpperCase()}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>RVC Conversion (เสียงคาแรคเตอร์)</span>
              <span style={{ color: vcEnabled ? '#51cf66' : 'var(--text)', fontWeight: 600 }}>
                {vcEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
              </span>
            </div>

            {vcEnabled && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text)', opacity: 0.8 }}>
                <span>Pitch key / Similarity index</span>
                <span>{vcPitch} semitones / {vcIndexRate}</span>
              </div>
            )}
          </div>
        </div>

        {/* Ollama Health */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)', opacity: 0.95 }}>🏠 รายละเอียดโมเดล Ollama</span>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: ollamaHealth?.status === 'ok' ? '#51cf66' : ollamaHealth?.status === 'error' ? '#ff6b6b' : '#ced4da',
              boxShadow: ollamaHealth?.status === 'ok' ? '0 0 8px #51cf66' : 'none'
            }} />
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.9, lineHeight: '1.5' }}>
            {ollamaHealth?.status === 'ok' ? (
              <div>
                🟢 บริการตอบสนองได้ปกติ (ONLINE)<br />
                <span style={{ fontSize: '10px', color: 'var(--text)', opacity: 0.7 }}>
                  โมเดล: {ollamaHealth.models?.map(m => m.name.split(':')[0]).join(', ') || 'ไม่มี'}
                </span>
              </div>
            ) : ollamaHealth?.status === 'error' ? (
              <span style={{ color: '#ff6b6b' }}>🔴 ข้อผิดพลาด: {ollamaHealth.message}</span>
            ) : (
              'กำลังตรวจสอบการเชื่อมต่อ...'
            )}
          </div>
        </div>

        {/* Memory Workers scheduler details */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)', opacity: 0.95 }}>🧠 การสรุปข้อมูลหน่วยความจำ (Memory Workers)</span>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>ข้อเท็จจริงความจำถาวร (Facts count)</span>
              <span style={{ fontWeight: 600 }}>{memoryStats ? memoryStats.factsActive : '-'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>ตารางจัดเก็บอัตโนมัติ (Daily Consolidation)</span>
              <span style={{ color: '#51cf66', fontWeight: 600 }}>เปิดใช้งาน (3:00 AM)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>ลดความสำคัญความจำ (Weekly Decay)</span>
              <span style={{ color: '#51cf66', fontWeight: 600 }}>เปิดใช้งาน (Sun 4:00 AM)</span>
            </div>
          </div>
        </div>

      </div>

      {/* Configuration change audit logs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)', opacity: 0.95 }}>📝 บันทึกประวัติการเปลี่ยนค่าระบบ (System Configuration Change Logs)</span>
        <div style={{
          maxHeight: '200px',
          overflowY: 'auto',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '10px'
        }}>
          {loadingLogs ? (
            <div className="animate-pulse flex flex-col gap-2 p-2">
              <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded opacity-40" />
              <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded opacity-30" />
              <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded opacity-20" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text)', opacity: 0.6, textAlign: 'center', padding: '12px' }}>
              ไม่มีประวัติบันทึกการเปลี่ยนตั้งค่าระบบ
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
                  <th style={{ padding: '6px' }}>เวลา</th>
                  <th style={{ padding: '6px' }}>คีย์ตั้งค่า</th>
                  <th style={{ padding: '6px' }}>ค่าเก่า ➔ ใหม่</th>
                  <th style={{ padding: '6px' }}>สั่งการโดย</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-h)', opacity: 0.95 }}>
                    <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>{new Date(log.changed_at).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    <td style={{ padding: '6px', color: 'var(--accent)', fontWeight: 600 }}>{log.config_key}</td>
                    <td style={{ padding: '6px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.old_value !== null ? JSON.stringify(log.old_value) : 'null'} ➔ {log.new_value !== null ? JSON.stringify(log.new_value) : 'null'}
                    </td>
                    <td style={{ padding: '6px', color: 'var(--accent)', fontWeight: 600 }}>{log.changed_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemStatusTab;
