const express = require("express")
const cors = require("cors")
const http = require("http")
const { initWebSocket } = require("./websocket")
require("dotenv").config()

//Routing declare
const chatRoutes = require('./routes/chat');
const ttsRoutes = require('./routes/tts');
const { initScheduler } = require('./jobs/scheduler');
const llmManager = require('./services/llm/index');
const ttsManager = require('./services/ttsService');

//ENV define
const PORT = process.env.PORT
const AI_MODEL = process.env.AI_MODEL;


//Application define
const app = express();

const path = require('path');

//CORS declaration
app.use(cors({
    origin: 'http://localhost:6060',
}))

//application level middleware
app.use(express.json())
app.use(express.urlencoded({extended:true}))

const fs = require('fs');
// Serve generated audio files
const audioDir = path.join(__dirname, '..', '..', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}
app.use('/audio', express.static(audioDir));

//application routes
app.get("/",(req,res)=>{
    res.json({status: "ok"})
})

//Routing
app.use("/api", chatRoutes)
app.use("/api/tts", ttsRoutes)

const llmRoutes = require('./routes/llm');
app.use("/api/llm", llmRoutes)

const configRoutes = require('./routes/config');
app.use("/api/config", configRoutes);

const healthRoutes = require('./routes/health');
app.use("/api/health", healthRoutes);

const memoryRoutes = require('./routes/memory');
app.use("/api/memory", memoryRoutes);


const server = http.createServer(app);
initWebSocket(server);

async function startServer() {
  // โหลดค่า provider ที่เคย switch ไว้จาก DB ก่อนเปิดรับ request
  await llmManager.initialize();
  await ttsManager.initialize();

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`AI Model: ${AI_MODEL}`);
    console.log(`LLM Provider: ${llmManager.getCurrentProvider()}`);
    console.log(`TTS Provider: ${ttsManager.getCurrentProvider()}`);
    initScheduler();

    // Preload Ollama models in background
    const ollamaService = require('./services/ollamaService');
    ollamaService.preloadModels();

    // Start RVC server if enabled
    if (process.env.VOICE_CONVERSION_ENABLED === 'true') {
      const voiceConversionService = require('./services/voiceConversionService');
      voiceConversionService.startServer();
    }
  });
}

startServer();

function gracefulShutdown(signal) {
  console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async () => {
    console.log('[Server] HTTP server closed.');
    
    if (process.env.VOICE_CONVERSION_ENABLED === 'true') {
      try {
        const voiceConversionService = require('./services/voiceConversionService');
        voiceConversionService.stopServer();
        console.log('[Server] RVC sidecar server stopped.');
      } catch (err) {
        console.error('[Server] Error stopping RVC server:', err.message);
      }
    }
    
    try {
      const { pool } = require('./db/pool');
      await pool.end();
      console.log('[Server] Database pool closed.');
    } catch (err) {
      console.error('[Server] Error closing database pool:', err.message);
    }
    
    console.log('[Server] Graceful shutdown complete. Exiting.');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('[Server] Force exiting due to shutdown timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));