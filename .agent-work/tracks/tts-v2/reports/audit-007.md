# TTS v2 Phase 3 — Terra Audit 007

- Requirements: v2 approved
- Implementation plan: v1, Phase 3
- Auditor: Terra, independent audit using `scrutinize`
- Scope: status purity and `installed`, bounded/fail-closed frontend status handling, switch/refresh/StrictMode behavior, preview/audio lifetime, typed error redaction, backend authority, timeout-budget regression, and Phase 1/2 compatibility
- Disposition: `CHANGES_REQUIRED` — **fix-then-ship**

## Intent and simpler-alternative pass

The change is meant to make the control panel consume an observation-only provider status API, allow only safe provider switches, and permit preview only for the active ready provider without exposing local credentials or implementation details.

Doing nothing retains the old list-only UI, which cannot safely represent install/readiness state. The smallest sound design is the shared context already added: normalize untrusted status once, make it the sole UI preview owner, and keep the backend as the authority. The remaining direct Voice Conversion preview duplicates that work instead of using this smaller shared path; removing that duplicate ingress is simpler and safer than adding another independent set of guards and cleanup handlers.

## End-to-end trace and verified behavior

- **Pure status and explicit installation:** `GET /api/tts/status` (`backend/src/routes/tts.js:30-37`) calls `TTSManager.getProviderStatuses()` (`backend/src/services/tts/index.js:195-204`), then `NeuralTTSController.getStatus()` (`backend/src/services/tts/neural/neuralTtsController.js:136-153`). The latter calls the bounded install-state observation and returns `installed`; it neither creates a sidecar client nor starts a process. Legacy metadata explicitly sets `installed: true` (`ttsFactory.js:28-43`). The independent default-controller check returned both neural providers as inactive `not_installed`; the backend pure-status test also asserts zero client-factory calls.
- **Shared selector path:** `TTSProviderContext.fetchTTSData()` receives `/status` and `/current` concurrently, generation-owns the result, and normalizes providers before state update (`frontend/src/contexts/TTSProviderContext.jsx:40-62`). Its selection assertion precedes `POST /switch` and rollback restores the prior displayed provider (`76-102`). The HTML select disables nonselectable options (`TTSProviderSelector.jsx:96-125`), while the route independently retains API-key auth and rate limiting (`backend/src/routes/tts.js:39-50`).
- **Shared preview path:** the context requires `active && ready` before requesting preview (`TTSProviderContext.jsx:104-128`), owns the `Audio` instance, pauses it on unmount, and logs only a normalized code (`65-74`, `131-151`). Backend preview remains authoritative and independently rejects an inactive or unready neural provider (`backend/src/services/tts/index.js:116-137`).
- **Timeout bounds:** production limits remain `startupTimeoutMs: 180000` and `requestTimeoutMs: 120000` (`backend/src/services/tts/neural/contracts.js:11-21`). Only the fake-client default test budgets rose to 2000/1000 ms (`backend/test/sidecar_client.test.js:11-30`); forced startup/request/late-producer timeout cases retain 40/40/30 ms (`69-127`).
- **Phase 1/2 seams:** the full backend suite exercised status, fake-sidecar protocol, publication, retention, legacy/RVC, route auth, and shutdown behavior without a provider install or model operation.

## Findings

### AUD-TTS-006 — A contradictory neural installation status is still selectable

- Severity: **Medium**
- Confidence: **High**
- Location: `frontend/src/services/ttsContracts.js:87-106`; missing reciprocal case in `frontend/test/ttsContracts.test.js:40-71`
- Requirement: FR6.2–3 requires malformed/contradictory provider state to fail closed; the Phase 3 handoff explicitly says contradictory installation states and `not_installed` providers cannot be selected.
- Evidence: the normalizer marks a contradiction only when `installed === false` and state is not `not_installed` (`88-90`). With `{ kind: 'neural', installed: true, state: 'not_installed' }`, it leaves `state: 'not_installed'`, has no error code, and calculates `selectable: true` (`99-106`). The independent reproduction returned exactly `{"state":"not_installed","installed":true,"selectable":true}`. `TTSProviderSelector` then renders that option enabled (`116-124`), and `changeProvider()` accepts it before calling the server (`TTSProviderContext.jsx:76-93`).
- Impact: a malformed or inconsistent status response can invite an operator to switch to a provider advertised as not installed. The backend remains the required authority and rejects invalid state, but the frontend fails its stated fail-closed safety property and gives an incorrect actionable control.
- Reproduction: run `normalizeTTSProvider({ id: 'jaitts-f5tts', kind: 'neural', installed: true, state: 'not_installed' })`; the result is currently selectable.
- Short-term fix: make the installation invariant bidirectional for neural providers: reject both `!installed && state !== 'not_installed'` and `installed && state === 'not_installed'` as `TTS_INSTALL_INVALID`/unavailable, therefore nonselectable.
- Long-term prevention: table-test every valid neural `installed × state` combination and assert no contradiction reaches an enabled select option or `assertTTSProviderSelectable`.
- Verification: add the reciprocal assertion to `ttsContracts.test.js`; add an integration-level assertion that an invalid-normalized option cannot issue `switchTTSProvider`; rerun the frontend suite/lint/build and backend auth/status suite.

### AUD-TTS-007 — A reachable Voice Conversion preview bypasses guarded ownership and can log credentials

- Severity: **High**
- Confidence: **High**
- Location: `frontend/src/components/tabs/VoiceConversionTab.jsx:83-113`, `frontend/src/services/api.js:12-20,46-51`, and the reachable control-panel branch `frontend/src/components/ControlPanel.jsx:70-75`
- Requirement: FR6.2–4 requires ready-state preview control, actual provider/RVC state, safe errors, and no paths/reference content/secrets in logs. The Phase 3 handoff further requires active-ready-only preview, browser-audio cleanup, and code-only UI logs.
- Evidence: the Voice Conversion tab remains reachable from `ControlPanel` and calls `previewTTS()` directly with a possibly stale `config['tts.currentProvider']` (`VoiceConversionTab.jsx:91-97`); it checks only nonblank text/its local `playing` flag (`83-86`), not the shared current active/ready status. It creates an untracked `Audio` object with no unmount cleanup (`99-106`) and logs the complete caught error (`110-112`). The API request interceptor adds `x-api-key` from session storage (`api.js:12-20`), and the normalized error retains the original Axios error object (`46-51`), whose request config contains that header and request/response details. The new shared context correctly avoids all three problems, but this reachable parallel path does not use it.
- Impact: the UI can submit a preview while the active provider is loading, failed, inactive, or stale; backend authority prevents unsafe neural synthesis, but the UI contract and UX are bypassed. Navigating away during playback does not pause this audio. On a failed request, browser console output can expose the session API key and preview text/transport/upstream details through `originalError`, violating the explicit redaction boundary.
- Reproduction: set a session API key, visit Control Panel → Voice Conversion, initiate its preview, and force the preview request to fail; `console.error` receives the normalized error whose `originalError.config.headers['x-api-key']` is the key. Independently, use a status where the current neural provider is not ready: this tab still calls `/tts/preview` because it has no readiness guard.
- Short-term fix: remove this direct `previewTTS`/`new Audio` path. Route the tab through a single context-owned preview operation that receives its RVC options, checks active-ready state, owns and pauses audio on cleanup, maps a typed error to bounded copy, and logs only the code. Do not pass or log `originalError` from any TTS UI path.
- Long-term prevention: make the API layer expose only a safe `{ code, status, message }` error shape to UI consumers (or make the raw cause non-enumerable and forbidden in UI logging); add a repository guard/test for direct TTS preview calls outside the shared owner and a component-level unmount/error-redaction test.
- Verification: test non-ready and stale-config Voice Conversion preview cannot issue HTTP; test unmount pauses its audio; force an Axios rejection with a sentinel API key/path/reference/text and assert neither rendered error nor console arguments contain it; rerun the frontend suite/lint/build and backend preview/auth regression tests.

## Independent checks

```text
Frontend node tests                                      20/20 passed
Frontend lint                                            passed (existing warnings only)
Frontend production build                                passed (216 modules)
Backend node tests                                       85/85 passed
Python sidecar unit suite                                20/20 passed
PowerShell parser                                        5/5 passed
PowerShell disposable containment/collision harness      14/14 passed
Actual default neural status                             two inactive/not_installed; no sidecar start
Provider enablement gates                                2/2 false
Backend source/test Node syntax                          74 files passed
git diff --check                                         passed (existing CRLF notices only)
```

No setup or verification script ran. No model, dependency, download, reference, artifact, manifest-gate, or real inference operation was performed.

## Residual notes

- The current pure contract tests cover one direction of installation contradiction but not its reciprocal, and do not exercise React context/component behavior. Thus all 20 frontend tests can pass while both findings remain.
- The full backend suite now passed 85/85 in this independent run. The test-only budget change retains explicit short timeout cases and does not alter FR7 production limits.
- Provider enablement remains explicitly blocked and out of scope.

## Disposition

`CHANGES_REQUIRED` — **fix-then-ship.** The Phase 3 frontend path cannot ship until all reachable preview controls share the active-ready, cleanup, and redaction owner, and contradictory neural installation state is made nonselectable.
