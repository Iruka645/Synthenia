# Root to Terra — Phase 3 remediation 001

## Findings addressed

### AUD-TTS-006 — reciprocal installation contradiction

- Neural install-state validation is now bidirectional: both `installed:false` with any non-`not_installed` state and `installed:true` with `not_installed` normalize to `TTS_INSTALL_INVALID`, `unavailable`, and nonselectable.
- A table test covers every `installed × state` combination.
- `dispatchTTSProviderSwitch()` centralizes the normalization assertion before the HTTP dispatcher. A focused test proves the contradictory provider dispatch count remains zero.

### AUD-TTS-007 — one preview owner and bounded errors

- Added `frontend/src/services/ttsPreviewOwner.js` as the sole browser-preview ownership primitive.
- It derives the provider only from the current normalized context snapshot, requires active + ready before HTTP, owns one pending request/audio instance, aborts with `AbortController`, and pauses by initiating source or on context disposal.
- The shared context owns this primitive and exposes typed `playTest(options)` plus source-scoped `stopPreview(source)`.
- `VoiceConversionTab` no longer imports/calls `previewTTS`, reads saved `tts.currentProvider`, constructs `Audio`, or logs caught error objects. It supplies only text plus explicit RVC options to the shared owner and stops its own preview source on unmount.
- The main selector still uses the same owner with its existing RVC controls.
- The Axios interceptor no longer retains `originalError`; UI consumers receive only normalized `message`, `status`, and `code`.
- Context log codes are allowlisted through `getSafeTTSErrorCode`. Voice Conversion config save/reset logs are fixed metadata-only strings and render fixed bounded errors.
- Tests prove non-ready state makes zero requests, a stale caller-supplied provider is ignored, source-scoped stop/unmount pauses audio, and a raw rejection containing sentinel API key/path/reference/transcript/body data reaches neither logs, rendered copy, nor the rethrown safe error.
- A repository guard proves the reachable Voice Conversion tab has no direct preview/Audio/original-error path.

## Files changed for remediation

- `frontend/src/services/api.js`
- `frontend/src/services/ttsContracts.js`
- `frontend/src/services/ttsPreviewOwner.js`
- `frontend/src/contexts/TTSProviderContext.jsx`
- `frontend/src/components/tabs/VoiceConversionTab.jsx`
- `frontend/test/ttsContracts.test.js`
- `backend/test/neural_tts_controller.test.js` (test-only Windows process budget)
- `docs/tts-v2-setup.md`

## Root verification

- Frontend tests: `26/26` passed.
- Frontend lint: exit 0; established warnings only.
- Frontend production build: passed (217 modules).
- Backend focused real-fake-sidecar integration: `1/1` passed.
- Backend full suite: `85/85` passed on the final standalone rerun.
- Backend source/test syntax: passed.
- Python sidecar tests: `20/20` passed.
- PowerShell parser: `5/5` passed.
- Containment/collision harness: `14/14` passed.
- Provider enablement gates: `2/2` remain false.
- `git diff --check`: passed with existing line-ending notices only.
- `graphify update .`: passed; 2,795 nodes / 3,921 edges.

One preceding concurrent full-suite run saw the real fake-sidecar integration exceed its old 500 ms test deadline. Root changed only that integration fixture's startup/request budgets to 2,000 ms and shutdown budget to 500 ms, then obtained focused and full-suite passes. Production limits remain 180 s startup / 120 s request. Explicit 30–40 ms timeout tests remain unchanged and passed.

No setup/verify script, download, dependency installation, model/reference access, real inference, benchmark, or manifest gate change was performed.

## Re-audit request

Use `scrutinize`; Terra remains audit-only. Reproduce both former findings, inspect the preview owner under abort/error/late completion/source mismatch, search all reachable TTS preview ingresses and error logs, and rerun safe model-free checks. Do not execute provider setup or verification.
