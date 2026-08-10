# Terra → Sol: TTS v2 Phase 2 audit handoff 004

- Audit report: `reports/audit-004.md`
- Requirements / plan: v2 approved / v1 Phase 2
- Disposition: `CHANGES_REQUIRED` — **FIX-THEN-SHIP**
- Blocking finding: `AUD-TTS-004` (High, high confidence)

## Verdict

The provider-neutral boot/status, manifest/receipt gate, JSONL/offline sidecar, exact Jai/Vacha IDs, and Phase 1 publication/legacy seams are substantially correct and remain fail closed. However, PowerShell 5.1 setup/verification containment is lexical only. A pre-existing junction/reparse-point ancestor below the repository root can redirect its first write, pip/download, receipt, move, hash, and recursive cleanup outside the approved repo-local TTS root once an operator later completes legitimate gates. False gates prevent present-day side effects but do not close the defect in authorized setup code.

Provider enablement remains explicitly out of scope and must remain blocked.

## Required correction order

1. Introduce a single PowerShell 5.1 physical-root admission helper. It must reject a reparse point in every existing path segment from the repository root through `.local`, `tts-v2`, provider/stage, reference, model, and receipt paths; it must create missing segments only below a checked physical parent.
2. Apply it before every relevant side effect in `common.ps1` and `verify-tts-assets.ps1`: `New-Item`, `Get-FileHash`, interpreter/pip command, `Invoke-WebRequest`, receipt write/move, final stage move, and all cleanup/remove paths. Revalidate source and destination immediately before moves/deletes and keep `-LiteralPath`.
3. Add model-free PowerShell tests/harness coverage for junctions at `.local`, `tts-v2`, provider, `reference`, `models`, and `receipts`. Assert rejection occurs before any write, hash, network, pip, move, or deletion. Include the receipt-writing verification route.
4. Re-run the complete model-free suite until the malformed-protocol case is stable in the full run. The audit's full suite observed 84/85 due a timeout, while a focused rerun of that case passed; retain the timeout bounds and fail-closed behavior rather than masking it with a broad timeout increase.

## Re-audit conditions

Terra must inspect the actual diff and independently verify all of the following before a Phase 2 ship disposition:

- a junction/reparse ancestor cannot make setup, verification, receipt write, model hash, move, or cleanup touch outside the checked repository-local root;
- all rejection paths happen before their first write/network/hash/process side effect;
- setup still fails closed with the committed false gates and no provider/model/reference acquisition occurs in tests;
- Node status remains spawn/network/model-hash free; manifests/receipt/full asset hash roles remain separated;
- Python stdio protocol, privacy/offline guard, staging-output handling, exact Jai/Vacha target checks, and Phase 1 publication/RVC/legacy/shutdown seams have not regressed; and
- complete test evidence is stable (or any remaining test-only flake is isolated with a narrow evidence-backed correction).

## Questions

None. The remediation is a required implementation correction, not a provider-selection or external-authority decision.
