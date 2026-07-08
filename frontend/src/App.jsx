import React, { useState } from 'react';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import AvatarCanvas from './components/AvatarCanvas';
import GameBoard from './components/GameBoard';
import { TTSProviderSelector } from './components/TTSProviderSelector';
import useChat from './hooks/useChat';
import ControlPanel from './components/ControlPanel';
import ApiKeyGate from './components/ApiKeyGate';

function App() {
  const { 
    messages, loading, error, send, transcribe, clear, systemReady,
    currentEmotion, volume,
    gameMode, board, gameWinner, gameLoading, startGame, stopGame, playMove
  } = useChat();

  const [view, setView] = useState('chat'); // 'chat' | 'control-panel'
  const [apiKey, setApiKey] = useState(sessionStorage.getItem('synthenia_api_key') || '');

  return (
    <div className="main-layout-container">
      {/* Left Panel: Live2D Avatar and Game Board */}
      <div className="left-panel">
        {/* Avatar View */}
        <div className="avatar-wrapper">
          <AvatarCanvas emotion={currentEmotion} volume={volume} />
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
        <TTSProviderSelector />
      </div>

      {/* Right Panel: Chat Interface or Control Panel */}
      {view === 'chat' ? (
        <div className="right-panel">
          <header className="chat-header">
            <div className="header-info">
              <div className="status-dot online"></div>
              <div>
                <h2>ซิน (Syn) {gameMode ? '[โหมดเกม OX]' : ''}</h2>
                <p className="status-text">{gameMode ? 'กำลังดวล OX กับคุณ!' : 'พร้อมคุยกับคุณ'}</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                onClick={() => setView('control-panel')}
                className="dashboard-toggle-button"
                style={{
                  padding: '8px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
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
                onClick={clear} 
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
            <ControlPanel 
              apiKey={apiKey} 
              onLogout={() => {
                sessionStorage.removeItem('synthenia_api_key');
                setApiKey('');
              }}
              onClose={() => setView('chat')}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
