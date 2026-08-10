const express = require("express")
const cors = require("cors")
const http = require("http")

require("dotenv").config()
const { initWebSocket } = require("./websocket")
const securityConfig = require('./config/securityConfig');
const { requestId, notFound, errorHandler } = require('./middleware/requestGuard');
const originGuard = require('./middleware/originGuard');

//Routing declare
const chatRoutes = require('./routes/chat');
const ttsRoutes = require('./routes/tts');
const { initScheduler } = require('./jobs/scheduler');
const llmManager = require('./services/llm/index');
const ttsManager = require('./services/ttsService');
const {
  publishedAudioStore,
  createPublishedAudioMiddleware,
} = require('./services/tts/neural/publishedAudioStore');

//ENV define
const PORT = securityConfig.port
const HOST = securityConfig.host
const AI_MODEL = process.env.AI_MODEL;


//Application define
const app = express();
app.disable('x-powered-by');
app.use(requestId);
app.use(originGuard(securityConfig.allowedOrigins));

const path = require('path');

//CORS declaration
app.use(cors({
    origin: securityConfig.allowedOrigins,
}))

//application level middleware
app.use(express.json({ limit: securityConfig.jsonLimit }))
app.use(express.urlencoded({ extended: true, limit: securityConfig.urlEncodedLimit }))

const fs = require('fs');
// Serve generated audio files
const audioDir = path.join(__dirname, '..', '..', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}
app.use('/audio/:filename', createPublishedAudioMiddleware(publishedAudioStore));
app.use('/audio', express.static(audioDir, {
  fallthrough: false,
  maxAge: '1h',
  dotfiles: 'deny',
}));

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


app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
initWebSocket(server);

async function startServer() {
  // à¹‚à¸«à¸¥à¸”à¸„à¹ˆà¸² provider à¸—à¸µà¹ˆà¹€à¸„à¸¢ switch à¹„à¸§à¹‰à¸ˆà¸²à¸ DB à¸à¹ˆà¸­à¸™à¹€à¸›à¸´à¸”à¸£à¸±à¸š request
  await publishedAudioStore.initialize();
  await llmManager.initialize();
  await ttsManager.initialize();

  server.listen(PORT, HOST, () => {
    console.log(`Server is running on ${HOST}:${PORT} (${securityConfig.mode} mode)`);
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
    
    try {
      await ttsManager.shutdown();
      console.log('[Server] TTS sidecar stopped.');
    } catch (err) {
      console.error('[Server] Error stopping TTS sidecar:', err.message);
    }

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

