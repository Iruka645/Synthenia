import React from 'react';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import AvatarCanvas from './components/AvatarCanvas';
import GameBoard from './components/GameBoard';
import { TTSProviderSelector } from './components/TTSProviderSelector';
import useChat from './hooks/useChat';

function App() {
  const { 
    messages, loading, error, send, transcribe, clear,
    currentEmotion, volume,
    gameMode, board, gameWinner, gameLoading, startGame, stopGame, playMove
  } = useChat();

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

      {/* Right Panel: Chat Interface */}
      <div className="right-panel">
        <header className="chat-header">
          <div className="header-info">
            <div className="status-dot online"></div>
            <div>
              <h2>ซิน (Syn) {gameMode ? '[โหมดเกม OX]' : ''}</h2>
              <p className="status-text">{gameMode ? 'กำลังดวล OX กับคุณ!' : 'พร้อมคุยกับคุณ'}</p>
            </div>
          </div>
          
          <button 
            onClick={clear} 
            className="reset-button" 
            disabled={loading || messages.length === 0}
            title="ล้างประวัติการสนทนา"
          >
            ล้างประวัติ
          </button>
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
            loading={loading} 
          />
        </footer>
      </div>
    </div>
  );
}

export default App;
