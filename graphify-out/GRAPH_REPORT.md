# Graph Report - D:\Synthenia  (2026-07-20)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1199 nodes · 1836 edges · 82 communities (54 shown, 28 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e52cec4f`
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
- a
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
- `TTSConfigTab()` --calls--> `getMemoryStats()`  [EXTRACTED]
  frontend/src/components/tabs/TTSConfigTab.jsx → frontend/src/services/api.js
- `compress_file()` --calls--> `validate()`  [EXTRACTED]
  .agents/skills/caveman-compress/scripts/compress.py → .agents/skills/caveman-compress/scripts/validate.py

## Import Cycles
- None detected.

## Communities (82 total, 28 thin omitted)

### Community 0 - "B"
Cohesion: 0.06
Nodes (3): ab(), B(), e()

### Community 2 - "ollamaService.js"
Cohesion: 0.07
Nodes (40): ALL_EMOTIONS, autoChecks(), { buildSystemPrompt }, { CHARACTER_BENCHMARK }, client, countSentences(), escapeMarkdownTable(), fs (+32 more)

### Community 3 - "v"
Cohesion: 0.05
Nodes (4): ah(), ao(), M(), v()

### Community 4 - "dependencies"
Cohesion: 0.05
Nodes (39): clsx, dependencies, axios, clsx, pixi.js, pixi-live2d-display, react-dom, socket.io-client (+31 more)

### Community 5 - "package.json"
Cohesion: 0.05
Nodes (36): author, dependencies, axios, cors, dotenv, express, multer, node-cron (+28 more)

### Community 6 - "S"
Cohesion: 0.06
Nodes (3): aq(), S(), X()

### Community 7 - "compress.py"
Cohesion: 0.12
Nodes (27): main(), print_usage(), backup_dir_for(), build_compress_prompt(), build_fix_prompt(), call_claude(), compress_file(), is_sensitive_path() (+19 more)

### Community 9 - "compress.py"
Cohesion: 0.12
Nodes (27): main(), print_usage(), backup_dir_for(), build_compress_prompt(), build_fix_prompt(), call_claude(), compress_file(), is_sensitive_path() (+19 more)

### Community 10 - "ac"
Cohesion: 0.09
Nodes (3): ac(), am(), au()

### Community 12 - "validate.py"
Cohesion: 0.16
Nodes (22): benchmark_pair(), count_tokens(), main(), print_table(), Path, count_bullets(), extract_code_blocks(), extract_headings() (+14 more)

### Community 13 - "chat.js"
Cohesion: 0.08
Nodes (25): EMOTION_LABELS_TH, EMOTION_VALUES, { chatLimit, sttLimit }, consolidationWorker, crypto, embeddingService, { EMOTION_VALUES }, express (+17 more)

### Community 15 - "validate.py"
Cohesion: 0.16
Nodes (22): benchmark_pair(), count_tokens(), main(), print_table(), Path, count_bullets(), extract_code_blocks(), extract_headings() (+14 more)

### Community 16 - "index.js"
Cohesion: 0.08
Nodes (23): app, audioDir, chatRoutes, configRoutes, cors, express, fs, healthRoutes (+15 more)

### Community 18 - "live2d.min.js"
Cohesion: 0.09
Nodes (6): ai(), ak(), at(), I(), J(), z()

### Community 21 - "config.js"
Cohesion: 0.13
Nodes (14): apiKeyAuth(), crypto, safeCompare(), apiKeyAuth, { adminAuth }, apiKeyAuth, configService, express (+6 more)

### Community 22 - "App.jsx"
Cohesion: 0.18
Nodes (12): react, App(), AvatarCanvas, ControlPanel, ApiKeyGate(), ChatInput(), formatDuration(), GameBoard() (+4 more)

### Community 23 - "U"
Cohesion: 0.18
Nodes (3): af(), h(), U()

### Community 24 - "package.json"
Cohesion: 0.12
Nodes (15): @claude-flow/cli, ruflo, author, description, devDependencies, @claude-flow/cli, ruflo, keywords (+7 more)

### Community 26 - "llm.js"
Cohesion: 0.14
Nodes (12): { availableProviders }, configuredProvider, modelByProvider, expensiveLimit, apiKeyAuth, { expensiveLimit }, express, llmManager (+4 more)

### Community 27 - "gttsProvider.js"
Cohesion: 0.13
Nodes (9): BaseProvider, BaseProvider, GTTSProvider, path, { spawn }, BaseProvider, path, PiperProvider (+1 more)

### Community 28 - "ollamaProvider.js"
Cohesion: 0.14
Nodes (7): BaseLLMProvider, BaseLLMProvider, { Ollama }, OllamaProvider, assert, BaseLLMProvider, test

### Community 29 - "api.js"
Cohesion: 0.26
Nodes (9): useChat(), api, getChatStatus(), resetChat(), sendGameMove(), sendMessage(), socket, transcribeAudio() (+1 more)

### Community 30 - "index.js"
Cohesion: 0.17
Nodes (10): { availableProviders }, configuredProvider, configService, { createTTSProvider, availableProviders }, currentProviderInstance, ttsConfig, voiceConversionService, GTTSProvider (+2 more)

### Community 31 - "index.js"
Cohesion: 0.18
Nodes (6): configService, { createLLMProvider, availableProviders }, currentProviderInstance, llmConfig, LLMManager, createLLMProvider()

### Community 34 - "security.test.js"
Cohesion: 0.18
Nodes (6): crypto, errorHandler(), notFound(), requestId(), assert, test

### Community 35 - "react"
Cohesion: 0.23
Nodes (7): AvatarCanvas(), fitModelToCanvas(), ChatWindow(), MessageBubble, EMOTION_OPTIONS, getEmotionEmoji(), react

### Community 36 - "MemoryTab.jsx"
Cohesion: 0.29
Nodes (9): MemoryTab(), SystemStatusTab(), ConfigToggle(), getAuditLog(), getMemoryStats(), getOllamaHealth(), triggerConsolidate(), triggerDecay() (+1 more)

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
Cohesion: 0.35
Nodes (8): LLMConfigTab(), VoiceConversionTab(), ConfigSlider(), previewTTS(), resetConfigKey(), testLLMProvider(), updateLLMConfig(), updateVoiceConversionConfig()

### Community 42 - "TTSProviderContext.jsx"
Cohesion: 0.27
Nodes (8): TTSConfigTab(), TTSProviderSelector, TTSProviderContext, TTSProviderContextProvider(), useTTSProvider(), getTTSCurrentProvider(), getTTSProvidersList(), switchTTSProvider()

### Community 43 - "securityConfig.js"
Cohesion: 0.20
Nodes (7): allowedOrigins, host, mode, getIO(), initWebSocket(), securityConfig, { Server }

### Community 44 - "pool.js"
Cohesion: 0.24
Nodes (4): { query, pool }, { Pool }, DecayWorker, { query, pool }

### Community 46 - "configService.js"
Cohesion: 0.22
Nodes (7): NOT_FOUND, { query }, axios, configService, fs, path, { spawn }

### Community 48 - "scheduler.js"
Cohesion: 0.25
Nodes (7): configService, consolidationWorker, cron, decayWorker, fs, path, securityConfig

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

### Community 59 - "embeddingService.js"
Cohesion: 0.33
Nodes (3): EmbeddingService, { Ollama }, ollamaClient

### Community 60 - "sttService.js"
Cohesion: 0.33
Nodes (4): fs, path, { spawn }, STTService

### Community 63 - "consolidationWorker.js"
Cohesion: 0.40
Nodes (4): embeddingService, { Ollama }, ollamaClient, { query, pool }

### Community 68 - "compilerOptions"
Cohesion: 0.50
Nodes (3): compilerOptions, baseUrl, paths

## Knowledge Gaps
- **257 isolated node(s):** `name`, `version`, `description`, `main`, `test` (+252 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `e()` connect `B` to `ae`, `live2d.min.js`, `App.jsx`, `ControlPanel.jsx`, `api.js`, `AudioAnalyser`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Why does `useChat()` connect `api.js` to `B`, `App.jsx`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `App()` connect `App.jsx` to `UIContext.jsx`, `api.js`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _257 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `B` be split into smaller, more focused modules?**
  _Cohesion score 0.060814383923849816 - nodes in this community are weakly interconnected._
- **Should `ae` be split into smaller, more focused modules?**
  _Cohesion score 0.07918552036199095 - nodes in this community are weakly interconnected._
- **Should `ollamaService.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06826241134751773 - nodes in this community are weakly interconnected._