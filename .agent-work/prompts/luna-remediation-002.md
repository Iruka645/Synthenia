Act as Luna for Synthenia Remediation Phase R2 in `D:\Synthenia`.

The user explicitly authorized `--sandbox danger-full-access` only because the
Windows workspace-write helper failed and only for repository code
implementation. This does not authorize machine changes, installations,
network/Ollama/browser/model calls, destructive actions, Git commit/push,
dependency or lockfile changes, environment changes, or writes outside the
workspace.

Read completely, in order:

1. `D:\Synthenia\AGENTS.md`
2. `C:\Users\sanak\.codex\skills\orchestrate-code-lifecycle\SKILL.md`
3. `C:\Users\sanak\.codex\skills\orchestrate-code-lifecycle\references\artifact-contracts.md`
4. `D:\Synthenia\.agent-work\README.md`
5. `D:\Synthenia\.agent-work\requirements.md`
6. the full `D:\Synthenia\.agent-work\implementation-plan.md`, especially R1
   and the delimited R2 phase
7. Audit 001 and Audit 002
8. Terra-to-Sol handoffs for both audits
9. R1 Sol/Luna handoffs and Luna role record
10. `D:\Synthenia\.agent-work\handoffs\sol-to-luna-remediation-002.md`

Implement only R2 exactly as handed off. Preserve unrelated dirty/untracked
work. Modify only the five allowed implementation/test files and create
`.agent-work/handoffs/luna-to-terra-remediation-002.md`. Do not directly write
`.agent-work/agents/luna-remediation-002.md`; the CLI final response is saved
there automatically, so make the final response a complete durable role record
with task/outcome, inputs, files, decisions by finding, deviations, exact
commands/results, privacy/scope/closed-finding checks, blockers, and outputs.
Include no chain-of-thought.

Required corrections:

- AUD-002: exact PNG PLTE legality/order/count/color policy and explicit JPEG
  OUTER/SCAN transition; preserve bounded structural parsing.
- AUD-003: page visibility validation for sessionless manual runs at every
  post-await boundary with exactly-once cleanup and no schedule.
- AUD-005: construct a fresh allowlisted typed error; never rethrow/copy raw
  capture/analyzer errors.
- Retain closed AUD-001 and AUD-004 behavior and tests without modifying the
  coordinator/timing implementation.

Run every validation command in the handoff including `graphify update .`. Do
not add fixtures, dependencies, routes, browser APIs, model calls, persistence,
Live2D changes, or machine changes. If blocked by an out-of-scope need, stop
safely, write the required blocker handoff, and mark the final role record
`HANDOFF_REQUIRED`. Do not self-certify closure. Do not commit or push.
