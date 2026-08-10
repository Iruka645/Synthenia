# Root → Terra: TTS v2 Remediation 001

- Source: `reports/audit-001.md`, `handoffs/terra-to-sol.md`, `handoffs/sol-to-root-remediation-001.md`
- Audit cycle requested: 2
- Scope: Phase 1 remediation only
- Implementer: root/Codex, explicitly authorized by the user
- Requested reviewer: Terra using the named `scrutinize` skill

## Finding disposition and implementation evidence

### AUD-TTS-001 — authenticated switch rate limit

- Added the named `ttsSwitchLimit` in `backend/src/middleware/rateLimits.js` with the existing expensive-operation policy: five requests per 60-second window.
- Applied exact middleware order in `backend/src/routes/tts.js`: `apiKeyAuth` → `ttsSwitchLimit` → switch handler.
- Added `backend/test/tts_switch_rate_limit.test.js`, which drives the actual route stack. An unauthorized call returns 401 without manager invocation; the first five authorized calls reach the stubbed manager; the sixth returns 429 while manager call count remains five.

### AUD-TTS-002 — legacy child stderr privacy

- Updated `gttsProvider.js` and `piperProvider.js` to drain stderr without retaining it.
- Provider failures now log only fixed provider/error-code metadata and reject with typed, fixed public messages. Raw stderr is not placed in logs, outward errors, or causes.
- Stdout is capped at 512 bytes and settlement is single-shot for exit/error/timeout races.
- Added `backend/test/legacy_provider_redaction.test.js` with a raw-stderr sentinel containing a full private path and request text. It checks direct gTTS, direct Piper, and neural→gTTS fallback across `console.log`, `console.warn`, `console.error`, and outward error messages.

### AUD-TTS-003 — stable output descriptor

- `backend/src/services/tts/neural/outputValidator.js` now opens the candidate once and passes that same handle to WAV parsing; `inspectPcmWav` never reopens a pathname.
- Validation uses BigInt `dev`/`ino` identity, regular-file type, exact size, and `nlink === 1` across pre-open `lstat`, opened-handle `fstat`, post-open pathname check, post-read handle check, and final pathname check.
- `O_NOFOLLOW` is used where Node exposes it. On the audit host (Windows), Node reports `fs.constants.O_NOFOLLOW` as unavailable, so the implementation fails closed through pre/open/post identity matching before any descriptor read. The host exposes stable nonzero `dev`/`ino`, which are required by the validator; missing/zero identity is rejected.
- Added `backend/test/output_validator_race.test.js`: valid one-link WAV succeeds; hardlink is rejected without deleting the external file; Windows denied real symlink creation, so the fail-closed symlink `lstat` branch is deterministically exercised through a restored filesystem seam; an atomic rename/swap after open is rejected before WAV inspection, and external content remains unchanged before and after in-root cleanup.

### Accepted integration verification gap

- Extended `backend/test/neural_tts_controller.test.js` to drive the actual `NeuralTTSController` → `SidecarClient` → spawned fake sidecar → actual output validator path.
- Covers valid synthesis and invalid-output cleanup, one settlement, zero invalid-output restart (one client instance), and ownership release on shutdown.

## Validation evidence

- Focused remediation/TTS suite: 31 tests, 31 passed, 0 failed.
- Full backend suite: `npm test` — 75 tests, 75 passed, 0 failed, 0 skipped.
- Node syntax check: 69 JavaScript files under `backend/src` and `backend/test`, all passed.
- `git diff --check`: passed; only Git line-ending notices were emitted.
- `rg` check found no retained `stderrData`, stderr string conversion, or stderr logging in `backend/src/services/tts`; switch route is `apiKeyAuth, ttsSwitchLimit, handler`.
- `graphify update .`: passed; graph rebuilt to 2,283 nodes, 3,182 edges, 177 communities. Existing warning remains for seven non-code JSON sources producing zero nodes.

## Scope confirmation

- No dependency, lockfile, database/schema, frontend, Python adapter, model, cache, reference-audio, install, download, port, or root lifecycle-v1 changes were made in this remediation.
- Existing gTTS/Piper selection, RVC-after-fallback, one nonrecursive fallback, exact preview, `/list`, `/current`, `/status` purity, async audio contracts, queue bounds, restart bound, and graceful shutdown remain covered by the passing suite.

Please re-audit all three accepted findings plus the real-child integration and shutdown seams. Do not begin Phase 2 unless the blocking findings are resolved.
