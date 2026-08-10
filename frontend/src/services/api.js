import axios from 'axios';
import { io } from 'socket.io-client';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4040/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 600000,
});

// Request interceptor to automatically inject x-api-key from sessionStorage if not manually provided
api.interceptors.request.use((config) => {
  if (!config.headers['x-api-key']) {
    const apiKey = sessionStorage.getItem('synthenia_api_key');
    if (apiKey) {
      config.headers['x-api-key'] = apiKey;
    }
  }
  return config;
});

// Response interceptor to catch 401s, clear stored keys, and normalize error response messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      sessionStorage.removeItem('synthenia_api_key');
      window.dispatchEvent(new Event('auth-unauthorized'));
    }

    let normalizedErrorCode;

    // Normalize error message
    let message = 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸•à¹ˆà¸­à¸à¸±à¸šà¹€à¸‹à¸´à¸£à¹Œà¸Ÿà¹€à¸§à¸­à¸£à¹Œ';
    if (error.response && error.response.data && error.response.data.error) {
      const payload = error.response.data.error;
      message = typeof payload === 'string' ? payload : (payload.message || 'Request failed');
      normalizedErrorCode = typeof payload === 'object'
        ? payload.code
        : error.response.data.code;
    } else if (error.message) {
      message = error.message;
    }

    const normalizedError = new Error(message);
    normalizedError.status = error.response?.status;
    normalizedError.code = normalizedErrorCode;

    return Promise.reject(normalizedError);
  }
);

const getWsUrl = () => {
  const viteApiUrl = import.meta.env.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl.replace('/api', '');
  }
  return 'http://localhost:4040';
};

const WS_URL = getWsUrl();
export const socket = io(WS_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
});

export const sendMessage = async (message, emotion, signal) => {
  const response = await api.post('/chat', { message, emotion }, { signal });
  return response.data;
};

export const resetChat = async () => {
  const response = await api.post('/chat/reset');
  return response.data;
};

export const transcribeAudio = async (wavBlob, signal) => {
  const formData = new FormData();
  formData.append('audio', wavBlob, 'voice.wav');
  const response = await api.post('/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    signal
  });
  return response.data;
};

export const sendGameMove = async (board, move, signal) => {
  const response = await api.post('/game/move', { board, move }, { signal });
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

export const getTTSProviderStatuses = async () => {
  const response = await api.get('/tts/status');
  return response.data;
};

export const switchTTSProvider = async (provider) => {
  const response = await api.post('/tts/switch', { provider });
  return response.data;
};

export const previewTTS = async (text, provider, voiceConversion, pitch, indexRate, signal) => {
  const response = await api.post(
    '/tts/preview',
    { text, provider, voiceConversion, pitch, indexRate },
    { signal },
  );
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

export const getMemoryStats = async () => {
  const response = await api.get('/memory/stats');
  return response.data;
};

export const testLLMProvider = async (provider) => {
  const response = await api.post('/llm/test', { provider });
  return response.data;
};

// Mutating APIs (require auth header)
export const updateLLMConfig = async (data) => {
  const response = await api.patch('/config/llm', data);
  return response.data;
};

export const updateVoiceConversionConfig = async (data) => {
  const response = await api.patch('/config/voice-conversion', data);
  return response.data;
};

export const updateMemoryConfig = async (data) => {
  const response = await api.patch('/config/memory', data);
  return response.data;
};

export const resetConfigKey = async (key) => {
  const response = await api.post(`/config/reset/${key}`, {});
  return response.data;
};

export const triggerConsolidate = async () => {
  const response = await api.post('/memory/consolidate', {});
  return response.data;
};

export const triggerDecay = async () => {
  const response = await api.post('/memory/decay', {});
  return response.data;
};

export const verifyApiKey = async (apiKey) => {
  const response = await api.post('/config/verify-key', {}, {
    headers: { 'x-api-key': apiKey }
  });
  return response.data;
};

export default api;

