import React, { useState, useEffect } from 'react';
import { getConfig } from '../services/api';
import LLMConfigTab from './tabs/LLMConfigTab';
import TTSConfigTab from './tabs/TTSConfigTab';
import VoiceConversionTab from './tabs/VoiceConversionTab';
import MemoryTab from './tabs/MemoryTab';
import SystemStatusTab from './tabs/SystemStatusTab';

export const ControlPanel = ({ apiKey, onLogout, onClose }) => {
  const [config, setConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('llm');
  const [loading, setLoading] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const data = await getConfig();
      setConfig(data);
    } catch (err) {
      console.error('[ControlPanel] Failed to retrieve system config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const renderActiveTab = () => {
    if (!config) return <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '40px' }}>กำลังโหลดระบบข้อมูลตั้งค่า...</div>;

    switch (activeTab) {
      case 'llm':
        return <LLMConfigTab config={config} onConfigChange={fetchConfig} apiKey={apiKey} />;
      case 'tts':
        return <TTSConfigTab config={config} onConfigChange={fetchConfig} apiKey={apiKey} />;
      case 'voice-conversion':
        return <VoiceConversionTab config={config} onConfigChange={fetchConfig} apiKey={apiKey} />;
      case 'memory':
        return <MemoryTab config={config} onConfigChange={fetchConfig} apiKey={apiKey} />;
      case 'status':
        return <SystemStatusTab config={config} />;
      default:
        return null;
    }
  };

  const tabs = [
    { id: 'llm', label: '🤖 Brain (LLM)', icon: '🧠' },
    { id: 'tts', label: '🔊 TTS Speech', icon: '📢' },
    { id: 'voice-conversion', label: '🎙️ RVC Voice', icon: '🎙️' },
    { id: 'memory', label: '🧠 Memory', icon: '💾' },
    { id: 'status', label: '📡 Status & Logs', icon: '📊' }
  ];

  return (
    <div style={{
      width: '100%',
      flex: '1 0 auto',
      color: 'var(--text-h)',
      fontFamily: 'Inter, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      padding: '4px'
    }}>
      {/* Header Panel */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-h)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🛠️ Synthenia Control Panel
          </h2>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            แดชบอร์ดตั้งค่าการทำงานและวิเคราะห์ข้อมูลความทรงจำของ AI VTuber (Syn)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onLogout}
            style={{
              padding: '8px 12px',
              background: 'rgba(255, 107, 107, 0.1)',
              border: '1px solid rgba(255, 107, 107, 0.2)',
              borderRadius: '8px',
              color: '#ff8787',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
          >
            🔒 ออกจากระบบ
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: 'var(--text-h)',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
          >
            💬 กลับหน้าแชท
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid rgba(255, 255, 255, 0.05)',
        gap: '4px',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 18px',
              background: activeTab === tab.id ? 'rgba(255,255,255,0.04)' : 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid var(--accent)' : '3px solid transparent',
              color: activeTab === tab.id ? 'var(--text-h)' : 'rgba(255,255,255,0.5)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Contents wrapper */}
      <div style={{
        background: 'rgba(30, 30, 45, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '20px',
        padding: '24px',
        minHeight: '400px',
        backdropFilter: 'blur(8px)'
      }}>
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default ControlPanel;
