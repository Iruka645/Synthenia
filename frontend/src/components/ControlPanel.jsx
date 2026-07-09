import React, { useState, useEffect, Suspense, lazy } from 'react';
import { getConfig } from '../services/api';

const LLMConfigTab = lazy(() => import('./tabs/LLMConfigTab'));
const TTSConfigTab = lazy(() => import('./tabs/TTSConfigTab'));
const VoiceConversionTab = lazy(() => import('./tabs/VoiceConversionTab'));
const MemoryTab = lazy(() => import('./tabs/MemoryTab'));
const SystemStatusTab = lazy(() => import('./tabs/SystemStatusTab'));

export const ControlPanel = ({ apiKey, onLogout, onClose, socketConnected, systemReady }) => {
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

  const handleTabKeyDown = (e, index) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else {
      return;
    }
    e.preventDefault();
    setActiveTab(tabs[nextIndex].id);
    
    // Focus the next tab button
    setTimeout(() => {
      document.getElementById(`tab-${tabs[nextIndex].id}`)?.focus();
    }, 0);
  };

const TabSkeleton = () => (
  <div className="animate-pulse flex flex-col gap-5 w-full">
    <div className="flex flex-col gap-2">
      <div className="h-6 w-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
      <div className="h-4 w-80 bg-zinc-200 dark:bg-zinc-800 rounded opacity-60" />
    </div>
    
    <div className="flex flex-col gap-4 mt-3">
      <div className="h-14 w-full bg-zinc-200 dark:bg-zinc-800 rounded-xl opacity-40" />
      <div className="h-20 w-full bg-zinc-200 dark:bg-zinc-800 rounded-xl opacity-40" />
      <div className="h-14 w-full bg-zinc-200 dark:bg-zinc-800 rounded-xl opacity-40" />
    </div>

    <div className="h-12 w-full bg-zinc-200 dark:bg-zinc-800 rounded-xl opacity-30 mt-4" />
  </div>
);

  const renderActiveTab = () => {
    if (!config) return <TabSkeleton />;

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
        return (
          <SystemStatusTab 
            config={config} 
            socketConnected={socketConnected} 
            systemReady={systemReady} 
          />
        );
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
    <div className="w-full flex-auto text-[var(--text-h)] font-sans flex flex-col gap-6 p-1">
      {/* Header Panel */}
      <div className="flex justify-between items-center pb-4 border-b border-[var(--border)]">
        <div>
          <h2 className="text-2xl font-extrabold text-[var(--text-h)] flex items-center gap-2">
            🛠️ Synthenia Control Panel
          </h2>
          <p className="text-xs text-[var(--text)] opacity-80 mt-1">
            แดชบอร์ดตั้งค่าการทำงานและวิเคราะห์ข้อมูลความทรงจำของ AI VTuber (Syn)
          </p>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={onLogout}
            className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs cursor-pointer font-semibold transition-all hover:bg-red-500/20 select-none"
          >
            🔒 ออกจากระบบ
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--code-bg)] border border-[var(--border)] rounded-lg text-[var(--text-h)] text-xs cursor-pointer font-semibold transition-all hover:bg-[var(--card)] select-none"
          >
            💬 กลับหน้าแชท
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div 
        role="tablist"
        aria-label="Configuration Options"
        className="flex border-b-2 border-[var(--border)] gap-1 overflow-x-auto pb-0.5 select-none"
      >
        {tabs.map((tab, idx) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => handleTabKeyDown(e, idx)}
            className={`px-4.5 py-3 border-b-3 transition-all duration-200 ease-in-out cursor-pointer text-sm flex items-center gap-1.5 whitespace-nowrap select-none ${
              activeTab === tab.id
                ? 'bg-[var(--card)] border-[var(--accent)] text-[var(--text-h)] font-bold'
                : 'bg-transparent border-transparent text-[var(--text)] opacity-70 font-medium hover:opacity-100'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Contents wrapper */}
      <div 
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="bg-[var(--card)] border border-[var(--border)] rounded-[20px] p-6 min-h-[400px]"
      >
        <Suspense fallback={<div className="text-[var(--text)] opacity-60 text-center py-10 animate-pulse">กำลังโหลดแท็บ...</div>}>
          {renderActiveTab()}
        </Suspense>
      </div>
    </div>
  );
};

export default ControlPanel;
