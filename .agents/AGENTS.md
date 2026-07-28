# AGENTS.md — Synthenia Project

> ไฟล์นี้อธิบาย architecture, โครงสร้างโค้ด, convention ที่ใช้ในโปรเจกต์ และกฎที่ Agent (AI coding assistant) ต้องปฏิบัติตามเมื่อทำงานกับ codebase นี้
>
> ตรวจสอบและปรับปรุงจากซอร์สโค้ดจริงล่าสุด (โครงสร้าง route/service ปัจจุบันมี Control Panel, LLM abstraction layer และ WebSocket เพิ่มเข้ามาจากเวอร์ชันก่อนหน้า)

---

## 📌 Overview

**Synthenia** คือ AI VTuber ชื่อ **ซิน (Syn)** — AI companion บุคลิกวัยรุ่นสาวซึนเดเระ ปากแข็ง ขี้แซว เรียก ผู้ใช้ ว่า "Ken" (พ่อ) ระบบประกอบด้วย:

- **Frontend**: React 19 (Vite) + PixiJS 6 + pixi-live2d-display — แสดงอวตาร Live2D พร้อม lip-sync, emotion mapping, และ **Control Panel** (dashboard สำหรับตั้งค่า LLM/TTS/Memory/Voice Conversion แบบ real-time)
- **Backend**: Node.js + Express 5 + Socket.IO — ประมวลผล chat, TTS, STT, memory, เกม OX, และ runtime config
- **AI Model**: Ollama (ผ่าน LLM abstraction layer ที่รองรับหลาย provider ในอนาคต) — ปัจจุบันมี provider เดียวคือ `ollama`
- **Database**: PostgreSQL + pgvector — เก็บ episodic memory, semantic facts, reflective summary, และ runtime config/audit log
- **TTS**: Multi-provider (gTTS, Piper) ผ่าน TTSManager + RVC Voice Conversion (sidecar Python server)
- **STT**: whisper-cli (local Whisper build) เรียกผ่าน subprocess, ภาษาไทย
- **Realtime**: Socket.IO ใช้ push แจ้งเมื่อ TTS audio generate เสร็จ (`tts:done` / `tts:error`) — คำตอบข้อความมาก่อนทันทีทาง REST แล้ว audio ตามหลังทาง WebSocket

---

## 🏗️ Project Structure

```
Synthenia/
├── .agents/
│   └── AGENTS.md                 ← ไฟล์นี้
├── illyasviel/                   ← Live2D model source asset (ต้นฉบับ) — ไม่ได้ถูก serve ตรง ๆ โดย frontend
│                                    (frontend ใช้ copy ที่อยู่ใน frontend/public/live2d-models/syn แทน)
├── backend/
│   ├── .env                      ← ⚠️ ห้าม commit ขึ้น git (มี API keys, DB credentials, CONTROL_PANEL_API_KEY)
│   ├── nodemon.json
│   ├── scripts/
│   │   └── benchmark_models.js   ← สคริปต์ benchmark model/provider นอก request cycle
│   ├── test/                     ← Node built-in test runner (`node --test`)
│   │   ├── memory_improvement.test.js
│   │   ├── llm_parser.test.js
│   │   ├── system_builder.test.js
│   │   └── test_rvc.js
│   ├── voice-conversion/         ← RVC Python sidecar (rvc_server.py, convert.py)
│   ├── voices/                   ← voice model config (speaker_config.json) + RVC voice files (.pth/.index, gitignored)
│   └── src/
│       ├── index.js              ← Entry point: Express app + HTTP server + Socket.IO init
│       ├── websocket.js          ← initWebSocket()/getIO() — Socket.IO server สำหรับ push TTS events
│       ├── bin/whisper/          ← whisper-cli binary + model files (STT, gitignored .bin)
│       ├── python/               ← Python helper scripts (gtts_tts.py, piper_tts.py, setup_whisper.py)
│       ├── logs/                 ← runtime logs (gitignored)
│       ├── middleware/
│       │   └── apiKeyAuth.js     ← ตรวจ header `x-api-key` เทียบ CONTROL_PANEL_API_KEY (timing-safe compare, fail-closed)
│       ├── config/
│       │   ├── personality.js    ← โหลด system prompt (PERSONALITY) + MODEL_CONFIG เริ่มต้น
│       │   ├── ttsConfig.js      ← default TTS provider จาก .env
│       │   └── llmConfig.js      ← default LLM provider + modelByProvider จาก .env
│       ├── db/
│       │   ├── init.js           ← migration script (รันครั้งเดียวตอน setup) — สร้างตารางทั้งหมดรวม pgvector extension
│       │   ├── migrate_memory_type.js  ← migration เสริมสำหรับ `memory_type` column
│       │   └── pool.js           ← PostgreSQL connection pool + query() wrapper
│       ├── jobs/
│       │   └── scheduler.js      ← node-cron: consolidation (3AM daily), decay (4AM Sunday), audio cleanup (2AM daily, ลบไฟล์เก่ากว่า 24 ชม.)
│       ├── prompts/              ← System prompt แบบ modular (.md sections)
│       │   ├── identity.md
│       │   ├── personality.md
│       │   ├── speech_style.md
│       │   ├── json_schema.md
│       │   ├── memory_context.md
│       │   ├── examples.md               ← เปิดใช้เมื่อ EXAMPLE_ENABLE=true เท่านั้น
│       │   ├── character_benchmark.js    ← ชุดทดสอบ/เกณฑ์บุคลิก สำหรับ benchmark script
│       │   └── system_builder.js         ← buildSystemPrompt()/buildMemoryContext() ประกอบ sections + inject memory context
│       ├── routes/
│       │   ├── chat.js           ← POST /api/chat, /api/transcribe, /api/chat/reset, GET /api/chat/status, POST /api/game/move
│       │   ├── tts.js            ← GET/POST /api/tts/*
│       │   ├── llm.js            ← GET /api/llm/current, /list; POST /api/llm/switch (auth), /api/llm/test
│       │   ├── config.js         ← Control Panel: GET /api/config (snapshot), /audit-log, /fallback-events, /history/:key; PATCH /llm /tts /voice-conversion /memory (auth); POST /reset/:key, /verify-key (auth)
│       │   ├── health.js         ← GET /api/health/ollama (เช็ค Ollama connectivity)
│       │   └── memory.js         ← GET /api/memory/stats; POST /api/memory/consolidate, /decay (auth)
│       └── services/
│           ├── ollamaService.js            ← chat()/resetHistory()/isReady() — จัดการ conversationHistory (system + จำกัด 21 messages) เรียก llmManager ภายใน
│           ├── sttService.js               ← transcribe() ผ่าน whisper-cli subprocess
│           ├── ttsService.js               ← re-export ของ TTS manager (`services/tts/index.js`)
│           ├── gameService.js              ← Tic-Tac-Toe logic (minimax, checkWinner, getBestMove, formatBoard)
│           ├── gameCommentaryService.js    ← ใช้ llmManager สร้างบทพูดแซว/วิจารณ์เกม OX (มี fallback ข้อความ hardcode เมื่อ LLM ล่ม)
│           ├── voiceConversionService.js   ← RVC sidecar process management (start/stop) + convert()
│           ├── config/
│           │   └── configService.js        ← wrapper อ่าน/เขียน `system_config` table (in-memory cache) + เขียน audit log ไปยัง `config_change_log`
│           ├── llm/
│           │   ├── index.js                ← LLMManager singleton: chat(), switchProvider(), initialize() (restore provider จาก DB), fallback ตอบข้อความปลอดภัยเมื่อทุก provider ล้มเหลว
│           │   ├── llmFactory.js           ← Factory pattern: createLLMProvider(name); ปัจจุบันมีแค่ `ollama`
│           │   └── providers/
│           │       ├── baseLLMProvider.js
│           │       └── ollamaProvider.js   ← เรียก Ollama + parse ผลลัพธ์เป็น JSON { reply, emotion }
│           ├── memory/
│           │   ├── embeddingService.js         ← getEmbedding() ผ่าน Ollama (bge-m3, 1024 dim)
│           │   ├── memoryWriteService.js       ← saveMessage(), endCurrentSession()
│           │   ├── memoryRetrievalService.js   ← retrieve() hybrid search + re-ranking, getLatestReflectiveSummary()
│           │   ├── consolidationWorker.js      ← extractFacts + upsertSemanticFact + reflective summary
│           │   └── decayWorker.js              ← decay importance score + archive + episodic pruning
│           └── tts/
│               ├── index.js            ← TTSManager: generate(), switchProvider(), initialize(), fallback → gTTS เสมอ, ต่อ voiceConversionService ถ้าเปิดใช้
│               ├── ttsFactory.js       ← Factory pattern: createTTSProvider(name); ปัจจุบันมี `gtts`, `piper`
│               └── providers/
│                   ├── baseProvider.js
│                   ├── gttsProvider.js
│                   └── piperProvider.js
├── frontend/
│   ├── vite.config.js
│   ├── jsconfig.json
│   ├── .oxlintrc.json            ← oxlint (linter) config
│   ├── index.html
│   ├── public/
│   │   ├── live2d-models/syn/    ← Live2D model ที่ frontend โหลดจริง (model.json, textures, motions)
│   │   └── vendor/live2d.min.js  ← Live2D Cubism core runtime (โหลดแบบ script tag)
│   └── src/
│       ├── main.jsx              ← React entry point
│       ├── App.jsx               ← Root component, สลับมุมมอง 'chat' ↔ 'control-panel' (Cmd/Ctrl+K, Esc)
│       ├── App.css / index.css
│       ├── components/
│       │   ├── AvatarCanvas.jsx        ← PIXI app + Live2D model loading + emotion motion + lip-sync (lazy loaded)
│       │   ├── ChatInput.jsx           ← ช่องพิมพ์ข้อความ + ปุ่ม voice recording
│       │   ├── ChatWindow.jsx          ← รายการข้อความ
│       │   ├── MessageBubble.jsx       ← Bubble component แต่ละข้อความ
│       │   ├── GameBoard.jsx           ← OX Game board UI
│       │   ├── TTSProviderSelector.jsx ← Dropdown + preview สำหรับเลือก TTS provider
│       │   ├── ApiKeyGate.jsx          ← หน้ากรอก/ยืนยัน Control Panel API key (เก็บใน sessionStorage)
│       │   ├── ControlPanel.jsx        ← Dashboard หลัก (lazy loaded), รวม tab ต่าง ๆ
│       │   ├── ThemeToggle.jsx         ← สลับ light/dark theme
│       │   ├── ErrorBoundary.jsx
│       │   ├── tabs/                   ← แท็บย่อยของ Control Panel
│       │   │   ├── LLMConfigTab.jsx        ← สลับ LLM provider, ปรับ temperature/top_p/num_predict, ทดสอบ provider
│       │   │   ├── TTSConfigTab.jsx        ← สลับ TTS provider
│       │   │   ├── VoiceConversionTab.jsx  ← เปิด/ปิด RVC, ปรับ pitch/indexRate
│       │   │   ├── MemoryTab.jsx           ← ดู memory stats, สั่ง consolidate/decay manual
│       │   │   └── SystemStatusTab.jsx     ← เช็คสถานะ Ollama/health, audit log
│       │   └── ui/                     ← shared UI primitives (Banner, ConfigSlider, ConfigToggle, ResetButton, Skeleton)
│       ├── contexts/
│       │   ├── TTSProviderContext.jsx  ← state ของ TTS provider ที่เลือกอยู่ (แชร์ทั้งแอป)
│       │   └── UIContext.jsx           ← modal/confirm dialogs ที่ใช้ร่วมกัน (showConfirm)
│       ├── hooks/
│       │   └── useChat.js              ← Central state hook: messages, emotions, volume, game state, audio, socket connection
│       ├── services/
│       │   └── api.js                  ← axios instance (inject x-api-key อัตโนมัติจาก sessionStorage, normalize error, handle 401) + socket.io-client instance
│       ├── lib/
│       │   └── utils.js                ← helper ทั่วไป (เช่น cn() สำหรับ clsx + tailwind-merge)
│       └── utils/
│           ├── audioAnalyser.js    ← Web Audio API: volume detection สำหรับ lip-sync
│           └── audioRecorder.js    ← MediaRecorder wrapper สำหรับ voice input
```

> หมายเหตุ: โฟลเดอร์ `audio/`, `uploads/`, ไฟล์โมเดล RVC (`*.pth`, `*.index`) และไฟล์ `.env` ถูก gitignore ไว้ทั้งหมด — จะไม่ปรากฏใน repo แต่ถูกสร้าง/ใช้งานตอน runtime

---

## 🧠 Memory Architecture

ระบบความทรงจำแบบ 3-tier (PostgreSQL + pgvector):

| Tier | Table | Description |
|------|-------|-------------|
| **Episodic** | `sessions`, `messages` | บันทึกบทสนทนาทุก turn พร้อม embedding (bge-m3, 1024 dim) |
| **Semantic** | `semantic_facts` (+ `semantic_facts_archive`) | ข้อเท็จจริงที่สกัดจาก episodes ด้วย LLM, มี `importance_score`, `confidence`, `memory_type`, supersede mechanism |
| **Reflective** | `reflective_summary` | สรุปภาพรวมความสัมพันธ์ Ken-Syn ทุกครั้งหลัง consolidation |

ตารางเสริม: `memory_retrieval_log` (audit การ retrieve), `quota_tracking` (เผื่อ TTS provider ที่มี quota), `system_config` + `config_change_log` (Control Panel settings + audit trail)

**Retrieval Flow:** per-message → hybrid search (cosine similarity + re-rank by importance + recency) → inject ใน system prompt ผ่าน `buildMemoryContext()`

**Consolidation:** trigger หลัง session reset (fire-and-forget) + cron 3AM daily (เว้นแต่ปิดผ่าน config `memory.autoConsolidation`)

**Decay:** cron ทุก Sunday 4AM — ลด importance score ของ facts ที่ไม่ถูกเข้าถึงนาน, archive ที่คะแนนต่ำมาก

ทั้งสอง worker เรียกได้ manual ผ่าน `POST /api/memory/consolidate` และ `/api/memory/decay` (ต้อง auth) หรือดูสถิติผ่าน `GET /api/memory/stats`

---

## 🎭 Emotion System

AI ตอบกลับเป็น JSON `{ reply: string, emotion: string }` เสมอ (parse โดย LLM provider layer เช่น `ollamaProvider.js`)

Emotions ที่รองรับ:
```
neutral | happy | embarrassed | sad | angry | thinking | surprised | laugh | annoyed
```

Emotion → Live2D motion mapping ผ่าน logic ใน `AvatarCanvas.jsx` พร้อม fallback chain

---

## 🔊 TTS & Realtime Delivery Pipeline

```
POST /api/chat
  → ollamaService.chat() (ผ่าน llmManager) → ตอบ { reply, emotion, ttsJobId } ทันทีทาง REST (audioUrl: null)
  → [background] TTSManager.generate()
        → currentProvider.synthesize()   (gtts / piper)
        → [optional] voiceConversionService.convert()  (RVC sidecar server ผ่าน HTTP)
        → audioFilename → serve ผ่าน /audio/{filename}
  → Socket.IO emit 'tts:done' { ttsJobId, audioUrl }  หรือ 'tts:error' ถ้าล้มเหลว
```

Fallback: primary TTS provider ล้มเหลว → gTTS เสมอ (ยกเว้น provider ปัจจุบันคือ gTTS อยู่แล้ว)

Frontend เชื่อม Socket.IO ผ่าน `services/api.js` (`socket` instance) และฟัง event เพื่ออัปเดต audio เมื่อ TTS เสร็จ — คำตอบข้อความและเสียงจึงมาไม่พร้อมกัน (text-first UX)

---

## 🤖 LLM Provider Abstraction (Control Panel)

`services/llm/index.js` (LLMManager) เป็น singleton ที่:
- โหลด provider ที่เคย switch ไว้จาก DB (`system_config` key `llm.currentProvider`) ตอน server boot
- รองรับสลับ provider runtime ผ่าน `POST /api/llm/switch` (ต้อง `x-api-key`), มี rate limit 3 วินาทีต่อการ switch
- ปัจจุบันมี provider เดียว: `ollama` (`llmFactory.js`) — เผื่อโครงสร้างสำหรับเพิ่ม cloud provider ในอนาคต
- มี fallback ตอบข้อความปลอดภัย (`"ขอโทษนะพ่อ ตอนนี้ซินมึนๆ..."`, emotion `sad`) เมื่อทุก provider ล้มเหลว

`services/tts/index.js` (TTSManager) มีโครงสร้างคล้ายกันสำหรับ TTS provider (`gtts`, `piper`)

ทั้งสองระบบ config ผ่าน `configService.js` ซึ่งอ่าน/เขียนตาราง `system_config` (cache ใน memory) และบันทึกทุกการเปลี่ยนแปลงลง `config_change_log` (audit log) — ดูได้ผ่าน `GET /api/config/audit-log` หรือ `/api/config/history/:key`

---

## 🔐 Control Panel Authentication

- Route ที่ mutate state (switch provider, ปรับ voice conversion, สั่ง consolidate/decay, ฯลฯ) ต้องผ่าน `middleware/apiKeyAuth.js`
- ตรวจ header `x-api-key` เทียบกับ `CONTROL_PANEL_API_KEY` ใน `.env` ด้วย `crypto.timingSafeEqual`
- **Fail-closed**: ถ้าไม่ได้ตั้งค่า `CONTROL_PANEL_API_KEY` ไว้ ระบบจะปฏิเสธ request auth ทั้งหมด (503) แทนที่จะเปิดโล่ง
- ฝั่ง frontend เก็บ key ไว้ใน `sessionStorage` (`synthenia_api_key`) ผ่าน `ApiKeyGate.jsx` และ inject อัตโนมัติทุก request โดย axios interceptor ใน `api.js`

---

## ⚙️ Environment Variables (backend/.env)

| Variable | Description |
|----------|-------------|
| `PORT` | Express server port (default: 4040) |
| `AI_MODEL` | Ollama model name (e.g., `gemma4:12b`) |
| `Ollama_BaseURL` | Ollama base URL |
| `Ollama_Port` | Ollama port |
| `LLM_PROVIDER` | Default LLM provider key (ปัจจุบันมีแค่ `ollama`) |
| `TTS_PROVIDER` | Default TTS provider key (`gtts` / `piper`) |
| `CONTROL_PANEL_API_KEY` | ⚠️ Secret — key สำหรับ auth Control Panel mutating routes |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | PostgreSQL connection |
| `VOICE_CONVERSION_ENABLED` | เปิด/ปิด RVC pipeline (ค่า default ก่อนถูก override จาก DB config) |
| `VOICE_CONVERSION_PITCH` | Pitch shift (semitones) |
| `VOICE_CONVERSION_INDEX_RATE` | RVC index rate (0.0–1.0) |
| `RVC_SERVER_PORT/URL` | RVC sidecar server |
| `EXAMPLE_ENABLE` | `"true"` เพื่อรวม `prompts/examples.md` เข้าไปใน system prompt |

> ค่า runtime หลายตัว (LLM/TTS provider, voice conversion, memory auto-consolidation) จะถูก override โดยค่าที่บันทึกไว้ใน `system_config` table ถ้ามี — `.env` เป็นเพียงค่าเริ่มต้นก่อนมีการตั้งค่าผ่าน Control Panel

frontend ใช้ `VITE_API_URL` (optional) เพื่อกำหนด backend URL — ถ้าไม่ตั้งจะ default ไปที่ `http://localhost:4040/api` (และ WebSocket ที่ `http://localhost:4040`)

---

## 📏 Coding Conventions

### ทั่วไป
- ใช้ **CommonJS** (`require/module.exports`) ฝั่ง backend
- ใช้ **ES Modules** (`import/export`) ฝั่ง frontend
- ทุก service สำคัญ export เป็น **singleton instance** (`module.exports = new ClassName()`)
- ตั้งชื่อไฟล์: `camelCase` สำหรับ JS, `PascalCase` สำหรับ React components

### Backend
- Route handler ต้องใช้ `try/catch` ทุก async operation
- Error response ต้องส่ง HTTP status code ที่เหมาะสม (400 สำหรับ input invalid, 401/503 สำหรับ auth, 500 สำหรับ server error)
- ตรวจสอบ input ใน route layer ก่อนส่งต่อ service
- Log message ใช้ prefix `[ServiceName]` เช่น `[TTS Manager]`, `[LLM Manager]`, `[Memory Consolidation]`
- ห้าม crash server เพราะ TTS/memory/LLM error — ใช้ fallback หรือ fail silently (LLM มี safe-fallback reply, TTS fallback ไป gTTS)
- Route ที่ mutate runtime config หรือ trigger งานหนัก (consolidate/decay/switch provider) **ต้องผ่าน `apiKeyAuth` middleware**
- ทุกการเปลี่ยนแปลง config ผ่าน `configService.set()`/`delete()` เพื่อให้มี audit log อัตโนมัติ — ห้าม query `system_config` ตรง ๆ เพื่อเขียนค่า

### Frontend
- State หลักของ chat อยู่ใน `useChat.js` hook — ห้ามสร้าง global state ใหม่โดยไม่จำเป็น (ใช้ Context สำหรับ state ที่ต้องแชร์ข้าม component เช่น `TTSProviderContext`, `UIContext`)
- Audio playback จัดการผ่าน analyser utility เพื่อรองรับ lip-sync เท่านั้น — ห้าม `new Audio()` เล่นตรง ๆ ที่อื่น
- Component หนักๆ ที่ไม่จำเป็นตอน initial load (`AvatarCanvas`, `ControlPanel`) ใช้ `React.lazy` — เพิ่ม component ใหม่ในกลุ่มนี้ควร lazy-load เช่นกัน
- Inline style/className ใช้ Tailwind v4 utility + CSS variables (ธีม) แทนค่า hard-coded
- ทุก API call ผ่าน `services/api.js` axios instance เท่านั้น (มี interceptor จัดการ auth header และ error normalization ให้แล้ว) — ห้ามสร้าง axios instance ใหม่แยก

### Database
- ทุก query ผ่าน `pool.js` wrapper (`query(text, params)`)
- ห้ามใช้ raw SQL string interpolation — ใช้ parameterized queries (`$1`, `$2`) เสมอ
- Schema migration หลักอยู่ใน `db/init.js`; migration เสริม (เช่น เพิ่ม column) แยกเป็นไฟล์ในโฟลเดอร์ `db/` เช่น `migrate_memory_type.js` — รันแยกต่างหาก ไม่ได้รันทุกครั้งที่ server start

### LLM/TTS Providers
- LLM provider ต้อง extend `baseLLMProvider.js` และ implement `async chat(messages, options): Promise<{ reply, emotion }>` — ลงทะเบียนใน `llmFactory.js`
- TTS provider ต้อง extend `baseProvider.js` และ implement `async synthesize(text): Promise<string>` — return **filename** (ไม่ใช่ full path) ของไฟล์เสียงใน `audio/` directory — ลงทะเบียนใน `ttsFactory.js`
- Provider ใหม่ต้องอัปเดต UI ที่เกี่ยวข้องด้วย (`LLMConfigTab.jsx` / `TTSConfigTab.jsx` / `TTSProviderSelector.jsx`)

---

## 🚫 Rules for Agents

1. **ห้าม commit `.env`** ขึ้น git ไม่ว่ากรณีใด
2. **ห้ามแก้ไข `db/init.js` migration** โดยไม่ระวัง — การเปลี่ยน schema ต้องทำ migration เพิ่มเติมเป็นไฟล์แยก (ดูตัวอย่าง `migrate_memory_type.js`)
3. **อย่า hardcode API keys** หรือ credentials ในโค้ด
4. **ห้ามเพิ่ม `console.log` debug ชั่วคราว** โดยไม่มี comment บอกว่าจะลบ
5. เมื่อเพิ่ม LLM หรือ TTS provider ใหม่ ต้องอัปเดตทั้ง factory (`llmFactory.js`/`ttsFactory.js`) และ UI selector ที่เกี่ยวข้องในฝั่ง frontend
6. **อย่าแก้ system prompt** (.md files ใน `prompts/`) โดยพลการ — กระทบบุคลิกของ Syn โดยตรง หากจำเป็นควรอ้างอิง `character_benchmark.js` เป็นเกณฑ์
7. เมื่อแก้ไข memory pipeline ต้องทดสอบ consolidation flow ด้วย session ที่มี messages >= 4 (เงื่อนไขที่ query สถิติใช้)
8. **Conversation history** ใน `ollamaService.js` จำกัดที่ **21 messages** (system + 20 last) — ห้ามเพิ่มโดยไม่วัด RAM/latency impact
9. ทุก async function ใน backend ต้อง handle error และไม่ throw ขึ้นไปถึง Express default handler (ยกเว้น intentional)
10. ไฟล์เสียงใน `audio/` มี cron cleanup อัตโนมัติทุกวันตอน 02:00 (ลบไฟล์เก่ากว่า 24 ชม.) — แต่ถ้าปิด/ลบ scheduler ต้องระวัง disk space เอง
11. **Route ที่ mutate runtime config หรือ trigger งานหนัก ต้องมี `apiKeyAuth` middleware เสมอ** — อย่าลืมเพิ่มเมื่อสร้าง route ใหม่ในหมวด Control Panel
12. เมื่อแก้ logic ที่เกี่ยวกับ TTS delivery ต้องคำนึงว่า response ของ `/api/chat` และ `/api/game/move` ส่ง `audioUrl: null` เสมอ แล้วค่อยส่ง audio จริงทาง Socket.IO event `tts:done`/`tts:error` — อย่าเปลี่ยนเป็น synchronous โดยไม่แก้ frontend ให้สอดคล้องกัน