# Root to Terra — Phase 3 audit 001

## Audit request

Use `scrutinize` for an independent end-to-end review of the Phase 3 status/switch/preview frontend integration. Root authored the implementation; Terra must not edit product code. Provider setup, verification, downloads, dependency installation, references, real inference, benchmarks, and manifest gate changes remain prohibited.

## Implemented contract

- `GET /api/tts/status` is consumed by the shared TTS context. Frontend state is normalized and bounded before rendering.
- Backend neural statuses now include explicit `installed`; legacy providers report `installed: true`. Status remains observation-only and must never spawn, load, install, hash model bytes, or access private reference content.
- Unknown kinds, unknown states, contradictory installation states, invalid installations, and unknown failures fail closed in the UI.
- `not_installed` and invalid providers cannot be selected. A verified neural provider with `installed: true` and idle `unavailable` may be selected so the backend can perform authoritative offline load/readiness checks.
- Known runtime start failures may be retried; unknown failures remain disabled. `loading` and `busy` cannot be selected.
- Preview is enabled only when the current provider is active and `ready`.
- A failed switch retains the previous displayed provider. A successful switch refreshes the authoritative status/current pair.
- Concurrent/stale status refreshes are generation-owned; React StrictMode cleanup invalidates old responses and releases active browser audio.
- UI errors are mapped from typed codes to bounded copy. Logs contain only an error code, not Axios objects, child output, paths, references, or request headers.
- The Axios normalizer now preserves the backend's top-level `{ error, code }` response shape.
- Fake-sidecar test-only default budgets were increased for Windows process scheduling. Explicit timeout tests retain 30–40 ms deadlines; runtime limits were not changed.

## Files in Phase 3 scope

- `backend/src/services/tts/neural/neuralTtsController.js`
- `backend/src/services/tts/ttsFactory.js`
- `backend/test/neural_tts_controller.test.js`
- `backend/test/tts_compatibility.test.js`
- `backend/test/sidecar_client.test.js`
- `frontend/src/services/api.js`
- `frontend/src/services/ttsContracts.js`
- `frontend/src/contexts/TTSProviderContext.jsx`
- `frontend/src/components/TTSProviderSelector.jsx`
- `frontend/test/ttsContracts.test.js`
- `frontend/package.json`
- `docs/tts-v2-setup.md`

Phase 1/2 files remain in the same uncommitted worktree and are regression scope, not new Phase 3 authorship.

## Root verification evidence

- Backend full suite: `85/85` passed after the explicit installed-status contract and test-only timeout stabilization.
- Backend Node syntax: all `src` and `test` JavaScript files passed.
- Frontend tests: `20/20` passed, including six TTS contract tests.
- Frontend lint: exit 0; only pre-existing warnings plus the established Fast Refresh context-export warning.
- Frontend production build: passed (216 modules).
- Python sidecar tests: `20/20` passed.
- PowerShell parser: `5/5` passed.
- Containment/collision harness: `14/14` passed.
- Both provider `enablementAllowed` gates: confirmed `false`.
- `git diff --check`: passed (line-ending notices only).
- `graphify update .`: passed; 2,761 nodes / 3,872 edges.

No setup/verify script, download, install, model/reference access, real inference, or enablement action was executed.

## Focus areas for Terra

1. Trace backend status purity and the new `installed` field through manager/route/frontend normalization.
2. Try malformed, contradictory, duplicate, unknown, stale, and transition-time status payloads against selection and preview gates.
3. Trace failed/successful switch ordering, rollback display, overlapping refreshes, StrictMode cleanup, and audio failure lifecycle.
4. Verify errors/logs cannot disclose API keys, Axios request objects, child output, paths, private transcript/reference data, or arbitrary upstream messages.
5. Confirm disabled HTML options are only defense in depth and backend authority remains intact.
6. Confirm the fake-sidecar timeout change does not weaken runtime bounds or make explicit timeout tests vacuous.
7. Re-run safe tests only. Do not run setup/verify scripts or any provider/model operation.
