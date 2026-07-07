const express = require("express")
const cors = require("cors")
require("dotenv").config()

//Routing declare
const chatRoutes = require('./routes/chat');
const ttsRoutes = require('./routes/tts');
const { initScheduler } = require('./jobs/scheduler');

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


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`AI Model: ${AI_MODEL}`);
    initScheduler();

    // Start RVC server if enabled
    if (process.env.VOICE_CONVERSION_ENABLED === 'true') {
        const voiceConversionService = require('./services/voiceConversionService');
        voiceConversionService.startServer();
    }
});