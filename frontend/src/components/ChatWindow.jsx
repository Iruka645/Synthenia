import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

export const ChatWindow = ({ messages, loading, error }) => {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="chat-window">
      {messages.length === 0 ? (
        <div className="chat-empty-state">
          <div className="empty-icon">💬</div>
          <h3>เริ่มคุยกับ ซิน (Syn)</h3>
          <p>พิมพ์อะไรบางอย่างเพื่อเริ่มต้นการสนทนาได้เลยครับ</p>
        </div>
      ) : (
        <div className="messages-list">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          
          {loading && (
            <div className="typing-indicator-container">
              <div className="avatar assistant-avatar">
                <span>S</span>
              </div>
              <div className="typing-wrapper">
                <div className="sender-name">ซิน (Syn)</div>
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              <span className="error-text">{error}</span>
            </div>
          )}
          
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
