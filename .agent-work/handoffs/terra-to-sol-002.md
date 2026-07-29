# Terra to Sol Handoff — Audit 002

- Audit report: `.agent-work/reports/audit-002.md`
- Disposition: `CHANGES_REQUIRED`
- Requirements / plan: v1 approved / v1 preserved, Remediation Phase R1
- Audited baseline: `824252a382f1f7f3163c0e2570407981a91f447f`

## Closure matrix

| Finding | State | Required action |
| --- | --- | --- |
| AUD-001 | CLOSED | Retain the tested `RUNNING`/`DRAINING` exclusive-flight implementation. |
| AUD-002 | OPEN — High | Correct PNG critical ordering and JPEG post-scan parser state; add regression coverage. |
| AUD-003 | OPEN — Medium | Apply hidden-state validation and cleanup to manual runs after each await. |
| AUD-004 | CLOSED | Retain admission-only freshness and completion-relative TTL behavior. |
| AUD-005 | NEW — High | Sanitize the controller's rejected error channel, not only emitted state. |

## Required actions and correction order

1. Fix **AUD-002** in `backend/src/contracts/vision.js` and its focused contract/privacy tests. Reject CRC-valid but invalid `PLTE` ordering/multiplicity/color cases; restore strict outer marker framing after a JPEG scan ends at a segment marker.
2. Fix **AUD-003** and **AUD-005** in `frontend/src/utils/adaptiveCaptureController.js` and focused tests. Every run must check visibility at post-await boundaries; terminal cleanup remains generation-owned. Replace raw analyzer/capture rethrows with typed, fixed error classification.
3. Re-run the R1 matrix and have Terra independently re-audit; do not alter the closed coordinator/timing behavior unless a regression test demonstrates a necessary correction.

## Optional actions

None. The fixes and tests fit the existing R1 allowed files and need no product decision, dependency, route, browser API, or configuration change.

## Required regression/retest scope

- PNG: CRC-valid `PLTE` inserted after `IDAT`, duplicate `PLTE`, and color-type-incompatible `PLTE` must reject before analyzer invocation.
- JPEG: arbitrary bytes after a scan-ending segment must reject; valid bounded stuffed-byte/restart/multi-scan framing must still accept.
- Controller: deferred manual capture and manual analyze become hidden, reject with `VISION_HIDDEN`, release owned frame once, make no later analyze call after the capture boundary, retain terminal state, and do not schedule.
- Controller error channel: a synthetic raw analyzer failure rejects only as a fixed typed `VISION_ANALYSIS_FAILED` error and leaks no raw text through rejection/state/callbacks.
- Re-run `backend` focused vision tests and `npm test`; frontend `npm run test:vision`, `npm run lint`, `npm run build`; then `git diff --check 824252a` and an R1 scope diff.

## Blockers and re-audit conditions

- Blockers: none. Existing R1 authority and allowed file list are sufficient.
- Re-audit requires the three findings corrected, the specified regressions present and passing, all prior R1 tests still passing, no scope expansion, and a complete Luna remediation handoff/role record.

## Artifact paths

- `.agent-work/reports/audit-002.md`
- `.agent-work/handoffs/terra-to-sol-002.md`
- `.agent-work/agents/terra-audit-002.md`
