# Remediation Phase R2 Independent Audit — 003

- Requirements version: 1 (approved; unchanged)
- Plan version: 1, including Remediation Phases R1 and R2
- Auditor: Terra (`terra-audit-003`)
- Baseline: `824252a382f1f7f3163c0e2570407981a91f447f`
- Audit date: 2026-07-29 (Asia/Bangkok)
- Disposition: `CHANGES_REQUIRED`
- Finding counts: Critical 0, High 1, Medium 0, Low 0

## Executive summary

R2 independently closes the five carried audit items: the coordinator retains its exclusive drain through late provider settlement; the original PLTE and JPEG state-machine cases reject before inference; manual runs honor post-await visibility; completion TTL/timing boundaries hold; and raw capture/analyzer errors do not reach the public promise, state, or callback channel.

One new High input-validation finding prevents acceptance. The PNG structural gate accepts an invalid nonconsecutive IDAT sequence: a CRC-valid ancillary `tEXt` chunk placed between two otherwise valid `IDAT` chunks is accepted and reaches the analyzer. The PNG standard requires multiple IDAT chunks to be consecutive, and the approved bounded, fail-closed image gate is intended to reject malformed containers before inference. This is the third and final permitted audit cycle; no further remediation may begin without an explicit user decision. Lifecycle disposition after this audit is therefore `USER_DECISION_REQUIRED`.

## Scope and method

- Read the applicable repository instructions; lifecycle skill and artifact contract; Graphify skill and query reference; `.agent-work/README.md`; Requirements v1; the complete Plan v1 including R1/R2; Audits 001/002; both Terra handoffs; both Sol-to-Luna remediation handoffs; both Luna-to-Terra remediation handoffs; and all Terra/Sol/Luna remediation role records through Luna R2.
- Compared current implementation against `824252a`. Implementation scope was the seven changed Phase 1/R1 files: contracts, coordinator, focused backend tests/fixture README, controller, and focused frontend tests. Root lifecycle/status/index/log changes, `.gitignore`, documentation, unrelated dirtiness, and generated `graphify-out/**` were excluded as directed.
- Used Graphify before source inspection. Exact graph-vocabulary expansion: `[adaptive, capture, coordinator, controller, lifecycle, parser, png, jpeg, privacy, release, stream, vision]`. The BFS result located `VisionCoordinator`, `parsePngDimensions`, `parseJpegDimensions`, `AdaptiveCaptureController`, and focused tests. No query result was saved.
- Performed read-only source/diff inspection, synthetic in-memory parser/controller/coordinator reproductions, fixture hash checks, and prescribed validation. No implementation, test, fixture, dependency, Git, machine, lifecycle/index/log, prompt, or Graphify output was modified by this audit.

## Closure matrix

| Finding | State | Independent evidence |
| --- | --- | --- |
| AUD-001 — coordinator timeout/abort one-flight escape | CLOSED | `VisionCoordinator` retains `DRAINING` ownership in `backend/src/services/vision/visionCoordinator.js:194` until settlement. Independent timeout probe returned `VISION_TIMEOUT`, B returned `VISION_BUSY`, late settlement caused 0 store writes and no extra log, and analyzer calls remained 1. Focused timeout/external-abort tests passed. |
| AUD-002 — malformed PNG/JPEG container acceptance | CLOSED for the Audit 002 PLTE/JPEG cases | `backend/src/contracts/vision.js:219-237` implements PLTE color/count/order policy; `:312-344` implements OUTER/SCAN framing. Independent JPEG probe rejected `APP0 + arbitrary bytes + EOI` and accepted `APP0 + immediate EOI`; full palette/multi-scan tests passed. New AUD-006 identifies a separate PNG IDAT-order bypass. |
| AUD-003 — manual post-await visibility escape | CLOSED | `frontend/src/utils/adaptiveCaptureController.js:227-246` checks visibility for every run. Independent sessionless manual-capture probe returned `VISION_HIDDEN`, made 0 analyzer calls, aborted/released once, scheduled 0 callbacks, and ended hidden with `inFlight: false`. |
| AUD-004 — completion freshness/TTL conflict | CLOSED | `normalizeObservation()` at `backend/src/contracts/vision.js:466-487` retains admission-only freshness and completion-relative TTL. Independent six-minute probe returned `analysisMs: 360000` and exact `ttlMs: 120000`; focused boundary tests passed. |
| AUD-005 — raw public error rethrow | CLOSED | Controller catch at `frontend/src/utils/adaptiveCaptureController.js:267-273` constructs a new allowlisted error. Independent raw-capture probe returned a distinct `VISION_ANALYSIS_FAILED` error with no cause or synthetic text in promise/state; focused capture/analyzer privacy tests passed. |

## Checks passed

- Coordinator: validation precedes analyzer invocation; timeout/external abort reject promptly, preserve exclusive drain until provider settlement, and discard late result/error without store/log side effects. Completion owns its flight through normalization, store, sanitized metadata telemetry, and release.
- Timing/TTL: exact five-minute admission age and 30-second future-skew boundaries remain strict; valid six-minute completion stores a 120-second completion-relative observation; elapsed `>=480000` ms times out without storage.
- PNG PLTE: all-chunk CRC, first/unique IHDR, color/depth pairs, indexed palette requirement/capacity, grayscale prohibition, truecolor optional palette, duplicate/post-IDAT/invalid-size rejection, terminal IEND, and analyzer noninvocation tests pass.
- JPEG: explicit SCAN-to-OUTER transition accepts immediate post-scan EOI and bounded stuffed/restart/multi-scan framing while rejecting arbitrary outer bytes; the parser is bounded, forward-only, and does not decode entropy.
- Controller: manual/periodic one-flight ownership, visibility/stream terminal handling, generation isolation, exactly-once frame/stream release, final `inFlight: false`, no stale scheduling, and terminal-state preservation pass focused tests.
- Privacy: raw frames/summaries/provider bodies are absent from coordinator logger payloads and public controller state/callbacks; raw injected error objects, messages, causes, and custom fields do not cross the public error channel.
- Scope: no route, model/provider integration, browser/DOM host, persistence, Live2D, package/dependency/lockfile/config, or machine change is present in the implementation diff. Synthetic fixture SHA-256 values match their README: PNG `431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460`; JPEG `9dacf9b93ef343cb1b10d45dcd84959c4448a68d0859d818cc3decfb7dbf619f`; WebP `52dc24c0429ea6ccc5b579a6da8bb79bf41e471fe5108a62009f3c2e195551c0`.

## Finding

### AUD-006 — PNG parser accepts nonconsecutive IDAT chunks and invokes the analyzer

- Severity: High
- Confidence: High
- Category: input validation / privacy-resource boundary
- Location: `backend/src/contracts/vision.js:229-231` (`IDAT` is tracked only as a Boolean; no image-data phase closes when an intervening ancillary chunk occurs).
- Affected requirement / references: Requirements R2.7 (unsupported/malformed media fails closed before work); Plan R1 AUD-002 bounded complete-container policy; Plan R2 retained PNG critical-order validation. The [W3C PNG Specification, Third Edition](https://www.w3.org/TR/png-3/) states that multiple IDAT chunks shall be consecutive with no intervening chunks.
- Evidence: The parser allows structurally bounded, CRC-valid ancillary chunks after `sawIdat` and permits a later `IDAT` by merely setting `sawIdat = true`. It has no `idatClosed`/phase state. A read-only mutation of the deterministic PNG produced `IDAT(original) -> tEXt("k\\0v", valid CRC) -> IDAT(copy) -> IEND`. `validateCaptureRequest()` accepted the 106-byte input as 1×1. At coordinator level, the same malformed input completed normally and the injected analyzer call count was 1.
- Impact: An invalid PNG bypasses the mandatory pre-inference structural gate, consuming the single-flight analyzer/frame boundary despite the fail-closed privacy and resource-control policy.
- Reproduction: Decode `backend/test/fixtures/vision/tiny-png.base64`; locate its IDAT and IEND chunks; insert a CRC-valid `tEXt` chunk with bytes `6b 00 76` after the original IDAT; append an exact copy of that IDAT before IEND; submit matching 1×1 PNG metadata at an admitted timestamp. Current result: accepted dimensions and one analyzer invocation. The mutation is in memory only.
- Short-term fix: Track explicit PNG image-data phase. Once any non-IDAT chunk occurs after the first IDAT, reject every later IDAT; retain consecutive IDAT chunks as legal. Add the constructed mutation to contract and coordinator analyzer-noninvocation tests.
- Long-term prevention: Maintain a table-driven PNG critical-order suite covering consecutive multi-IDAT acceptance and each illegal intervening ancillary/critical transition, alongside strict-prefix and CRC corpus cases.
- Verification criteria: (1) two consecutive CRC-valid IDAT chunks accept; (2) `IDAT -> tEXt -> IDAT -> IEND`, `IDAT -> PLTE -> IDAT`, and any post-image-data critical transition reject with `VISION_INVALID_IMAGE`; (3) each rejected variant yields zero coordinator analyzer calls; (4) existing PNG/JPEG/WebP and R2 regression suites remain passing.
- Disposition: Required. Because this is Audit 003, remediation requires explicit user authority before another cycle.

## Validation evidence

| Command or probe | Result |
| --- | --- |
| `D:\Synthenia\backend> node --test test/vision_contract.test.js test/vision_privacy.test.js` | PASS — 24/24. |
| `D:\Synthenia\backend> npm test` | PASS — 44/44. Existing LLM parser diagnostics appeared as expected test output. |
| `D:\Synthenia\frontend> npm run test:vision` | PASS — 14/14. |
| `D:\Synthenia\frontend> npm run lint` | PASS with 9 existing unrelated warnings. |
| `D:\Synthenia\frontend> npm run build` | PASS; existing 538.42 kB Pixi chunk and plugin-timing warnings remain. |
| `D:\Synthenia> git diff --check 824252a` | PASS; only existing LF-to-CRLF working-copy notices. |
| Decoded fixture SHA-256 probe | PASS — all three documented hashes match. |
| Independent AUD-001/AUD-004 probe | PASS — timeout/busy/late-silence and six-minute 120-second TTL behavior observed. |
| Independent AUD-002 JPEG probe | PASS — arbitrary post-segment bytes reject; immediate EOI accepts. |
| Independent AUD-003/AUD-005 controller probe | PASS — hidden manual cleanup and sanitized raw error channel observed. |
| Independent AUD-006 PNG probe | FAIL — CRC-valid nonconsecutive IDAT container accepted and invoked analyzer once. |

## Residual risks

- This remains a Phase 1 foundation: no route, actual browser capture, provider/model adapter, chat-memory integration, or persistence path is in scope. Their later trust-boundary work remains unaudited here.
- An abort-ignoring analyzer intentionally retains the drain lock until actual settlement. This preserves single-flight privacy/resource control but is not provider force termination.
- Deferred mojibake and High/Critical frontend dependency advisories remain outside the approved remediation scope and continue to prevent lifecycle `COMPLETE` under Requirements v1.
- The audit found no evidence of a raw payload/privacy regression in the corrected controller/coordinator pathways; AUD-006 concerns malformed-input admission before inference.

## Final disposition

`CHANGES_REQUIRED`. AUD-006 is High and unresolved. The three-cycle remediation limit is reached, so the appropriate lifecycle escalation is `USER_DECISION_REQUIRED`; no fourth remediation/audit cycle is authorized without explicit user direction.
