import { useState, useCallback, useRef, useEffect } from 'react';
import { sendMessage, resetChat, transcribeAudio, sendGameMove, socket, getChatStatus } from '../services/api';
import AudioAnalyser from '../utils/audioAnalyser';

export const useChat = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Live2D State
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [volume, setVolume] = useState(0);

  // Game Mode State
  const [gameMode, setGameMode] = useState(false);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [gameWinner, setGameWinner] = useState(null);
  const [gameLoading, setGameLoading] = useState(false);

  // System readiness state (Ollama preloading status)
  const [systemReady, setSystemReady] = useState(false);

  const audioAnalyserRef = useRef(new AudioAnalyser());

  // Poll backend status until Ollama models are preloaded
  useEffect(() => {
    let active = true;
    let pollInterval = null;

    const checkStatus = async () => {
      try {
        const data = await getChatStatus();
        if (data.ready && active) {
          setSystemReady(true);
          if (pollInterval) clearInterval(pollInterval);
        }
      } catch (err) {
        console.warn('[System Status Check] Failed to query status:', err.message);
      }
    };

    // Initial check
    checkStatus();

    // Poll every 3 seconds
    pollInterval = setInterval(checkStatus, 3000);

    return () => {
      active = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Map to hold pending TTS job callbacks
  const pendingTTSRef = useRef(new Map());

  // Clean up audio analyser on unmount
  useEffect(() => {
    return () => {
      audioAnalyserRef.current.stop();
    };
  }, []);

  // Listen to WebSocket 'tts:done' and 'tts:error' events
  useEffect(() => {
    const handleTTSDone = ({ ttsJobId, audioUrl }) => {
      const callback = pendingTTSRef.current.get(ttsJobId);
      if (callback) {
        callback(audioUrl);
        pendingTTSRef.current.delete(ttsJobId);
      }
    };

    const handleTTSError = ({ ttsJobId, error }) => {
      console.warn('[TTS WebSocket] Job failed:', error);
      pendingTTSRef.current.delete(ttsJobId);
    };

    socket.on('tts:done', handleTTSDone);
    socket.on('tts:error', handleTTSError);

    return () => {
      socket.off('tts:done', handleTTSDone);
      socket.off('tts:error', handleTTSError);
    };
  }, []);

  const playAudioWithAnalysis = useCallback((audioUrl) => {
    if (!audioUrl) return;

    try {
      audioAnalyserRef.current.stop();
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = audioUrl;

      audio.addEventListener('play', () => {
        audioAnalyserRef.current.analyse(audio, (vol) => {
          setVolume(vol);
        });
      });

      audio.addEventListener('ended', () => {
        audioAnalyserRef.current.stop();
        setVolume(0);
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio load error:', e);
        audioAnalyserRef.current.stop();
        setVolume(0);
      });

      audio.play().catch(audioErr => {
        console.warn('Audio playback failed (browser autoplay restrictions may apply):', audioErr);
      });
    } catch (err) {
      console.error('Failed to initialize audio playback with analysis:', err);
    }
  }, []);

  // Helper to wait for audio push via WebSocket and play it
  const waitForAudioAndPlay = useCallback((ttsJobId) => {
    const WS_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4040';
    pendingTTSRef.current.set(ttsJobId, (audioUrl) => {
      const fullUrl = `${WS_URL}${audioUrl}`;
      playAudioWithAnalysis(fullUrl);
    });

    // Cleanup timeout: remove after 120s if no event received
    setTimeout(() => {
      if (pendingTTSRef.current.has(ttsJobId)) {
        console.warn('[TTS WebSocket] Timed out waiting for audio');
        pendingTTSRef.current.delete(ttsJobId);
      }
    }, 120_000);
  }, [playAudioWithAnalysis]);

  const send = useCallback(async (text) => {
    if (!text || !text.trim()) return;

    const trimmedText = text.trim();
    
    // Add user message immediately
    const userMessage = {
      id: Date.now() + '-user',
      text: trimmedText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    // Reset default emotion to thinking while waiting
    setCurrentEmotion('thinking');

    try {
      const response = await sendMessage(trimmedText);
      
      const assistantMessage = {
        id: Date.now() + '-assistant',
        text: response.reply || 'ไม่มีคำตอบจาก AI',
        sender: 'assistant',
        emotion: response.emotion || 'neutral',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (response.emotion) {
        setCurrentEmotion(response.emotion);
      }

      // Wait for audio from WebSocket (does not block UI)
      if (response.ttsJobId) {
        waitForAudioAndPlay(response.ttsJobId);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
      setCurrentEmotion('annoyed');
    } finally {
      setLoading(false);
    }
  }, [waitForAudioAndPlay]);

  const transcribe = useCallback(async (wavBlob) => {
    setLoading(true);
    setError(null);
    try {
      const result = await transcribeAudio(wavBlob);
      return result.text || '';
    } catch (err) {
      console.error('Error transcribing audio:', err);
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการแปลงเสียงเป็นข้อความ');
      return '';
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await resetChat();
      setMessages([]);
      setBoard(Array(9).fill(null));
      setGameWinner(null);
      setGameMode(false);
      setCurrentEmotion('neutral');
      setVolume(0);
      audioAnalyserRef.current.stop();
    } catch (err) {
      console.error('Error resetting chat:', err);
      setError('ไม่สามารถรีเซ็ตประวัติการสนทนาได้');
    } finally {
      setLoading(false);
    }
  }, []);

  // Game Mode Methods
  const startGame = useCallback(() => {
    setGameMode(true);
    setBoard(Array(9).fill(null));
    setGameWinner(null);
    setGameLoading(false);
    setCurrentEmotion('happy');
    
    // Add game start indicator in chat
    const infoMsg = {
      id: Date.now() + '-game-info',
      text: '[ระบบ] เริ่มเกม OX กับซินแล้ว! คุณคือ X และเดินก่อน',
      sender: 'system',
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, infoMsg]);
  }, []);

  const stopGame = useCallback(() => {
    setGameMode(false);
    const infoMsg = {
      id: Date.now() + '-game-info-stop',
      text: '[ระบบ] ออกจากโหมดเกม OX กลับเข้าสู่โหมดคุยปกติ',
      sender: 'system',
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, infoMsg]);
    setCurrentEmotion('neutral');
  }, []);

  const playMove = useCallback(async (index) => {
    if (board[index] !== null || gameWinner || gameLoading) return;

    const nextBoard = [...board];
    nextBoard[index] = 'X';
    setBoard(nextBoard);
    setGameLoading(true);
    setError(null);
    setCurrentEmotion('thinking');

    // Add Ken's move to messages list
    const userMsg = {
      id: Date.now() + '-user-game',
      text: `ฉันเดินช่อง ${index}`,
      sender: 'user',
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await sendGameMove(nextBoard, index);
      
      setBoard(response.board);
      setGameWinner(response.winner);

      // Add Syn's comment to chat
      const synMsg = {
        id: Date.now() + '-assistant-game',
        text: response.reply || 'ตาฉันเดินแล้ว!',
        sender: 'assistant',
        emotion: response.emotion || 'neutral',
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, synMsg]);

      if (response.emotion) {
        setCurrentEmotion(response.emotion);
      }
      if (response.ttsJobId) {
        waitForAudioAndPlay(response.ttsJobId);
      }
    } catch (err) {
      console.error('Error playing game move:', err);
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการเล่นเกม');
      setCurrentEmotion('annoyed');
    } finally {
      setGameLoading(false);
    }
  }, [board, gameWinner, gameLoading, waitForAudioAndPlay]);

  return {
    messages,
    loading,
    error,
    send,
    transcribe,
    clear,
    systemReady,
    // Live2D parameters
    currentEmotion,
    volume,
    // OX Game parameters
    gameMode,
    board,
    gameWinner,
    gameLoading,
    startGame,
    stopGame,
    playMove,
  };
};

export default useChat;
