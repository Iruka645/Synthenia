import React, { useState, useRef, useEffect } from 'react';
import AudioRecorder from '../utils/audioRecorder';
import { useUI } from '../contexts/UIContext';

const formatDuration = (sec) => {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const ChatInput = ({ onSend, onTranscribe, loading, placeholder }) => {
  const { showToast } = useUI();
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [autoSend, setAutoSend] = useState(false); // Default to false so they can review transcribed text
  const inputRef = useRef(null);
  const recorderRef = useRef(null);

  useEffect(() => {
    let interval = null;
    if (recording) {
      setRecordSeconds(0);
      interval = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recording]);

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
        showToast('ไม่สามารถเข้าถึงไมโครโฟนได้: ' + err.message, 'error');
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
        showToast('เกิดข้อผิดพลาดในการบันทึกเสียง', 'error');
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

        {recording ? (
          <div className="recording-status-container select-none">
            <span className="recording-text">ซินกำลังตั้งใจฟังคุณพูด...</span>
            <div className="waveform-container">
              <div className="waveform-bar bar1"></div>
              <div className="waveform-bar bar2"></div>
              <div className="waveform-bar bar3"></div>
              <div className="waveform-bar bar4"></div>
              <div className="waveform-bar bar5"></div>
            </div>
            <span className="recording-timer">{formatDuration(recordSeconds)}</span>
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            className="chat-input-field"
            placeholder={
              placeholder
                ? placeholder
                : loading
                ? 'ซิน กำลังคิดอยู่...'
                : 'พิมพ์ข้อความ หรือใช้ไมค์เพื่อพิมพ์ด้วยเสียง...'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoFocus
          />
        )}
        
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
