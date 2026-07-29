# Terra to Sol Handoff — Audit 001

- Audit report: `.agent-work/reports/audit-001.md`
- Disposition: `CHANGES_REQUIRED`
- Requirements / plan: v1 / v1
- Audited commit: `824252a382f1f7f3163c0e2570407981a91f447f`

## Prioritized required corrections

1. **AUD-001 (High):** retain the coordinator's single-flight admission lock until an abort-ignoring analyzer settles; timeout/external abort must not permit a second analyzer concurrently.
2. **AUD-002 (High):** make PNG/JPEG/WebP container validation fail closed for truncated/inconsistent headers before analyzer invocation.
3. **AUD-003 (Medium):** re-check and clean up hidden/ended/disconnected/error session state after async capture/analyze boundaries, before success or rescheduling.
4. **AUD-004 (Medium):** do not reapply five-minute capture freshness at completion after valid request admission; preserve the eight-minute timeout contract.

## Required regression tests

- Abort-ignoring deferred analyzer for both timeout and external abort: second request is `VISION_BUSY` until the first provider promise settles; no late result reaches store/logger.
- Valid minimal PNG/JPEG/WebP fixtures plus truncated/structurally inconsistent variants, including PNG before CRC/IEND, JPEG without completion, and WebP RIFF-size mismatch. Invalid variants must not invoke analyzer.
- Deferred capture and deferred analyze tests that flip hidden/ended/disconnected/error during work: terminal status, abort, exactly-once frame/stream cleanup, and no reschedule.
- Controlled-clock tests: valid admission completed at six minutes succeeds with a 120-second observation; stale-at-admission and timeout behavior remain rejected/aborted as applicable.

## Correction order and re-audit conditions

Address the two High findings first, then controller lifecycle and timing behavior. Keep implementation within Phase 1's approved modules/tests; do not add routes, dependencies, lockfile changes, browser capture, persistence, or model calls. Re-audit requires focused backend/frontend tests, full backend test suite, frontend vision tests/lint/build, `git diff --check`, and evidence that no raw frames/descriptions are added to logs or durable storage.

## Open questions

None requiring product authority. The implementation should define an internal drain/late-settlement policy without expanding the approved public contract.
