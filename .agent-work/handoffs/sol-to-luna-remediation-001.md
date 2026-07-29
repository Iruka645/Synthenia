# Sol to Luna Handoff — Remediation 001

- Requirements version: 1 (approved 2026-07-28; unchanged)
- Plan version: 1 (preserved)
- Assigned phase: `Remediation Phase R1 — Audit 001`
- Incoming audit: `.agent-work/reports/audit-001.md`
- Finding disposition: AUD-001 through AUD-004 accepted and in scope
- Role: Luna (implementation/remediation)
- Repository: `D:\Synthenia`
- Status: ready
- User-authority blocker: none

## Read first

Read these completely, in order:

1. `D:\Synthenia\AGENTS.md`
2. `C:\Users\sanak\.codex\skills\orchestrate-code-lifecycle\SKILL.md`
3. `C:\Users\sanak\.codex\skills\orchestrate-code-lifecycle\references\artifact-contracts.md`
4. `D:\Synthenia\.agent-work\README.md`
5. `D:\Synthenia\.agent-work\requirements.md`
6. `D:\Synthenia\.agent-work\implementation-plan.md`, especially the delimited `Remediation Phase R1 — Audit 001`
7. `D:\Synthenia\.agent-work\reports\audit-001.md`
8. `D:\Synthenia\.agent-work\handoffs\terra-to-sol.md`
9. this handoff

The repository contains unrelated dirty and untracked work. Preserve it. Dirty Graphify output is expected and is not a reason to skip the repository instruction.

## Required outcome

Implement only R1 and make all four accepted findings ready for an independent Terra re-audit:

- AUD-001: public timeout/abort returns promptly, while an exclusive drain lock remains until the actual analyzer promise settles; no second analyzer starts and no late store/log action occurs.
- AUD-002: PNG/JPEG/WebP structural validation fails closed with bounded linear dependency-free parsing and complete valid fixtures.
- AUD-003: controller cleanup is generation-owned and rechecked after every await; hidden/ended/disconnected/error/stop releases owned resources exactly once and never reschedules.
- AUD-004: capture age/future-skew is checked at admission only; completion validates observation timing/TTL without rejecting an otherwise valid six-minute analysis.

Follow the exact algorithms, state transitions, parser policies, timing rules, and acceptance criteria in the R1 plan section. If this handoff is less specific than that section, the R1 section controls.

## Allowed files

Modify only:

- `backend/src/contracts/vision.js`
- `backend/src/services/vision/visionCoordinator.js`
- `backend/test/vision_contract.test.js`
- `backend/test/vision_privacy.test.js`
- `backend/test/fixtures/vision/README.md`
- `frontend/src/utils/adaptiveCaptureController.js`
- `frontend/test/adaptiveCaptureController.test.js`

Create only these implementation fixtures if they are needed:

- `backend/test/fixtures/vision/tiny-jpeg.base64`
- `backend/test/fixtures/vision/tiny-webp.base64`

Create these mandatory lifecycle artifacts:

- `.agent-work/agents/luna-remediation-001.md`
- `.agent-work/handoffs/luna-to-terra-remediation-001.md`

Generated-validation exception:

- `graphify-out/**` may change only as generated output of the required `graphify update .`; do not hand edit, clean, delete, or normalize Graphify files.

Do not edit any other file. In particular, do not rewrite the requirements, approved plan/remediation text, status, artifact registry/index, session log, `.gitignore`, existing audit/handoffs, or unrelated role records.

## Implementation constraints

- No dependency, package manifest, lockfile, config-value, environment, machine-state, route, model/provider, browser/DOM, persistence, database, Socket.IO, Live2D, mojibake, or broad formatting change.
- No image/prompt/OCR/summary/provider body in logs, errors, disk, generated test output, or durable storage.
- No real screenshot, browser, network, model, database, or real-time wait in tests.
- No queue and no second analyzer/capture while an old operation remains unsettled.
- Do not force-release a backend drain lock. It ends only when that exact analyzer promise settles.
- Parsing remains a structural pre-inference gate, not a claim of complete pixel decoding.
- Use one forward cursor, overflow-safe remaining-length checks, and bounded linear work over the existing 1,500,000-byte maximum.
- PNG CRC-32 applies to every chunk. JPEG requires a marker-aware terminal EOI with no trailing data. WebP requires exact RIFF size and a physical zero pad byte for every odd chunk.
- Retain the configured 300,000-ms admission age, 30,000-ms future skew, 480,000-ms timeout, and 120,000-ms completion-relative TTL.
- Do not commit or push.

## Exact test matrix

### Backend container contracts

| Format | Valid cases | Required rejection cases |
| --- | --- | --- |
| PNG | Existing complete 1x1 fixture; matching MIME/dimensions | Every strict prefix; corrupt `IHDR`/image-data/`IEND` CRC; missing/nonterminal `IEND`; no `IDAT`; duplicate/out-of-order critical chunk; impossible chunk length; unknown critical chunk; trailing byte |
| JPEG | Complete 1x1 fixture with SOI, supported SOF, SOS, scan, terminal EOI | Every strict prefix; no SOF/SOS/EOI; early EOI; short/overrunning segment; truncated marker/stuffing; inconsistent/duplicate frame; illegal standalone marker; trailing byte |
| WebP | Complete 1x1 still-image fixture; valid simple or extended chunk layout | Every strict prefix; RIFF declared size zero/short/long; chunk overrun; missing/nonzero odd pad; missing/duplicate primary image; invalid `VP8 `/`VP8L`/`VP8X`; animation flag/chunk; dimension disagreement; trailing byte |

For all formats, preserve MIME mismatch, declared-dimension mismatch, maximum bytes/dimensions, exact-key, prohibited-field, and timestamp tests. At coordinator level, representative invalid containers must leave analyzer call count at zero.

### Backend coordinator and timing

Run separate deferred, abort-ignoring cases for timeout and external abort:

1. A invokes analyzer once.
2. Timeout/abort wins and A's caller rejects promptly with the typed outcome.
3. B returns `VISION_BUSY`; analyzer count remains one.
4. Exactly one sanitized metadata-only timeout/abort log exists; store remains empty.
5. Resolve A late with a secret-bearing result, then repeat with a secret-bearing rejection: no additional log/store data and no unhandled rejection.
6. Only after A settles may C invoke the analyzer.

Also prove:

- a pre-aborted signal invokes no analyzer;
- normal success/error releases ownership and preserves sanitized logs;
- a request fresh at admission and completed at six minutes stores an observation whose expiry is exactly 120,000 ms after `observedAt`;
- capture age exactly 300,000 ms and future skew exactly 30,000 ms are admitted, while one millisecond beyond each rejects before analysis;
- completion at elapsed time `<480,000 ms` may succeed; elapsed time `>=480,000 ms` returns `VISION_TIMEOUT` without storage, and an unsettled provider remains drain-locked after the timer wins.

### Frontend controller

Use a table-driven test for each issue `hidden|ended|disconnected|error` at each deferred boundary `capture|analyze` (eight cases). Assert:

- matching terminal status/error code;
- controller signal aborted;
- frame released exactly once if/when produced;
- stream released exactly once;
- analyzer not called when invalidation is discovered after capture;
- no success-state overwrite and no new schedule.

Add:

- stop during deferred capture and deferred analyze, including abort-ignoring late settlement;
- repeated stop idempotence;
- current-generation analyzer rejection cleanup;
- stale timer callback and stale late completion cannot mutate or schedule a later generation;
- new start/manual/tick during an unsettled run returns busy with no second call/queue;
- valid current periodic completion schedules exactly once with the existing clamp formula.

Keep the existing manual-off, shared-flight, adaptive-delay, payload-free state, and initial terminal-state tests.

## Validation commands

Run from the stated directories and record exact pass/fail counts and existing warnings:

```text
cd D:\Synthenia\backend
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

If a command fails, investigate only within allowed scope. Do not hide baseline lint/chunk warnings or open dependency/mojibake risks. Do not run `npm audit fix`, install anything, or regenerate a lockfile.

## Required Luna artifacts

Before yielding, create `.agent-work/agents/luna-remediation-001.md` with:

- role/task and final outcome;
- all inputs read;
- files inspected and changed/created;
- concise implementation decisions and any deviations;
- commands with exact results;
- privacy/scope checks;
- blockers and output paths;
- no hidden chain-of-thought.

Create `.agent-work/handoffs/luna-to-terra-remediation-001.md` with:

- Requirements v1, Plan v1, phase R1, and Audit 001 references;
- exact changed-file list and behavior by AUD ID;
- state/parser/timing policies actually implemented;
- deviations with evidence;
- tests/commands/results and known baseline warnings;
- limitations, residual risks, blockers, and focused re-audit instructions;
- confirmation that no dependency/lockfile/package/config/route/persistence/model/browser/Live2D change was made.

Luna must not edit Audit 001 or declare the audit findings closed. Terra independently decides closure.

## Stop conditions

Stop safely and write both required artifacts as a blocker handoff if:

- a fix requires a file or capability outside the allowed list;
- dependency-free fail-closed structural parsing cannot be implemented safely;
- unrelated changes overlap an allowed file and cannot be preserved;
- a test requires payload logging/persistence, a real screenshot/model/network/browser, a dependency, or a machine change;
- the approved behavior would need to change materially.

The blocker artifact must list completed/incomplete work, exact blocker, files touched, commands and sanitized errors, attempted safe resolutions, authority/decision needed, and safest next action.

## Completion checklist

- [ ] AUD-001 drain ownership and late-settlement tests pass.
- [ ] AUD-002 complete fixtures and parser mutation/truncation tests pass.
- [ ] AUD-003 generation/post-await/exactly-once cleanup tests pass.
- [ ] AUD-004 six-minute completion and admission/timeout boundary tests pass.
- [ ] Only allowed implementation/test/fixture files and mandatory lifecycle artifacts changed, apart from generated Graphify output.
- [ ] Full backend and frontend validation is recorded accurately.
- [ ] `.agent-work/agents/luna-remediation-001.md` exists and is complete.
- [ ] `.agent-work/handoffs/luna-to-terra-remediation-001.md` exists and is ready for independent review.
