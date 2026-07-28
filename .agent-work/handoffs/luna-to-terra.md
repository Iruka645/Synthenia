# Luna to Terra Handoff — Phase 1

- Requirements version: 1 (approved 2026-07-28)
- Plan version: 1
- Implemented phase: Phase 1 — Privacy and scheduling foundation
- Role: Luna (implementation)
- Repository: `D:\Synthenia`
- Status: ready for independent Terra audit

## Changed files

Created the approved Phase 1 files:

- `backend/src/config/visionConfig.js`
- `backend/src/contracts/vision.js`
- `backend/src/services/vision/shortTermObservationStore.js`
- `backend/src/services/vision/visionCoordinator.js`
- `backend/test/fixtures/vision/README.md`
- `backend/test/fixtures/vision/tiny-png.base64`
- `backend/test/vision_contract.test.js`
- `backend/test/vision_privacy.test.js`
- `frontend/src/services/visionContracts.js`
- `frontend/src/utils/adaptiveCaptureController.js`
- `frontend/test/visionContracts.test.js`
- `frontend/test/adaptiveCaptureController.test.js`

Modified only the authorized script entry in `frontend/package.json`:

- Added `test:vision` using Node's built-in test runner.

Workflow evidence was updated in `.agent-work/status.md` and `update-log.md`. The required local `graphify update .` also refreshed `graphify-out/` outputs; no machine-level or external files were touched.

## Implemented behavior

- Canonical immutable backend bounds cover contract version 1, manual/periodic modes, PNG/JPEG/WebP, 1.5 MB encoded bytes, 1280×720 dimensions, 5-second base cadence, 1.25 adaptive factor, 60-second cap, 8-minute timeout, 120-second observation TTL, 800-character summaries, and one concurrent analysis.
- Capture metadata and observations are exact-key, allowlisted contracts with timestamp, MIME, dimension, signature, size, sensitive-field, and expiry validation.
- PNG, JPEG, and WebP header dimensions are checked against declared metadata; malformed or signature-mismatched input fails closed without adding a dependency.
- Provider summaries are whitespace-normalized, bounded, marked `source: screen` and `trust: untrusted`, and rendered through fixed prompt delimiters that explicitly reject visible commands as instructions.
- The short-term store retains one normalized observation in memory, returns a defensive copy, eagerly expires it, and supports idempotent clearing without serialization or persistence hooks.
- The coordinator is dependency-injected, single-flight, timeout/abort aware, provider-error sanitizing, and restricted to metadata-only telemetry. Raw bytes, summaries, prompts, OCR, and provider bodies are never passed to the logger or store.
- The frontend controller has one shared manual/periodic flight, no queue, injected scheduling/clock/state dependencies, adaptive delay calculation, typed busy outcomes, and cleanup for stop, abort, hidden, ended, disconnected, and error states.
- Frontend public errors/statuses are normalized without exposing payloads. Comments and tests state that server validation remains authoritative.
- No route, browser permission, Ollama/model call, React integration, WebSocket event, persistence path, or Live2D change was added.

## Deviations

No approved behavior, dependency, public route, or data-model deviation was made. The deterministic PNG fixture is stored as base64 text with a README explanation so tests decode it in memory and do not require a binary generation step.

## Validation evidence

- `cd D:\Synthenia\backend; npm test` — PASS, 31/31 tests.
- `cd D:\Synthenia\frontend; npm run test:vision` — PASS, 7/7 tests.
- `cd D:\Synthenia\frontend; npm run lint` — PASS with the same 9 pre-existing warnings; no new Phase 1 warning was reported.
- `cd D:\Synthenia\frontend; npm run build` — PASS with the existing large Pixi chunk warning.
- `cd D:\Synthenia; git diff --check` — PASS; Git reported only existing LF-to-CRLF working-copy warnings.
- `cd D:\Synthenia; graphify update .` — PASS; code graph refreshed to 1,675 nodes, 2,386 edges, and 120 communities. Graphify reported its existing zero-node warning for several non-code/config files; no implementation validation failed.

The backend full suite emits its existing parser-test diagnostics and dotenv test notices; these are test output, not new persistence of vision data.

## Limitations and blockers

- This phase intentionally does not validate browser `getDisplayMedia`, an Express route, Ollama vision, model performance, memory exclusion at the chat boundary, or Live2D behavior; those belong to later approved phases.
- The known seven-file Thai encoding regression and frontend dependency advisories remain untouched and explicitly deferred. The two High and two Critical advisories remain lifecycle completion blockers.
- No Terra audit has been run yet. Luna does not self-certify acceptance.

## Terra audit focus

- Verify exact Phase 1 scope against the Sol handoff and ensure no prohibited file, dependency, route, asset, or persistence path changed.
- Independently inspect image signature/dimension validation for PNG/JPEG/WebP malformed-input cases and timestamp/TTL edge cases.
- Audit coordinator timeout, external abort, late provider completion, single-flight behavior, sanitized telemetry, and temporary-reference cleanup.
- Audit controller race behavior for repeated scheduled callbacks, manual/periodic contention, stop during capture/analyze, visibility/stream failures, and final state transitions.
- Confirm tests are deterministic, fixture data is non-sensitive, existing warnings/advisories are accurately preserved, and Graphify evidence is consistent with the actual diff.
