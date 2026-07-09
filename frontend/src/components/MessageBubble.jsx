import React from 'react';
import { useUI } from '../contexts/UIContext';

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
  const { showToast } = useUI();
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';

  const handleDoubleClick = () => {
    if (!message.text) return;
    navigator.clipboard.writeText(message.text)
      .then(() => {
        showToast('คัดลอกข้อความลงคลิปบอร์ดแล้ว!', 'success');
      })
      .catch((err) => {
        console.error('Failed to copy message:', err);
      });
  };

  if (isSystem) {
    return (
      <div 
        className="chat-bubble-container system-align"
        onDoubleClick={handleDoubleClick}
        title="ดับเบิ้ลคลิกเพื่อคัดลอก"
        style={{
          alignSelf: 'center',
          maxWidth: '90%',
          margin: '8px auto',
          textAlign: 'center',
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          cursor: 'pointer'
        }}
      >
        <div 
          style={{
            background: 'var(--code-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-h)',
            opacity: 0.85,
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '0.85rem',
            lineHeight: '1.4',
            userSelect: 'none'
          }}
        >
          {message.text}
        </div>
      </div>
    );
  }

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
        <div 
          className={`bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}
          onDoubleClick={handleDoubleClick}
          title="ดับเบิ้ลคลิกเพื่อคัดลอกข้อความ"
          style={{ cursor: 'pointer' }}
        >
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
