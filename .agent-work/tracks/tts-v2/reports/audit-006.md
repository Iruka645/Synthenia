# TTS v2 Phase 2 — Terra Audit 006

- Requirements: v2 (approved)
- Implementation plan: v1, Phase 2
- Auditor: Terra, independent re-audit using `scrutinize`
- Scope: AUD-TTS-005 exclusive promotion remediation, artifact promotion, reparse/TOCTOU containment, cleanup, fail-closed status/gates/protocol, and Phase 1 regressions
- Disposition: `PASS` — **SHIP Phase 2 provider-neutral scaffolding**

## Executive summary

The remediation's purpose is to make a verified staged provider installation either promote exactly once into an absent provider root or fail without nesting/mixing its data into an already-existing installation. That behavior now holds. `Move-TtsPhysicalDirectoryExclusive()` requires a physical source and parent, requires an absent destination twice, and uses `.NET Directory.Move`, whose same-volume rename rejects an existing destination rather than treating it as a container. Its failure leaves the source stage for the existing exact-stage cleanup path. The same exclusive file contract now protects downloaded-artifact promotion.

No Critical, High, or Medium finding remains in the audited Phase 2 scaffolding scope. This is not approval to enable a provider: both manifest gates remain false and no setup, verification, download, install, model, or reference action was performed.

## Intent and simpler-alternative pass

Doing nothing would retain the deterministic concurrent-promotion false-success path. A broad lock manager is unnecessary for this explicit one-off setup flow. The implemented smaller correction—physical source/parent/destination admission plus .NET fail-if-exists rename—is the right layer: it removes the container semantics of PowerShell `Move-Item` while preserving the existing staged cleanup design.

## Scope and independent checks

- Re-read `scrutinize`, `AGENTS.md`, `audit-005.md`, `terra-to-sol-phase-2-005.md`, root's remediation handoff, current status, and the actual code/test diff. Queried the repository graph before tracing setup and runtime call paths.
- Traced setup wrapper → provider root/manifest/lock gates → reference gate → physical local/stage/venv roots → Python/pip → download/hash → exclusive artifact file move → receipt replace → exclusive final directory promotion → checked cleanup. Traced verification's hash/receipt branch and unchanged Node status → controller → sidecar protocol → Phase 1 publication/RVC/legacy/shutdown seams.
- Ran permitted model-free checks only:

  ```text
  PowerShell parser (5 scripts/harness)                 # 5/5 passed
  containment.tests.ps1                                 # 14/14 passed; no temp roots remained
  Python sidecar suite                                  # 20/20 passed
  focused malformed-sidecar test                         # passed
  focused failed-readiness test                          # passed
  Node syntax                                            # 74 files passed
  pure default status with spawn patched to throw        # two not_installed; no roots created
  disabled manifest gates                                # 2/2 false
  git diff --check                                       # passed; existing LF→CRLF notices only
  ```

`npm.cmd test` in this audit run reached 84/85: the existing timing-sensitive `sidecar_client.test.js:83-88` readiness test expected `SIDECAR_START_FAILED` but saw the suite's short test timeout (`TTS_TIMEOUT`). Its focused rerun passed, the preceding independent Audit 005 full suite passed 85/85, and this remediation changes only PowerShell/harness code. This is non-blocking test-scheduling evidence, not a Phase 2 promotion/containment finding; retain it as CI stabilization work rather than widening production behavior or test timeouts indiscriminately.

## Re-verified findings and end-to-end evidence

| Finding | Result | Evidence-backed trace |
| --- | --- | --- |
| AUD-TTS-004 — reparse ancestor containment | Resolved | `Assert-TtsPhysicalPath()` rejects reparse segments (`common.ps1:8-68`); `New-TtsPhysicalDirectory()` admits each parent before/after creation (`71-96`). The six junction cases still reject pre-side-effect and preserve their outside marker (`containment.tests.ps1:36-98`). |
| AUD-TTS-005 — nonexclusive final promotion | Resolved | Setup requires an absent provider root before staging (`common.ps1:359-360`) and calls `Move-TtsPhysicalDirectoryExclusive()` (`431-432`). That helper admits source/parent/destination, applies `-MustNotExist` immediately before `[IO.Directory]::Move`, then requires the promoted destination (`98-120`). An existing/racing destination therefore causes the move to fail, preserving the exact source stage for catch cleanup (`433-442`). |

- **Collision and cleanup:** the permitted harness first proves the final destination absent, creates a physical destination as the simulated winning setup, calls the exclusive helper, verifies the throw, preserves the winning marker, verifies no nested `.setup-*`, then removes only the admitted losing stage and re-verifies the marker (`containment.tests.ps1:100-141`). Its run completed 14/14 and left no disposable root.
- **Artifact promotion:** after download length/hash verification, setup uses `Move-TtsPhysicalFileExclusive()` (`common.ps1:395-423`). It requires a physical source and parent, an absent file destination twice, uses `[IO.File]::Move`, then requires the promoted physical file (`123-145`). An existing file or directory cannot be accepted as a `Move-Item` container.
- **Reparse/TOCTOU posture:** physical admission surrounds manifest/lock reads/hashes (`153-187`), references (`264-286`), receipt temporary/write/replace/cleanup (`289-335`), process execution and downloads (`337-418`), and promotion/cleanup. Existing junction/symlink ancestors fail before these operations. The design does not claim an OS-principal boundary against a same-principal adversary swapping a filesystem object after admission; its explicit protection is checked physical paths plus fail-if-exists .NET moves, consistent with the established Phase 1 residual model.
- **Fail-closed and compatibility:** false provenance gates stop setup at `Assert-TtsManifestReady()` before local setup side effects (`203-235`, `346-360`). The actual default status remains pure in `installState.js:12-20,61-85` and `neuralTtsController.js:76-86,136-156`; the independent spawn-patched check returned both providers as `not_installed` without creating install/staging roots. Python protocol/privacy/offline controls, exact Jai/Vacha targeting, and Phase 1 exclusive publication/HTTP/RVC/legacy/shutdown behavior remain covered by the model-free suites.

## Findings

None. AUD-TTS-004 and AUD-TTS-005 are resolved by source trace and the independent permitted harness/tests.

## Residual notes

- Provider enablement, upstream provenance completion, lawful reference provisioning, model acquisition, and hardware benchmark remain explicitly blocked and were not tested.
- The complete backend suite intermittently times out in short fake-sidecar readiness cases under full-suite scheduling. Both affected cases have passed when focused; this audit did not change their runtime or test logic. Stabilize that test scheduling separately, with a narrow evidence-backed change, before treating a single complete-suite count as release CI evidence.

## Disposition

`PASS` — **SHIP Phase 2 provider-neutral scaffolding.** The two containment/promotion findings are closed. Keep providers unavailable and gates false until a separately approved enablement phase supplies complete provenance, licenses, hashes, locks, and private-reference authority.
