import React from 'react';

// Mapping emotion to emoji
const getEmotionEmoji = (emotion) => {
  switch (emotion) {
    case 'happy': return '😊';
    case 'laugh': return '😆';
    case 'embarrassed': return '😳';
    case 'annoyed': return '😒';
    case 'sad': return '😢';
    case 'thinking': return '🤔';
    case 'surprised': return '😲';
    case 'neutral':
    default:
      return '👧';
  }
};

// Format the time as HH:MM
const formatTime = (dateObj) => {
  if (!dateObj) return '';
  const date = new Date(dateObj);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const MessageBubble = React.memo(({ message }) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`chat-bubble-container ${isUser ? 'user-align' : 'assistant-align'}`}>
      {!isUser && (
        <div className="avatar assistant-avatar" title={`อารมณ์: ${message.emotion || 'neutral'}`}>
          <span>{getEmotionEmoji(message.emotion)}</span>
        </div>
      )}
      
      <div className="bubble-wrapper">
        <div className="sender-name">
          {isUser ? 'คุณ' : 'ซิน (Syn)'}
        </div>
        <div className={`bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
          <p className="bubble-text">{message.text}</p>
        </div>
        <div className="bubble-time">
          {formatTime(message.timestamp)}
        </div>
      </div>

      {isUser && (
        <div className="avatar user-avatar">
          <span>U</span>
        </div>
      )}
    </div>
  );
});

export default MessageBubble;
