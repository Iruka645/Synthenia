import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4040/api',
  headers: {
    'Content-Type': 'application/json',
  },
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

export default api;
