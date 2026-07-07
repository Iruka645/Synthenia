import React, { useState, useRef } from 'react';
import AudioRecorder from '../utils/audioRecorder';

export const ChatInput = ({ onSend, onTranscribe, loading }) => {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [autoSend, setAutoSend] = useState(false); // Default to false so they can review transcribed text
  const inputRef = useRef(null);
  const recorderRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || loading || recording) return;
    onSend(text);
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleMicClick = async () => {
    if (loading) return;

    if (!recording) {
      try {
        if (!recorderRef.current) {
          recorderRef.current = new AudioRecorder();
        }
        await recorderRef.current.start();
        setRecording(true);
      } catch (err) {
        console.error('Failed to start recording:', err);
        alert('ไม่สามารถเข้าถึงไมโครโฟนได้: ' + err.message);
      }
    } else {
      try {
        setRecording(false);
        const wavBlob = await recorderRef.current.stop();
        if (onTranscribe) {
          const transcribedText = await onTranscribe(wavBlob);
          if (transcribedText && transcribedText.trim()) {
            if (autoSend) {
              onSend(transcribedText);
            } else {
              setText(transcribedText);
              // Focus the input to let the user edit the text
              setTimeout(() => {
                inputRef.current?.focus();
              }, 50);
            }
          }
        }
      } catch (err) {
        console.error('Failed to stop recording:', err);
        alert('เกิดข้อผิดพลาดในการบันทึกเสียง');
      }
    }
  };

  return (
    <div className="chat-input-container">
      <div className="chat-input-controls">
        <label className="auto-send-toggle-label">
          <input
            type="checkbox"
            checked={autoSend}
            onChange={(e) => setAutoSend(e.target.checked)}
            className="auto-send-checkbox"
            disabled={loading}
          />
          <span className="auto-send-text">ส่งคำตอบทันทีหลังพูดเสร็จ (Auto Send)</span>
        </label>
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <button
          type="button"
          className={`chat-mic-button ${recording ? 'recording' : ''}`}
          onClick={handleMicClick}
          disabled={loading}
          title={recording ? 'กดอีกครั้งเพื่อบันทึกเสร็จสิ้น' : 'กดเพื่อพูด'}
        >
          {recording ? (
            <span className="mic-icon recording-pulse">🎙️</span>
          ) : (
            <span className="mic-icon">🎙️</span>
          )}
        </button>

        <input
          ref={inputRef}
          type="text"
          className="chat-input-field"
          placeholder={
            loading
              ? 'ซิน กำลังคิดอยู่...'
              : recording
              ? 'ซิน กำลังฟังอยู่... (กดปุ่มไมค์อีกครั้งเพื่อหยุดพูด)'
              : 'พิมพ์ข้อความ หรือใช้ไมค์เพื่อพิมพ์ด้วยเสียง...'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || recording}
          autoFocus
        />
        
        <button
          type="submit"
          className="chat-send-button"
          disabled={!text.trim() || loading || recording}
        >
          {loading ? (
            <span className="spinner"></span>
          ) : (
            <span className="send-icon">➔</span>
          )}
        </button>
      </form>
    </div>
  );
};

export default ChatInput;
