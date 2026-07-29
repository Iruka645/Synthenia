# Sol to Luna Handoff — Remediation 002

- Requirements version: 1 (approved 2026-07-28; unchanged)
- Plan version: 1 (preserved), including the append-only R1 and R2 sections
- Assigned phase: `Remediation Phase R2 — Audit 002`
- Incoming audit: `.agent-work/reports/audit-002.md`
- Finding disposition: AUD-001/AUD-004 closed and retained; AUD-002/AUD-003/AUD-005 accepted and in scope
- Role: Luna (implementation/remediation)
- Repository: `D:\Synthenia`
- Status: ready
- User-authority blocker: none

## Read first

Read completely, in this order:

1. `D:\Synthenia\AGENTS.md`
2. `C:\Users\sanak\.codex\skills\orchestrate-code-lifecycle\SKILL.md`
3. `C:\Users\sanak\.codex\skills\orchestrate-code-lifecycle\references\artifact-contracts.md`
4. `D:\Synthenia\.agent-work\README.md`
5. `D:\Synthenia\.agent-work\requirements.md`
6. `D:\Synthenia\.agent-work\implementation-plan.md`, especially `Remediation Phase R1 — Audit 001` and `Remediation Phase R2 — Audit 002`
7. `D:\Synthenia\.agent-work\reports\audit-001.md`
8. `D:\Synthenia\.agent-work\reports\audit-002.md`
9. `D:\Synthenia\.agent-work\handoffs\terra-to-sol.md`
10. `D:\Synthenia\.agent-work\handoffs\terra-to-sol-002.md`
11. `D:\Synthenia\.agent-work\handoffs\sol-to-luna-remediation-001.md`
12. `D:\Synthenia\.agent-work\handoffs\luna-to-terra-remediation-001.md`
13. `D:\Synthenia\.agent-work\agents\luna-remediation-001.md`
14. this handoff

The repository has unrelated dirty/untracked work. Preserve it. Consult the existing Graphify graph before broad code browsing, but do not treat dirty generated graph files as a blocker.

## Required outcome

Implement only R2 and make the three accepted findings ready for independent Terra Audit 003:

- AUD-002 — High: enforce exact PNG `PLTE` legality/order/multiplicity/color-type/count rules and transition JPEG parsing out of entropy mode when a marker is encountered.
- AUD-003 — Medium: validate visibility for every manual run after capture and analysis awaits, even when no periodic session/stream exists.
- AUD-005 — High: reject only with a newly constructed allowlisted typed error; never rethrow a raw capture/analyzer error.

Do not modify or reinterpret the closed findings:

- AUD-001: retain coordinator `RUNNING`/`DRAINING` exclusivity and late-settlement silence.
- AUD-004: retain admission-only freshness, completion-relative TTL, and timeout boundaries.

The R2 plan section contains the controlling algorithms and matrix. If this handoff is less specific, the plan controls.

## Exact allowed files

Modify only:

- `backend/src/contracts/vision.js`
- `backend/test/vision_contract.test.js`
- `backend/test/vision_privacy.test.js`
- `frontend/src/utils/adaptiveCaptureController.js`
- `frontend/test/adaptiveCaptureController.test.js`

Create only:

- `.agent-work/agents/luna-remediation-002.md`
- `.agent-work/handoffs/luna-to-terra-remediation-002.md`

Generated-validation exception:

- `graphify-out/**` may change only through the required `graphify update .`; do not hand edit, delete, clean, or normalize it.

No fixture file or README change is authorized. Use only in-memory mutations of the existing deterministic fixtures.

Do not edit `visionCoordinator.js`, `visionConfig.js`, the store, `frontend/src/services/visionContracts.js`, packages/lockfiles, routes, providers/models, application integration, persistence/memory/database/Socket.IO, browser/DOM hosts, Live2D, requirements, plan, audits, existing handoffs/roles, status, update log, docs/indexes, `.gitignore`, machine state, or unrelated work. Do not commit or push.

## Required implementation behavior

### PNG palette policy

Preserve the current signature, forward chunk framing, bounds, all-chunk CRC, unknown-critical rejection, first/unique `IHDR`, color/depth allowlist, `IDAT`, terminal `IEND`, and no-trailing-data behavior.

Track validated `bitDepth`, `colorType`, `sawPlte`, and `sawIdat`.

- `PLTE` must appear after `IHDR`, at most once, and before the first `IDAT`.
- Length must be a nonzero multiple of 3; entry count must be 1–256.
- Color type 3 requires exactly one `PLTE`; entries must be `<= 2 ** bitDepth`.
- Color types 0 and 4 forbid `PLTE`.
- Color types 2 and 6 permit zero or one valid pre-`IDAT` `PLTE`.
- Duplicate, post-`IDAT`, too-large, zero, partial-entry, forbidden-color, and missing-indexed palettes reject.

Do not decompress pixels or change ancillary-chunk policy.

### JPEG framing state

Use explicit `OUTER` and `SCAN` states.

- In `SCAN`, continue over ordinary entropy bytes, `FF 00`, fill `FF`, and restart `FF D0..D7`.
- Any other marker ends the scan. Transition to `OUTER` before interpreting that already-consumed marker.
- Parse that marker once using outer framing.
- A valid `SOS` is the only action that re-enters `SCAN`.
- APP/DQT/DHT/DRI/COM/other bounded variable segments leave the parser in `OUTER`.
- After such a segment, require the next byte to begin an outer marker; arbitrary/entropy-like bytes reject.
- EOI may terminate directly from a scan or immediately after an outer segment, but only after valid SOF/SOS and at exact buffer end.

Retain supported SOF, segment/component validation, standalone-marker rejection, stuffed/restart behavior, multi-scan acceptance, and bounded one-pass work.

### Manual visibility and cleanup

`ensureRunValid(run)` must check:

1. active-run/generation/signal ownership;
2. page visibility for every run;
3. ended/disconnected/error only when a stream exists.

Apply it before capture, after assigning the frame returned by capture, after analyze, and immediately before success/rescheduling. For a sessionless manual run becoming hidden at either await boundary:

- reject typed `VISION_HIDDEN`;
- analyze count is zero after capture-boundary failure and one after analyze-boundary failure;
- abort once;
- release the acquired frame once and no stream;
- retain `hidden`, `active: false`, `errorCode: VISION_HIDDEN`;
- after owned finalization, public/internal `inFlight` is false;
- emit no later success and never schedule.

Finalization may publish an `inFlight: false` patch only when the run still owns the slot; preserve its terminal status/outcome/error. A stale run may not mutate a later generation.

### Public error channel

Always normalize a caught input error, then:

```text
if current run:
  invalidateGeneration("error", normalized.code)
throw createVisionError(normalized.code)
```

Never throw the input object. Known lifecycle codes stay allowlisted; unknown/raw capture or analyzer errors become `VISION_ANALYSIS_FAILED`. Do not copy message, stack, cause, response/body, custom fields, or identity. Raw text must be absent from the public rejection, current state, `onStateChange` history, and all controller outputs. Existing hidden/stopped/ended/disconnected terminal state must not be overwritten.

## Exact regression matrix

### Backend

- Existing valid PNG/JPEG/WebP, strict-prefix, CRC, critical, SOF/SOS/EOI, stuffing/restart, RIFF, timing, drain, privacy, and analyzer-noninvocation tests remain passing.
- PNG accepts a test-built indexed variant with one valid pre-`IDAT` entry.
- PNG rejects indexed-without-palette, indexed entries beyond bit-depth capacity, color 0/4 palette, zero/partial/257-entry palette, duplicate palette, and CRC-valid post-`IDAT` palette.
- PNG color types 2/6 accept no palette and one valid pre-`IDAT` palette.
- JPEG rejects the Audit 002 `post-scan APP0 length=2 + arbitrary bytes + EOI` mutation.
- JPEG accepts a bounded post-scan segment immediately followed by EOI.
- JPEG accepts a bounded segment followed immediately by a copied valid SOS, scan bytes containing stuffed and restart markers, and terminal EOI.
- Adding one arbitrary byte between that segment and the next marker rejects.
- Representative invalid PLTE and JPEG state mutations leave coordinator analyzer count zero.
- AUD-001 drain and AUD-004 timing tests remain unchanged and passing.

Build CRC-valid PNG chunks and JPEG sequences in memory; create no fixture.

### Frontend

- Table-test sessionless manual hidden transitions at deferred `capture` and `analyze`.
- Assert typed code, analyzer count, abort once, frame release once, zero stream release, terminal hidden state with `inFlight: false`, no success overwrite, and zero schedule.
- For raw capture and analyzer errors separately, inject unique synthetic sensitive strings/custom fields; assert the rejection is a different fixed typed `VISION_ANALYSIS_FAILED` error and the raw values are absent from rejection/state/state-callback history/output.
- Capture failure releases no frame; analyzer failure releases its frame once; both finish `error`, inactive, not in flight, and unscheduled.
- Retain typed `VISION_ABORTED` on stop/late settlement, typed `VISION_HIDDEN` on visibility invalidation, existing stream terminal codes, periodic generation cleanup, busy/no-queue, stale callbacks, manual success, payload-free state, and adaptive delay.

Tests use injected clocks, schedulers, promises, signals, streams, and synthetic strings only. No network, browser, screenshot, model, database, filesystem write, or real-time wait.

## Validation commands

Run and record exact results:

```text
cd D:\Synthenia\backend
node --test test/vision_contract.test.js test/vision_privacy.test.js
npm test

cd D:\Synthenia\frontend
npm run test:vision
npm run lint
npm run build

cd D:\Synthenia
git diff --check
graphify update .
git status --short
```

Inspect the final name-only diff. Record existing nine lint warnings, the existing large Pixi chunk warning, deferred mojibake/dependency risks, and unrelated/generated dirtiness without repairing them. Do not run an audit fix or install anything.

## Mandatory Luna artifacts

Create `.agent-work/agents/luna-remediation-002.md` with:

- role/task and final outcome;
- every input read;
- files inspected and changed/created;
- decisions by AUD ID and any deviation;
- commands with exact results/counts/warnings;
- privacy, scope, and closed-finding retention checks;
- blockers and output paths.

Create `.agent-work/handoffs/luna-to-terra-remediation-002.md` with:

- Requirements v1, Plan v1, R2, Audit 002 references;
- exact changed-file list and behavior by AUD ID;
- actual PNG/JPEG/controller/error algorithms;
- tests, commands, exact results, and baseline warnings;
- deviations, limitations, residual risks, blockers;
- confirmation of no dependency/fixture/lockfile/config/route/provider/browser/persistence/Live2D change;
- Audit 003 focus for all open/new findings plus AUD-001/AUD-004 retention.

Do not self-certify any finding closed.

## Stop conditions

Stop safely and write both artifacts as a blocker handoff if:

- a fix needs a file outside the exact allowlist, including `visionCoordinator.js` or `visionContracts.js`;
- a dependency/new fixture/full decoder is needed;
- a closed AUD-001/AUD-004 regression appears to require implementation changes;
- unrelated overlapping work cannot be preserved;
- tests would need raw payload logging/persistence, a real screenshot/browser/model/network/database, or a machine change;
- approved behavior/public contract must materially change.

The blocker record must list completed/incomplete work, exact blocker, touched files, commands and sanitized errors, attempted safe resolutions, authority needed, and safest next action.

## Completion checklist

- [ ] PNG palette legality/order/multiplicity/color/count matrix passes.
- [ ] JPEG exits scan for every marker, stays outer after non-SOS segments, and preserves valid stuffed/restart/multi-scan input.
- [ ] Manual hidden capture/analyze boundaries clean up exactly once and end `inFlight: false` without scheduling.
- [ ] Raw capture/analyzer errors never cross promise/state/callback boundaries.
- [ ] AUD-001/AUD-004 closure tests and full R1 regressions remain passing.
- [ ] Only five allowed implementation/test files, two mandatory Luna artifacts, and generated Graphify output changed.
- [ ] Both mandatory Luna artifacts are complete and ready for independent Terra Audit 003.
