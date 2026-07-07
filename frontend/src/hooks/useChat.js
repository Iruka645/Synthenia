import { useState, useCallback, useRef, useEffect } from 'react';
import { sendMessage, resetChat, transcribeAudio, sendGameMove } from '../services/api';
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

  const audioAnalyserRef = useRef(new AudioAnalyser());

  // Clean up audio analyser on unmount
  useEffect(() => {
    return () => {
      audioAnalyserRef.current.stop();
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

      // Play generated audio if available
      if (response.audioUrl) {
        playAudioWithAnalysis(response.audioUrl);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
      setCurrentEmotion('annoyed');
    } finally {
      setLoading(false);
    }
  }, [playAudioWithAnalysis]);

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
      if (response.audioUrl) {
        playAudioWithAnalysis(response.audioUrl);
      }
    } catch (err) {
      console.error('Error playing game move:', err);
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการเล่นเกม');
      setCurrentEmotion('annoyed');
    } finally {
      setGameLoading(false);
    }
  }, [board, gameWinner, gameLoading, playAudioWithAnalysis]);

  return {
    messages,
    loading,
    error,
    send,
    transcribe,
    clear,
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
