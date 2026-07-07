# AGENTS.md — Synthenia Project

> ไฟล์นี้อธิบาย architecture, โครงสร้างโค้ด, convention ที่ใช้ในโปรเจกต์ และกฎที่ Agent (AI coding assistant) ต้องปฏิบัติตามเมื่อทำงานกับ codebase นี้

---

## 📌 Overview

**Synthenia** คือ AI VTuber ชื่อ **ซิน (Syn)** — เป็น AI companion ที่มีบุคลิกเป็นวัยรุ่นสาวซึนเดเระ ปากแข็ง ขี้แซว พ่อลูกกันกับ Ken (ผู้ใช้) ระบบประกอบด้วย:

- **Frontend**: React (Vite) + PixiJS + pixi-live2d-display — แสดงอวตาร Live2D พร้อม lip-sync และ emotion mapping
- **Backend**: Node.js + Express — ประมวลผล chat, TTS, STT, memory, เกม OX
- **AI Model**: Ollama (ใช้ `gemma4:12b` เป็น default) สำหรับ conversation + memory consolidation
- **Database**: PostgreSQL + pgvector — เก็บ episodic memory, semantic facts, reflective summary
- **TTS**: Multi-provider (gTTS, Piper, PyThaiTTS, KhanomTan, Gemini TTS) + RVC Voice Conversion
- **STT**: whisper-cli.exe (local Whisper model) ภาษาไทย

---

## 🏗️ Project Structure

```
Synthenia/
├── .agents/
│   └── AGENTS.md           ← ไฟล์นี้
├── audio/                  ← ไฟล์เสียง TTS ที่ generate แล้ว (ไม่ commit)
├── backend/
│   ├── .env                ← ⚠️ ห้าม commit ขึ้น git (มี API keys)
│   ├── src/
│   │   ├── index.js        ← Entry point, Express app setup
│   │   ├── bin/whisper/    ← whisper-cli.exe และ model files (STT)
│   │   ├── config/
│   │   │   ├── personality.js   ← โหลด system prompt + MODEL_CONFIG
│   │   │   └── ttsConfig.js     ← ตั้งค่า TTS default provider
│   │   ├── db/
│   │   │   ├── init.js     ← migration script (รันครั้งเดียวตอน setup)
│   │   │   └── pool.js     ← PostgreSQL connection pool
│   │   ├── jobs/
│   │   │   └── scheduler.js     ← node-cron: consolidation (3AM daily), decay (4AM Sunday)
│   │   ├── prompts/        ← System prompt modular sections (.md files)
│   │   │   ├── identity.md
│   │   │   ├── personality.md
│   │   │   ├── speech_style.md
│   │   │   ├── json_schema.md
│   │   │   ├── memory_context.md
│   │   │   ├── examples.md
│   │   │   └── system_builder.js   ← รวม sections + inject memory context
│   │   ├── routes/
│   │   │   ├── chat.js     ← POST /api/chat, /api/transcribe, /api/chat/reset, /api/game/move
│   │   │   └── tts.js      ← GET/POST /api/tts/*
│   │   ├── services/
│   │   │   ├── ollamaService.js        ← chat() + resetHistory(), จัดการ conversation history
│   │   │   ├── sttService.js           ← transcribe() ผ่าน whisper-cli.exe subprocess
│   │   │   ├── ttsService.js           ← re-export ของ TTS manager (wrapper얇)
│   │   │   ├── gameService.js          ← Tic-Tac-Toe logic (minimax, checkWinner, formatBoard)
│   │   │   ├── voiceConversionService.js   ← RVC server sidecar management + convert()
│   │   │   ├── memory/
│   │   │   │   ├── embeddingService.js         ← getEmbedding() ผ่าน Ollama (bge-m3)
│   │   │   │   ├── memoryWriteService.js        ← saveMessage(), endCurrentSession()
│   │   │   │   ├── memoryRetrievalService.js    ← retrieve() hybrid search + re-ranking
│   │   │   │   └── consolidationWorker.js       ← extractFacts + upsertSemanticFact + reflective summary
│   │   │   │   └── decayWorker.js               ← decay importance score + archive + episodic pruning
│   │   │   └── tts/
│   │   │       ├── index.js            ← TTSManager: generate(), switchProvider(), fallback logic
│   │   │       ├── ttsFactory.js       ← Factory pattern: createTTSProvider(name)
│   │   │       └── providers/
│   │   │           ├── baseProvider.js
│   │   │           ├── gttsProvider.js
│   │   │           ├── piperProvider.js
│   │   │           ├── pythaittsProvider.js
│   │   │           ├── khanomtanProvider.js
│   │   │           └── geminittsProvider.js    ← Gemini TTS + in-memory quota tracker + fallback chain
│   │   └── uploads/        ← temp audio files จาก STT (ลบทิ้งหลัง transcribe)
│   ├── voice-conversion/   ← RVC Python sidecar server
│   └── voices/             ← voice model files สำหรับ TTS providers
├── frontend/
│   ├── public/
│   │   └── live2d-models/  ← Live2D model files (.json, textures, motions)
│   ├── src/
│   │   ├── App.jsx         ← Root component, layout สองคอลัมน์
│   │   ├── main.jsx        ← React entry point
│   │   ├── components/
│   │   │   ├── AvatarCanvas.jsx        ← PIXI app + Live2D model loading + emotion motion + lip-sync
│   │   │   ├── ChatInput.jsx           ← ช่องพิมพ์ข้อความ + ปุ่ม voice recording
│   │   │   ├── ChatWindow.jsx          ← รายการข้อความ
│   │   │   ├── MessageBubble.jsx       ← Bubble component แต่ละข้อความ
│   │   │   ├── GameBoard.jsx           ← OX Game board UI
│   │   │   └── TTSProviderSelector.jsx ← Dropdown + preview สำหรับ TTS settings
│   │   ├── hooks/
│   │   │   └── useChat.js  ← Central state hook: messages, emotions, volume, game state, audio
│   │   ├── services/
│   │   │   └── api.js      ← axios instance + all API call functions
│   │   └── utils/
│   │       ├── audioAnalyser.js    ← Web Audio API: volume detection สำหรับ lip-sync
│   │       └── audioRecorder.js    ← MediaRecorder wrapper สำหรับ voice input
│   └── vite.config.js
├── syn_voice/              ← RVC voice model files (.pth, .index)
└── uploads/                ← shared uploads directory
```

---

## 🧠 Memory Architecture

ระบบความทรงจำแบบ 3-tier:

| Tier | Table | Description |
|------|-------|-------------|
| **Episodic** | `sessions`, `messages` | บันทึกบทสนทนาทุก turn พร้อม embedding (bge-m3, 1024 dim) |
| **Semantic** | `semantic_facts` | ข้อเท็จจริงที่สกัดจาก episodes ด้วย LLM, มี importance score + supersede mechanism |
| **Reflective** | `reflective_summary` | สรุปภาพรวมความสัมพันธ์ Ken-Syn ทุกครั้งหลัง consolidation |

**Retrieval Flow:** per-message → hybrid search (cosine similarity + re-rank by importance + recency) → inject ใน system prompt

**Consolidation:** triggered หลัง session reset (fire-and-forget) + cron 3AM daily

**Decay:** cron ทุก Sunday 4AM — ลด importance score ของ facts ที่ไม่ถูกเข้าถึง > 60 วัน, archive ที่ต่ำกว่า 0.1

---

## 🎭 Emotion System

AI ตอบกลับเป็น JSON `{ reply: string, emotion: string }` เสมอ

Emotions ที่รองรับ:
```
neutral | happy | embarrassed | sad | angry | thinking | surprised | laugh | annoyed
```

Emotion → Live2D motion mapping ผ่าน `playMotionSafe()` ใน `AvatarCanvas.jsx` พร้อม fallback chain

---

## 🔊 TTS Pipeline

```
text → TTSManager.generate()
     → currentProvider.synthesize()   (gtts / piper / pythaitts / khanomtan / geminitts)
     → [optional] voiceConversionService.convert()  (RVC server HTTP)
     → audioFilename → serve via /audio/{filename}
```

Fallback: primary provider ล้มเหลว → gTTS (เสมอ)

GeminiTTS มี in-memory QuotaTracker (10 req/day/model, reset Pacific Time)

---

## ⚙️ Environment Variables (backend/.env)

| Variable | Description |
|----------|-------------|
| `PORT` | Express server port (default: 4040) |
| `AI_MODEL` | Ollama model name (e.g., `gemma4:12b`) |
| `Ollama_BaseURL` | Ollama base URL |
| `Ollama_Port` | Ollama port |
| `TTS_PROVIDER` | Default TTS provider key |
| `GEMINI_API_KEY` | ⚠️ Secret — Gemini API key |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | PostgreSQL connection |
| `VOICE_CONVERSION_ENABLED` | เปิด/ปิด RVC pipeline |
| `VOICE_CONVERSION_PITCH` | Pitch shift (semitones) |
| `VOICE_CONVERSION_INDEX_RATE` | RVC index rate (0.0–1.0) |
| `RVC_SERVER_PORT/URL` | RVC sidecar server |

---

## 📏 Coding Conventions

### ทั่วไป
- ใช้ **CommonJS** (`require/module.exports`) ฝั่ง backend
- ใช้ **ES Modules** (`import/export`) ฝั่ง frontend
- ทุก service สำคัญ export เป็น **singleton instance** (`module.exports = new ClassName()`)
- ตั้งชื่อไฟล์: `camelCase` สำหรับ JS, `PascalCase` สำหรับ React components

### Backend
- Route handler ต้องใช้ `try/catch` ทุก async operation
- Error response ต้องส่ง HTTP status code ที่เหมาะสม (400 สำหรับ input invalid, 500 สำหรับ server error)
- ตรวจสอบ input ใน route layer ก่อนส่งต่อ service
- Log message ใช้ prefix `[ServiceName]` เช่น `[TTS Manager]`, `[Memory Consolidation]`
- ห้าม crash server เพราะ TTS/memory error — ใช้ fallback หรือ fail silently

### Frontend
- State ทั้งหมดของ chat อยู่ใน `useChat.js` hook — ห้ามสร้าง global state ใหม่โดยไม่จำเป็น
- Audio playback จัดการผ่าน `playAudioWithAnalysis()` เท่านั้น (เพื่อ lip-sync)
- Inline style ใน JSX ใช้ CSS variables (`var(--accent)`, `var(--bg)`, etc.) แทนค่า hard-coded

### Database
- ทุก query ผ่าน `pool.js` wrapper (`query(text, params)`)
- ห้ามใช้ raw SQL string interpolation — ใช้ parameterized queries (`$1`, `$2`) เสมอ
- Schema migration อยู่ใน `db/init.js` — รันแยกต่างหาก ไม่ได้รันทุกครั้งที่ server start

### TTS Providers
- ทุก provider ต้อง extend `BaseTTSProvider` และ implement `async synthesize(text): Promise<string>`
- Return value คือ **filename** (ไม่ใช่ full path) ของไฟล์เสียงใน `audio/` directory
- ลงทะเบียน provider ใหม่ใน `ttsFactory.js`

---

## 🚫 Rules for Agents

1. **ห้าม commit `.env`** ขึ้น git ไม่ว่ากรณีใด
2. **ห้ามแก้ไข `db/init.js` migration** โดยไม่ระวัง — การเปลี่ยน schema ต้องทำ migration เพิ่มเติม
3. **อย่า hardcode API keys** หรือ credentials ในโค้ด
4. **ห้ามเพิ่ม `console.log` debug ชั่วคราว** โดยไม่มี comment บอกว่าจะลบ (มีอยู่แล้วบางจุด ต้องลบออก)
5. เมื่อเพิ่ม TTS provider ใหม่ ต้องอัปเดตทั้ง `ttsFactory.js` และ label mapping ใน `TTSProviderSelector.jsx`
6. **อย่าแก้ system prompt** (.md files ใน `prompts/`) โดยพลการ — กระทบบุคลิกของ Syn โดยตรง
7. เมื่อแก้ไข memory pipeline ต้องทดสอบ consolidation flow ด้วย session ที่มี messages >= 4
8. **Conversation history** ใน `ollamaService.js` จำกัดที่ **21 messages** (system + 20 last) — ห้ามเพิ่มโดยไม่วัด RAM impact
9. ทุก async function ใน backend ต้อง handle error และไม่ throw ขึ้นไปถึง Express default handler (ยกเว้น intentional)
10. ไฟล์เสียงใน `audio/` ไม่ได้มีระบบ cleanup อัตโนมัติ — ต้องระวัง disk space หากรันนาน
