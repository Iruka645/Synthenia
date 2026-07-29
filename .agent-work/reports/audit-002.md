# Remediation Phase R1 Independent Audit — 002

- Requirements version: 1 (approved; unchanged)
- Plan version: 1 (preserved), including `Remediation Phase R1 — Audit 001`
- Auditor: Terra (`terra-audit-002`)
- Baseline commit: `824252a382f1f7f3163c0e2570407981a91f447f`
- Audit date: 2026-07-29 (Asia/Bangkok)
- Disposition: `CHANGES_REQUIRED`

## Executive summary

R1 correctly implements the core coordinator drain model and separates admission freshness from completion validation. Its scoped diff also retains the intended dependency-free, bounded parsers; genuine synthetic fixture hashes match their documented values; no route, package, lockfile, provider/model, browser, persistence, Live2D, or machine change was found in the R1 implementation scope.

The remediation is not ready to close. `AUD-002` remains open because the PNG parser accepts a CRC-valid critical `PLTE` chunk after `IDAT`, and the JPEG parser accepts arbitrary bytes after a post-scan segment before `EOI`. `AUD-003` remains open for manual work without a periodic session: post-await visibility changes are not checked, so a hidden page can still analyze a newly captured frame. A new high-severity error-channel finding (`AUD-005`) is also required: the controller publishes a normalized error state but rethrows the raw analyzer error, contrary to the R1 prohibition on provider bodies in errors.

Finding counts: Critical 0, High 2, Medium 1, Low 0.

## Scope and method

- Compared the current worktree with `824252a`; implementation findings include only the R1-approved backend contracts/coordinator, frontend controller, focused tests, and two permitted fixtures. Root-owned lifecycle registry/log/index changes, unrelated dirty work, and generated `graphify-out/**` changes were excluded.
- Read the approved requirements, complete plan including the delimited R1 section, Audit 001, both Terra/Sol handoffs, Luna's remediation handoff, and Luna's role record before auditing code.
- Consulted Graphify before source inspection. Exact-vocabulary expansion was `[vision, coordinator, capture, observation, contract, controller, timeout, abort, flight, png, jpeg, webp]`; the BFS query identified the contracts, coordinator, controller, store, and tests. No query result was saved.
- Inspected the complete current `vision.js`, `visionCoordinator.js`, `adaptiveCaptureController.js`, focused tests, fixture provenance, and scoped diff. Read-only one-off reproductions used only the committed synthetic fixtures and in-memory buffers/promises.

## Original finding closure matrix

| Audit 001 finding | Re-audit state | Evidence |
| --- | --- | --- |
| AUD-001 — timeout/abort one-flight escape | CLOSED | Active-flight `RUNNING`/`DRAINING` ownership retains the frame/admission lock until provider settlement; focused timeout and external-abort tests cover late fulfillment/rejection. |
| AUD-002 — malformed container acceptance | OPEN | Two malformed but accepted structural cases remain; detailed below. |
| AUD-003 — mid-flight lifecycle escape | OPEN | Periodic-session paths are improved, but manual execution skips visibility/session checking after awaits; detailed below. |
| AUD-004 — completion re-applies admission freshness | CLOSED | Completion normalization disables capture-age freshness while observation TTL/skew and the `<480000`/`>=480000` boundary are enforced. |

## Checks passed

- `VisionCoordinator` validates before analyzer invocation; an already-aborted external signal returns `VISION_ABORTED`; a timeout or external abort transitions the owned flight to `DRAINING`, rejects promptly, emits one metadata-only outcome, and releases only after the provider settles. The settlement handlers are attached immediately, and focused late-rejection coverage passed without an unhandled-rejection failure.
- Normal coordinator completion retains ownership through normalization, store write, sanitized log, resolve, and identity-checked release. Logger fields are limited to request ID, mode, byte count, dimensions, outcome, and elapsed milliseconds.
- Timestamp behavior now admits captures exactly at the five-minute-age / 30-second-future-skew limits, permits a valid six-minute completion, creates an exact completion-relative 120-second TTL, and rejects completion at elapsed `>=480000` ms without storage.
- PNG uses an unsigned CRC-32 over every chunk; fixture strict-prefix coverage passes for PNG/JPEG/WebP. JPEG handles stuffed bytes, restart markers, and later `SOS` markers without decoding pixels. WebP checks exact RIFF size, chunk bounds, odd zero padding, still-image primary chunks, `VP8X` dimensions, and animation rejection.
- Decoded fixture hashes independently match the fixture README: PNG `431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460`, JPEG `9dacf9b93ef343cb1b10d45dcd84959c4448a68d0859d818cc3decfb7dbf619f`, and WebP `52dc24c0429ea6ccc5b579a6da8bb79bf41e471fe5108a62009f3c2e195551c0`.
- Periodic controller runs now have generation/run ownership, idempotent frame/stream release, post-await checks, stale-timer protection, no queueing, and valid 5-second / factor / 60-second scheduling coverage.
- The current R1 implementation diff is limited to approved implementation/test/fixture files, plus root-owned lifecycle and generated Graphify artifacts. No scoped package, lockfile, config, route, persistence, model/provider, browser/DOM, Live2D, or machine change was found.

## Findings

### AUD-002 — Structural parsers still admit malformed critical/order states

- Severity: High
- Confidence: High
- Category: input validation / privacy-resource boundary
- Location: `backend/src/contracts/vision.js:216-224` and `backend/src/contracts/vision.js:306-335`
- Affected requirement: R2.7; Phase 1 malformed-input fail-closed boundary; R1 AUD-002 PNG critical-chunk/order and JPEG outside-entropy marker-framing policies.
- Evidence: `parsePngDimensions()` recognizes `PLTE` as a known critical type but records neither its order nor multiplicity. An in-memory mutation that inserts a CRC-valid three-byte `PLTE` after the fixture's `IDAT` and before `IEND` is accepted as a 1x1 PNG, although `PLTE` is a critical pre-image-data chunk and is invalid for the fixture's color type. Separately, after scan data ends at a segment marker, `parseJpegDimensions()` leaves `inScan` true. An `APP0` segment followed by arbitrary bytes then `EOI` is consequently accepted: those arbitrary bytes are incorrectly skipped as entropy data even though they occur after a parsed segment.
- Impact: The pre-inference gate still passes malformed containers to the analyzer. This violates the accepted fail-closed structural contract and lets crafted image bytes consume the single-flight analyzer/frame boundary.
- Reproduction: With the documented valid fixtures and otherwise matching 1x1 metadata, (1) compute a valid PNG CRC for `PLTE` data and insert that chunk after `IDAT`; `validateCaptureRequest()` returns image dimensions, and (2) insert `FF E0 00 02 12 34` immediately before the JPEG's terminal `FF D9`; the same validator returns image dimensions. Both probes were in-memory only.
- Recommendation: Model PNG critical-chunk state/order explicitly and return to an outside-scan JPEG marker state whenever an entropy scan terminates at a non-restart/non-stuffed marker.
- Short-term fix: Reject duplicate, post-`IDAT`, or incompatible `PLTE` chunks and enforce the selected PNG color-type ordering rules. In JPEG, set `inScan` false before parsing a segment found from scan data; require the next outer marker immediately after that segment and set `inScan` true only after a valid `SOS`.
- Long-term prevention: Add generated structural mutation coverage for all critical PNG ordering states and JPEG scan-to-segment-to-scan/EOI transitions, then retain a small deterministic malformed-container corpus beside the fixtures.
- Verification criteria: CRC-valid `PLTE` after `IDAT`, duplicate `PLTE`, and `PLTE` invalid for the declared color type reject before analyzer invocation. JPEG bytes between a post-scan segment and the next marker reject, while a deliberately valid stuffed/restart/multi-scan structural sequence remains accepted and bounded.
- Disposition: Required before re-audit; AUD-002 remains OPEN.

### AUD-003 — Manual work does not terminate when visibility changes during an awaited boundary

- Severity: Medium
- Confidence: High
- Category: lifecycle / privacy cleanup
- Location: `frontend/src/utils/adaptiveCaptureController.js:181-195`, `frontend/src/utils/adaptiveCaptureController.js:227-236`, and `frontend/src/utils/adaptiveCaptureController.js:246-253`
- Affected requirement: R2.8; R1 AUD-003 generation-owned cleanup rules requiring hidden/ended/disconnected/error handling at each post-await boundary for each execution.
- Evidence: `manualSnapshot()` calls `execute()` with no session while periodic mode is off. `ensureRunValid()` calls `sessionIssue()` only when `run.session` exists, so it does not check `readVisibility()` for that execution. In a deferred in-memory manual capture, changing `readVisibility()` from true to false before resolving the frame still invokes `analyze()` once and completes the state as `idle/completed`; it does not emit `hidden` or abort the run.
- Impact: A manual frame can be analyzed after the page is hidden, contrary to the terminal lifecycle/privacy boundary. The R1 tests cover the eight periodic-session issue/boundary combinations but omit their manual counterpart.
- Reproduction: Construct `AdaptiveCaptureController` with a deferred `capture`, `readVisibility: () => visible`, and an analyzer call counter. Start `manualSnapshot()`, set `visible = false`, resolve capture, and await the call. Current result: `{ calls: 1, status: "idle", outcome: "completed" }` rather than `VISION_HIDDEN`.
- Recommendation: Make visibility a run-level validity check independent of whether the run owns a periodic stream/session.
- Short-term fix: Have `ensureRunValid()` evaluate page visibility for every run, then evaluate stream-ended/disconnected/error state when a stream exists. On either failure, invalidate that generation, abort/release owned resources once, and preserve the terminal state.
- Long-term prevention: Keep a table-driven lifecycle suite that executes every terminal state at every awaited boundary for both periodic and manual ownership modes.
- Verification criteria: Deferred manual capture and deferred manual analyze cases that become hidden reject with `VISION_HIDDEN`, invoke no later analyzer after a capture-boundary failure, release a returned frame exactly once, retain the terminal state, and never schedule.
- Disposition: Required before re-audit; AUD-003 remains OPEN.

### AUD-005 — Controller rethrows raw analyzer errors after producing a sanitized state

- Severity: High
- Confidence: High
- Category: privacy / error handling
- Location: `frontend/src/utils/adaptiveCaptureController.js:261-267`
- Affected requirement: R2.6 and R2.8; R1 constraint prohibiting image/prompt/OCR/summary/provider bodies in errors; R1 controller requirement for sanitized error classification.
- Evidence: The catch path derives `normalizeVisionError(error).code` for state, then executes `throw error`. A read-only manual-snapshot reproduction whose analyzer rejects with `Error('provider-response: synthetic-sensitive-text')` receives that exact raw message at the controller's public promise while state correctly reports `VISION_ANALYSIS_FAILED`.
- Impact: A future caller can display, retain, or log provider error bodies that may contain screen-derived text or prompts, bypassing the intended metadata-only/sanitized error boundary.
- Reproduction: Inject a normal capture and an analyzer that rejects with a synthetic provider-body string, call `manualSnapshot()`, and inspect the rejection. Current result has no normalized code and preserves the full raw message.
- Recommendation: Make the controller's rejection channel use the same allowlisted error classification as its state channel.
- Short-term fix: In the current-run catch path, throw `createVisionError(normalized.code)` (or an equivalent fixed-message typed error) after cleanup; preserve terminal lifecycle codes for stale/aborted runs without exposing the original error object.
- Long-term prevention: Define one shared frontend error adapter and assert that public state, rejection, telemetry, and UI notifications never serialize a raw analyzer/capture error.
- Verification criteria: A raw analyzer rejection produces only `VISION_ANALYSIS_FAILED` and its fixed public message/code; the synthetic raw text is absent from the rejected error, emitted state, and all callbacks. Existing abort/hidden/ended/disconnected codes remain typed and unchanged.
- Disposition: Required before re-audit; new finding.

## Validation evidence

| Command | Result |
| --- | --- |
| `D:\Synthenia\backend> node --test test/vision_contract.test.js test/vision_privacy.test.js` | PASS — 21/21 focused tests. |
| `D:\Synthenia\backend> npm test` | PASS — 41/41 tests. Existing LLM-provider parser diagnostics appeared as expected test output. |
| `D:\Synthenia\frontend> npm run test:vision` | PASS — 12/12 tests. |
| `D:\Synthenia\frontend> npm run lint` | PASS with 9 pre-existing warnings in TTSProviderSelector, UIContext, TTSProviderContext, audioAnalyser, ControlPanel, and AvatarCanvas. |
| `D:\Synthenia\frontend> npm run build` | PASS with the existing Vite warning for the 538.42 kB Pixi chunk. |
| `D:\Synthenia> git diff --check 824252a` | PASS — no whitespace errors; only existing LF-to-CRLF working-copy notices. |
| Fixture hash probe and three focused read-only reproductions | Hashes match; parser/order, manual-hidden, and raw-error issues reproduced as documented. |

## Residual risks and scope notes

- R1 remains a pure foundation: it mounts no route and has no browser capture, provider/model call, or durable screen-data integration. Later Phase 3 still needs its route/authentication, actual-track, and persistence-boundary audit.
- The intentionally deferred mojibake and frontend dependency advisory findings remain outside R1 and continue to block lifecycle completion under Requirements v1; they were not reclassified as R1 implementation defects.
- The desired drain policy intentionally leaves an abort-ignoring provider exclusive until actual settlement. This avoids multiplied processing but is not a forced provider-termination mechanism.
- No blocker or additional authority is required to remediate the listed findings within the R1 allowed controller/contracts/tests/fixtures scope.

CHANGES_REQUIRED
