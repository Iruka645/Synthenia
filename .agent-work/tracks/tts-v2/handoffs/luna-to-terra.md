# Phase 1 Implementation → Terra Handoff

- Requirements: v2 approved
- Plan: v1 ready
- Implemented phase: Phase 1 — Node lifecycle/contracts/fake-sidecar tests
- Implementer: root coordinator under the user's explicit 2026-08-10 role exception after Luna CLI failure
- Audit requested: Terra using `<user-profile>\.agents\skills\scrutinize\SKILL.md`

## Implemented behavior

- Registered stable provider IDs `jaitts-f5tts` and `vachaspeech-0.6b` without starting processes; both remain `not_installed` until explicit Phase 2 setup.
- Added a single neural ownership controller with serialized readiness-gated switching, one active request, two waiting requests, bounded startup/request/shutdown, one restart, old-provider restoration, and shutdown draining.
- Added a loopback-free JSONL stdio child-process client with structured request IDs, strict response fields, bounded lines, sanitized environment inheritance, raw stderr suppression, and kill-before-timeout/abort settlement.
- Added contained mono PCM WAV validation: filename/path/realpath/regular-file checks, 25 MiB limit, 120-second limit, RIFF/chunk/PCM consistency, and partial cleanup.
- Refactored the existing TTS manager to keep gTTS/Piper/RVC and async chat contracts, provide single opt-out-able gTTS fallback, exact-provider preview without fallback, atomic readiness plus persistence switching, status metadata, and neural shutdown.
- Preserved `/api/tts/list` and `/api/tts/current` shapes; added pure `GET /api/tts/status`; kept switch/preview authenticated and preview rate-limited.
- Graceful server shutdown now awaits the neural TTS ownership boundary before RVC and database teardown.

## Changed source and tests

- Modified: `backend/src/index.js`
- Modified: `backend/src/routes/tts.js`
- Modified: `backend/src/services/tts/index.js`
- Modified: `backend/src/services/tts/ttsFactory.js`
- Added: `backend/src/services/tts/providers/neuralProvider.js`
- Added: `backend/src/services/tts/neural/contracts.js`
- Added: `backend/src/services/tts/neural/outputValidator.js`
- Added: `backend/src/services/tts/neural/sidecarClient.js`
- Added: `backend/src/services/tts/neural/neuralTtsController.js`
- Added: `backend/test/fixtures/fake-tts-sidecar.js`
- Added: `backend/test/neural_tts_controller.test.js`
- Added: `backend/test/sidecar_client.test.js`
- Added: `backend/test/tts_compatibility.test.js`

No frontend, Python adapter, dependency, model, cache, reference voice, root lifecycle v1, database schema, prompt, or machine configuration was changed.

## Deviations and rationale

- The approved plan assigned Luna, but the user explicitly instructed root to implement after the documented Luna sandbox blocker. Terra remains independent.
- The existing manager stays at `backend/src/services/tts/index.js`; no parallel `TTSManager.js` was created.
- Neural sidecars use inherited stdio rather than a loopback HTTP listener, which is the smaller process boundary and avoids adding an exposed port.
- Phase 1 exposes inert neural metadata only. Real adapter commands and installation detection remain Phase 2 work and no download path exists at runtime.

## Validation evidence

- `node --test test/sidecar_client.test.js test/neural_tts_controller.test.js test/tts_compatibility.test.js` — 25/25 passed.
- `npm.cmd test` in `backend/` — 69/69 passed.
- `Get-ChildItem src -Recurse -Filter *.js | node --check` — 55 JavaScript files passed syntax validation.
- `npm.cmd run lint` in `frontend/` — passed with the same nine pre-existing warnings.
- `npm.cmd run build` in `frontend/` — passed; existing Pixi chunk-size warning remains.
- `git diff --check` — passed; only Git line-ending notices were emitted.
- `graphify update .` — completed: 2,192 nodes, 3,070 edges, 164 communities. It reported seven pre-existing/non-code JSON sources with zero graph nodes.

## Limitations and residual risks

- No real JaiTTS/VachaSpeech code, model, CUDA, audio, or benchmark was exercised; providers intentionally report `not_installed`.
- Phase 3 UI does not yet consume the additive status route.
- Real upstream protocol compatibility, license manifests, pinned dependencies, and offline model loading remain Phase 2/4 gates.
- File validation is defensive but remains subject to platform filesystem race semantics; audit the lstat/realpath/open sequence.
- Legacy gTTS/Piper process internals were preserved rather than rewritten in this phase.

## Required scrutinize audit focus

1. First challenge whether the controller/client split is the smallest adequate design.
2. Trace normal chat and preview end-to-end through unchanged route seams, manager capture/fallback/RVC, neural provider, controller queue, sidecar response, validator, audio URL, and shutdown.
3. Verify manager persistence/readiness atomicity for legacy→neural, neural→legacy, neural→neural, failure, and concurrent generation.
4. Stress one-active/two-waiting ownership, immediate transition admission closure, abort/timeout child drain, one restart, late settlement, and unload failure.
5. Inspect protocol/path/WAV validation, environment inheritance, error/log privacy, route auth/rate-limit behavior, and no runtime install/download path.
6. Confirm tests exercise real seams rather than only injected behavior, and identify any requirement claimed but not demonstrated.

Terra must not modify implementation code during the audit. Write `reports/audit-001.md`; if changes are required, also write `handoffs/terra-to-sol.md`.
