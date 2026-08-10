# Root to Terra: Phase 2 AUD-TTS-005 remediation

- Source audit: `reports/audit-005.md`
- Finding: AUD-TTS-005, Medium
- AUD-TTS-004: remains resolved
- Provider setup/gates: not executed or changed

## Exclusive promotion correction

`Assert-TtsPhysicalPath` now supports mutually exclusive `-MustExist` and `-MustNotExist` contracts. A destination leaf that appears after an earlier precheck is rejected on the immediate admission pass.

`Move-TtsPhysicalDirectoryExclusive` now owns final provider promotion:

1. require a physical existing stage directory;
2. require its physical destination parent;
3. require an absent destination leaf;
4. immediately re-admit source, parent, and absent destination;
5. call `[IO.Directory]::Move(source,destination)`, whose same-volume rename fails if the destination appears in the remaining race window; and
6. require the promoted physical destination after success.

The setup uses this helper instead of `Move-Item`. A collision leaves the exact stage in place, so the already-hardened catch path can delete only that checked `.setup-<provider>-<guid>` tree while preserving the winning provider root.

`Move-TtsPhysicalFileExclusive` applies the same absent-destination and `.NET File.Move` contract to downloaded artifact promotion, preventing an existing directory from becoming an accidental `Move-Item` container. The venv leaf is also created through `New-TtsPhysicalDirectory` before Python is allowed to populate it.

## Collision regression

The disposable PowerShell harness now has 14 assertions. After the six junction cases and physical-tree positive case, it:

- proves the final provider destination is initially absent;
- creates a physical provider destination to simulate another setup winning promotion;
- verifies exclusive promotion throws instead of reporting success;
- verifies the existing provider marker is byte-for-byte unchanged;
- verifies no `.setup-*` directory was nested below the existing provider;
- verifies the losing stage still exists;
- removes only that physically admitted stage; and
- re-verifies the winning provider marker and zero leftover disposable temp roots.

Result: `powershell-containment:14`.

## Root validation

- PowerShell parser: 5/5 pass.
- Junction/promotion harness: 14/14 pass; zero disposable temp roots remain.
- Python sidecar tests: 20/20 pass in 0.545 s.
- Backend suite: 85/85 pass in the immediately preceding remediation run; final changes are PowerShell/harness only.
- Node syntax: 74 files pass.
- `git diff --check`: pass; existing line-ending notices only.
- `graphify update .`: pass; 2,716 nodes / 3,811 edges.
- Both manifests remain `enablementAllowed:false`; no setup/verify/model/reference/download/install action ran.

Terra should use `scrutinize` for Audit 006, inspect the exclusive helpers and actual setup call, independently rerun the safe collision/junction harness and model-free suites, and confirm collision cleanup cannot modify the existing provider root. AUD-TTS-005 remains open until independent PASS.
