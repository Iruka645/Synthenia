# Baseline Assessment

Date: 2026-07-28  
Role: Sol (discovery)  
Scope: repository architecture, dirty diff, package/test configuration, relevant chat/LLM/security/Live2D source, feasibility research, and safe validation.  
Exclusions: implementation, asset editing, machine changes, model downloads, live Ollama inference, and legal conclusions.

## Executive Assessment

Synthenia has a workable local-first foundation and a clearer structured LLM/emotion path than its repository documentation suggests. The backend unit/security suite and frontend production build pass. The project is not ready for screen capture or a model replacement yet: changes that were dirty at the start of discovery and later checkpointed as `1adfc91` include widespread text corruption, the frontend dependency audit reports critical/high advisories, the Live2D asset has no recorded provenance/editable source, and the application lacks browser/end-to-end privacy and avatar tests.

Recommended order:

1. Freeze and inventory the dirty worktree; repair encoding without losing intended changes.
2. Resolve/contain the Live2D dependency advisories and add minimum browser/runtime tests.
3. Correct readiness and multi-client/global-state assumptions.
4. Define privacy and resource contracts for one-shot screen understanding.
5. Benchmark one approved 2B–4B vision model with fixed local fixtures.
6. Approve original Syn art direction/provenance and author a new modern-format model.
7. Add a small, versioned animation schema and expand authored motion variety.

## Architecture Facts

### Request and response flow

- `frontend/src/hooks/useChat.js` owns chat state, request cancellation, current emotion, TTS job callbacks, game state, and audio-driven mouth volume.
- `frontend/src/services/api.js` sends text/emotion to `/api/chat` and injects a session-stored API key.
- `backend/src/routes/chat.js` validates input emotion, computes an embedding, retrieves/saves memory, calls `ollamaService.chat`, immediately returns reply/emotion/job ID, then produces TTS in the background.
- `backend/src/services/ollamaService.js:19-55` keeps one process-global conversation history and injects the modular system prompt/memory context.
- `backend/src/services/llm/providers/ollamaProvider.js:21-43` makes a non-streaming Ollama call with a strict reply/emotion JSON schema and a five-minute timeout.
- `backend/src/websocket.js:6-22` accepts origin-allowed sockets but has no socket authentication or per-client room/session.
- Chat/game routes call `getIO().emit`, so TTS completion events are broadcast to all connected sockets.

### Avatar flow

- `frontend/src/components/AvatarCanvas.jsx:8` imports the Cubism 2-only runtime bundle.
- `AvatarCanvas.jsx:35-100` maps seven non-neutral emotions to named groups, then falls back among only `tap_body`, `flick_head`, and `sleepy`-style groups.
- `AvatarCanvas.jsx:149-180` loads `/live2d-models/syn/model.json`, adds pointer focus, and plays random non-idle motion on tap.
- `AvatarCanvas.jsx:182-198` applies audio volume to legacy/current mouth parameter names.
- `frontend/public/live2d-models/syn/model.json:1-39` declares Cubism 2 format, references `illyasviel.moc`, and exposes only four motion groups (`idle`, `sleepy`, `flick_head`, `tap_body`); there are no expression definitions.
- The duplicated `illyasviel/` and frontend model directories are byte-identical for the MOC and texture and consume approximately 3.47 MB together.

### Screen understanding

- Repository search found no `getDisplayMedia`, screenshot, capture, image-to-LLM, or vision message implementation.
- The existing request path accepts JSON text/emotion and audio upload, not image input.
- Official Ollama documentation supports image arrays for vision-capable models, and the official model registry lists `gemma3:4b` as text+image input.
- Browser `getDisplayMedia()` requires transient user activation, prompts for a source each time, cannot persist permission, and is a significant privacy/security surface.

## Findings and Priorities

### P0 — Repair double-encoded Thai in the checkpointed changes

Evidence:

- The discovery-time `git diff` showed valid Thai from the previous `HEAD` replaced by strings such as `à¸...`; those changes were subsequently checkpointed as `1adfc91`.
- A byte-level UTF-8 scan found mojibake markers in seven files:
  - `backend/src/index.js`
  - `backend/src/routes/chat.js`
  - `backend/src/routes/config.js`
  - `backend/src/routes/llm.js`
  - `backend/src/routes/memory.js`
  - `backend/src/routes/tts.js`
  - `frontend/src/services/api.js`
- Several of those modified files also gained a UTF-8 BOM.

Impact:

- User-facing errors are unreadable.
- Game/memory strings written to the database can be permanently corrupted.
- Tests pass because they do not assert Thai copy fidelity.

Recommendation:

- Treat the clean `HEAD` text plus intended dirty logic as reconstruction evidence.
- Add a repository encoding check before accepting the current stabilization work.

### P0 — Resolve frontend production dependency advisories

Evidence:

- `npm audit --omit=dev` in `frontend` reports four vulnerabilities: two high and two critical.
- `npm ls` shows `pixi-live2d-display@0.4.0 -> gh-pages@4.0.0 -> globby -> glob -> minimatch -> brace-expansion`.
- Vite resolves `postcss@8.5.16`, which is also flagged.
- The audit’s force-fix suggests downgrading `pixi-live2d-display` to 0.3.1, a breaking change; it should not be applied automatically.

Impact:

- The current dependency tree cannot meet a no-unreviewed-high/critical release criterion.
- A Live2D runtime change may affect model compatibility and should be planned/tested, not blindly fixed.

Recommendation:

- Evaluate a maintained runtime/fork or direct official Cubism Web integration, verify why publication tooling is shipped as a runtime dependency, and update Vite/PostCSS through a lockfile-reviewed change.

### P1 — Correct readiness semantics

Evidence:

- `backend/src/services/ollamaService.js:79-91` sets `isModelReady = true` on both successful and failed chat-model preload.

Impact:

- The UI can enable chat while the configured model is unavailable, masking cold-start/failure conditions and invalidating latency measurements.

Recommendation:

- Represent `loading`, `ready`, and `error/degraded` distinctly and include embedding/chat model status.

### P1 — Remove unsafe global-state assumptions before broader capture modes

Evidence:

- `ollamaService.js:19` holds one global history array for the entire process.
- `websocket.js` has origin checking but no socket authentication/session binding.
- TTS completion is broadcast globally from route handlers.

Impact:

- Multiple browser tabs/users can mix conversation history or receive each other’s TTS metadata/audio URL.
- Screen observations would make this confidentiality risk materially worse.

Recommendation:

- Scope history and socket delivery to an authenticated local session before LAN/public or multi-user support. If strictly single-user/loopback is approved, document and enforce that boundary.

### P1 — Define a privacy boundary before implementing screen capture

Evidence:

- MDN documents that screen capture is security-sensitive, must be initiated by user interaction, and must prompt every time.
- The current app logs replies/emotions and persists memory; no screenshot-specific exclusion controls exist.
- The backend JSON cap is 64 KB, too small for useful image payloads, while accepting image traffic through the existing route would obscure resource accounting.

Impact:

- Credentials and private windows can be captured.
- Screen text can become prompt injection.
- Base64 images can exhaust request memory or block local inference.

Recommendation:

- Use a dedicated authenticated endpoint/session, explicit one-shot capture first, strict size/rate/concurrency limits, zero default persistence, untrusted-context delimiters, and fixture-based privacy tests.

### P1 — Establish asset provenance before “replacing” Illyasviel

Evidence:

- No LICENSE/NOTICE/provenance file was found for the model.
- The runtime manifest still names `illyasviel.moc`.
- No layered PSD or Cubism editable project exists in the repository.
- Current official Live2D output uses `.moc3` and `.model3.json`; the project is on Cubism 2 `.moc`.

Impact:

- The project cannot demonstrate the right to modify/distribute the asset.
- Binary runtime files are insufficient to author a distinct maintainable Syn model.

Recommendation:

- Do not derive Syn by tracing/recoloring/renaming. Obtain original layered art, record rights, create editable Cubism source, export modern runtime assets side-by-side, and retain rollback until acceptance.

### P2 — Improve animation variety through authored semantics, not randomness alone

Evidence:

- Eight semantic emotions collapse onto three/four legacy groups.
- Several emotion branches share the same fallback order.
- No expression files are declared.
- Clicks select any non-idle group randomly, independent of emotion.

Impact:

- Different emotions often look alike; random playback can contradict dialogue.

Recommendation:

- Define a versioned allowlisted animation command (`emotion`, `cue`, `variant`, `intensity`, bounded timing), author multiple model-specific variants, and layer expression/gaze/blink/breath/speaking with cooldown and priority rules.

### P2 — Add frontend/browser/integration coverage

Evidence:

- Backend has Node tests only.
- Frontend package scripts provide lint/build but no test command.
- No Playwright/Cypress/browser tests are configured.
- Lint reports 9 warnings, including an AvatarCanvas missing hook dependency and unused render-size variables.

Impact:

- Model loading, pointer focus, resize cleanup, lip sync, capture permission state, track shutdown, and visual fallbacks are unverified.

Recommendation:

- Add unit tests for schema/selection logic and browser smoke tests using mocks/fixtures before feature work.

### P2 — Profile bundle and inference contention

Evidence:

- Production build emits a 538.42 KB minified Pixi chunk (151.16 KB gzip) and warns about chunks above 500 KB.
- Chat is non-streaming; model preload keeps the model alive for 30 minutes.
- A second vision model can contend with chat, embedding, STT, and TTS for memory/compute.

Impact:

- Cold loads and model swaps can produce long apparent hangs on local hardware.

Recommendation:

- Capture cold/warm measurements, lazy-load the avatar/runtime, prefer one-shot vision, constrain image resolution, and benchmark model residency/swap strategy on target hardware.

## Live2D Research Notes

- Official Live2D documentation says model deformation is stored in `.moc3`, while `.model3.json` indexes the model and related textures/physics/motions. This supports moving away from the current Cubism 2 manifest: [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/).
- Official Editor requirements list PSD/PNG inputs, Windows 10/11, OpenGL requirements, and recommend testing the FREE/trial version before purchase: [Cubism Editor system requirements](https://www.live2d.com/en/cubism/download/spec/).
- The official FREE/PRO comparison confirms FREE is limited and its commercial terms depend on user/business status: [Cubism FREE vs PRO](https://www.live2d.com/en/cubism/comparison/).
- Live2D explicitly provides an AI/chatbot publication-license flow and special handling for expandable applications. Development verification can begin without a publication license, but release posture must be reviewed: [SDK Release License](https://www.live2d.com/en/sdk/license/).
- The current third-party `pixi-live2d-display` project supports Cubism 2 and 4 bundles, but the dependency audit and maintenance posture require review before relying on it for a new asset: [pixi-live2d-display repository](https://github.com/guansss/pixi-live2d-display).

## Screen/Vision Research Notes

- Browser screen capture requires explicit user interaction and a fresh permission/source choice; permission cannot be persisted. It is only available in secure contexts, with localhost typically treated as secure: [MDN getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia).
- Ollama vision messages accept images alongside text, including raw bytes through its SDK: [Ollama Vision](https://docs.ollama.com/capabilities/vision).
- Ollama’s official registry lists `gemma3:4b` as a 4B-class image+text option around 3.3 GB. It is a feasible first candidate under the user’s 2B–4B constraint, subject to explicit approval and hardware benchmarking: [gemma3 tags](https://ollama.com/library/gemma3/tags).

## Validation Commands and Results

```text
Command: graphify query "What is the current Synthenia architecture, how do chat, Ollama, emotions, the frontend avatar, screen understanding, and illyasviel assets connect, and what are the main implementation and security risks?" --budget 3500
Result: PASS; BFS depth 2, 670 nodes found. It identified the chat/Ollama/security/frontend/Live2D communities; direct source inspection followed because output was broad/truncated.

Command: git status --short
Result: PASS; confirmed a heavily dirty worktree with 20 tracked modifications and multiple untracked security/config/tooling files. No pre-existing change was reverted or staged.

Command: git diff --stat
Result: PASS; tracked diff at discovery was 20 files, 530 insertions, 276 deletions.

Command: git diff --check
Result: WARN; 11 files report a new blank line at EOF. No implementation correction was made in discovery.

Command: npm test  (cwd: backend)
Result: PASS; 20 tests passed, 0 failed, duration 31.7 s.

Command: npm run lint  (cwd: frontend)
Result: PASS WITH WARNINGS; 9 warnings (unused variables/catch parameters, two Fast Refresh warnings, one AvatarCanvas hook dependency warning).

Command: npm run build  (cwd: frontend)
Result: PASS; 215 modules transformed in 1.13 s. Largest emitted chunk: pixi 538.42 kB minified / 151.16 kB gzip; Vite emitted a >500 kB warning.

Command: npm audit --omit=dev  (cwd: backend)
Result: PASS; 0 vulnerabilities.

Command: npm audit --omit=dev  (cwd: frontend)
Result: FAIL; 4 vulnerabilities (2 high, 2 critical). No automatic fix was run.

Command: npm ls brace-expansion gh-pages postcss pixi-live2d-display --all  (cwd: frontend)
Result: PASS; confirmed pixi-live2d-display@0.4.0 -> gh-pages@4.0.0 -> brace-expansion@1.1.15 and vite@8.1.3 -> postcss@8.5.16.

Command: UTF-8 mojibake marker scan over backend/src, backend/test, backend/scripts, frontend/src
Result: FAIL; seven application source files contain known double-encoding markers.

Command: Get-FileHash for both Illyasviel/syn MOC and texture copies
Result: PASS; each pair is byte-identical, confirming duplication/renaming rather than a distinct Syn model.
```

## Discovery Limitations

- No live Ollama inference was run; therefore no small-model latency/quality claim is made.
- No model was downloaded.
- No database, STT, TTS, WebSocket browser, or Live2D visual end-to-end test was run.
- No screenshot was captured.
- Licensing observations identify decision points and are not legal advice.
- The initially dirty diff was checkpointed as `1adfc91` during discovery. Findings preserve the observed before/after evidence but do not assign authorship.
