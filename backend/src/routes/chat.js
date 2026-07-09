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
    cb(null, `voice-${Date.now()}.wav`);
  }
});
const upload = multer({ storage });

//POST chat request
router.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'ต้องส่ง message มาด้วย', message: message });
  }
  try {
    // Generate embedding once for user message
    const embedding = await embeddingService.getEmbedding(message.trim());

    // Phase 4: Fire-and-forget — DB write does not block chat
    memoryWriteService.saveMessage('user', message.trim(), null, embedding)
      .catch(err => console.error('[Chat] Error saving user message:', err.message));

    const { reply, emotion } = await ollamaService.chat(message.trim(), embedding);
    
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
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการคุยกับ LLM' });
  }
})

//POST transcribe voice request
router.post("/transcribe", upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ไม่พบไฟล์เสียงสำหรับการแปลงข้อความ' });
  }

  const filePath = req.file.path;

  try {
    const transcribedText = await sttService.transcribe(filePath);
    res.json({ text: transcribedText });
  } catch (error) {
    console.error('Transcription error:', error.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการแปลงเสียงเป็นข้อความ' });
  } finally {
    // Delete temporary file to clean up space
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete temp audio file:', err);
    });
  }
});

//POST reset conversation
router.post('/chat/reset', async (req, res) => {
  ollamaService.resetHistory();

  // End current session and trigger memory consolidation asynchronously
  try {
    await memoryWriteService.endCurrentSession();
    consolidationWorker.runConsolidation(); // Fire and forget
  } catch (err) {
    console.error('Error during session reset consolidation trigger:', err);
  }

  res.json({ message: 'reset conversation history เรียบร้อย' });
});

// GET chat status (model readiness check)
router.get('/chat/status', (req, res) => {
  res.json({ ready: ollamaService.isReady() });
});

// POST game move request (OX Game)
router.post("/game/move", async (req, res) => {
  const { board, move } = req.body;

  if (!board || !Array.isArray(board) || board.length !== 9) {
    return res.status(400).json({ error: "กระดาน OX ต้องมีขนาด 9 ช่อง" });
  }

  // 1. Process Ken's move
  if (move !== undefined && move !== null) {
    if (move < 0 || move > 8 || board[move] !== 'X') {
      return res.status(400).json({ error: "การเดินช่องนี้ไม่ถูกต้อง" });
    }
    await memoryWriteService.saveMessage('user', `เล่นเกม OX: ฉันเดินที่ช่อง ${move}`);
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

    await memoryWriteService.saveMessage('assistant', `ผลเกม OX จบลงด้วย: ${winner === 'X' ? 'Ken ชนะ' : 'เสมอ'} และฉันพูดว่า "${reply}"`, emotion);
  } else {
    // 3. Syn's turn to move
    synMove = gameService.getBestMove(board, 'O');
    if (synMove !== -1) {
      board[synMove] = 'O';
      await memoryWriteService.saveMessage('assistant', `ฉันเดินเกม OX ที่ช่อง ${synMove}`);
    }

    // 4. Check if Syn won or draw
    winner = gameService.checkWinner(board);

    // 5. Ollama comments on Syn's move
    const commentary = await gameCommentaryService.getGameCommentary(board, synMove, winner, 'syn_move');
    reply = commentary.reply;
    emotion = commentary.emotion;

    await memoryWriteService.saveMessage('assistant', `ฉันเดินเกม OX ที่ช่อง ${synMove} และพูดว่า "${reply}"`, emotion);
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