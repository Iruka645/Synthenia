import axios from 'axios';
import { io } from 'socket.io-client';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4040/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

const WS_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4040';
export const socket = io(WS_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
});

export const sendMessage = async (message) => {
  const response = await api.post('/chat', { message });
  return response.data;
};

export const resetChat = async () => {
  const response = await api.post('/chat/reset');
  return response.data;
};

export const transcribeAudio = async (wavBlob) => {
  const formData = new FormData();
  formData.append('audio', wavBlob, 'voice.wav');
  const response = await api.post('/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const sendGameMove = async (board, move) => {
  const response = await api.post('/game/move', { board, move });
  return response.data;
};

export const getTTSCurrentProvider = async () => {
  const response = await api.get('/tts/current');
  return response.data;
};

export const getTTSProvidersList = async () => {
  const response = await api.get('/tts/list');
  return response.data;
};

export const switchTTSProvider = async (provider) => {
  const response = await api.post('/tts/switch', { provider });
  return response.data;
};

export const previewTTS = async (text, provider, voiceConversion, pitch, indexRate) => {
  const response = await api.post('/tts/preview', { text, provider, voiceConversion, pitch, indexRate });
  return response.data;
};

export const getChatStatus = async () => {
  const response = await api.get('/chat/status');
  return response.data;
};

export const getConfig = async () => {
  const response = await api.get('/config');
  return response.data;
};

export const getConfigHistory = async (key) => {
  const response = await api.get(`/config/history/${key}`);
  return response.data;
};

export const getAuditLog = async (limit = 20) => {
  const response = await api.get(`/config/audit-log?limit=${limit}`);
  return response.data;
};

export const getFallbackEvents = async () => {
  const response = await api.get('/config/fallback-events');
  return response.data;
};

export const getOllamaHealth = async () => {
  const response = await api.get('/health/ollama');
  return response.data;
};

export const getSiliconFlowHealth = async () => {
  const response = await api.get('/health/siliconflow');
  return response.data;
};

export const getMemoryStats = async () => {
  const response = await api.get('/memory/stats');
  return response.data;
};

export const testLLMProvider = async (provider) => {
  const response = await api.post('/llm/test', { provider });
  return response.data;
};

// Mutating APIs (require auth header)
export const updateLLMConfig = async (data, apiKey) => {
  const response = await api.patch('/config/llm', data, {
    headers: { 'x-api-key': apiKey }
  });
  return response.data;
};

export const updateTTSConfig = async (data, apiKey) => {
  const response = await api.patch('/config/tts', data, {
    headers: { 'x-api-key': apiKey }
  });
  return response.data;
};

export const updateVoiceConversionConfig = async (data, apiKey) => {
  const response = await api.patch('/config/voice-conversion', data, {
    headers: { 'x-api-key': apiKey }
  });
  return response.data;
};

export const updateMemoryConfig = async (data, apiKey) => {
  const response = await api.patch('/config/memory', data, {
    headers: { 'x-api-key': apiKey }
  });
  return response.data;
};

export const resetConfigKey = async (key, apiKey) => {
  const response = await api.post(`/config/reset/${key}`, {}, {
    headers: { 'x-api-key': apiKey }
  });
  return response.data;
};

export const triggerConsolidate = async (apiKey) => {
  const response = await api.post('/memory/consolidate', {}, {
    headers: { 'x-api-key': apiKey }
  });
  return response.data;
};

export const triggerDecay = async (apiKey) => {
  const response = await api.post('/memory/decay', {}, {
    headers: { 'x-api-key': apiKey }
  });
  return response.data;
};

export const verifyApiKey = async (apiKey) => {
  const response = await api.post('/config/verify-key', {}, {
    headers: { 'x-api-key': apiKey }
  });
  return response.data;
};

export default api;
