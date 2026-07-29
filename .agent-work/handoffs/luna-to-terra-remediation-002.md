# Luna to Terra Handoff — Remediation 002

- Requirements: v1 approved and unchanged
- Plan: v1 preserved, including Remediation Phases R1 and R2
- Phase: Remediation Phase R2 — Audit 002
- Audit input: `.agent-work/reports/audit-002.md`
- Findings in scope: AUD-002, AUD-003, and AUD-005
- Closed findings retained: AUD-001 and AUD-004
- Status: ready for independent Terra Audit 003; not self-certified
- Repository: `D:\Synthenia`

## Outcome

Implemented only the handed-off R2 corrections in the existing structural image
gate, adaptive capture controller, and their focused tests. No coordinator or
timing implementation was changed for closed AUD-001/AUD-004 behavior.

## Changed files for R2

- `backend/src/contracts/vision.js`
- `backend/test/vision_contract.test.js`
- `backend/test/vision_privacy.test.js`
- `frontend/src/utils/adaptiveCaptureController.js`
- `frontend/test/adaptiveCaptureController.test.js`
- `.agent-work/handoffs/luna-to-terra-remediation-002.md`

No fixture, fixture README, package manifest, dependency, lockfile, route,
provider, model, browser/DOM host, persistence, memory, database, Socket.IO,
Live2D, configuration, machine, requirements, plan, audit, status, or existing
role-record file was changed for R2. The required Luna role record is supplied
by the CLI final response per the explicit task instruction.

## Decisions and implementation evidence by finding

### AUD-002 — PNG and JPEG structural legality

- PNG now records validated `bitDepth` and `colorType`, plus `sawPlte` and
  `sawIdat` while retaining the one-pass bounded chunk walk, all-chunk CRC,
  exact first/unique `IHDR`, supported depth/color pairs, `IDAT` requirement,
  terminal zero-length `IEND`, unknown-critical rejection, and no trailing
  bytes.
- `PLTE` is allowed only after `IHDR`, at most once, and before `IDAT`; it is
  nonzero, divisible by three, and limited to 1–256 entries. Indexed color
  requires a palette and limits entries to `2 ** bitDepth`; grayscale and
  grayscale-alpha forbid palettes; truecolor and truecolor-alpha allow zero or
  one valid pre-`IDAT` palette.
- JPEG parsing now has explicit `OUTER` and `SCAN` states. Scan stuffing and
  restart markers remain entropy data; every other scan marker transitions to
  `OUTER` before that marker is interpreted. Only a valid `SOS` re-enters
  `SCAN`; bounded post-scan segments require the next byte to begin an outer
  marker; EOI is accepted directly from scan or immediately after a bounded
  outer segment only after a valid frame/SOS and at exact buffer end.
- Tests build CRC-valid PNG palette mutations and JPEG post-scan/multi-scan
  sequences entirely in memory. Coverage includes indexed capacity, forbidden
  color types, missing/duplicate/post-IDAT/invalid-size palettes, arbitrary
  post-segment bytes, valid immediate EOI, valid copied-SOS re-entry, and
  stuffed/restart scan bytes.
- Coordinator privacy tests prove representative illegal PNG/JPEG variants are
  rejected before analyzer invocation.

### AUD-003 — sessionless manual visibility

- `ensureRunValid(run)` now checks active run/generation/signal ownership first,
  page visibility for every run (including manual runs with no session), and
  stream ended/disconnected/error state only when a stream exists.
- The same check is applied before capture, immediately after frame ownership
  is assigned, after analysis, and before success/rescheduling.
- Invalidated generations abort once and use identity-owned, idempotent frame
  and stream release. Finalization clears the active run and publishes
  `inFlight: false` without overwriting the terminal status/outcome/error.
- Focused tests cover hidden manual capture and analyze boundaries with zero or
  one analyzer call respectively, one frame release, zero stream releases, one
  abort, terminal hidden state, no success overwrite, and zero schedules.

### AUD-005 — sanitized public error channel

- The controller catch path always applies `normalizeVisionError` and rejects
  with a newly constructed `createVisionError(normalized.code)`; it never
  rethrows the injected capture/analyzer object or copies its fields.
- Unknown/raw failures normalize to the existing allowlisted
  `VISION_ANALYSIS_FAILED`; known lifecycle codes retain their existing code.
- Focused tests separately inject sensitive raw capture and analyzer errors
  with custom cause/response fields and verify different error identity, fixed
  code, no raw text/custom fields in rejection/state/state callback history,
  terminal error state, correct frame cleanup, and no scheduling.

### Closed-finding retention

- `backend/src/services/vision/visionCoordinator.js` was not modified.
- Existing AUD-001 drain tests and AUD-004 admission/completion timing tests
  remained in the suite and passed unchanged in behavior.

## Validation commands and exact results

```text
D:\Synthenia\backend> node --test test/vision_contract.test.js test/vision_privacy.test.js
PASS — 24 tests, 24 passed, 0 failed, 0 skipped.

D:\Synthenia\backend> npm test
PASS — 44 tests, 44 passed, 0 failed, 0 skipped.
Expected existing LLM-provider parser diagnostic lines were printed.

D:\Synthenia\frontend> npm run test:vision
PASS — 14 tests, 14 passed, 0 failed, 0 skipped.

D:\Synthenia\frontend> npm run lint
PASS — nine existing warnings remain in the pre-existing TTS provider,
UI context, audio analyser, Control Panel, and AvatarCanvas files.

D:\Synthenia\frontend> npm run build
PASS — existing Vite warning remains for the 538.42 kB Pixi chunk; existing
plugin timing notices were also reported.

D:\Synthenia> git diff --check
PASS — no whitespace errors; existing LF-to-CRLF working-copy notices only.

D:\Synthenia> graphify update .
PASS — generated graph updated: 1,919 nodes, 2,696 edges, 154 communities.
Existing warning: seven source files produced zero nodes. Graphify output was
generated by this command only and was not hand-edited.

D:\Synthenia> git status --short
PASS — status inspected. The five R2 implementation/test paths and this R2
handoff are present alongside pre-existing R1/lifecycle/documentation changes,
fixtures, logs, and generated Graphify output; no cleanup or reset was run.
```

## Privacy, scope, deviations, and limitations

- Tests use only existing deterministic fixtures and in-memory mutations,
  synthetic sensitive strings, injected promises, clocks, schedulers, signals,
  and resource-release spies. No screenshot, browser, network, model, database,
  filesystem fixture write, or real-time wait was used.
- Structural parsing remains bounded, dependency-free, forward-only validation;
  it does not decompress pixels or claim JPEG entropy decoding.
- No image bytes, summaries, OCR, prompts, provider bodies, or injected error
  fields are logged, persisted, or exposed through controller state/callbacks.
- No dependency, lockfile, package, configuration, route, provider/model,
  browser/DOM, persistence, Live2D, environment, machine, commit, or push
  change was made.
- Existing deferred mojibake and frontend dependency advisories remain outside
  R2 and were not repaired. Existing unrelated dirty/untracked work and
  generated Graphify dirtiness were preserved.
- No approved behavior deviation was identified. The process deviation is that
  the Luna role record is not directly written, as the user explicitly directed
  the CLI final response to be saved there automatically.

## Blockers and Terra Audit 003 focus

- Blockers: none for the assigned R2 implementation. Terra must independently
  decide `PASS`, `PASS_WITH_NOTES`, or `CHANGES_REQUIRED`; this handoff does not
  close any finding.
- Re-audit AUD-002: independently verify every PNG palette legality/order/count/
  color rule, CRC-valid pre/post-IDAT mutations, and JPEG OUTER/SCAN framing,
  including valid immediate EOI and bounded multi-scan stuffing/restart cases,
  with invalid variants rejected before analyzer invocation.
- Re-audit AUD-003: verify sessionless manual hidden capture/analyze boundaries,
  exactly-once frame cleanup, zero stream cleanup, one abort, terminal state
  with `inFlight: false`, no success overwrite, and no schedule.
- Re-audit AUD-005: verify raw capture/analyzer error messages, causes, custom
  fields, and object identity cannot cross promise, state, callback, or output
  boundaries while known lifecycle codes remain stable.
- Also retain independent checks for closed AUD-001 drain exclusivity/late
  settlement silence and AUD-004 admission-only freshness/completion TTL and
  timeout boundaries.

Output: `.agent-work/handoffs/luna-to-terra-remediation-002.md`

