import React, { useState, useEffect } from 'react';
import { getOllamaHealth, getSiliconFlowHealth, getFallbackEvents, getAuditLog } from '../../services/api';

export const SystemStatusTab = ({ config }) => {
  const [ollamaHealth, setOllamaHealth] = useState(null);
  const [siliconFlowHealth, setSiliconFlowHealth] = useState(null);
  const [fallbackEvents, setFallbackEvents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const ollama = await getOllamaHealth();
      setOllamaHealth(ollama);
    } catch (err) {
      console.error('[SystemStatusTab] Ollama health failed:', err);
      setOllamaHealth({ status: 'error', message: 'ไม่สามารถติดต่อบริการ Ollama' });
    }

    try {
      const sf = await getSiliconFlowHealth();
      setSiliconFlowHealth(sf);
    } catch (err) {
      console.error('[SystemStatusTab] SiliconFlow health failed:', err);
      setSiliconFlowHealth({ status: 'error', message: 'ไม่สามารถติดต่อบริการ SiliconFlow' });
    }
    setLoadingHealth(false);
  };

  const fetchLogsAndEvents = async () => {
    setLoadingLogs(true);
    try {
      const logs = await getAuditLog(20);
      setAuditLogs(logs);
      
      const events = await getFallbackEvents();
      setFallbackEvents(events);
    } catch (err) {
      console.error('[SystemStatusTab] Failed to fetch logs/events:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchLogsAndEvents();
  }, []);

  // Request counter & cost estimation
  const reqCount = config?.siliconFlowRequestCount || 0;
  const minCost = reqCount * 0.000052;
  const maxCost = reqCount * 0.000100;
  const avgCost = reqCount * 0.000076;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>📡 สถานะระบบเบื้องหลัง (System Status Dashboard)</h3>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            ตรวจการตอบสนองของเซิร์ฟเวอร์ คำนวณค่าใช้จ่าย และดูประวัติการบันทึกการทำงานของระบบ
          </p>
        </div>
        <button
          onClick={() => { fetchHealth(); fetchLogsAndEvents(); }}
          disabled={loadingHealth || loadingLogs}
          style={{
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: 'var(--text-h)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {loadingHealth || loadingLogs ? '⏳ รีเฟรชสด...' : '🔄 รีเฟรชสถานะ'}
        </button>
      </div>

      {/* Connection health indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Ollama Health Indicator */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>🏠 บริการ Ollama (Local LLM)</span>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: ollamaHealth?.status === 'ok' ? '#51cf66' : ollamaHealth?.status === 'error' ? '#ff6b6b' : '#ced4da',
              boxShadow: ollamaHealth?.status === 'ok' ? '0 0 8px #51cf66' : 'none'
            }} />
          </div>

          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5' }}>
            {ollamaHealth?.status === 'ok' ? (
              <div>
                🟢 ทำงานปกติ (ONLINE)<br />
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                  โมเดลที่ติดตั้ง: {ollamaHealth.models?.map(m => m.name.split(':')[0]).join(', ') || 'ไม่มี'}
                </span>
              </div>
            ) : ollamaHealth?.status === 'error' ? (
              <span style={{ color: '#ff6b6b' }}>🔴 ข้อผิดพลาด: {ollamaHealth.message}</span>
            ) : (
              'กำลังตรวจสอบการเชื่อมต่อ...'
            )}
          </div>
        </div>

        {/* SiliconFlow Health Indicator */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>☁️ บริการ SiliconFlow (Cloud API)</span>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: siliconFlowHealth?.status === 'ok' ? '#51cf66' : siliconFlowHealth?.status === 'error' ? '#ff6b6b' : '#ced4da',
              boxShadow: siliconFlowHealth?.status === 'ok' ? '0 0 8px #51cf66' : 'none'
            }} />
          </div>

          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5' }}>
            {siliconFlowHealth?.status === 'ok' ? (
              <div>
                🟢 เชื่อมต่อสำเร็จ (ONLINE)<br />
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                  {siliconFlowHealth.message}
                </span>
              </div>
            ) : siliconFlowHealth?.status === 'error' ? (
              <span style={{ color: '#ff6b6b' }}>🔴 ข้อผิดพลาด: {siliconFlowHealth.message}</span>
            ) : (
              'กำลังตรวจสอบการเชื่อมต่อ...'
            )}
          </div>
        </div>
      </div>

      {/* Cost Estimator */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>💵 ปริมาณการเรียกและประมาณการค่าใช้จ่าย SiliconFlow (เซสชันปัจจุบัน)</span>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: '16px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent)' }}>{reqCount}</span>
            <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>จำนวนครั้งที่ยิงขอ</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>เฉลี่ยโดยประมาณ:</span>
              <span style={{ fontWeight: 700, color: '#e9ecef' }}>${avgCost.toFixed(6)} USD <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>(~{(avgCost * 35).toFixed(4)} บาท)</span></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>ช่วงราคาต่ำ-สูง:</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                ${minCost.toFixed(6)} - ${maxCost.toFixed(6)} USD
              </span>
            </div>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
              * ข้อมูลอิงตามการประมาณการ in-memory และจะเริ่มนับใหม่เมื่อล้างประวัติแชทหรือรีสตาร์ทระบบหลังบ้าน
            </span>
          </div>
        </div>
      </div>

      {/* Fallback Events */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>⚠️ ประวัติการดรอปถอยหลบภัย (LLM Fallback Log - SiliconFlow ➔ Ollama)</span>
        <div style={{
          maxHeight: '130px',
          overflowY: 'auto',
          background: 'rgba(0,0,0,0.15)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '10px'
        }}>
          {fallbackEvents.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '12px' }}>
              ไม่มีประวัติความล้มเหลวในการเชื่อมต่อ Cloud (ระบบทำงานเสถียรดี)
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {fallbackEvents.map((evt, idx) => (
                <div key={idx} style={{
                  fontSize: '11px',
                  background: 'rgba(255, 107, 107, 0.05)',
                  border: '1px solid rgba(255, 107, 107, 0.1)',
                  borderRadius: '6px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ff8787' }}>
                    <span>{evt.fromProvider.toUpperCase()} ➔ {evt.toProvider.toUpperCase()}</span>
                    <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.7)' }}>โมเดลที่พัง: {evt.model}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    Error: {evt.error}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Configuration change audit logs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>📝 บันทึกประวัติการสลับสับค่าระบบ (System Configuration Change Logs)</span>
        <div style={{
          maxHeight: '200px',
          overflowY: 'auto',
          background: 'rgba(0,0,0,0.15)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '10px'
        }}>
          {auditLogs.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '12px' }}>
              ไม่มีประวัติบันทึกการสับเปลี่ยนตั้งค่าระบบ
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                  <th style={{ padding: '6px' }}>เวลา</th>
                  <th style={{ padding: '6px' }}>คีย์ตั้งค่า</th>
                  <th style={{ padding: '6px' }}>ค่าเก่า ➔ ใหม่</th>
                  <th style={{ padding: '6px' }}>สั่งการโดย</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)' }}>
                    <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>{new Date(log.changed_at).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    <td style={{ padding: '6px', color: 'var(--accent)', fontWeight: 600 }}>{log.config_key}</td>
                    <td style={{ padding: '6px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.old_value !== null ? JSON.stringify(log.old_value) : 'null'} ➔ {log.new_value !== null ? JSON.stringify(log.new_value) : 'null'}
                    </td>
                    <td style={{ padding: '6px', color: '#ffd8a8' }}>{log.changed_by}</td>
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
