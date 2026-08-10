# TTS v2 Phase 3 — Terra Audit 009

- Requirements: v2 (approved)
- Implementation plan: v1, Phase 3
- Auditor: Terra, independent re-audit using scrutinize
- Scope: remediation 002; AUD-TTS-008/009/010; regression of AUD-TTS-006/007; all reachable frontend preview, status, switch, error, and cleanup paths; and existing Phase 1/2 safety contracts
- Disposition: PASS — SHIP Phase 3 provider-neutral frontend integration

## Executive summary

Remediation 002 closes all three retained Phase 3 findings. A neural provider in failed state is selectable only for a small explicit retry allowlist; missing, blank, overlong, and unknown codes fail closed and cannot dispatch a switch. Each reachable preview surface now has a distinct stable source and source-scoped unmount cleanup. The shared owner keeps cancellation ownership across the audio.play await boundary, so late completion after source stop or provider-context disposal rejects with safe TTS_ABORTED rather than reporting success.

No Critical, High, or Medium finding remains in the audited scope. This is not approval to enable either neural provider: manifests remain disabled, setup/verification was not run, and no model, dependency, reference, or external asset was accessed.

## Intent and simpler-alternative pass

The intended result is a UI that treats untrusted provider status as advisory but never makes an unsafe control action, while one owner governs preview request/audio lifetime for every TTS-control surface.

Blocking every failed provider would be simpler but wrongly removes the explicitly allowed bounded retry for named transient start failures. The fixed allowlist is the smaller correct policy. Likewise, separate Audio owners per component would reintroduce duplicated readiness, cancellation, and secret-redaction logic; the shared owner plus a required per-surface source is the smaller correct lifecycle boundary.

## Lifecycle trace and re-verified findings

| Finding | Result | Evidence-backed trace |
| --- | --- | --- |
| AUD-TTS-008 — malformed failed code dispatches | Resolved | normalizeTTSProvider limits a failed state to RETRYABLE_SELECTION_ERRORS (frontend/src/services/ttsContracts.js:11-15,87-115). The dispatcher first requires the normalized selectable value (154-157). Independent direct reproduction gave selectable:false and zero calls for missing, blank, 65-character, and UNKNOWN_FAILURE codes; all four named allowlist codes stayed selectable and dispatched once. The focused table test asserts the unsafe cells and zero dispatches (frontend/test/ttsContracts.test.js:189-207). |
| AUD-TTS-009 — selector lifetime is not source-scoped | Resolved | The persistent App selector supplies app-tts-selector (frontend/src/App.jsx:111), the transient Control Panel selector supplies control-panel-tts-selector (frontend/src/components/tabs/TTSConfigTab.jsx:29), and Voice Conversion owns voice-conversion-tab (frontend/src/components/tabs/VoiceConversionTab.jsx:9,40-42,102-107). TTSProviderSelector passes its source to playTest and calls stopPreview with the same source on unmount (frontend/src/components/TTSProviderSelector.jsx:17,43-56). Owner.stop rejects a mismatched source without touching active request/audio (frontend/src/services/ttsPreviewOwner.js:46-61). Independent source isolation reproduction confirmed three own-source stops paused three times total, while mismatches returned false. |
| AUD-TTS-010 — late audio.play reports success after cancellation | Resolved | The owner creates a generation-owned AbortController, validates current generation after request completion, and rechecks disposed, generation, and audio identity immediately after audio.play (frontend/src/services/ttsPreviewOwner.js:64-124). Stop/dispose clear handlers, abort/pause exactly once, and invalidate ownership (46-61,132-135). Independent deferred-play reproduction returned TTS_ABORTED, one pause, empty logs, and isPlaying:false for both stop and dispose. The regression test checks the same behavior (frontend/test/ttsContracts.test.js:289-325). |
| AUD-TTS-006 — reciprocal installed/state contradiction | Remains resolved | The normalization matrix still turns both neural installation contradictions into unavailable/nonselectable status (frontend/src/services/ttsContracts.js:88-115); the full installed × state matrix remains covered (frontend/test/ttsContracts.test.js:87-107). |
| AUD-TTS-007 — Voice Conversion bypass/raw error path | Remains resolved | Voice Conversion has no direct previewTTS, Audio, or raw error-object route; it uses the snapshot-based shared owner and suppresses cancellation UI error (frontend/src/components/tabs/VoiceConversionTab.jsx:1-18,97-112). Context logs only a normalized error code (frontend/src/contexts/TTSProviderContext.jsx:59,83,107); the Axios interceptor creates a new error with only message/status/code, not its original response/request object (frontend/src/services/api.js:32-50). Sentinel redaction and static reachable-ingress assertions passed (frontend/test/ttsContracts.test.js:327-389). The only other new Audio instance is unchanged useChat normal chat playback, outside the TTS-control preview owner. |

The complete execution path remains bounded and fail closed: status/current API data is normalized before HTML controls render or dispatch; the backend independently keeps switch authentication/rate limiting and preview active-ready checks. Preview flows App selector or Control Panel selector or Voice Conversion → context playTest → shared owner snapshot/AbortController → preview API → owner-created Audio; source cleanup, owner disposal, and audio events return through the same owner. Existing backend integration coverage confirms controller/sidecar validation, exclusive output publication, verified audio delivery, retention, legacy/RVC behavior, and shutdown.

## Independent checks

Safe, model-free checks run by this auditor:

```text
Direct bad-code dispatcher reproduction                         passed: 4 unsafe classes zero dispatch
Direct named retry-allowlist dispatcher reproduction             passed: 4 allowed codes dispatch once
Direct three-source mismatch/own-stop reproduction               passed: mismatches false; own stops isolated
Direct deferred audio.play stop/dispose reproduction             passed: TTS_ABORTED, 1 pause, no log, no owner state
Frontend node tests                                              29/29 passed
Frontend lint                                                    passed (7 established warnings only)
Frontend production build                                        passed (217 modules)
Backend node tests                                               85/85 passed
Python sidecar unit suite                                        20/20 passed
PowerShell parser                                                passed
PowerShell disposable containment/collision harness              14/14 passed
Provider enablement gates                                        2/2 remain false
git diff --check                                                 passed (existing LF→CRLF notices only)
```

The attempted full per-file backend Node syntax loop reached the outer 60-second audit cap after its targeted preview/log search and without reporting a syntax error. It is recorded as a bounded-check timeout, not a product finding: the complete backend test suite above parsed and executed all current backend tests successfully, and remediation 002 changes frontend code/tests only.

Production sidecar bounds remain 180 s startup, 120 s request, and 5 s shutdown (backend/src/services/tts/neural/contracts.js:16-20). The real-fake-sidecar controller fixture uses only test-local 2,000/2,000/500 ms limits (backend/test/neural_tts_controller.test.js:208-211), while explicit timeout cases retain their 30–40 ms assertions (backend/test/sidecar_client.test.js:72,99,117). No runtime bound or provider gate changed.

No setup script or verification script ran. No download, install, inference, manifest/gate write, model/reference access, or external-network action was performed.

## Findings

None. AUD-TTS-008, AUD-TTS-009, and AUD-TTS-010 are resolved; AUD-TTS-006 and AUD-TTS-007 remain resolved.

## Residual notes

- Provider enablement remains explicitly blocked and out of scope. Both provider manifests still have pinsVerified, licensesResolved, checksumsComplete, and enablementAllowed set false.
- The existing lint warnings and Vite chunk-size advisory are outside the TTS remediation and do not invalidate the audited safety/correctness contract.

## Disposition

PASS — SHIP Phase 3 provider-neutral frontend integration. Keep both neural providers unavailable until a separately approved enablement phase completes provenance, license, hash, lock, lawful private-reference, real offline-load, and hardware-validation gates.
