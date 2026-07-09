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

module.exports = router;
