# Graph Report - Synthenia  (2026-07-29)

## Corpus Check
- 195 files · ~185,143 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1919 nodes · 2696 edges · 154 communities (113 shown, 41 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `824252a3`
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
- luna-cli-result.md
- VisionCoordinator
- vision_contract.test.js
- ._$2b
- B
- Sol to Luna Handoff — Remediation 001
- Phase 1 Independent Audit — 001
- validateObservation
- Sol Role Record — Remediation 001
- ab
- Terra Role Record — Audit 001
- TTSManager
- visionCoordinator.js
- Synthenia Session Handoff
- MemoryTab.jsx
- Luna Role Record — Phase 1
- Terra to Sol Handoff — Audit 001
- Sol Role Record — Discovery and Planning v1
- Agent Work Artifact Registry
- d
- N
- Ordered Phases
- shortTermObservationStore.js
- Terra Role Record — Audit 002
- Terra to Sol Handoff — Audit 002
- Required R2 regression tests
- piperProvider.js
- VoiceConversionService
- Core Contracts
- AUD-002 algorithm — dependency-free, bounded, fail-closed containers
- au

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
10. `AdaptiveCaptureController` - 18 edges

## Surprising Connections (you probably didn't know these)
- `ChatInput()` --indirect_call--> `e()`  [INFERRED]
  frontend/src/components/ChatInput.jsx → frontend/public/vendor/live2d.min.js
- `ControlPanel()` --indirect_call--> `e()`  [INFERRED]
  frontend/src/components/ControlPanel.jsx → frontend/public/vendor/live2d.min.js
- `useChat()` --indirect_call--> `e()`  [INFERRED]
  frontend/src/hooks/useChat.js → frontend/public/vendor/live2d.min.js
- `TTSConfigTab()` --calls--> `getMemoryStats()`  [EXTRACTED]
  frontend/src/components/tabs/TTSConfigTab.jsx → frontend/src/services/api.js
- `ChatInput()` --calls--> `useUI()`  [EXTRACTED]
  frontend/src/components/ChatInput.jsx → frontend/src/contexts/UIContext.jsx

## Import Cycles
- None detected.

## Communities (154 total, 41 thin omitted)

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

### Community 12 - "validate.py"
Cohesion: 0.13
Nodes (14): assert, baseTime, config, createPngChunk(), insertPngChunk(), jpeg, metadata, png (+6 more)

### Community 13 - "chat.js"
Cohesion: 0.08
Nodes (23): { chatLimit, sttLimit }, consolidationWorker, crypto, embeddingService, { EMOTION_VALUES }, express, fs, gameCommentaryService (+15 more)

### Community 15 - "validate.py"
Cohesion: 0.15
Nodes (11): createVisionError(), ERROR_DEFINITIONS, isVisionMode(), normalizeVisionError(), normalizeVisionState(), VISION_MODES, VISION_STATUSES, AdaptiveCaptureController (+3 more)

### Community 16 - "index.js"
Cohesion: 0.07
Nodes (25): app, audioDir, chatRoutes, configRoutes, cors, express, fs, healthRoutes (+17 more)

### Community 18 - "live2d.min.js"
Cohesion: 0.07
Nodes (8): ai(), ak(), at(), d(), I(), J(), N(), z()

### Community 21 - "config.js"
Cohesion: 0.18
Nodes (10): { adminAuth }, apiKeyAuth, configService, express, llmConfig, llmManager, { query }, router (+2 more)

### Community 22 - "App.jsx"
Cohesion: 0.22
Nodes (9): AvatarCanvas, ControlPanel, ApiKeyGate(), ChatWindow(), GameBoard(), MessageBubble, ThemeToggle(), verifyApiKey() (+1 more)

### Community 23 - "U"
Cohesion: 0.18
Nodes (3): af(), h(), U()

### Community 24 - "package.json"
Cohesion: 0.12
Nodes (15): @claude-flow/cli, ruflo, author, description, devDependencies, @claude-flow/cli, ruflo, keywords (+7 more)

### Community 25 - "G"
Cohesion: 0.12
Nodes (16): Backend, Completion checklist, Exact allowed files, Exact regression matrix, Frontend, JPEG framing state, Mandatory Luna artifacts, Manual visibility and cleanup (+8 more)

### Community 26 - "llm.js"
Cohesion: 0.09
Nodes (18): { availableProviders }, configuredProvider, modelByProvider, expensiveLimit, apiKeyAuth, { expensiveLimit }, express, llmManager (+10 more)

### Community 27 - "gttsProvider.js"
Cohesion: 0.22
Nodes (5): BaseProvider, BaseProvider, GTTSProvider, path, { spawn }

### Community 28 - "ollamaProvider.js"
Cohesion: 0.14
Nodes (7): BaseLLMProvider, BaseLLMProvider, { Ollama }, OllamaProvider, assert, BaseLLMProvider, test

### Community 29 - "api.js"
Cohesion: 0.22
Nodes (11): MemoryTab(), SystemStatusTab(), api, getAuditLog(), getMemoryStats(), getOllamaHealth(), socket, triggerConsolidate() (+3 more)

### Community 30 - "index.js"
Cohesion: 0.17
Nodes (10): { availableProviders }, configuredProvider, configService, { createTTSProvider, availableProviders }, currentProviderInstance, ttsConfig, voiceConversionService, GTTSProvider (+2 more)

### Community 31 - "index.js"
Cohesion: 0.07
Nodes (27): Acceptance Criteria, Approval Record, Approved Stabilization Exception and Completion Gate, Assumptions, Baseline stabilization, Confirmed facts, Confirmed Functional Requirements, Constraints (+19 more)

### Community 34 - "security.test.js"
Cohesion: 0.18
Nodes (6): crypto, errorHandler(), notFound(), requestId(), assert, test

### Community 35 - "react"
Cohesion: 0.22
Nodes (5): ChatInput(), formatDuration(), AudioRecorder, EMOTION_OPTIONS, getEmotionEmoji()

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
Cohesion: 0.27
Nodes (8): TTSConfigTab(), TTSProviderSelector, TTSProviderContext, TTSProviderContextProvider(), useTTSProvider(), getTTSCurrentProvider(), getTTSProvidersList(), switchTTSProvider()

### Community 43 - "securityConfig.js"
Cohesion: 0.20
Nodes (7): allowedOrigins, host, mode, getIO(), initWebSocket(), securityConfig, { Server }

### Community 44 - "pool.js"
Cohesion: 0.24
Nodes (4): { query, pool }, { Pool }, DecayWorker, { query, pool }

### Community 45 - "._$P7"
Cohesion: 0.17
Nodes (11): AUD-001, AUD-002, AUD-003, AUD-004, Blockers and Terra re-audit focus, Changed and created files, Implementation decisions by finding, Luna to Terra Handoff — Remediation 001 (+3 more)

### Community 46 - "configService.js"
Cohesion: 0.33
Nodes (5): axios, configService, fs, path, { spawn }

### Community 47 - "TTSManager"
Cohesion: 0.17
Nodes (11): Approved Product Decisions, Architectural boundaries, Compatibility and Migration, Current Architecture, Global Recovery Strategy, Goal and Planning Posture, Plan Completion Criteria, Proposed Architecture (+3 more)

### Community 48 - "scheduler.js"
Cohesion: 0.18
Nodes (9): configService, consolidationWorker, cron, decayWorker, fs, path, securityConfig, NOT_FOUND (+1 more)

### Community 49 - "rateLimits.js"
Cohesion: 0.25
Nodes (5): audioSlots, buckets, chatLimit, chatSlots, sttLimit

### Community 50 - "memory.js"
Cohesion: 0.16
Nodes (11): apiKeyAuth(), crypto, safeCompare(), apiKeyAuth, { adminAuth }, apiKeyAuth, consolidationWorker, decayWorker (+3 more)

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
Cohesion: 0.18
Nodes (7): embeddingService, { Ollama }, ollamaClient, { query, pool }, EmbeddingService, { Ollama }, ollamaClient

### Community 60 - "sttService.js"
Cohesion: 0.33
Nodes (4): fs, path, { spawn }, STTService

### Community 61 - "VoiceConversionService"
Cohesion: 0.09
Nodes (20): Before / After, Benchmarks, How It Work, <img src="../../docs/assets/dancing-rock.svg" width="20" height="20" alt="rock"/> Caveman (285 tokens), Install, 📄 Original (706 tokens), Part of Caveman, Security (+12 more)

### Community 63 - "consolidationWorker.js"
Cohesion: 0.17
Nodes (11): AUD-002 — Structural parsers still admit malformed critical/order states, AUD-003 — Manual work does not terminate when visibility changes during an awaited boundary, AUD-005 — Controller rethrows raw analyzer errors after producing a sanitized state, Checks passed, Executive summary, Findings, Original finding closure matrix, Remediation Phase R1 Independent Audit — 002 (+3 more)

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

### Community 101 - "ah"
Cohesion: 0.12
Nodes (29): asciiAt(), config, CRC32_TABLE, findProhibitedKey(), getImageDimensions(), isPngChunkType(), JPEG_SOF_MARKERS, parseJpegDimensions() (+21 more)

### Community 102 - "caveman-stats"
Cohesion: 0.29
Nodes (5): caveman-stats, Example output, How to invoke, See also, What it does

### Community 103 - "caveman-stats"
Cohesion: 0.29
Nodes (5): caveman-stats, Example output, How to invoke, See also, What it does

### Community 104 - "Synthenia Update Log"
Cohesion: 0.20
Nodes (9): 2026-07-28 — Discovery and requirements v1, 2026-07-28 — Luna Phase 1 execution blocker, 2026-07-28 — Luna Phase 1 implementation, 2026-07-28 — Requirements approval and planning v1, 2026-07-28 — Root coordination and checkpoint, 2026-07-28 — User-authorized Luna retry, 2026-07-28 — User-requested session handoff, 2026-07-29 — Lifecycle resumed and artifact registry added (+1 more)

### Community 105 - "Q: Graphify ทำงานถูกต้องไหม และอ่านง่ายขึ้นแค่ไหนเมื่อเทียบกับปกติ"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Graphify ทำงานถูกต้องไหม และอ่านง่ายขึ้นแค่ไหนเมื่อเทียบกับปกติ, Source Nodes

### Community 107 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + Vite

### Community 108 - "Lifecycle Status"
Cohesion: 0.11
Nodes (12): Luna Role Record — Remediation 001, Agent Work Artifact Registry, Current artifact index, Lifecycle artifacts, Required artifacts for every delegated agent, Lifecycle Status, Phase 1 Luna Evidence, Transition Evidence (+4 more)

### Community 113 - "luna-cli-result.md"
Cohesion: 0.22
Nodes (7): Changed files, Deviations, Implemented behavior, Limitations and blockers, Luna to Terra Handoff — Phase 1, Terra audit focus, Validation evidence

### Community 121 - "vision_contract.test.js"
Cohesion: 0.11
Nodes (17): buildPromptSegment(), assert, {
  buildPromptSegment,
  normalizeObservation,
  validateCaptureMetadata,
  validateCaptureRequest,
  validateObservation,
}, config, createPngChunk(), fixture, fs, insertPngChunk() (+9 more)

### Community 124 - "Sol to Luna Handoff — Remediation 001"
Cohesion: 0.14
Nodes (13): Allowed files, Backend container contracts, Backend coordinator and timing, Completion checklist, Exact test matrix, Frontend controller, Implementation constraints, Read first (+5 more)

### Community 125 - "Phase 1 Independent Audit — 001"
Cohesion: 0.17
Nodes (11): AUD-001 — Timeout/abort breaks the one-flight concurrency guarantee, AUD-002 — Header parsing accepts malformed/truncated image containers, AUD-003 — Mid-flight visibility/stream failure is not cleaned up before completion, AUD-004 — Capture freshness is rechecked after analysis and conflicts with the 8-minute timeout, Checks passed, Disposition, Executive summary, Findings (+3 more)

### Community 126 - "validateObservation"
Cohesion: 0.51
Nodes (11): assertExactKeys(), fail(), normalizeObservation(), normalizeProviderResult(), normalizeSummary(), normalizeTimestamp(), rejectProhibitedKeys(), requirePlainObject() (+3 more)

### Community 127 - "Sol Role Record — Remediation 001"
Cohesion: 0.20
Nodes (10): Blockers, Commands and validation, Decisions recorded, Files changed, Finding classification, Graph and source inspection, Inputs read, Next action (+2 more)

### Community 129 - "Terra Role Record — Audit 001"
Cohesion: 0.22
Nodes (8): Blockers, Commands and results, Evidence-based decisions, Files inspected, Graph evidence, Inputs read, Outputs, Terra Role Record — Audit 001

### Community 131 - "visionCoordinator.js"
Cohesion: 0.20
Nodes (6): visionConfig, VisionError, config, isAbortError(), safeRequestId(), {
  VisionError,
  normalizeObservation,
  validateCaptureRequest,
}

### Community 132 - "Synthenia Session Handoff"
Cohesion: 0.29
Nodes (6): Completed, Current Limitations, Important Authorization, Resume Order, Synthenia Session Handoff, Validation Evidence

### Community 133 - "MemoryTab.jsx"
Cohesion: 0.18
Nodes (11): AUD-001 algorithm — prompt outcome with an exclusive drain state, AUD-003 algorithm — generation-owned controller cleanup, AUD-004 algorithm — admission freshness versus completion validation, Constraints, recovery, and stop conditions, Exact implementation scope, Finding classification, Objective and correction order, R1 acceptance and re-audit criteria (+3 more)

### Community 134 - "Luna Role Record — Phase 1"
Cohesion: 0.33
Nodes (5): Boundaries, Inputs, Luna Role Record — Phase 1, Outputs, Validation

### Community 135 - "Terra to Sol Handoff — Audit 001"
Cohesion: 0.33
Nodes (5): Correction order and re-audit conditions, Open questions, Prioritized required corrections, Required regression tests, Terra to Sol Handoff — Audit 001

### Community 136 - "Sol Role Record — Discovery and Planning v1"
Cohesion: 0.40
Nodes (4): Inputs, Outputs, Sol Role Record — Discovery and Planning v1, Validation and boundaries

### Community 137 - "Agent Work Artifact Registry"
Cohesion: 0.18
Nodes (11): AUD-002 algorithm — explicit JPEG scan/outer framing, AUD-002 algorithm — explicit PNG palette state, AUD-003 algorithm — visibility belongs to every run, AUD-005 algorithm — one sanitized public error channel, Constraints, recovery, and stop conditions, Exact R2 implementation scope, Finding classification and authority, Objective and correction order (+3 more)

### Community 138 - "d"
Cohesion: 0.31
Nodes (10): react, App(), useUI(), useChat(), getChatStatus(), resetChat(), sendGameMove(), sendMessage() (+2 more)

### Community 139 - "N"
Cohesion: 0.20
Nodes (9): Authorized outputs and changes, Blockers and next action, Commands and validation, Decisions recorded, Finding classification, Graph and source evidence, Inputs read completely, Outputs (+1 more)

### Community 141 - "Ordered Phases"
Cohesion: 0.22
Nodes (9): Ordered Phases, Phase 1 — Privacy and scheduling foundation, Phase 2 — Local boundary, readiness, and 2B–4B benchmark, Phase 3 — Opt-in one-shot and periodic screen understanding, Phase 4 — Animation contract and deterministic engine, Phase 5 — Original Syn concept, provenance scaffold, and runtime adapter, Phase 6 — Conditional Live2D authoring and runtime acceptance, Phase 7 — Deferred stabilization/remediation (not currently authorized) (+1 more)

### Community 142 - "shortTermObservationStore.js"
Cohesion: 0.31
Nodes (4): cloneObservation(), config, ShortTermObservationStore, { validateObservation }

### Community 143 - "Terra Role Record — Audit 002"
Cohesion: 0.25
Nodes (7): Commands and results, Evidence-based decisions, Graphify and files inspected, Inputs read, Outputs and blockers, Role and task, Terra Role Record — Audit 002

### Community 144 - "Terra to Sol Handoff — Audit 002"
Cohesion: 0.25
Nodes (7): Artifact paths, Blockers and re-audit conditions, Closure matrix, Optional actions, Required actions and correction order, Required regression/retest scope, Terra to Sol Handoff — Audit 002

### Community 145 - "Required R2 regression tests"
Cohesion: 0.33
Nodes (6): Closed-finding retention matrix, JPEG transition matrix, Manual visibility matrix, PNG palette matrix, Required R2 regression tests, Sanitized error matrix

### Community 146 - "piperProvider.js"
Cohesion: 0.33
Nodes (4): BaseProvider, path, PiperProvider, { spawn }

### Community 148 - "Core Contracts"
Cohesion: 0.40
Nodes (5): Animation command v1, Capture metadata v1, Core Contracts, Screen observation v1, Short-term prompt segment

### Community 150 - "AUD-002 algorithm — dependency-free, bounded, fail-closed containers"
Cohesion: 0.50
Nodes (4): AUD-002 algorithm — dependency-free, bounded, fail-closed containers, JPEG completion policy, PNG policy, WebP RIFF/chunk-padding policy

## Knowledge Gaps
- **710 isolated node(s):** `name`, `version`, `description`, `main`, `test` (+705 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `e()` connect `B` to `._$nP`, `react`, `d`, `live2d.min.js`, `ControlPanel.jsx`, `._$2b`, `AudioAnalyser`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `useChat()` connect `d` to `B`, `App.jsx`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `c()` connect `c` to `B`, `live2d.min.js`, `ab`, `._$ZT`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _710 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ollamaService.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06352941176470588 - nodes in this community are weakly interconnected._
- **Should `v` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._