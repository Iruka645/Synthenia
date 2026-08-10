# TTS v2 Phase 3 — Terra Audit 008

- Requirements: v2 approved
- Implementation plan: v1, Phase 3
- Auditor: Terra, independent re-audit using `scrutinize`
- Scope: AUD-TTS-006/007 remediation, every reachable preview ingress, status/switch fail-closed behavior, abort/late completion/source cleanup, typed error redaction, and Phase 1/2/runtime-bound regressions
- Disposition: `CHANGES_REQUIRED` — **fix-then-ship**

## Intent and simpler-alternative pass

The remediation is meant to close the status contradiction and make one context-owned preview path enforce readiness, cleanup, cancellation, and bounded error observability across both the selector and Voice Conversion UI.

The new owner is the right smaller abstraction. The remaining issue is that callers are not all made proper sources of that owner, and one status edge case remains outside its fail-closed decision table. Do not add a second preview abstraction: give each selector instance a stable source and cleanup, centralize the `failed`-state selection rule, and re-check cancellation after `audio.play()` resolves.

## Re-verified remediations

| Prior finding | Result | Evidence |
| --- | --- | --- |
| AUD-TTS-006 — reciprocal installation contradiction | Resolved | `normalizeTTSProvider()` now rejects both directions of neural install/state mismatch (`frontend/src/services/ttsContracts.js:87-108`). An independent 12-cell `installed × state` matrix passed; the reciprocal `installed:true/state:not_installed` normalized unavailable/nonselectable and `dispatchTTSProviderSwitch()` made zero dispatches. The focused test covers the same matrix and zero-dispatch result (`frontend/test/ttsContracts.test.js:43-106,152-167`). |
| AUD-TTS-007 — raw Voice Conversion preview/error path | Resolved | `VoiceConversionTab` now calls context `playTest` with its RVC options and source, and invokes source-scoped stop on unmount (`frontend/src/components/tabs/VoiceConversionTab.jsx:9-18,40-42,97-110`). It has no direct `previewTTS`, `Audio`, stale config provider, or caught error-object log. Save/reset logs are fixed code-only strings (`61-64,89-92`). The shared owner takes the current context snapshot and requires active-ready before HTTP (`frontend/src/services/ttsPreviewOwner.js:64-116`); Axios no longer retains `originalError` (`frontend/src/services/api.js:46-50`). The sentinel test passed. |

The backend remains the authority: `/switch` keeps API-key/rate-limit middleware and `/preview` independently checks active neural readiness (`backend/src/routes/tts.js:39-79`, `backend/src/services/tts/index.js:116-137`). The only `new Audio` instances are the shared preview context and unchanged `useChat` normal chat playback; the latter is not a TTS control-panel preview ingress.

## Findings

### AUD-TTS-008 — A failed neural status with no recognized error code still fails open and dispatches

- Severity: **Medium**
- Confidence: **High**
- Location: `frontend/src/services/ttsContracts.js:87,101-108`; incomplete coverage at `frontend/test/ttsContracts.test.js:169-185`
- Requirement: FR6.2–3 and the Phase 3 remediation contract require malformed/unknown state to fail closed; only known retryable runtime-start failures may be selectable.
- Evidence: a missing, invalid, or overlong `errorCode` is normalized to `undefined` (`87`). `selectionErrorAllowed` then accepts it through `!errorCode` (`101-102`), even for `state:'failed'`; `dispatchTTSProviderSwitch()` consequently calls its dispatcher (`154-157`). Independent reproduction with `{kind:'neural',installed:true,state:'failed'}` returned `selectable:true` and `dispatched:1`.
- Impact: a malformed/partial failed status can offer a retry and issue a switch request despite no trustworthy cause permitting retry. Backend authority still protects the server, but the Phase 3 UI's fail-closed contract and zero-dispatch expectation do not hold.
- Reproduction: normalize the status above, then call `dispatchTTSProviderSwitch()` with a counting dispatcher; it runs once.
- Short-term fix: make `failed` selectable only when its normalized code is in `RETRYABLE_SELECTION_ERRORS`; a missing/unknown failed code must be nonselectable and expose bounded not-ready/failure copy.
- Long-term prevention: table-test `state × installed × error-code-class` (missing, known-retryable, known-nonretryable, unknown, malformed) and assert the dispatcher count is zero for every unsafe cell.
- Verification: add the missing-code/overlong-code cases to the dispatcher test, rerun frontend tests/lint/build, and preserve backend switch auth/rate-limit tests.

### AUD-TTS-009 — Selector previews are not source-scoped across component unmounts

- Severity: **Medium**
- Confidence: **High**
- Location: `frontend/src/components/TTSProviderSelector.jsx:1,17-55`; reachable mount at `frontend/src/components/tabs/TTSConfigTab.jsx:29`; Control Panel unmount transition at `frontend/src/components/ControlPanel.jsx:66-87`; generic source default at `frontend/src/services/ttsPreviewOwner.js:64-70`
- Requirement: FR6 preview UX and the remediation contract require source-scoped unmount cleanup so a preview is paused/aborted when its initiating UI goes away without stopping another source.
- Evidence: the Voice Conversion tab correctly owns `PREVIEW_SOURCE` cleanup, but `TTSProviderSelector` imports no `useEffect`, neither requests a source nor calls `stopPreview`. It is mounted both persistently in `App` and transiently inside `TTSConfigTab`. Selecting another Control Panel tab unmounts the latter, while the context stays mounted. Both selector instances use the default `tts-selector` source, so simply adding identical cleanup would also be unable to distinguish them.
- Impact: a preview started from the transient Control Panel TTS selector continues after that initiating control is removed. A generic cleanup could instead pause a preview started by the persistent selector. This violates the promised source ownership and makes preview lifetime dependent on incidental component layout.
- Reproduction: open Control Panel → TTS, start a preview from its selector, then switch to LLM/Memory/Status. `renderActiveTab()` replaces `TTSConfigTab`; no cleanup reaches `stopPreview`, so the owner retains the pending request or audio.
- Short-term fix: give every selector instance a stable distinct source prop, pass it through `playTest`, and add an unmount effect that calls `stopPreview(itsSource)`. Use distinct IDs for the persistent App selector and the transient TTSConfigTab selector (or remove the duplicate selector deliberately).
- Long-term prevention: require all preview callers to declare a source and test mount → play → unmount for each reachable control surface, including source-mismatch preservation.
- Verification: component/integration test that unmounting the Control Panel selector aborts/pause its own preview, while unmounting it does not stop a preview owned by the App selector; run the current Voice Conversion source test as a regression.

### AUD-TTS-010 — A late `audio.play()` resolution is reported as success after the preview was stopped

- Severity: **Medium**
- Confidence: **High**
- Location: `frontend/src/services/ttsPreviewOwner.js:102-125`; missing late-audio test after `frontend/test/ttsContracts.test.js:241-266`
- Requirement: FR6.2/4 and the remediation's abort/late-completion requirement require cancellation to own late work and prevent a stopped/unmounted preview from reporting success or reviving playback.
- Evidence: `stop()` increments `generation`, pauses and clears the audio (`46-61`). The request response is generation-checked (`97`), but after awaiting `audio.play()` the owner immediately returns success (`115-116`) without a second generation/disposal check. Independent reproduction used a deferred `audio.play()`: after `stop('tts-selector')` paused it and cleared ownership, resolving the deferred promise returned `{provider:'gtts',audioUrl:'/audio/test.wav'}` rather than `TTS_ABORTED`.
- Impact: callers can observe a successful preview after their source was stopped/unmounted; depending on browser timing, a late play acknowledgement can also race the pause and leave audio outside owner tracking.
- Reproduction: inject an audio factory whose `play()` returns a deferred promise; begin play, call `stop(source)`, then resolve it. The current promise fulfills successfully while `isPlaying()` is false.
- Short-term fix: after `await audio.play()`, re-check `disposed/currentGeneration`; if no longer owner, pause that local audio and throw the safe `TTS_ABORTED` error before returning.
- Long-term prevention: model owner operations as generation-owned through every await boundary and add deferred tests for request success, audio-play success, audio-play rejection, source stop, and dispose.
- Verification: assert the above reproduction rejects `TTS_ABORTED`, emits no error log for cancellation, leaves `isPlaying()` false, and has exactly one pause; retain existing request-late-completion coverage.

## Independent checks

```text
AUD-TTS-006 installed × state matrix + zero invalid dispatch    passed
AUD-TTS-007 request-late abort / stale provider / sentinel path  passed
Deferred audio-play-after-stop reproduction                      confirmed late success (AUD-TTS-010)
Failed-without-code dispatcher reproduction                      confirmed dispatch (AUD-TTS-008)
Frontend node tests                                               26/26 passed
Frontend lint                                                     passed (existing warnings only)
Frontend production build                                         passed (217 modules)
Backend node tests                                                85/85 passed
Python sidecar unit suite                                         20/20 passed
PowerShell parser                                                 5/5 passed
PowerShell disposable containment/collision harness               14/14 passed
Provider enablement gates                                         2/2 false
Backend source/test Node syntax                                   74 files passed
git diff --check                                                  passed (existing CRLF notices only)
```

Production sidecar bounds remain 180 s startup / 120 s request (`backend/src/services/tts/neural/contracts.js:11-21`). The real-fake-sidecar controller integration uses 2,000/2,000/500 ms test-only budgets (`backend/test/neural_tts_controller.test.js:205-211`); the generic sidecar unit client uses 2,000/1,000/500 ms defaults (`backend/test/sidecar_client.test.js:23-29`), while explicit 30–40 ms timeout cases remain at `69-127`. The independent full backend run passed 85/85.

No setup or verification script ran. No model, dependency, download, real model/reference, benchmark, or manifest-gate operation was performed.

## Disposition

`CHANGES_REQUIRED` — **fix-then-ship.** AUD-TTS-006/007 are resolved, but untrusted failed status still dispatches and preview ownership is not yet complete across selector unmount and late audio-play settlement.
