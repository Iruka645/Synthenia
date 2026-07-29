# Terra to Sol Handoff — Audit 003

- Audit report: `.agent-work/reports/audit-003.md`
- Requirements / plan: v1 approved / v1 preserved, including R1 and R2
- Disposition: `CHANGES_REQUIRED`
- Lifecycle escalation: `USER_DECISION_REQUIRED` — Audit 003 is the final allowed remediation cycle

## Closure matrix

| Finding | State | Action |
| --- | --- | --- |
| AUD-001 | CLOSED | Retain coordinator RUNNING/DRAINING ownership, prompt timeout/abort, and silent late settlement. |
| AUD-002 | CLOSED for its R2 PLTE/JPEG cases | Retain PLTE and JPEG OUTER/SCAN coverage; see AUD-006 for a separate PNG ordering gap. |
| AUD-003 | CLOSED | Retain per-run visibility checks, generation ownership, final `inFlight: false`, and exactly-once cleanup. |
| AUD-004 | CLOSED | Retain admission-only freshness, completion-relative TTL, and 480000-ms timeout boundary. |
| AUD-005 | CLOSED | Retain newly constructed allowlisted public controller errors. |
| AUD-006 | OPEN — High | Explicit user decision is required before any additional remediation. |

## Required action

Request a user decision. Under the lifecycle maximum-cycle rule, do not start a fourth implementation/audit cycle autonomously.

If the user authorizes a narrow additional cycle, correct only the PNG IDAT-contiguity bypass in `backend/src/contracts/vision.js` and focused backend tests. Track image-data phase so that consecutive IDAT chunks remain valid but an intervening ancillary or critical chunk closes the IDAT run. Add contract and coordinator analyzer-noninvocation tests for the in-memory `IDAT -> tEXt -> IDAT -> IEND` mutation.

## Priority and correction order

1. **Blocking High — AUD-006:** add explicit IDAT-run state and rejection coverage for an intervening chunk.
2. Re-run the parser/coordinator matrix first, then the complete retained AUD-001 through AUD-005 regression matrix.
3. Submit a new Luna handoff and independent Terra audit only if the user explicitly authorizes an additional lifecycle cycle.

## Required retest scope if authorized

- Valid consecutive multi-IDAT accepts; nonconsecutive multi-IDAT rejects with `VISION_INVALID_IMAGE`.
- Rejected variants invoke the coordinator analyzer zero times.
- Re-run backend focused vision tests and full `npm test`; frontend `npm run test:vision`, lint, build; fixture hashes; and `git diff --check 824252a`.
- Retain AUD-001 through AUD-005 closure regressions and prohibit dependency, fixture, route, provider, browser, persistence, Live2D, config, machine, Git, and unrelated lifecycle changes.

## Optional actions

None. Do not broaden parser work into pixel/entropy decoding or add a decoder dependency.

## Open questions

None about the narrow technical correction. The required decision is whether the user authorizes work beyond the lifecycle's three-cycle cap.

## Residual risks and blockers

- Blocker: remediation-cycle limit, not implementation authority. Existing requirements cover the narrow correction, but explicit user authorization is required because Audit 003 is final.
- Deferred mojibake and High/Critical dependency advisories remain separate lifecycle-completion blockers.
- Provider force termination, route/authentication, real browser/track lifecycle, chat-memory, and persistence integration remain later-scope risks.

## Evidence and artifact paths

- New finding/evidence: `.agent-work/reports/audit-003.md` (AUD-006).
- Audit role record: `.agent-work/agents/terra-audit-003.md`.
- Current handoff: `.agent-work/handoffs/terra-to-sol-003.md`.

## Re-audit condition

Only after explicit user authorization, a bounded remediation handoff, and independent validation of the required IDAT-order and retained regression matrix. Without that authority, end the lifecycle as `USER_DECISION_REQUIRED`.
