# Graph Report - Synthenia  (2026-07-28)

## Corpus Check
- 175 files · ~161,252 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1675 nodes · 2386 edges · 120 communities (86 shown, 34 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `54f063c4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- B
- ae
- ollamaService.js
- v
- dependencies
- package.json
- S
- compress.py
- ax
- compress.py
- ac
- aa
- validate.py
- chat.js
- Y
- validate.py
- index.js
- c
- live2d.min.js
- l
- W
- config.js
- App.jsx
- U
- package.json
- G
- llm.js
- gttsProvider.js
- ollamaProvider.js
- api.js
- index.js
- index.js
- .init
- security.test.js
- react
- MemoryTab.jsx
- gameCommentaryService.js
- ConsolidationWorker
- memoryRetrievalService.js
- UIContext.jsx
- VoiceConversionTab.jsx
- TTSProviderContext.jsx
- securityConfig.js
- pool.js
- ._$P7
- configService.js
- TTSManager
- scheduler.js
- rateLimits.js
- memory.js
- tts.js
- memoryWriteService.js
- rvc_server.py
- .oxlintrc.json
- ControlPanel.jsx
- ConfigService
- test_rvc.js
- AudioRecorder
- embeddingService.js
- sttService.js
- VoiceConversionService
- AudioAnalyser
- consolidationWorker.js
- an
- ar
- init.js
- compilerOptions
- setup_whisper.py
- health.js
- d
- N
- Banner.jsx
- vite.config.js
- __init__.py
- __init__.py
- ae
- AGENTS.md — Synthenia Project
- SKILL.md
- Caveman Help
- SKILL.md
- Caveman Help
- Sol to Luna Handoff — Phase 1
- Caveman Compress
- SKILL.md
- X
- Caveman Compress
- SKILL.md
- caveman-commit
- caveman-review
- ao
- caveman-commit
- caveman-review
- Luna Blocker Handoff — Phase 1
- ah
- caveman-stats
- caveman-stats
- Synthenia Update Log
- Q: Graphify ทำงานถูกต้องไหม และอ่านง่ายขึ้นแค่ไหนเมื่อเทียบกับปกติ
- aq
- React + Vite
- Lifecycle Status
- AvatarCanvas.jsx
- AGENTS.md
- emotion_input.md
- README.md

## God Nodes (most connected - your core abstractions)
1. `Y()` - 43 edges
2. `aa()` - 40 edges
3. `B()` - 30 edges
4. `c()` - 28 edges
5. `react` - 23 edges
6. `ae()` - 22 edges
7. `k()` - 22 edges
8. `ax()` - 21 edges
9. `S()` - 18 edges
10. `W()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `ChatInput()` --indirect_call--> `e()`  [INFERRED]
  frontend/src/components/ChatInput.jsx → frontend/public/vendor/live2d.min.js
- `ControlPanel()` --indirect_call--> `e()`  [INFERRED]
  frontend/src/components/ControlPanel.jsx → frontend/public/vendor/live2d.min.js
- `useChat()` --indirect_call--> `e()`  [INFERRED]
  frontend/src/hooks/useChat.js → frontend/public/vendor/live2d.min.js
- `ChatInput()` --calls--> `useUI()`  [EXTRACTED]
  frontend/src/components/ChatInput.jsx → frontend/src/contexts/UIContext.jsx
- `LLMConfigTab()` --calls--> `useUI()`  [EXTRACTED]
  frontend/src/components/tabs/LLMConfigTab.jsx → frontend/src/contexts/UIContext.jsx

## Import Cycles
- None detected.

## Communities (120 total, 34 thin omitted)

### Community 0 - "B"
Cohesion: 0.06
Nodes (4): a(), ab(), B(), e()

### Community 2 - "ollamaService.js"
Cohesion: 0.06
Nodes (42): ALL_EMOTIONS, autoChecks(), { buildSystemPrompt }, { CHARACTER_BENCHMARK }, client, countSentences(), escapeMarkdownTable(), fs (+34 more)

### Community 4 - "dependencies"
Cohesion: 0.05
Nodes (40): clsx, dependencies, axios, clsx, pixi.js, pixi-live2d-display, react-dom, socket.io-client (+32 more)

### Community 5 - "package.json"
Cohesion: 0.05
Nodes (36): author, dependencies, axios, cors, dotenv, express, multer, node-cron (+28 more)

### Community 7 - "compress.py"
Cohesion: 0.07
Nodes (49): benchmark_pair(), count_tokens(), main(), print_table(), Path, main(), print_usage(), backup_dir_for() (+41 more)

### Community 9 - "compress.py"
Cohesion: 0.07
Nodes (49): benchmark_pair(), count_tokens(), main(), print_table(), Path, main(), print_usage(), backup_dir_for() (+41 more)

### Community 10 - "ac"
Cohesion: 0.09
Nodes (3): ac(), am(), au()

### Community 12 - "validate.py"
Cohesion: 0.06
Nodes (50): visionConfig, assertExactKeys(), buildPromptSegment(), config, fail(), findProhibitedKey(), getImageDimensions(), normalizeObservation() (+42 more)

### Community 13 - "chat.js"
Cohesion: 0.08
Nodes (23): { chatLimit, sttLimit }, consolidationWorker, crypto, embeddingService, { EMOTION_VALUES }, express, fs, gameCommentaryService (+15 more)

### Community 15 - "validate.py"
Cohesion: 0.16
Nodes (10): createVisionError(), ERROR_DEFINITIONS, isVisionMode(), normalizeVisionError(), normalizeVisionState(), VISION_MODES, VISION_STATUSES, AdaptiveCaptureController (+2 more)

### Community 16 - "index.js"
Cohesion: 0.08
Nodes (21): app, audioDir, chatRoutes, configRoutes, cors, express, fs, healthRoutes (+13 more)

### Community 18 - "live2d.min.js"
Cohesion: 0.07
Nodes (8): ai(), ak(), at(), d(), I(), J(), N(), z()

### Community 21 - "config.js"
Cohesion: 0.13
Nodes (14): apiKeyAuth(), crypto, safeCompare(), apiKeyAuth, { adminAuth }, apiKeyAuth, configService, express (+6 more)

### Community 22 - "App.jsx"
Cohesion: 0.26
Nodes (8): AvatarCanvas, ControlPanel, ApiKeyGate(), GameBoard(), ThemeToggle(), TTSProviderSelector, verifyApiKey(), react

### Community 23 - "U"
Cohesion: 0.18
Nodes (3): af(), h(), U()

### Community 24 - "package.json"
Cohesion: 0.12
Nodes (15): @claude-flow/cli, ruflo, author, description, devDependencies, @claude-flow/cli, ruflo, keywords (+7 more)

### Community 26 - "llm.js"
Cohesion: 0.08
Nodes (20): { availableProviders }, configuredProvider, modelByProvider, expensiveLimit, apiKeyAuth, { expensiveLimit }, express, llmManager (+12 more)

### Community 27 - "gttsProvider.js"
Cohesion: 0.13
Nodes (9): BaseProvider, BaseProvider, GTTSProvider, path, { spawn }, BaseProvider, path, PiperProvider (+1 more)

### Community 28 - "ollamaProvider.js"
Cohesion: 0.14
Nodes (7): BaseLLMProvider, BaseLLMProvider, { Ollama }, OllamaProvider, assert, BaseLLMProvider, test

### Community 29 - "api.js"
Cohesion: 0.31
Nodes (10): react, App(), useUI(), useChat(), getChatStatus(), resetChat(), sendGameMove(), sendMessage() (+2 more)

### Community 30 - "index.js"
Cohesion: 0.12
Nodes (12): { availableProviders }, configuredProvider, configService, { createTTSProvider, availableProviders }, currentProviderInstance, ttsConfig, TTSManager, voiceConversionService (+4 more)

### Community 31 - "index.js"
Cohesion: 0.07
Nodes (27): Acceptance Criteria, Approval Record, Approved Stabilization Exception and Completion Gate, Assumptions, Baseline stabilization, Confirmed facts, Confirmed Functional Requirements, Constraints (+19 more)

### Community 34 - "security.test.js"
Cohesion: 0.18
Nodes (6): crypto, errorHandler(), notFound(), requestId(), assert, test

### Community 35 - "react"
Cohesion: 0.16
Nodes (7): ChatInput(), formatDuration(), ChatWindow(), MessageBubble, AudioRecorder, EMOTION_OPTIONS, getEmotionEmoji()

### Community 36 - "MemoryTab.jsx"
Cohesion: 0.20
Nodes (12): MemoryTab(), SystemStatusTab(), TTSConfigTab(), api, getAuditLog(), getMemoryStats(), getOllamaHealth(), socket (+4 more)

### Community 37 - "gameCommentaryService.js"
Cohesion: 0.22
Nodes (4): GameCommentaryService, gameService, llmManager, GameService

### Community 39 - "memoryRetrievalService.js"
Cohesion: 0.18
Nodes (7): embeddingService, MemoryRetrievalService, { query }, assert, consolidationWorker, memoryRetrievalService, test

### Community 40 - "UIContext.jsx"
Cohesion: 0.22
Nodes (3): ErrorBoundary, UIContext, UIProvider()

### Community 41 - "VoiceConversionTab.jsx"
Cohesion: 0.28
Nodes (9): LLMConfigTab(), VoiceConversionTab(), ConfigSlider(), ConfigToggle(), previewTTS(), resetConfigKey(), testLLMProvider(), updateLLMConfig() (+1 more)

### Community 42 - "TTSProviderContext.jsx"
Cohesion: 0.43
Nodes (6): TTSProviderContext, TTSProviderContextProvider(), useTTSProvider(), getTTSCurrentProvider(), getTTSProvidersList(), switchTTSProvider()

### Community 43 - "securityConfig.js"
Cohesion: 0.20
Nodes (7): allowedOrigins, host, mode, getIO(), initWebSocket(), securityConfig, { Server }

### Community 44 - "pool.js"
Cohesion: 0.24
Nodes (4): { query, pool }, { Pool }, DecayWorker, { query, pool }

### Community 46 - "configService.js"
Cohesion: 0.18
Nodes (6): axios, configService, fs, path, { spawn }, VoiceConversionService

### Community 47 - "TTSManager"
Cohesion: 0.08
Nodes (25): Animation command v1, Approved Product Decisions, Architectural boundaries, Capture metadata v1, Compatibility and Migration, Core Contracts, Current Architecture, Global Recovery Strategy (+17 more)

### Community 48 - "scheduler.js"
Cohesion: 0.20
Nodes (9): startServer(), configService, consolidationWorker, cron, decayWorker, fs, initScheduler(), path (+1 more)

### Community 49 - "rateLimits.js"
Cohesion: 0.25
Nodes (5): audioSlots, buckets, chatLimit, chatSlots, sttLimit

### Community 50 - "memory.js"
Cohesion: 0.25
Nodes (7): { adminAuth }, apiKeyAuth, consolidationWorker, decayWorker, express, { query }, router

### Community 51 - "tts.js"
Cohesion: 0.25
Nodes (7): apiKeyAuth, { createTTSProvider }, { expensiveLimit }, express, router, ttsManager, voiceConversionService

### Community 52 - "memoryWriteService.js"
Cohesion: 0.29
Nodes (3): embeddingService, MemoryWriteService, { query }

### Community 53 - "rvc_server.py"
Cohesion: 0.29
Nodes (3): convert(), ConvertRequest, BaseModel

### Community 54 - ".oxlintrc.json"
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

### Community 55 - "ControlPanel.jsx"
Cohesion: 0.29
Nodes (7): ControlPanel(), LLMConfigTab, MemoryTab, SystemStatusTab, TTSConfigTab, VoiceConversionTab, getConfig()

### Community 57 - "test_rvc.js"
Cohesion: 0.33
Nodes (6): axios, fs, path, runTest(), voiceConversionService, wait()

### Community 58 - "AudioRecorder"
Cohesion: 0.09
Nodes (20): Before / After, Benchmarks, How It Work, <img src="../../docs/assets/dancing-rock.svg" width="20" height="20" alt="rock"/> Caveman (285 tokens), Install, 📄 Original (706 tokens), Part of Caveman, Security (+12 more)

### Community 59 - "embeddingService.js"
Cohesion: 0.33
Nodes (3): EmbeddingService, { Ollama }, ollamaClient

### Community 60 - "sttService.js"
Cohesion: 0.33
Nodes (4): fs, path, { spawn }, STTService

### Community 61 - "VoiceConversionService"
Cohesion: 0.09
Nodes (20): Before / After, Benchmarks, How It Work, <img src="../../docs/assets/dancing-rock.svg" width="20" height="20" alt="rock"/> Caveman (285 tokens), Install, 📄 Original (706 tokens), Part of Caveman, Security (+12 more)

### Community 63 - "consolidationWorker.js"
Cohesion: 0.40
Nodes (4): embeddingService, { Ollama }, ollamaClient, { query, pool }

### Community 68 - "compilerOptions"
Cohesion: 0.50
Nodes (3): compilerOptions, baseUrl, paths

### Community 71 - "d"
Cohesion: 0.10
Nodes (20): Architecture Facts, Avatar flow, Baseline Assessment, Discovery Limitations, Executive Assessment, Findings and Priorities, Live2D Research Notes, P0 — Repair double-encoded Thai in the checkpointed changes (+12 more)

### Community 72 - "N"
Cohesion: 0.10
Nodes (20): 3-Tier Model Routing, After Success, Agent Comms (SendMessage-First Coordination), Agent Routing, Agents, Background Workers, Before Any Task, Build & Test (+12 more)

### Community 83 - "AGENTS.md — Synthenia Project"
Cohesion: 0.12
Nodes (16): AGENTS.md — Synthenia Project, Backend, 📏 Coding Conventions, 🔐 Control Panel Authentication, Database, 🎭 Emotion System, ⚙️ Environment Variables (backend/.env), Frontend (+8 more)

### Community 84 - "SKILL.md"
Cohesion: 0.14
Nodes (12): cavecrew, Example chaining, How to invoke, Model overrides, See also, What it does, Auto-clarity (inherited), Chaining patterns (+4 more)

### Community 85 - "Caveman Help"
Cohesion: 0.14
Nodes (12): caveman-help, Example output, How to invoke, See also, What it does, Caveman Help, Configure Default Mode, Deactivate (+4 more)

### Community 86 - "SKILL.md"
Cohesion: 0.14
Nodes (12): cavecrew, Example chaining, How to invoke, Model overrides, See also, What it does, Auto-clarity (inherited), Chaining patterns (+4 more)

### Community 87 - "Caveman Help"
Cohesion: 0.14
Nodes (12): caveman-help, Example output, How to invoke, See also, What it does, Caveman Help, Configure Default Mode, Deactivate (+4 more)

### Community 88 - "Sol to Luna Handoff — Phase 1"
Cohesion: 0.17
Nodes (11): Completion Checklist, Exact Scope, Prohibited Changes, Read First, Required Backend Behavior, Required Constants and Contracts, Required Frontend Behavior, Risks and Assumptions (+3 more)

### Community 89 - "Caveman Compress"
Cohesion: 0.17
Nodes (11): Boundaries, Caveman Compress, Compress, Compression Rules, Pattern, Preserve EXACTLY (never modify), Preserve Structure, Process (+3 more)

### Community 90 - "SKILL.md"
Cohesion: 0.17
Nodes (10): caveman, Example output, How to invoke, See also, What it does, Auto-Clarity, Boundaries, Intensity (+2 more)

### Community 92 - "Caveman Compress"
Cohesion: 0.17
Nodes (11): Boundaries, Caveman Compress, Compress, Compression Rules, Pattern, Preserve EXACTLY (never modify), Preserve Structure, Process (+3 more)

### Community 93 - "SKILL.md"
Cohesion: 0.17
Nodes (10): caveman, Example output, How to invoke, See also, What it does, Auto-Clarity, Boundaries, Intensity (+2 more)

### Community 94 - "caveman-commit"
Cohesion: 0.18
Nodes (9): caveman-commit, Example output, How to invoke, See also, What it does, Auto-Clarity, Boundaries, Examples (+1 more)

### Community 95 - "caveman-review"
Cohesion: 0.18
Nodes (9): caveman-review, Example output, How to invoke, See also, What it does, Auto-Clarity, Boundaries, Examples (+1 more)

### Community 98 - "caveman-commit"
Cohesion: 0.18
Nodes (9): caveman-commit, Example output, How to invoke, See also, What it does, Auto-Clarity, Boundaries, Examples (+1 more)

### Community 99 - "caveman-review"
Cohesion: 0.18
Nodes (9): caveman-review, Example output, How to invoke, See also, What it does, Auto-Clarity, Boundaries, Examples (+1 more)

### Community 100 - "Luna Blocker Handoff — Phase 1"
Cohesion: 0.20
Nodes (9): Attempted Safe Resolutions, Command, Completed Work, Decision or External State Required, Exact Blocker, Files Changed, Incomplete Work, Luna Blocker Handoff — Phase 1 (+1 more)

### Community 102 - "caveman-stats"
Cohesion: 0.29
Nodes (5): caveman-stats, Example output, How to invoke, See also, What it does

### Community 103 - "caveman-stats"
Cohesion: 0.29
Nodes (5): caveman-stats, Example output, How to invoke, See also, What it does

### Community 104 - "Synthenia Update Log"
Cohesion: 0.29
Nodes (6): 2026-07-28 — Discovery and requirements v1, 2026-07-28 — Luna Phase 1 execution blocker, 2026-07-28 — Requirements approval and planning v1, 2026-07-28 — Root coordination and checkpoint, 2026-07-28 — User-authorized Luna retry, Synthenia Update Log

### Community 105 - "Q: Graphify ทำงานถูกต้องไหม และอ่านง่ายขึ้นแค่ไหนเมื่อเทียบกับปกติ"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Graphify ทำงานถูกต้องไหม และอ่านง่ายขึ้นแค่ไหนเมื่อเทียบกับปกติ, Source Nodes

### Community 107 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + Vite

## Knowledge Gaps
- **556 isolated node(s):** `name`, `version`, `description`, `main`, `test` (+551 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `e()` connect `B` to `._$nP`, `react`, `live2d.min.js`, `ControlPanel.jsx`, `api.js`, `AudioAnalyser`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `useChat()` connect `api.js` to `B`, `App.jsx`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `ae()` connect `ae` to `._$nP`, `live2d.min.js`, `W`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _556 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `B` be split into smaller, more focused modules?**
  _Cohesion score 0.05547785547785548 - nodes in this community are weakly interconnected._
- **Should `ollamaService.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06352941176470588 - nodes in this community are weakly interconnected._
- **Should `v` be split into smaller, more focused modules?**
  _Cohesion score 0.09956709956709957 - nodes in this community are weakly interconnected._