# Root to Terra: Phase 2 AUD-TTS-004 remediation

- Source audit: `reports/audit-004.md`
- Finding: AUD-TTS-004, High
- Scope: PowerShell physical containment only; provider gates remain false
- Setup/download/install/reference processing executed: **no**

## Correction

`scripts/tts-v2/common.ps1` now centralizes path admission in two PowerShell 5.1-compatible functions:

- `Assert-TtsPhysicalPath` first proves lexical containment under an existing physical root, then walks every existing path segment with `Get-Item -LiteralPath -Force`. It rejects any symbolic link, junction, mount/reparse point, non-directory ancestor, missing required path, or wrong leaf type.
- `New-TtsPhysicalDirectory` creates missing segments one at a time with .NET only after its physical parent passes admission, then immediately revalidates the new directory.

The helpers now guard:

- committed sidecar root, manifest, and lock before reads/hashes;
- provider/local/stage/reference/model/receipt roots and files;
- bootstrap/isolated Python and lock before venv/pip process execution;
- stage and temp paths before `Invoke-WebRequest`;
- downloaded and installed artifacts immediately before hash/move;
- receipt root/temp/destination before write/atomic replace/move/cleanup;
- stage source and provider destination immediately before final move; and
- the exact `.setup-<provider>-<guid>` physical directory immediately before recursive failure cleanup.

The setup also now requires the requested provider to match the manifest's exact stable ID and invokes pip with `--isolated --no-input --no-cache-dir --require-hashes`.

`scripts/verify-tts-assets.ps1` independently admits provider/Python/model/artifact/receipt paths before process/hash/receipt side effects. `docs/tts-v2-setup.md` documents reparse rejection, per-process execution-policy use, and the safe model-free harness.

## Junction regression harness

Added `scripts/tts-v2/tests/containment.tests.ps1`. It creates disposable junctions entirely under a GUID temp root at each required ancestor:

1. `.local`
2. `.local/tts-v2`
3. provider root
4. `reference`
5. `models`
6. `receipts`

For every location it proves both admission and safe directory creation reject before the simulated first side effect, confirms the junction target marker is unchanged, removes the exact verified junction with .NET, confirms no reparse object remains, and only then recursively removes the validated disposable temp tree. It also proves an ordinary physical tree can be created/admitted. Result: `powershell-containment:13`.

An initial harness cleanup exposed a Windows PowerShell `Remove-Item` junction bug. Root stopped that run, resolved and verified the exact GUID test root under `%TEMP%`, removed the one verified junction with `[IO.Directory]::Delete(path,$false)`, then removed the now-reparse-free test root. The committed harness uses this safe sequence and a subsequent run left zero `synthenia-tts-containment-*` temp roots.

## Root validation

- Backend full suite: 85/85 pass, including the prior timing-sensitive malformed-protocol case.
- Python sidecar suite: 20/20 pass in 0.563 s.
- PowerShell parse: 5/5 scripts/harness pass.
- PowerShell physical-containment harness: 13/13 pass.
- Node syntax: 74 files pass.
- Manifest/lock checks: 2/2 consistent and both `enablementAllowed:false`.
- `git diff --check`: pass; only existing line-ending notices.
- `graphify update .`: pass; 2,687 nodes / 3,782 edges.

## Re-audit request

Terra should use `scrutinize`, inspect the actual remediation diff, independently run the harness and safe model-free suites, and verify rejection precedes every write/network/hash/process/move/delete boundary. Do not run either setup/verify script, change manifest gates, create a private reference, or acquire a provider artifact. AUD-TTS-004 remains open until Terra passes the remediation.
