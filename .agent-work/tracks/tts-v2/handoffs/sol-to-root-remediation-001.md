# Sol → Root: TTS v2 Remediation 001

- Source: `reports/audit-001.md`, `handoffs/terra-to-sol.md`
- Audit cycle: 1
- Scope: Phase 1 remediation only
- Implementer: root/Codex, explicitly authorized by the user
- Exit: return evidence to Terra for independent `scrutinize` re-audit

## Finding classification

| Item | Decision | Evidence and required disposition |
| --- | --- | --- |
| AUD-TTS-001 (High) | **Accept** | `backend/src/routes/tts.js:39-50` authenticates `/switch` but has no HTTP limiter, while preview uses `expensiveLimit` and FR6.3 explicitly requires switch rate limiting. Add a named limiter before the handler and prove rejection occurs before manager invocation. |
| AUD-TTS-002 (High) | **Accept** | `gttsProvider.js:26-35` and `piperProvider.js:29-38` log accumulated raw child stderr before manager normalization. Neural failure can enter gTTS fallback at `tts/index.js:94-111`, violating the approved no-text/path/raw-payload log boundary. Drain stderr safely but never retain, log, throw, or expose its content. |
| AUD-TTS-003 (Medium) | **Accept** | `outputValidator.js:100-111` checks with `lstat`/`realpath`, then `inspectPcmWav()` reopens the pathname. Replacement between check and open invalidates containment. Validate one stable descriptor with no-follow/identity checks and fail closed if the platform cannot establish them. |
| Controller → real fake-sidecar integration gap | **Accept as remediation verification** | The focused tests cover seams separately, but not restart/validation/cleanup through the real child boundary. Add one model-free integration test; this changes no product requirement. |
| Real adapters/CUDA/reference artifacts | **Defer to Phases 2 and 4** | Audit explicitly confirms they were not run; Requirements v2 prohibits model/download/reference work in Phase 1. |
| Frontend state UX/gTTS disclosure | **Defer to Phase 3** | Audit identifies this as planned future work, not a Phase 1 regression. |

No Terra finding is rejected. Deferred items are outside this remediation scope, not waived.

## Implementation contract

### 1. Privacy boundary first — AUD-TTS-002

Targets:

- `backend/src/services/tts/providers/gttsProvider.js`
- `backend/src/services/tts/providers/piperProvider.js`
- Direct-provider/fallback tests under the existing `backend/test/*.test.js` discovery pattern; prefer extending `tts_compatibility.test.js` unless isolation warrants `legacy_provider_redaction.test.js`.

Requirements:

- Continue consuming child stderr so pipes cannot block, but bound/discard bytes; do not interpolate stderr into `console.*`, `Error.message`, `cause`, API/Socket.IO payload, or telemetry.
- On nonzero exit/spawn failure, emit only stable provider/error code and fixed sanitized message. Keep manager logs code-only and preserve fallback/RVC behavior.
- Inject sentinel stderr for direct gTTS, direct Piper, and neural→gTTS fallback. Spy all relevant logger/error surfaces and assert the sentinel and full paths are absent; assert outward errors remain normalized.

### 2. Control-plane limiter — AUD-TTS-001

Targets:

- `backend/src/middleware/rateLimits.js`
- `backend/src/routes/tts.js`
- Route regression test under `backend/test/*.test.js`; prefer `tts_compatibility.test.js`.

Requirements:

- Export a named `ttsSwitchLimit`, using the existing `expensiveLimit` window/policy (five requests per window) unless the module already exposes a safer equivalent.
- Middleware order on `POST /api/tts/switch`: `apiKeyAuth` → `ttsSwitchLimit` → handler. Preserve route body/response shape and manager cooldown.
- Test authorized repeated requests: first five reach the test handler policy; sixth returns 429 and does not call `ttsManager.switchProvider()`. Also retain unauthorized/auth behavior.

### 3. Stable output validation/publication — AUD-TTS-003

Targets:

- `backend/src/services/tts/neural/outputValidator.js`
- `backend/test/neural_tts_controller.test.js` or a directly discovered `backend/test/output_validator.test.js`.

Requirements:

- Resolve the audio root and candidate lexically; reject absolute, traversal, symlink, directory, device, and external paths.
- Open the candidate exactly once with read-only/no-follow semantics where supported. Use the same open handle for `fstat`, PCM WAV parsing, size/duration checks, and all reads; `inspectPcmWav` must accept the handle and never reopen the pathname.
- Compare pre-open `lstat`, open-handle `fstat`, and post-validation `lstat` identity (`dev`/`ino`, type, size as applicable); require a regular file and reject multi-link files (`nlink !== 1`) to close hardlink substitution. Reconfirm resolved containment and identity before success.
- On mismatch, swap, link, unsupported no-follow/identity guarantee, or validation failure: fail closed, close the handle once, and remove only the in-root candidate/partial file—never follow or delete an external target.
- Add deterministic test hooks only if injectable and production-inert. Test valid in-root PCM WAV, preexisting symlink/hardlink, and atomic swap between checks. Assert external content is never read/published/deleted.
- If Windows/Node cannot provide the stated no-follow and stable identity guarantees, stop and report the exact API/platform limitation to Sol/Terra; do not weaken the requirement.

### 4. End-to-end model-free integration evidence

Target: a direct `backend/test/*.test.js` file, preferably extend `neural_tts_controller.test.js`; fixture remains `backend/test/fixtures/fake-tts-sidecar.js`.

Drive `NeuralTTSController` through the actual `SidecarClient`, spawned fake sidecar, and actual output validator. Cover one successful valid WAV plus one crash/restart or invalid-output cleanup path. Assert one settlement, one restart maximum, released ownership, and removed partial output. No listeners, network, Python, models, installs, or downloads.

## Invariants and prohibited changes

- Preserve gTTS/Piper selection, optional RVC, single nonrecursive fallback, exact preview, `/list` and `/current` shapes, `/status` purity, REST/WebSocket/job/audio contracts, auth, async delivery, cleanup, and graceful shutdown.
- Stay in Phase 1 Node TTS/middleware/tests. No frontend, database/schema, Python adapters, dependencies, setup scripts, ports, model/cache/reference processing, root lifecycle v1 edits, unrelated cleanup, commit/push, or deletion of provider assets.
- Do not expose raw text, stderr, full paths, child payloads, secrets, or reference data in logs/errors/tests.

## Required validation and handoff

- Run focused remediation/TTS tests, full `backend` tests, Node syntax checks for changed JS, and `git diff --check`.
- Record exact changed files, commands/results, limiter policy/order, logger surfaces checked, deterministic race evidence, and Windows no-follow/identity behavior.
- Confirm no dependencies, downloads, models, references, frontend, schema, or root-v1 files changed.
- Write root-to-Terra remediation handoff. Do not begin Phase 2 until Terra re-audits all three accepted findings plus integration/shutdown seams and returns `ship` or all blocking findings are explicitly resolved.
