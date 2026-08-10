# TTS Provider Implementation Plan

- Version: 1
- Requirements: 2 (`requirements.md`, approved)
- Status: ready
- Track: `tts-v2`, independent of root lifecycle v1

## Architecture

Current: REST chat/game returns text plus `ttsJobId`; background `TTSManager` calls the selected provider's `synthesize(text) -> filename`, optionally applies RVC, then emits `tts:done`/`tts:error`. Preview calls a named provider directly. gTTS/Piper share the audio directory; provider switching is authenticated but not readiness-gated.

Proposed: retain all public REST/WebSocket/audio contracts and legacy providers. Add a Node lifecycle/controller around two loopback-only Python sidecars. It owns a serialized switch state machine, one GPU lease, one neural in-flight slot, queue length two, bounded startup/request/restart, output validation, sanitized status, and fallback/recovery. Runtime never installs or downloads. Setup is explicit and separate per provider.

Confirm likely paths against imports before editing; path correction is allowed, scope expansion is not.

## Phase 1 — Node lifecycle, contracts, and fake-sidecar tests

Likely files:

- `backend/src/services/tts/index.js` — existing `TTSManager`; preserve legacy synthesis/fallback/RVC contract and delegate neural work.
- `backend/src/services/tts/ttsFactory.js` — register neural provider metadata without constructing/starting sidecars.
- `backend/src/services/tts/providers/neuralProvider.js` — provider adapter to the controller contract.
- `backend/src/services/tts/neural/neuralTtsController.js` — state, queue, GPU lease, switch/recovery/shutdown.
- `backend/src/services/tts/neural/sidecarClient.js` — bounded stdio IPC, process lifecycle, request correlation.
- `backend/src/services/tts/neural/contracts.js` — IDs, states, bounds, schemas, normalized errors.
- `backend/src/services/tts/neural/outputValidator.js` — canonical path, WAV/size/duration validation, partial cleanup.
- `backend/src/routes/tts.js` — preserve `/list` and `/current`; add pure `GET /api/tts/status`; readiness-gate switch/preview.
- `backend/src/index.js` — graceful shutdown awaits `ttsManager.shutdown()` before database close.
- `backend/test/neural_tts_controller.test.js`, `sidecar_client.test.js`, `tts_compatibility.test.js` — direct `test/` placement matches the npm test glob.
- `backend/test/fixtures/fake-tts-sidecar.js` — deterministic ready/busy/fail/hang/late-exit protocol; no models/network.

Interfaces/pseudocode:

```text
registry exposes jaitts-f5tts/vachaspeech-0.6b metadata as not_installed without constructing or starting them
GET /api/tts/status -> detailed states by pure observation; no spawn/load/download
existing /list and /current response shapes remain unchanged
switchTo(id): lock -> drain/unload old -> start target -> await ready<=180s
  -> commit configured active only on ready
  -> on failure stop target, restore old once, keep prior selection
synthesize({providerId,text,outputName,timeoutMs<=120000}) -> canonical relative WAV filename
queue: neural inFlight<=1; waiting<=2; excess=>TTS_BUSY
normal: selected once -> optional gTTS once -> optional RVC
preview: exact named provider, ready required, active selection not required, no fallback
shutdown: reject new -> settle queued -> abort/drain -> stop sidecar -> remove partial output
process shutdown: await ttsManager.shutdown() before database close
```

Risks: double settlement, switch races, child/LAN exposure, fallback recursion, path traversal, private logging. Test state transitions; concurrent switch/synthesis; queue 1+2; timeout/abort/restart once; crash/late settlement; restoration; exact preview; disabled gTTS; RVC failure; input bounds; malformed IPC; path escapes; WAV limits; shutdown; sanitized errors; unchanged REST/Socket.IO payloads. Completion: model-free tests pass offline, no runtime network/install path exists, legacy tests pass, and root lifecycle v1 is untouched.

## Phase 2 — Python adapters and explicit pinned setup

Likely files:

- `backend/tts-sidecars/common/protocol.py`, `wav.py`, `security.py`.
- `backend/tts-sidecars/jaitts/server.py`, `adapter.py`, `manifest.json`, `requirements.lock`.
- `backend/tts-sidecars/vachaspeech/server.py`, `adapter.py`, `manifest.json`, `requirements.lock`.
- `scripts/setup-jaitts.ps1`, `scripts/setup-vachaspeech.ps1`, `scripts/verify-tts-assets.ps1`.
- `.gitignore`, `docs/tts-v2-setup.md`; Python contract/unit tests beside adapters.

Interface: bounded JSONL over inherited stdio: `hello|load|synthesize|unload|shutdown`; response `{requestId,ok,state,output?,metrics?,error?}`. Reject unknown fields/paths; never bind a socket. Produce mono PCM WAV from manifest-pinned, SHA-256-verified local artifacts. Explicit setup creates separate ignored venv/cache roots and fails closed; tests never execute setup/downloads. Test schemas, hash failure, offline runtime, malicious fields, normalization, missing installs, environment isolation, and clean Git state. Completion requires exact pins/provenance; license ambiguity means unavailable.

## Phase 3 — Frontend status, switch, and preview

Likely files:

- `frontend/src/services/api.js` — typed/normalized list, status, switch, preview calls.
- `frontend/src/components/ControlPanel.jsx` — provider states, disabled/busy controls, external gTTS disclosure.
- `frontend/src/components/TTSProviderSelector.jsx` — distinct stable IDs/labels and readiness UI.
- `frontend/src/__tests__/TTSProviderSelector.test.jsx`, `ControlPanel.tts.test.jsx`.

Pseudocode: `refreshStatus()` calls pure `/api/tts/status`; preserve `/list`/`current` parsing. `switch(id)` blocks duplicates and displays active only after success. `preview(id,text,rvc)` requires named readiness, need not activate, and never substitutes. Test stale responses, duplicate clicks, sanitized errors, six states, gTTS/Piper, and existing `ttsJobId` playback/lip-sync.

## Phase 4 — Real setup and benchmark gate

Likely files:

- `scripts/benchmark-tts-v2.ps1`, `backend/tts-sidecars/benchmark/corpus.th.json`, `docs/tts-v2-benchmark.md`.
- Untracked only: `.local/tts-v2/{jaitts,vachaspeech,reference,results}/`.

Start only by explicit invocation after lawful 5–10 s mono WAV, accurate private transcript, consent/provenance, disk/driver/CUDA/resource checks, and resolved pins/licenses/hashes. Verify offline readiness; benchmark identical private reference/corpus with RVC off: cold load, 20+ prompts × 3 randomized warm runs, resources with Ollama/embedding, recovery, and sequential chat. Never log/commit private content or paths.

Completion: each provider meets 59/60, median RTF <=1.0, p95 <=1.5, 120 s ceiling, no OOM/crash/silent fallback, listening >=3.5, and privacy/provenance/recovery gates, or gets an explicit waiver. Apply approved ranking; user selects; delete nothing.

## Compatibility, security, and recovery gates

- Preserve legacy providers/RVC, audio cleanup/URLs, REST/Socket.IO, playback/lip-sync, auth/rate limits, and immediate chat response.
- Local process boundary only; structured bounded IPC; no shell interpolation, arbitrary paths/URLs, unnecessary environment secrets, runtime network/install/upgrade, raw text/reference logging, or unchecked pickle/hash.
- On provider failure: one restart maximum, remove partial output, release lease, normal-flow gTTS once if enabled. Failed switch never persists target and attempts bounded old-provider restoration. Shutdown settles once. Rollback selects a legacy provider without deleting neural assets/evidence.

## Review sequence

Luna implements one phase at a time. After each, Terra performs an outsider `scrutinize` audit: restate intent, seek a smaller approach, trace real entry-to-side-effect paths and seams, verify error paths/tests with file/line evidence, then verdict `ship|fix-then-ship|rework|reject`. Resolve/accept blockers and majors before advancing.
