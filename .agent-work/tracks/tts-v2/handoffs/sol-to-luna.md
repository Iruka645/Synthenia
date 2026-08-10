# Sol → Luna: Phase 1 Handoff

Implement only Phase 1 of `implementation-plan.md` against approved Requirements v2. Preserve public behavior while adding a model-free Node neural lifecycle and deterministic fake-sidecar coverage.

## Scope and likely files

Confirm these exact likely targets against existing imports before editing; correct a path if necessary, but do not expand scope:

- `backend/src/services/tts/index.js` (existing `TTSManager`; do not create `TTSManager.js`)
- `backend/src/services/tts/ttsFactory.js`
- `backend/src/services/tts/providers/neuralProvider.js`
- `backend/src/services/tts/neural/neuralTtsController.js`
- `backend/src/services/tts/neural/sidecarClient.js`
- `backend/src/services/tts/neural/contracts.js`
- `backend/src/services/tts/neural/outputValidator.js`
- `backend/src/routes/tts.js`
- `backend/src/index.js`
- `backend/test/neural_tts_controller.test.js`
- `backend/test/sidecar_client.test.js`
- `backend/test/tts_compatibility.test.js`
- `backend/test/fixtures/fake-tts-sidecar.js`

## Required contracts

```text
stable IDs: jaitts-f5tts, vachaspeech-0.6b
state: not_installed|loading|ready|busy|unavailable|failed
registry: ttsFactory exposes both neural IDs/labels as not_installed metadata
          without constructing or starting providers/sidecars
/list and /current: preserve existing response shapes exactly
GET /api/tts/status: detailed pure observation; never spawn/load/install/download
switch: serialize; drain old; target ready<=180s; persist only after ready;
        failure stops target, preserves prior selection, restores old once
neural synthesis: one in flight total; two waiting; excess TTS_BUSY;
                  queue+synthesis<=120s; one automatic restart maximum
input: nonblank, <=1,000 Unicode code points; data only
output: canonical relative path under audio root, PCM WAV, nonempty,
        <=25 MiB and <=120s; invalid/partial output removed
normal flow: selected once -> gTTS once if enabled -> optional RVC
preview: exact named ready provider; it need not be active; no fallback
shutdown/abort: stop intake, settle each job once, drain GPU ownership,
                stop child, remove partial output
process shutdown: await ttsManager.shutdown() before database close
```

Use bounded structured stdio IPC and request IDs. Fake sidecar must simulate ready, busy, malformed response, hang, late success, crash, unload failure, and clean shutdown without network or model assets. Normalize errors; logs may contain provider/job/state/timing/error code/fallback only—never text, audio/reference content, full paths, raw payloads, or secrets.

## Tests required

- State table; registry metadata does not construct/start sidecars; pure `/api/tts/status` behavior.
- Existing `/list` and `/current` response-shape compatibility; detailed status lives only at `GET /api/tts/status`.
- Simultaneous synthesis/switch: no GPU overlap; queue is exactly one active plus two waiting.
- Startup/request timeouts, abort, crash, one restart, late settlement, and shutdown settle once.
- Switch commits only on readiness; failure retains persisted active and attempts one old-provider restoration.
- Normal gTTS fallback is single/nonrecursive and disable-able; preview accepts an exact named ready non-active provider and never falls back.
- RVC runs after successful base/fallback; RVC failure returns base.
- Reject blank, 1,001-code-point, unexpected IPC fields, traversal, absolute/external/symlink output, malformed/oversize/over-duration WAV; clean partials.
- Preserve existing route shapes, job IDs, `tts:done`/`tts:error`, audio URLs, gTTS/Piper, playback/lip-sync assumptions, auth/rate limits, and cleanup.
- Graceful process shutdown awaits manager shutdown before closing the database.
- Prove tests run model-free/offline and status/runtime contains no install/download path.

## Prohibited changes

- No downloads, installs, dependency upgrades, model/cache access, real provider imports, or setup script execution.
- No reference audio/transcript processing, ASR, voice cloning, benchmark, CUDA/driver/FFmpeg, or machine-wide changes.
- No frontend, Python adapter, Phase 2–4, unrelated cleanup, candidate deletion, commit/push, or out-of-workspace writes.
- Do not edit root lifecycle v1 artifacts or remediate root-v1 issues. The `tts-v2` track is independent.
- Do not change public REST/WebSocket/audio contracts or remove gTTS/Piper/RVC behavior.

## Risks and stop conditions

Highest risks are race/double settlement, traffic to an unready provider, fallback recursion, child-process leakage, path escape, and sensitive logging. Stop and return to Sol if existing contracts materially differ, required work crosses root lifecycle v1, a dependency/install/download appears necessary, output containment cannot be proven, or any privacy/network/license/bounds decision must change. Do not guess through these gates.

## Completion checklist

- [ ] Only Phase 1 files changed; no root lifecycle v1 edits.
- [ ] Lifecycle, queue, readiness-gated switch, recovery, and shutdown contracts implemented.
- [ ] Neural registry entries remain inert/not_installed until an explicit readiness-gated action.
- [ ] `/list` and `/current` shapes are unchanged; pure `/api/tts/status` has detailed states.
- [ ] Fake-sidecar and compatibility/security tests pass offline.
- [ ] gTTS/Piper/RVC and async delivery contracts remain green.
- [ ] Logs/errors contain no prohibited content.
- [ ] No downloads/installs/models/references were touched.
- [ ] Exact changed files, test commands/results, residual risks, and assumptions handed to Terra for `scrutinize` audit.
