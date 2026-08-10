# Root to Terra — Phase 3 remediation 002

## Findings addressed

### AUD-TTS-008 — failed status requires a recognized retry code

- Neural `failed` is selectable only when its normalized error code is one of the explicit retry allowlist entries.
- Missing, blank, overlong, and unknown codes are nonselectable and use bounded blocked-status copy.
- Focused tests prove all four cases produce zero switch dispatches; the full installed/state matrix also asserts an installed failed provider without a code is blocked.

### AUD-TTS-009 — selector-specific preview ownership

- `TTSProviderSelector` now accepts a stable `previewSource`, sends it to the shared owner, and calls `stopPreview(previewSource)` on unmount.
- The persistent selector uses `app-tts-selector`.
- The transient Control Panel TTS selector uses `control-panel-tts-selector`.
- The Voice Conversion tab retains its distinct `voice-conversion-tab` source.
- Existing functional ownership tests prove a mismatched source cannot pause another source. A repository assertion proves both reachable selector call sites use distinct stable IDs and the component has source-scoped cleanup.

### AUD-TTS-010 — late audio.play completion remains cancelled

- The preview owner rechecks disposed/generation/audio identity immediately after awaiting `audio.play()`.
- A stopped or disposed operation rejects with the safe `TTS_ABORTED` error instead of returning success.
- Deferred-play tests cover both stop and dispose: one pause, no cancellation log, no internal playing ownership, and no success settlement. Source-scoped stop also emits the final `playing:false` state.
- Context and Voice Conversion callers suppress cancellation UI errors, avoiding post-unmount error rendering.

## Files changed for remediation 002

- `frontend/src/services/ttsContracts.js`
- `frontend/src/services/ttsPreviewOwner.js`
- `frontend/src/contexts/TTSProviderContext.jsx`
- `frontend/src/components/TTSProviderSelector.jsx`
- `frontend/src/components/tabs/VoiceConversionTab.jsx`
- `frontend/src/components/tabs/TTSConfigTab.jsx`
- `frontend/src/App.jsx`
- `frontend/test/ttsContracts.test.js`

## Root verification

- Frontend tests: `29/29` passed.
- Frontend lint: exit 0; established warnings only.
- Frontend production build: passed (217 modules).
- `git diff --check`: passed with existing line-ending notices only.
- `graphify update .`: passed; 2,822 nodes / 3,944 edges.
- The immediately preceding remediation-wide safe checks remain green: backend final full `85/85`, Python `20/20`, PowerShell parser `5/5`, containment harness `14/14`, Node syntax, and both disabled gates.

No backend runtime limit, provider source, setup/verification code, manifest, lock, receipt, model/reference, or enablement gate changed in remediation 002. No setup/verify/download/install/inference action ran.

## Re-audit request

Use `scrutinize`; Terra remains audit-only. Reproduce AUD-TTS-008/009/010 and adversarially trace missing/unknown retry code, both selector unmount paths, cross-source mismatch, pending-request and deferred-play stop/dispose, settlement count, pause count, playing state, cancellation logging, and error redaction. Re-run only safe model-free checks; do not execute setup or verification.
