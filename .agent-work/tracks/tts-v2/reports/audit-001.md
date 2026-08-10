# TTS v2 Phase 1 — Terra Audit 001

- Requirements: v2 approved (`../requirements.md`)
- Plan: v1 ready (`../implementation-plan.md`)
- Auditor: Terra (`gpt-5.6-terra`) using `scrutinize`
- Disposition: `CHANGES_REQUIRED`
- Audit cycle: 1

## Executive summary

Phase 1 correctly keeps both neural providers inert, uses a smaller stdio boundary rather than a listener, preserves the legacy list/current routes, and passes the model-free tests. The controller/client split is justified: folding one-GPU ownership, serialized transition, child lifecycle, and legacy fallback into `TTSManager` would mix incompatible responsibilities; a loopback HTTP service would add more surface than JSONL stdio.

The implementation is not ready to advance because the switch endpoint is not rate-limited, legacy fallback still logs raw child stderr, and output validation has an unclosed pathname race. These violate the approved control-plane, privacy, and external-output requirements.

## Scope and checks

- Inspected every Phase 1 source/test addition and all modified TTS files named in `handoffs/luna-to-terra.md`.
- Traced normal chat/game: `routes/chat.js:61-85,177-197` → `services/ttsService.js:1` → `TTSManager.generate()` → provider/fallback/RVC → `tts:done`/`tts:error` → `frontend/src/hooks/useChat.js:103-210` playback/lip-sync seam.
- Traced preview/control plane: `routes/tts.js:31-79` → `TTSManager.preview()/switchProvider()` → neural controller → sidecar → output validator; traced process shutdown in `src/index.js:103-145`.
- Ran `node --test test/sidecar_client.test.js test/neural_tts_controller.test.js test/tts_compatibility.test.js` (25/25 pass) and `npm.cmd test` in `backend/` (69/69 pass).
- Ran syntax checks on modified/neural files and `git diff --check`; both pass (only Git CRLF notices). Searched Phase 1 neural/manager/factory files for runtime install/download/network/listener calls; the only process primitive is the intended `spawn` in `sidecarClient.js`.

## Passed checks

- Provider metadata is inert at startup: `ttsFactory.js:7-36`, `neuralTtsController.js:36-50`, and `sidecar_client.test.js:33-51` show no model start/download during status/listing.
- The controller serializes switching, admits one active plus two waiting jobs, performs one restart, and exposes bounded stdio IPC: `neuralTtsController.js:91-153,193-324`; tests cover the principal queue/switch/restart cases at `neural_tts_controller.test.js:90-188`.
- Normal generation captures the provider instance, performs at most one gTTS fallback, then runs optional RVC: `services/tts/index.js:86-114`; no fallback is used by preview at `116-138`.
- Sidecar protocol fields, environment inheritance, filename containment, PCM WAV structure, output size, and duration are constrained in `contracts.js:93-127`, `sidecarClient.js:11-35,225-262`, and `outputValidator.js:7-113`.
- Server shutdown reaches the neural ownership boundary before RVC/database cleanup: `src/index.js:103-132`.

## Findings

### AUD-TTS-001 — Switch is authenticated but not rate-limited

- Severity: High
- Confidence: High
- Location: `backend/src/routes/tts.js:39-50`; compare `backend/src/routes/tts.js:52` and `backend/src/middleware/rateLimits.js:38-42`.
- Affected requirement: FR6.3; NFR7; acceptance criterion 5 (preserve auth/rate limits).
- Evidence: `POST /switch` has `apiKeyAuth` only. `POST /preview` adds `expensiveLimit`; `rateLimits.js` already supplies that limiter. `TTSManager.switchProvider()` has only a three-second in-process cooldown at `services/tts/index.js:147-160`, which is neither an HTTP rate limit nor an abuse boundary.
- Impact: Once a neural provider is installed, a valid or exposed control-panel key can repeatedly force GPU drain/load transitions and disrupt synthesis/fallback. The explicit approved requirement says the switch remains rate-limited.
- Reproduction: With an authorized request and an installed neural descriptor, repeatedly call `POST /api/tts/switch` faster than the desired control-plane limit. The route invokes manager switching for every request that reaches the three-second cooldown; there is no middleware 429 boundary.
- Short-term fix: Attach a dedicated conservative switch limiter (or `expensiveLimit` if its five-per-window policy is accepted) after `apiKeyAuth` and before the handler.
- Long-term prevention: Treat every GPU lifecycle endpoint as a control-plane operation with a named limiter; add a route-policy test that proves excess authorized `/switch` requests receive 429 before `TTSManager.switchProvider()`.
- Verification: Add the regression test, rerun all TTS/backend tests, and demonstrate the sixth request in the selected window returns 429 without invoking a switch.

### AUD-TTS-002 — gTTS/Piper fallback can log unbounded raw child stderr

- Severity: High
- Confidence: High
- Location: `backend/src/services/tts/providers/gttsProvider.js:26-35`; `backend/src/services/tts/providers/piperProvider.js:29-38`; new fallback path `backend/src/services/tts/index.js:94-111`.
- Affected requirement: FR4.2; FR7 logging boundary; Security/Privacy/License/Provenance items 6 and 8; acceptance criterion 7.
- Evidence: On a child-process failure each legacy provider concatenates `stderrData` and writes it verbatim with `console.error`. A neural failure enters this path when the approved default fallback is enabled (`index.js:97-107`). Manager-level conversion to `TTSError` happens only after the provider has already logged its raw stderr.
- Impact: Child stderr is untrusted and may contain submitted text, reference-related paths, stack traces, or provider details. This contradicts the requirement that gTTS fallback and development logs never record text/private paths/raw payloads.
- Reproduction: Make the legacy child emit a failing stderr line containing a sentinel such as `private-text-or-path`; the provider writes the sentinel at the cited `console.error` call before `TTSManager` sanitizes the outward error.
- Short-term fix: Stop retaining/logging raw stderr in both legacy providers. Emit only a fixed provider/error-code message, preserve the raw value only as an Error cause, and let `TTSManager` retain its current code-only log.
- Long-term prevention: Centralize child-process error normalization/redaction and add tests that inject a sentinel into child stderr, then assert it is absent from logs, API/WebSocket errors, and fallback telemetry.
- Verification: Add redaction tests for direct gTTS/Piper failures and neural-to-gTTS fallback; run the full backend suite with a logger spy.

### AUD-TTS-003 — Output validation reopens a path after containment checks (TOCTOU)

- Severity: Medium
- Confidence: High
- Location: `backend/src/services/tts/neural/outputValidator.js:100-111`, especially `lstat` at 100, `realpath` at 105-108, and the pathname reopen in `inspectPcmWav()` at 29-30.
- Affected requirement: FR1.4, FR4.5, Security/Privacy/License/Provenance item 7, acceptance criterion 6.
- Evidence: A sidecar-controlled output name is checked as a regular contained file, resolved, then opened later by pathname. No file descriptor identity is preserved or rechecked between those operations. A writer with access to the audio root can replace the name between the checks and open.
- Impact: A replacement symlink/hardlink to an otherwise-valid external PCM WAV can bypass the intended "inside the audio root" guarantee and later be served from `/audio`. This is a local race, but the sidecar is explicitly an untrusted process boundary and the requirement calls for rejecting external files.
- Reproduction: In a test hook between `realpath()` and `fs.promises.open()`, atomically replace the approved output file with a link to a valid WAV outside the root. Current validation uses the prior resolution and follows the replacement on reopen.
- Short-term fix: Open the candidate once with no-follow semantics where supported; derive size/format from that descriptor, compare pre/post `lstat`/`fstat` identity, and revalidate containment without reopening the pathname. Fail closed on platforms where identity/no-follow guarantees cannot be established.
- Long-term prevention: Encapsulate secure output publication (write temp file in the audio root, validate its open descriptor, then atomically rename) and test swap/link attacks for both validation and cleanup.
- Verification: Add deterministic swap/link regression tests; ensure a valid in-root WAV passes and every replacement is rejected/removed without serving external content.

## Residual risks and test gaps

- No real JaiTTS/VachaSpeech adapter, CUDA process, reference voice, or upstream artifact was run; this remains correctly deferred to Phases 2 and 4.
- The 25 new focused tests test controller and sidecar seams separately; add at least one controller-to-real-fake-sidecar integration test during remediation so restart/validation/cleanup are proven as one path.
- Frontend status-state UX and disclosed gTTS labeling remain Phase 3 work, not a Phase 1 regression.

## Disposition

`CHANGES_REQUIRED` — fix the two High findings and the filesystem-race Medium finding, then re-audit before advancing to Phase 2. The largest issue is that a new neural-to-gTTS fallback can still send raw child stderr to application logs.
