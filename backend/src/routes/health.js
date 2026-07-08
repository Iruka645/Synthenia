const express = require('express');
const router = express.Router();

// GET /api/health/ollama
router.get('/ollama', async (req, res) => {
  const Ollama_BASE_URL = process.env.Ollama_BaseURL || "http://localhost";
  const Ollama_PORT = process.env.Ollama_Port || 11434;

  try {
    const response = await fetch(`${Ollama_BASE_URL}:${Ollama_PORT}/api/tags`, {
      signal: AbortSignal.timeout(3000)
    });
    if (response.ok) {
      const data = await response.json();
      return res.json({ status: 'ok', models: data.models || [] });
    } else {
      throw new Error(`Ollama responded with status: ${response.status}`);
    }
  } catch (err) {
    return res.json({ status: 'error', message: err.message });
  }
});

// GET /api/health/siliconflow
router.get('/siliconflow', async (req, res) => {
  const key = process.env.SILICONFLOW_API_KEY;
  if (!key) {
    return res.json({ status: 'error', message: 'ไม่ได้ตั้งค่า SILICONFLOW_API_KEY ใน .env' });
  }

  try {
    const response = await fetch('https://api.siliconflow.cn/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` },
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      return res.json({ status: 'ok', message: 'เชื่อมต่อ SiliconFlow สำเร็จและ API key ถูกต้อง' });
    } else {
      const text = await response.text();
      return res.json({ status: 'error', message: `SiliconFlow API error: ${response.status} - ${text}` });
    }
  } catch (err) {
    return res.json({ status: 'error', message: `ไม่สามารถเชื่อมต่อ SiliconFlow ได้: ${err.message}` });
  }
});

module.exports = router;
