# TTS v2 Phase 1 — Terra Audit 002

- Requirements: v2 approved (`../requirements.md`)
- Plan: v1 ready (`../implementation-plan.md`)
- Auditor: Terra (`gpt-5.6-terra`) using `scrutinize`
- Disposition: `CHANGES_REQUIRED`
- Audit cycle: 2

## Executive summary

The remediation's intent is to make the Phase 1 neural-TTS control plane rate-limited, remove raw legacy-child error disclosure, and make untrusted output validation stable. A named middleware limiter and fixed-message legacy providers are the smallest sufficient fixes; moving those responsibilities into the controller would add coupling. Conversely, no ordering of `lstat`, `realpath`, and descriptor checks can secure a filename after the validator returns it to a process that can still replace that pathname. That remaining publication seam requires an explicit stable-publication/ownership design.

AUD-TTS-001 and AUD-TTS-002 are resolved. Controller → `SidecarClient` → spawned fake child → real validator integration and shutdown were independently exercised. AUD-TTS-003 remains open: validation protects its open descriptor, but the returned filename is still a mutable served pathname after the final check.

## Scope and independent checks

- Read `audit-001.md`, Sol's Remediation 001 contract, root's remediation handoff, current status, modified source, every added remediation test, and the unchanged chat/manager/static-audio/shutdown seams.
- Traced normal delivery: `backend/src/routes/chat.js:61-85` → `services/ttsService.js:1` → `services/tts/index.js:86-114` → neural provider/controller/sidecar/validator → `tts:done` → `frontend/src/hooks/useChat.js:103-210` → `/audio/<filename>` served by `backend/src/index.js:41-47`.
- Traced control plane: `routes/tts.js:39-50` → `apiKeyAuth` → `ttsSwitchLimit` → manager; traced provider error flow from `TTSManager.generate()` at `services/tts/index.js:94-111` into gTTS/Piper and back to sanitized outward errors.
- Traced shutdown: `backend/src/index.js:103-132` awaits `ttsManager.shutdown()` before RVC/database teardown; `neuralTtsController.js:326-346` stops the child, drains/settles work, and clears ownership.
- Independently ran focused tests (31/31), complete backend suite (75/75), JavaScript syntax checks for `backend/src` and `backend/test`, and `git diff --check`. All passed; diff check emitted only CRLF notices.

## Re-verified findings

| Audit 001 finding | Re-audit result | Evidence |
| --- | --- | --- |
| AUD-TTS-001 — switch rate limit | Resolved | `backend/src/middleware/rateLimits.js:38-52` defines `ttsSwitchLimit`; `backend/src/routes/tts.js:39` orders `apiKeyAuth, ttsSwitchLimit`; `backend/test/tts_switch_rate_limit.test.js:37-74` proves five authorized calls reach the manager and the sixth gets 429. |
| AUD-TTS-002 — raw legacy stderr | Resolved | `gttsProvider.js:47-87` and `piperProvider.js:50-90` drain but do not retain stderr, log fixed codes only, and reject typed fixed errors. `legacy_provider_redaction.test.js:42-109` supplies a path/text sentinel through direct providers and neural→gTTS fallback and confirms it is absent from logs/outward errors. |
| AUD-TTS-003 — output TOCTOU | Still open | `outputValidator.js:123-149` validates a stable descriptor and detects swaps during validation, but returns the same mutable `filename` at 150. `neuralTtsController.js:282-287` then returns that pathname to the manager, and chat/static serving later use it by name. No publication step binds the final served pathname to the validated descriptor. |

## Passed checks

- The limiter is attached after authentication, so unauthorized requests do not consume an authenticated bucket; the test verifies no manager invocation for 401 and no sixth invocation for 429.
- Legacy process error paths are now single-settlement, bounded on stdout, `shell: false`, raw-stderr-draining, and fixed-message only. The normal manager retains nonrecursive gTTS fallback/RVC order.
- The controller integration test at `backend/test/neural_tts_controller.test.js:196-255` uses the actual `SidecarClient`, spawned JSONL fixture, real PCM validator, invalid-output removal, and shutdown state clearing.
- `outputValidator.js:123-149` is materially stronger than Audit 001: one open handle is parsed, link count/identity/snapshot checks reject preexisting links, and the supplied swap test catches changes during validation.

## Finding

### AUD-TTS-003 — Validated descriptor is not atomically published as the served audio object

- Severity: Medium
- Confidence: High
- Location: `backend/src/services/tts/neural/outputValidator.js:143-150`; `backend/src/services/tts/neural/neuralTtsController.js:282-287`; `backend/src/routes/chat.js:79-84`; `backend/src/index.js:41-47`.
- Affected requirement: FR1.4, FR4.5, Security/Privacy/License/Provenance item 7, and acceptance criterion 6.
- Evidence: `validateOutput()` performs its last pathname/descriptor identity check at line 149, then returns the original filename at 150. The controller ignores validation metadata and returns `outputName`; later the chat route emits that name and Express static opens it afresh. A child that keeps write access to the audio root can replace the filename after line 149 but before the client fetches `/audio/<filename>`. The checker never observes that replacement. `output_validator_race.test.js:89-118` tests only a swap *after open and before the first containment recheck*, not a replacement after the final check/return.
- Impact: The desired guarantee is not end-to-end: validation proves one descriptor was a safe PCM WAV, while playback can consume a later different pathname target. A replacement can be an external/malicious WAV or an unvalidated file, contrary to the approved external-file and output-validity requirements.
- Reproduction: Let a sidecar/background helper leave the validated file unchanged through `assertPathStillMatches()` at line 149, then atomically replace `tts_<uuid>.wav` before the browser requests the emitted `/audio/<filename>`. Static middleware reads the replacement because it does not share the validator's descriptor.
- Short-term fix: Do not return the sidecar-writable pathname. Introduce a Node-owned staging/publication boundary: validate the staged descriptor, publish bytes into a newly and exclusively created served filename, revalidate that publication, and return only the published name. Ensure cleanup operates only on the appropriate staging/published root.
- Long-term prevention: Separate sidecar staging and browser-served audio ownership (including OS-level write permissions where feasible), define the final filename as a published artifact rather than child output, and integration-test a late post-validation swap before `/audio` access.
- Verification: Add a deterministic late-swap regression that occurs after the validator's last pre-return check. It must prove no success event/audio URL names a replacement, external bytes are not served or removed, and normal valid audio remains playable. Re-run focused and full backend tests.

## Residual risks

- Real model/CUDA/reference/provenance work remains intentionally deferred to Phases 2 and 4.
- Phase 3 has not yet connected status UI/disclosure work; this audit does not treat that planned work as a Phase 1 defect.

## Disposition

`CHANGES_REQUIRED` — fix-then-ship. The only blocking issue is the post-validation publication race: a secure descriptor check is insufficient while the returned static path remains writable by the sidecar.
