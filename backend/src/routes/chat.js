// Calling libs
const express = require('express');
const router = express.Router();
const { getIO } = require('../websocket');

// Calling OllamaService and TTSService
const ollamaService = require("../services/ollamaService")
const ttsService = require("../services/ttsService")
const sttService = require("../services/sttService")
const memoryWriteService = require("../services/memory/memoryWriteService");
const embeddingService = require("../services/memory/embeddingService");
const consolidationWorker = require("../services/memory/consolidationWorker");
const llmManager = require("../services/llm/index");
const gameService = require("../services/gameService");
const gameCommentaryService = require("../services/gameCommentaryService");
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { EMOTION_VALUES } = require("../config/emotions");
const { resourceAuth } = require('../middleware/routePolicies');
const { chatLimit, sttLimit } = require('../middleware/rateLimits');
const securityConfig = require('../config/securityConfig');
const crypto = require('crypto');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomUUID()}.wav`);
  }
});
const upload = multer({ storage, limits: { fileSize: securityConfig.maxAudioBytes, files: 1 }, fileFilter: (_req, file, cb) => { const allowed = new Set(['audio/wav', 'audio/x-wav', 'audio/webm']); cb(null, allowed.has(file.mimetype)); } });

//POST chat request
router.post("/chat", resourceAuth, chatLimit, async (req, res) => {
  const { message, emotion: inputEmotion } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'à¸•à¹‰à¸­à¸‡à¸ªà¹ˆà¸‡ message à¸¡à¸²à¸”à¹‰à¸§à¸¢', message: message });
  }

  // Validate user emotion against allowed values. Default to null if invalid or not provided.
  const validatedEmotion = EMOTION_VALUES.includes(inputEmotion) ? inputEmotion : null;

  try {
    // Generate embedding once for user message
    const embedding = await embeddingService.getEmbedding(message.trim());

    // Phase 4: Fire-and-forget â€” DB write does not block chat
    memoryWriteService.saveMessage('user', message.trim(), validatedEmotion, embedding)
      .catch(err => console.error('[Chat] Error saving user message:', err.message));

    const { reply, emotion } = await ollamaService.chat(message.trim(), embedding, validatedEmotion);
    
    const ttsJobId = `tts-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Reply text and emotion immediately
    res.json({ reply, emotion, audioUrl: null, ttsJobId });  
    
    // Background: Save assistant message + generate & push TTS audio
    (async () => {
      try {
        // Phase 3: Embed reply in advance and save assistant message with precalculated embedding
        const replyEmbedding = await embeddingService.getEmbedding(reply);
        await memoryWriteService.saveMessage('assistant', reply, emotion, replyEmbedding);
      } catch (err) {
        console.error('[Chat] Error saving assistant message:', err.message);
      }

      try {
        const audioFilename = await ttsService.generate(reply);
        const audioUrl = `/audio/${audioFilename}`;
        getIO().emit('tts:done', { ttsJobId, audioUrl });
      } catch (ttsError) {
        console.error('[Chat] TTS Error:', ttsError.message);
        getIO().emit('tts:error', { ttsJobId, error: ttsError.message });
      }
    })();
    
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ error: 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¸„à¸¸à¸¢à¸à¸±à¸š LLM' });
  }
})

//POST transcribe voice request
router.post("/transcribe", resourceAuth, sttLimit, upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'à¹„à¸¡à¹ˆà¸žà¸šà¹„à¸Ÿà¸¥à¹Œà¹€à¸ªà¸µà¸¢à¸‡à¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸²à¸£à¹à¸›à¸¥à¸‡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡' });
  }

  const filePath = req.file.path;

  try {
    const transcribedText = await sttService.transcribe(filePath);
    res.json({ text: transcribedText });
  } catch (error) {
    console.error('Transcription error:', error.message);
    res.status(500).json({ error: 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¹à¸›à¸¥à¸‡à¹€à¸ªà¸µà¸¢à¸‡à¹€à¸›à¹‡à¸™à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡' });
  } finally {
    // Delete temporary file to clean up space
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete temp audio file:', err);
    });
  }
});

//POST reset conversation
router.post('/chat/reset', resourceAuth, async (req, res) => {
  ollamaService.resetHistory();

  // End current session and trigger memory consolidation asynchronously
  try {
    await memoryWriteService.endCurrentSession();
    consolidationWorker.runConsolidation(); // Fire and forget
  } catch (err) {
    console.error('Error during session reset consolidation trigger:', err);
  }

  res.json({ message: 'reset conversation history à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢' });
});

// GET chat status (model readiness check)
router.get('/chat/status', (req, res) => {
  res.json({ ready: ollamaService.isReady() });
});

// POST game move request (OX Game)
router.post("/game/move", resourceAuth, chatLimit, async (req, res) => {
  const { board, move } = req.body;

  if (!board || !Array.isArray(board) || board.length !== 9) {
    return res.status(400).json({ error: "à¸à¸£à¸°à¸”à¸²à¸™ OX à¸•à¹‰à¸­à¸‡à¸¡à¸µà¸‚à¸™à¸²à¸” 9 à¸Šà¹ˆà¸­à¸‡" });
  }

  // 1. Process Ken's move
  if (move !== undefined && move !== null) {
    if (move < 0 || move > 8 || board[move] !== 'X') {
      return res.status(400).json({ error: "à¸à¸²à¸£à¹€à¸”à¸´à¸™à¸Šà¹ˆà¸­à¸‡à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡" });
    }
    await memoryWriteService.saveMessage('user', `à¹€à¸¥à¹ˆà¸™à¹€à¸à¸¡ OX: à¸‰à¸±à¸™à¹€à¸”à¸´à¸™à¸—à¸µà¹ˆà¸Šà¹ˆà¸­à¸‡ ${move}`);
  }

  // 2. Check if Ken won or draw
  let winner = gameService.checkWinner(board);
  let reply = "";
  let emotion = "neutral";
  let synMove = null;

  if (winner) {
    // Game over: Ken won or draw
    const commentary = await gameCommentaryService.getGameCommentary(board, null, winner, 'game_over');
    reply = commentary.reply;
    emotion = commentary.emotion;

    await memoryWriteService.saveMessage('assistant', `à¸œà¸¥à¹€à¸à¸¡ OX à¸ˆà¸šà¸¥à¸‡à¸”à¹‰à¸§à¸¢: ${winner === 'X' ? 'Ken à¸Šà¸™à¸°' : 'à¹€à¸ªà¸¡à¸­'} à¹à¸¥à¸°à¸‰à¸±à¸™à¸žà¸¹à¸”à¸§à¹ˆà¸² "${reply}"`, emotion);
  } else {
    // 3. Syn's turn to move
    synMove = gameService.getBestMove(board, 'O');
    if (synMove !== -1) {
      board[synMove] = 'O';
      await memoryWriteService.saveMessage('assistant', `à¸‰à¸±à¸™à¹€à¸”à¸´à¸™à¹€à¸à¸¡ OX à¸—à¸µà¹ˆà¸Šà¹ˆà¸­à¸‡ ${synMove}`);
    }

    // 4. Check if Syn won or draw
    winner = gameService.checkWinner(board);

    // 5. Ollama comments on Syn's move
    const commentary = await gameCommentaryService.getGameCommentary(board, synMove, winner, 'syn_move');
    reply = commentary.reply;
    emotion = commentary.emotion;

    await memoryWriteService.saveMessage('assistant', `à¸‰à¸±à¸™à¹€à¸”à¸´à¸™à¹€à¸à¸¡ OX à¸—à¸µà¹ˆà¸Šà¹ˆà¸­à¸‡ ${synMove} à¹à¸¥à¸°à¸žà¸¹à¸”à¸§à¹ˆà¸² "${reply}"`, emotion);
  }

  // 6. Generate speech audio for reply via WS
  const ttsJobId = `tts-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  res.json({ board, synMove, winner, reply, emotion, audioUrl: null, ttsJobId });

  (async () => {
    try {
      const audioFilename = await ttsService.generate(reply);
      const audioUrl = `/audio/${audioFilename}`;
      getIO().emit('tts:done', { ttsJobId, audioUrl });
    } catch (ttsError) {
      console.error('[Chat] Game TTS Error:', ttsError.message);
      getIO().emit('tts:error', { ttsJobId, error: ttsError.message });
    }
  })();
});

module.exports = router;

