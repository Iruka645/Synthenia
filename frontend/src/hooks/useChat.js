import { useState, useCallback, useRef, useEffect } from 'react';
import { sendMessage, resetChat, transcribeAudio, sendGameMove, socket, getChatStatus } from '../services/api';
import AudioAnalyser from '../utils/audioAnalyser';
import { useUI } from '../contexts/UIContext';

export const useChat = () => {
  const { showToast } = useUI();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Live2D State
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const volumeRef = useRef(0);

  // Socket Connection State
  const [socketConnected, setSocketConnected] = useState(socket.connected);

  // Game Mode State
  const [gameMode, setGameMode] = useState(false);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [gameWinner, setGameWinner] = useState(null);
  const [gameLoading, setGameLoading] = useState(false);

  // System readiness state (Ollama preloading status)
  const [systemReady, setSystemReady] = useState(false);

  const audioAnalyserRef = useRef(null);
  if (!audioAnalyserRef.current) {
    audioAnalyserRef.current = new AudioAnalyser();
  }

  // Ref to track requests and prevent race conditions/stale state updates
  const requestIdRef = useRef(0);
  // AbortController for the single in-flight request; aborting the previous
  // controller when a new request starts actually frees the HTTP connection
  // (requestIdRef only *ignores* stale responses, it can't cancel them).
  const abortControllerRef = useRef(null);

  // Abort any in-flight request. Used on supersede / clear / unmount.
  const cancelInFlight = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Poll backend status until Ollama models are preloaded, with max attempts and backoff
  useEffect(() => {
    let active = true;
    let attempt = 0;
    const maxAttempts = 15;
    let delay = 2000;
    let timerId = null;

    const checkStatus = async () => {
      if (!active) return;
      try {
        const data = await getChatStatus();
        if (data.ready && active) {
          setSystemReady(true);
          return;
        }
      } catch (err) {
        console.warn('[System Status Check] Failed to query status:', err.message);
      }

      attempt++;
      if (attempt < maxAttempts && active) {
        delay = Math.min(delay * 1.5, 10000); // Backoff, cap at 10s
        timerId = setTimeout(checkStatus, delay);
      } else if (attempt >= maxAttempts) {
        console.warn('[System Status Check] Reached maximum status poll attempts.');
        // Fallback to ready anyway so user can try messaging
        setSystemReady(true);
      }
    };

    checkStatus();

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  // Map to hold pending TTS job callbacks
  const pendingTTSRef = useRef(new Map());

  // Clean up audio analyser + cancel any in-flight request on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (audioAnalyserRef.current) {
        audioAnalyserRef.current.stop();
      }
    };
  }, []);

  // Listen to WebSocket 'tts:done' and 'tts:error' events
  useEffect(() => {
    setSocketConnected(socket.connected);
    if (!socket.connected) {
      socket.connect();
    }

    const handleConnect = () => {
      setSocketConnected(true);
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    const handleConnectError = (err) => {
      console.error('[WebSocket] Socket connection error:', err.message);
      setSocketConnected(false);
    };

    const handleTTSDone = ({ ttsJobId, audioUrl }) => {
      const callback = pendingTTSRef.current.get(ttsJobId);
      if (callback) {
        callback(audioUrl);
        pendingTTSRef.current.delete(ttsJobId);
      } else {
        console.warn('[WebSocket] Received tts:done but no callback was registered for job:', ttsJobId);
      }
    };

    const handleTTSError = ({ ttsJobId, error }) => {
      console.warn('[TTS WebSocket] Job failed:', error);
      pendingTTSRef.current.delete(ttsJobId);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('tts:done', handleTTSDone);
    socket.on('tts:error', handleTTSError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
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

      audioAnalyserRef.current.analyse(audio, (vol) => {
        volumeRef.current = vol;
      });

      audio.addEventListener('ended', () => {
        audioAnalyserRef.current.stop();
        volumeRef.current = 0;
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio load error:', e);
        audioAnalyserRef.current.stop();
        volumeRef.current = 0;
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
    
    // Set 8-second slow response reminder
    const slowWarningTimeout = setTimeout(() => {
      if (pendingTTSRef.current.has(ttsJobId)) {
        showToast('การสร้างประโยคเสียงพูดค่อนข้างช้ากรุณารอสักครู่นะคะ...', 'info');
      }
    }, 8000);

    pendingTTSRef.current.set(ttsJobId, (audioUrl) => {
      clearTimeout(slowWarningTimeout);
      const fullUrl = `${WS_URL}${audioUrl}`;
      playAudioWithAnalysis(fullUrl);
    });

    // Cleanup timeout: remove after 120s if no event received
    setTimeout(() => {
      if (pendingTTSRef.current.has(ttsJobId)) {
        clearTimeout(slowWarningTimeout);
        console.warn('[TTS WebSocket] Timed out waiting for audio');
        pendingTTSRef.current.delete(ttsJobId);
        showToast('การส่งผ่านข้อมูลสังเคราะห์เสียงล่าช้าเกินเวลา', 'error');
      }
    }, 120_000);
  }, [playAudioWithAnalysis, showToast]);

  const send = useCallback(async (text) => {
    if (!text || !text.trim()) return;

    if (audioAnalyserRef.current) {
      audioAnalyserRef.current.initContext();
    }

    const trimmedText = text.trim();
    // Abort any previous in-flight request and start a fresh one
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const reqId = ++requestIdRef.current; // capture request ID

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
      const response = await sendMessage(trimmedText, controller.signal);
      if (reqId !== requestIdRef.current) return; // Discard stale response

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
      // Aborts are expected (superseded by a newer send / clear / unmount)
      if (controller.signal.aborted || err.name === 'CanceledError') return;
      if (reqId !== requestIdRef.current) return;
      console.error('Error sending message:', err);
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
      setCurrentEmotion('annoyed');
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (reqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [waitForAudioAndPlay]);

  const transcribe = useCallback(async (wavBlob) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await transcribeAudio(wavBlob, controller.signal);
      if (reqId !== requestIdRef.current) return '';
      return result.text || '';
    } catch (err) {
      if (controller.signal.aborted || err.name === 'CanceledError') return '';
      if (reqId !== requestIdRef.current) return '';
      console.error('Error transcribing audio:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการแปลงเสียงเป็นข้อความ');
      return '';
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (reqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const clear = useCallback(async () => {
    requestIdRef.current++; // Invalidate pending operations
    cancelInFlight(); // Abort any in-flight HTTP request
    // Drop pending TTS jobs so a late socket event can't replay audio
    // after the conversation has been wiped.
    pendingTTSRef.current.clear();
    setLoading(true);
    setError(null);
    try {
      await resetChat();
      if (gameMode) {
        const infoMsg = {
          id: Date.now() + '-game-info-reset',
          text: '[ระบบ] รีเซ็ตประวัติสนทนาแล้ว แต่โหมดเกม OX ยังดำเนินต่อได้',
          sender: 'system',
          timestamp: new Date()
        };
        setMessages([infoMsg]);
      } else {
        setMessages([]);
        setBoard(Array(9).fill(null));
        setGameWinner(null);
      }
      setCurrentEmotion('neutral');
      volumeRef.current = 0;
      if (audioAnalyserRef.current) {
        audioAnalyserRef.current.stop();
      }
    } catch (err) {
      console.error('Error resetting chat:', err);
      setError('ไม่สามารถรีเซ็ตประวัติการสนทนาได้');
    } finally {
      setLoading(false);
    }
  }, [cancelInFlight, gameMode]);

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

    if (audioAnalyserRef.current) {
      audioAnalyserRef.current.initContext();
    }

    const nextBoard = [...board];
    nextBoard[index] = 'X';
    setBoard(nextBoard);
    setGameLoading(true);
    setError(null);
    setCurrentEmotion('thinking');

    // Abort any previous in-flight request (covers chat→game or game→game races)
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const reqId = ++requestIdRef.current; // capture request ID

    // Add Ken's move to messages list
    const userMsg = {
      id: Date.now() + '-user-game',
      text: `ฉันเดินช่อง ${index}`,
      sender: 'user',
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await sendGameMove(nextBoard, index, controller.signal);
      if (reqId !== requestIdRef.current) return;

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
      if (controller.signal.aborted || err.name === 'CanceledError') return;
      if (reqId !== requestIdRef.current) return;
      console.error('Error playing game move:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการเล่นเกม');
      setCurrentEmotion('annoyed');
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (reqId === requestIdRef.current) {
        setGameLoading(false);
      }
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
    socketConnected,
    // Live2D parameters
    currentEmotion,
    volumeRef,
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
