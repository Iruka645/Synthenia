# Agent Work Artifact Registry

This directory is the authoritative, Git-tracked record for the Synthenia
development lifecycle. It contains concise evidence and handoffs, not private
reasoning, credentials, screenshots, model payloads, or raw user data.

## Required artifacts for every delegated agent

Each delegated agent must:

1. Read the applicable repository instructions and lifecycle inputs.
2. Create a role record under `agents/` named after its task.
3. Write the role-specific output under `reports/`, `handoffs/`, or another
   path explicitly assigned by the coordinator.
4. Record scope, inputs, files inspected or changed, commands and validation,
   outcome, blockers, and output paths.
5. Avoid chain-of-thought. Decisions must be summarized as verifiable facts.
6. Keep all writes inside `D:\Synthenia`.

## Lifecycle artifacts

- Requirements: `requirements.md`
- Implementation plan: `implementation-plan.md`
- Current state: `status.md`
- Phase handoffs: `handoffs/`
- Independent audits and baseline reports: `reports/`
- Per-agent role records: `agents/`
- Session-level chronological log: `../update-log.md`

## Current artifact index

| Role/task | Role record | Primary output | Status |
|---|---|---|---|
| Sol discovery/planning | `agents/sol-discovery-planning.md` | `requirements.md`, `implementation-plan.md`, `reports/baseline-assessment.md`, `handoffs/sol-to-luna.md` | Complete |
| Luna Phase 1 | `agents/luna-phase-1.md` | `handoffs/luna-to-terra.md` | Complete |
| Terra audit 001 | `agents/terra-audit-001.md` | `reports/audit-001.md`, `handoffs/terra-to-sol.md` | CHANGES_REQUIRED |
| Sol remediation 001 | `agents/sol-remediation-001.md` | `handoffs/sol-to-luna-remediation-001.md` | Complete |
| Luna remediation 001 | `agents/luna-remediation-001.md` | `handoffs/luna-to-terra-remediation-001.md` | Complete |
| Terra audit 002 | `agents/terra-audit-002.md` | `reports/audit-002.md`, `handoffs/terra-to-sol-002.md` | CHANGES_REQUIRED |
| Sol remediation 002 | `agents/sol-remediation-002.md` | `handoffs/sol-to-luna-remediation-002.md` | Complete |
| Luna remediation 002 | `agents/luna-remediation-002.md` | `handoffs/luna-to-terra-remediation-002.md` | Complete |
| Terra audit 003 | `agents/terra-audit-003.md` | `reports/audit-003.md`, `handoffs/terra-to-sol-003.md` | CHANGES_REQUIRED |

The human-facing navigation mirror is `../docs/agent-artifacts/README.md`.
