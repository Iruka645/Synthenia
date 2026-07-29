Act as Luna for Synthenia Remediation 001. Work only inside D:\Synthenia.
The user explicitly authorized `--sandbox danger-full-access` only because the
Windows workspace-write helper failed, and only for repository code
implementation. This does not authorize machine changes, installations,
network/Ollama/browser/model calls, destructive actions, Git commits or pushes,
dependency or lockfile changes, environment changes, or writes outside
D:\Synthenia.

Read completely, in this order:

1. `D:\Synthenia\AGENTS.md`
2. `C:\Users\sanak\.codex\skills\orchestrate-code-lifecycle\SKILL.md`
3. `C:\Users\sanak\.codex\skills\orchestrate-code-lifecycle\references\artifact-contracts.md`
4. `D:\Synthenia\.agent-work\README.md`
5. `D:\Synthenia\.agent-work\requirements.md`
6. `D:\Synthenia\.agent-work\implementation-plan.md`, especially the
   delimited `Remediation Phase R1 — Audit 001`
7. `D:\Synthenia\.agent-work\reports\audit-001.md`
8. `D:\Synthenia\.agent-work\handoffs\terra-to-sol.md`
9. `D:\Synthenia\.agent-work\handoffs\sol-to-luna-remediation-001.md`

Implement only Remediation Phase R1 exactly as handed off. Preserve all
unrelated dirty and untracked work. Modify or create only the implementation,
test, and fixture files allowed by the handoff, plus
`.agent-work/handoffs/luna-to-terra-remediation-001.md`.

Do not directly write `.agent-work/agents/luna-remediation-001.md`; your final
response will be saved there automatically. Make that final response a complete
durable role record containing role/task, outcome, inputs read, files inspected
and changed, concise evidence-based implementation decisions and deviations,
exact commands/results, privacy/scope checks, blockers, and output paths. Do not
include chain-of-thought.

Required corrections:

- AUD-001: drain-locked coordinator with prompt typed timeout/abort and no late
  store/log action.
- AUD-002: bounded dependency-free fail-closed PNG/JPEG/WebP structural
  validators plus complete synthetic fixtures and tests.
- AUD-003: generation-owned controller with post-await validity checks and
  exactly-once cleanup/no reschedule.
- AUD-004: admission-only capture freshness with completion-relative
  120-second TTL and the 8-minute timeout boundary.

Run the exact validation commands in the handoff, including
`graphify update .`. The Graphify generated-output exception applies only to
the required update; do not hand-edit Graphify output.

If blocked by an out-of-scope need, stop safely, keep partial work bounded,
write the Luna-to-Terra artifact as a blocker handoff, and make the final role
record state `HANDOFF_REQUIRED`. Do not self-certify audit closure. Do not
commit or push.
