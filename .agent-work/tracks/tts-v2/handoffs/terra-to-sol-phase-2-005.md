# Terra → Sol: TTS v2 Phase 2 audit handoff 005

- Audit report: `reports/audit-005.md`
- Requirements / plan: v2 approved / v1 Phase 2
- Disposition: `CHANGES_REQUIRED` — **FIX-THEN-SHIP**
- AUD-TTS-004: resolved
- Blocking finding: `AUD-TTS-005` (Medium, high confidence)

## Verdict

The physical segment/reparse remediation works: the independent PowerShell harness passed 13/13 at all required ancestor locations, safely cleaned its disposable roots, and no regression appeared in pure status, sidecar, Phase 1 publication, or legacy paths. The remaining blocker is a deterministic promotion collision: `Move-Item` can nest a later setup's stage beneath a provider root created after the early absence check, then the script returns success.

Provider enablement remains out of scope and both manifests must remain disabled.

## Required correction order

1. Encapsulate final promotion in a small helper that requires a checked physical stage, checked physical provider parent, and an absent provider-root leaf.
2. Replace the final `Move-Item` with `[IO.Directory]::Move(source, destination)` so an existing destination fails rather than becoming a container. Re-admit the source/parent immediately before rename and the destination after success.
3. Keep the existing catch cleanup only for the exact still-present `.setup-<provider>-<guid>` directory; prove a promotion collision neither removes nor modifies the pre-existing provider root.
4. Add a model-free disposable PowerShell test for the late-created physical destination, including no nested `.setup-*`, no false success, preserved destination marker, and safe stage cleanup. Retain all six junction tests.

## Re-audit conditions

- AUD-TTS-004's six reparse cases still reject before simulated side effects and leave no temp roots.
- A late existing final destination makes promotion fail closed, rather than nesting/mixing a stage or reporting success.
- Manifest/lock/reference/pip/download/hash/receipt/move/cleanup physical checks remain intact; gates remain false and no real setup/verify/model/reference/download action is exercised.
- Pure default status remains no-spawn/no-network/no-model-hash; Python protocol/privacy/offline, exact provider targeting, and Phase 1 publication/RVC/legacy/shutdown remain green.
- Parser, Python, focused protocol, complete backend suite, syntax, disabled-gate, and diff checks pass.

## Independent validation recorded

- PowerShell parser 5/5; containment harness 13/13 with cleanup clean.
- Python 20/20; focused malformed-sidecar test passed; backend 85/85; Node syntax 74 files; disabled gates 2/2; diff check passed (only existing line-ending notices).
