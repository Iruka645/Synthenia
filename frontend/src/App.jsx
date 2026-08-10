import React, { useState } from 'react';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import GameBoard from './components/GameBoard';
import { TTSProviderSelector } from './components/TTSProviderSelector';
import useChat from './hooks/useChat';
import ApiKeyGate from './components/ApiKeyGate';
import ThemeToggle from './components/ThemeToggle';
import { useUI } from './contexts/UIContext';

const AvatarCanvas = React.lazy(() => import('./components/AvatarCanvas'));
const ControlPanel = React.lazy(() => import('./components/ControlPanel'));

function App() {
  const { showConfirm } = useUI();
  const { 
    messages, loading, error, send, transcribe, clear, systemReady, socketConnected,
    currentEmotion, volumeRef,
    gameMode, board, gameWinner, gameLoading, startGame, stopGame, playMove
  } = useChat();

  const [view, setView] = useState('chat'); // 'chat' | 'control-panel'
  const [apiKey, setApiKey] = useState(sessionStorage.getItem('synthenia_api_key') || '');

  React.useEffect(() => {
    const handleAuthError = () => {
      setApiKey('');
    };
    window.addEventListener('auth-unauthorized', handleAuthError);
    return () => {
      window.removeEventListener('auth-unauthorized', handleAuthError);
    };
  }, []);

  React.useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Escape to exit dashboard back to chat
      if (e.key === 'Escape') {
        setView((prev) => {
          if (prev === 'control-panel') {
            return 'chat';
          }
          return prev;
        });
      }

      // Cmd+K or Ctrl+K to toggle dashboard view
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setView((prev) => (prev === 'chat' ? 'control-panel' : 'chat'));
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const handleClearChat = async () => {
    const confirm = await showConfirm(
      'ล้างประวัติการสนทนา',
      'ต้องการล้างประวัติการสนทนาทั้งหมดในเซสชันนี้ใช่หรือไม่?'
    );
    if (confirm) {
      await clear();
    }
  };

  return (
    <div className="main-layout-container">
      {/* Left Panel: Live2D Avatar and Game Board */}
      <div className="left-panel">
        {/* Avatar View */}
        <div className="avatar-wrapper">
          <React.Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text)', fontSize: '13px' }}>กำลังโหลดอวตาร...</div>}>
            <AvatarCanvas emotion={currentEmotion} volumeRef={volumeRef} />
          </React.Suspense>
        </div>

        {/* Game Mode Area */}
        <div className="game-mode-container">
          {!gameMode ? (
            <button
              onClick={startGame}
              className="game-toggle-button"
              disabled={view === 'control-panel'}
            >
              <span>🎮</span> เล่นเกม OX กับซิน
            </button>
          ) : (
            <div className="game-active-container">
              <GameBoard 
                board={board} 
                onCellClick={playMove} 
                loading={gameLoading} 
                winner={gameWinner} 
                onReset={startGame} 
              />
              <button
                onClick={stopGame}
                className="back-chat-button"
              >
                💬 กลับโหมดแชทปกติ
              </button>
            </div>
          )}
        </div>

        {/* TTS Settings Dropdown & Preview Selector */}
        <TTSProviderSelector previewSource="app-tts-selector" />
      </div>

      {/* Right Panel: Chat Interface or Control Panel */}
      {view === 'chat' ? (
        <div className="right-panel">
          <header className="chat-header">
            <div className="header-info">
              <div className={`status-dot ${
                !socketConnected ? 'offline' : !systemReady ? 'connecting' : 'online'
              }`} style={{
                backgroundColor: !socketConnected ? '#ef4444' : !systemReady ? '#f59e0b' : '#10b981',
                boxShadow: !socketConnected ? '0 0 8px #ef4444' : !systemReady ? '0 0 8px #f59e0b' : '0 0 8px #10b981',
                width: '10px',
                height: '10px',
                borderRadius: '50%'
              }}></div>
              <div>
                <h2>ซิน (Syn) {gameMode ? '[โหมดเกม OX]' : ''}</h2>
                <p className="status-text">
                  {!socketConnected 
                    ? 'ขาดการเชื่อมต่อเซิร์ฟเวอร์' 
                    : !systemReady 
                      ? 'กำลังเตรียมความพร้อมของระบบ...' 
                      : gameMode 
                        ? 'กำลังดวล OX กับคุณ!' 
                        : 'พร้อมคุยกับคุณ'}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <ThemeToggle />
              <button 
                onClick={() => setView('control-panel')}
                className="dashboard-toggle-button"
                style={{
                  padding: '8px 16px',
                  background: 'var(--code-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-h)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🛠️ แดชบอร์ด
              </button>
              <button 
                onClick={handleClearChat} 
                className="reset-button" 
                disabled={loading || messages.length === 0}
                title="ล้างประวัติการสนทนา"
              >
                ล้างประวัติ
              </button>
            </div>
          </header>

          <main className="chat-main">
            <ChatWindow 
              messages={messages} 
              loading={loading} 
              error={error} 
            />
          </main>

          <footer className="chat-footer">
            <ChatInput 
              onSend={send} 
              onTranscribe={transcribe}
              loading={loading || !systemReady} 
              placeholder={!systemReady ? 'กำลังปลุก Syn...' : undefined}
            />
          </footer>
        </div>
      ) : (
        <div className="right-panel" style={{ padding: '24px', overflowY: 'auto' }}>
          {!apiKey ? (
            <ApiKeyGate onSuccess={setApiKey} />
          ) : (
            <React.Suspense fallback={<div style={{ color: 'var(--text)', padding: '20px', textAlign: 'center' }}>กำลังโหลดแดชบอร์ด...</div>}>
              <ControlPanel 
                apiKey={apiKey} 
                onLogout={() => {
                  sessionStorage.removeItem('synthenia_api_key');
                  setApiKey('');
                }}
                onClose={() => setView('chat')}
                socketConnected={socketConnected}
                systemReady={systemReady}
              />
            </React.Suspense>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
