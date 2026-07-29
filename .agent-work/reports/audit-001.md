# Phase 1 Independent Audit — 001

- Requirements version: 1 (approved)
- Plan version: 1
- Auditor: Terra (`terra-audit-001`)
- Audited implementation commit: `824252a382f1f7f3163c0e2570407981a91f447f`
- Date: 2026-07-29 (Asia/Bangkok)
- Disposition: `CHANGES_REQUIRED`

## Executive summary

Phase 1 stays within its intended application scope: no route, browser capture, model call, dependency or lockfile change, persistence path, or Live2D change was introduced. The canonical constants, exact-key contracts, bounded in-memory store, metadata-only coordinator telemetry, deterministic fixture, and client state normalization are substantively present.

However, four correctness/privacy-resilience defects prevent acceptance. Most critically, a timeout or external abort releases the coordinator's single-flight lock before an abort-ignoring provider settles, permitting concurrent analyzer invocations. The image gate also accepts structurally truncated or inconsistent PNG/JPEG/WebP headers despite the required malformed-input fail-closed boundary. Controller cleanup is only checked before a run; a visibility or stream failure during analysis can complete and reschedule. A valid capture can additionally fail after more than five minutes of otherwise permitted analysis because completion re-applies capture freshness.

## Scope and method

- Compared `824252a^..824252a`, including exact changed-file names and the approved Phase 1 handoff.
- Preserved all current uncommitted coordinator documentation/index changes and existing Graphify local files as out of scope.
- Graphify was consulted before direct source inspection. Exact graph-vocabulary expansion selected: `[vision, capture, observation, contract, privacy, short, term, metadata]`. BFS query located the Phase 1 cluster (`vision.js`, `VisionCoordinator`, `ShortTermObservationStore`, controller, and tests). No graph result was retained.
- Inspected the new backend contracts/config/store/coordinator, frontend contracts/controller, fixture documentation, focused tests, package-script diff, and commit scope.

## Checks passed

- Commit scope contains the approved Phase 1 modules/tests and the authorized `frontend/package.json` script; no dependency or lockfile diff, mounted route, browser API, Ollama call, database/memory-service import, or Live2D change was found.
- Config values match the approved v1 bounds: versions/modes/MIME allowlist, 1.5 MB, 1280×720, 5 s base, 1.25 factor, 60 s cap, 8-minute timeout, 120-second TTL, 800-character summary, and one configured concurrent analysis.
- Metadata and observation contracts enforce exact top-level keys, reject prohibited sensitive keys recursively, normalize summary whitespace, use fixed untrusted delimiters, and validate TTL equality.
- The store is RAM-only/latest-only, returns defensive copies, expires eagerly at 120 seconds, and has idempotent `clear()`.
- Coordinator logger payloads are restricted to sanitized request ID, mode, byte count, dimensions, outcome, and elapsed time; direct provider error text is not logged. No durable write interface exists in these modules.
- Fixtures are deterministic, 1×1, non-sensitive, and decoded only in memory.
- Independent validation passed: backend `npm test` 31/31; frontend `npm run test:vision` 7/7; frontend lint passed with the same 9 pre-existing warnings; production build passed with the existing large Pixi chunk warning; commit and current-worktree `git diff --check` passed (the latter emitted existing line-ending warnings).

## Findings

### AUD-001 — Timeout/abort breaks the one-flight concurrency guarantee

- Severity: High
- Confidence: High
- Category: concurrency / resource control
- Location: `backend/src/services/vision/visionCoordinator.js:99`, `backend/src/services/vision/visionCoordinator.js:129-134`
- Requirement / plan reference: R2.4 and R2.7; Phase 1 `VisionCoordinator` pseudocode and required backend behavior (one flight, hard timeout/abort, no queue).
- Evidence: `Promise.race()` rejects immediately when the timer or external signal aborts, and `finally` sets `this.inFlight = false` without waiting for `analysisPromise`. An analyzer that ignores `AbortSignal` therefore continues holding its bytes/work while a second request starts. Independent reproduction: a first analyzer remained unsettled after `VISION_TIMEOUT`; a second `analyze()` succeeded and the analyzer call count became 2.
- Impact: Violates the maximum-concurrent-analysis and single-flight privacy/resource boundary. A slow or non-cooperative provider can create concurrent image processing and retained frame references after a timeout or cancellation.
- Reproduction: Inject an analyzer promise that does not settle on abort and a controllable timeout. Start request A, trigger timeout, await `VISION_TIMEOUT`, then start request B before resolving A; two analyzer calls occur.
- Recommendation: Introduce an internal draining-flight state that remains exclusive until the underlying provider promise settles.
- Short-term fix: Keep the flight occupied until the underlying analyzer settles, while still returning the timeout/abort outcome promptly; prevent a replacement request from invoking the analyzer during that drain period. Ensure late settlement cannot store/log provider data.
- Long-term prevention: Define and test a provider-cancellation contract with a drain state/metric and bounded adapter cleanup.
- Verification criteria: Add timeout and external-abort tests with an abort-ignoring deferred analyzer. Assert B returns `VISION_BUSY`, analyzer calls remain one until A settles, no late store/log payload is emitted, and only then is another analysis admitted.
- Disposition: Required before re-audit.

### AUD-002 — Header parsing accepts malformed/truncated image containers

- Severity: High
- Confidence: High
- Category: input validation / resource exhaustion
- Location: `backend/src/contracts/vision.js:104-167`, `backend/src/contracts/vision.js:170-188`
- Requirement / plan reference: R2.7; Phase 1 required backend behavior and risk control: malformed input and signature/dimension mismatches must fail closed.
- Evidence: Parsers accept only enough bytes to read dimensions, not a structurally complete image. Independent reproductions accepted: a 24-byte PNG through `IHDR` but without its CRC/data/end chunks; a JPEG containing SOI/SOF dimensions but no EOI; and a WebP `VP8X` chunk whose RIFF declared size is zero. All reached `validateCaptureRequest()` as valid 1×1 images.
- Impact: Malformed payloads bypass the pre-inference gate and can consume vision-provider capacity despite the fail-closed contract. It weakens the size/dimension boundary against crafted inputs.
- Reproduction: Use the three minimal buffers described above with matching declared 1×1 metadata; each currently returns an image result instead of `VISION_INVALID_IMAGE`.
- Recommendation: Treat parsed dimensions as necessary but insufficient; require a structurally complete bounded container for every allowlisted format.
- Short-term fix: Validate container completeness and declared lengths before accepting dimensions: PNG chunk structure/CRC and terminal `IEND`; JPEG segment bounds plus an image-completion policy; WebP RIFF size/chunk padding and terminal bounds. Retain the 1.5 MB and dimensions limits before any costly work.
- Long-term prevention: Add corpus/fuzz-style malformed-header tests for every allowlisted MIME and use a proven safe decoder only if an approved dependency decision permits it.
- Verification criteria: The three reproductions reject; valid minimal PNG/JPEG/WebP fixtures accept; signature mismatch, truncation at every parser boundary, inconsistent RIFF length, oversized dimensions, and oversized encoded input reject without analyzer invocation.
- Disposition: Required before re-audit.

### AUD-003 — Mid-flight visibility/stream failure is not cleaned up before completion

- Severity: Medium
- Confidence: High
- Category: lifecycle / privacy cleanup
- Location: `frontend/src/utils/adaptiveCaptureController.js:98-114`, `frontend/src/utils/adaptiveCaptureController.js:164-197`
- Requirement / plan reference: R2.8; Phase 1 required frontend behavior for hidden, ended, disconnected, error, and abort paths.
- Evidence: `sessionIssue()` is called before work begins, but not after `capture()`/`analyze()` settles. When visibility changes to hidden during a deferred analysis, the independent reproduction resolves the analyzer and leaves the controller `{ status: "active", active: true }` with a new 5000 ms periodic schedule rather than releasing the stream/frame and transitioning hidden.
- Impact: A capture session may remain active and schedule another opportunity after the page is hidden or the stream fails during work, contrary to the explicit cleanup/privacy invariant.
- Reproduction: Start periodic mode with injected `readVisibility`, defer `analyze`, change visibility to false, resolve the analysis, then inspect state and scheduler calls.
- Recommendation: Make post-await session validity a required gate before every success state or periodic schedule.
- Short-term fix: Re-check session state after each awaited boundary and before emitting success/rescheduling; on an issue, abort/clear/release and emit the appropriate terminal visible state. Make the host integration invoke the same cleanup on lifecycle events.
- Long-term prevention: Model session generation/epoch ownership so late completions from a stopped or superseded session cannot mutate state or schedule work.
- Verification criteria: Deferred capture/analyze tests for hidden, ended, disconnected, and error transitions assert abort, one release of frame/stream, terminal state, and zero post-failure schedules.
- Disposition: Required before re-audit.

### AUD-004 — Capture freshness is rechecked after analysis and conflicts with the 8-minute timeout

- Severity: Medium
- Confidence: High
- Category: timestamp / correctness
- Location: `backend/src/contracts/vision.js:232-250`, `backend/src/contracts/vision.js:252-276`
- Requirement / plan reference: R2.4 and R2.7; approved hard analysis timeout is 480,000 ms; Phase 1 timestamp/TTL contract.
- Evidence: The coordinator validates `capturedAt` at admission, then `normalizeObservation()` calls `validateCaptureMetadata()` again using `observedAt` after analyzer completion. Since capture maximum age is five minutes, a request that began validly but takes more than five minutes fails with `VISION_TIMESTAMP_STALE`, although it is still inside the approved eight-minute hard timeout. Independent controlled-clock reproduction advanced from admission to six minutes and produced `VISION_TIMESTAMP_STALE` instead of storing the valid normalized result.
- Impact: Long but permitted analyses fail unpredictably before the documented timeout, undermining manual fallback and making behavior inconsistent with the configured 8-minute bound.
- Reproduction: Admit a capture at `T-1s`, advance the injected clock to `T+6m` inside the analyzer, then resolve a valid summary.
- Recommendation: Separate request-admission freshness from observation-expiry validation.
- Short-term fix: Preserve the already validated immutable metadata through completion, or validate capture freshness only at request admission; separately validate observation timestamps/TTL at completion.
- Long-term prevention: Specify timing invariants for admission, inference duration, observation expiry, and clock skew, with boundary tests at 5 minutes and 8 minutes.
- Verification criteria: A valid request completing at 6 minutes stores a 120-second observation; stale-at-admission and future-skew inputs still reject; completion at/after the hard timeout returns the timeout outcome.
- Disposition: Required before re-audit.

## Test adequacy and residual risks

Current tests cover normal single-flight, cooperative timeout abort, basic malformed bytes, initial hidden/ended/disconnected/error state, adaptive delay, stop, and payload-free public state. They do not cover a provider that ignores abort, late provider settlement, external abort, complete-but-malformed JPEG/WebP/PNG containers, mid-flight session invalidation, start/manual contention, or the five-to-eight-minute timing boundary. These omissions allowed the findings above.

No evidence was found that raw frames or derived summaries enter durable memory or logs in Phase 1's new modules. That privacy invariant remains conditional on later route/chat-boundary integration, which Phase 1 intentionally does not implement.

## Disposition

CHANGES_REQUIRED
