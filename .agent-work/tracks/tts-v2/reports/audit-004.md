# TTS v2 Phase 2 — Terra Audit 004

- Requirements: v2 (approved)
- Implementation plan: v1, Phase 2
- Auditor: Terra, independent audit using `scrutinize`
- Scope: fail-closed provider scaffolding, setup/verification boundary, local sidecar protocol, and Phase 1 compatibility regression
- Disposition: `CHANGES_REQUIRED` — **FIX-THEN-SHIP**

## Executive summary

Phase 2 is intended to add only inert, auditable infrastructure for JaiTTS F5-TTS and VachaSpeech 0.6B. Provider enablement remains explicitly out of scope: both committed manifests retain unresolved provenance/license/checksum/lock gates and therefore must stay unavailable. The ordinary boot/status path is appropriately pure: it snapshots bounded manifest/lock metadata, returns `not_installed` for missing local files, and does not spawn a child, create an install root, hash model assets, or access the network.

One High-severity defect blocks this phase. The PowerShell setup and verification boundary treats `<repository-root>\.local\tts-v2` containment as a string-prefix property. It does not reject an existing directory junction/reparse point in `.local`, `tts-v2`, or a nested target. Once an operator has legitimately completed the currently-false gates, the explicit setup can create its staging tree, virtual environment, downloaded artifacts, and receipt outside the repository-local root; its failure cleanup can recurse there as well. The current false gates prevent an accidental write today, but they do not make the approved setup implementation safe when it is later authorized.

No provider was enabled, no setup/verification script was run, and no model, reference, dependency, or external artifact was downloaded by this audit.

## Intent and simpler-alternative pass

The intended outcome is a provider-neutral, offline-by-default seam that can be tested before lawful model activation. Doing nothing would be smaller and would avoid the new setup surface, but would not provide the approved reproducible setup, receipt, sidecar, and fail-closed status contract. The simpler adequate correction is not a new sandbox or a provider redesign: one PowerShell 5.1-compatible physical-root assertion, invoked before every filesystem side effect and before cleanup, plus model-free junction regression tests. Provider enablement must remain blocked while the existing manifest gates are false.

## Scope and independent checks

- Re-read `AGENTS.md`, the approved requirements v2, implementation plan Phase 2, `audit-003.md`, Sol's Phase 2 handoff, root's Phase 2 handoff, current status, and the required `scrutinize` instructions.
- Queried the repository graph, then traced `TTSManager`/controller → install-state checker → `SidecarClient` → stdio server/protocol → adapter → private staging/publication → reserved `/audio` route → retention/shutdown. I also traced setup/verify scripts through manifest gate, reference gate, first write/network, receipt, atomic move, and cleanup.
- Independently ran safe, model-free checks only. No setup scripts, installer, downloader, model loader, or reference path were invoked.

  ```text
  backend/tts-engine/venv/Scripts/python.exe -m unittest discover \
    -s backend/tts-sidecars/tests -p test_*.py            # 20 passed
  npm.cmd test                                            # 84 passed, 1 timed out
  node --test --test-name-pattern="fails closed" \
    test/sidecar_client.test.js                           # passed on focused rerun
  PowerShell parser for 4 TTS scripts                     # passed in the preceding independent run
  git diff --check                                        # passed; only existing LF→CRLF notices
  ```

The sole full-suite failure was the timing-sensitive malformed-sidecar protocol test (`test/sidecar_client.test.js:53-67`): under the complete suite it received `TTS_TIMEOUT` rather than the expected `SIDECAR_PROTOCOL_ERROR`; its focused rerun passed. This is recorded as validation noise requiring a stable CI rerun, not classified as a product security finding because the same case independently exercised the expected fail-closed protocol path.

## End-to-end evidence that passed

- **Pure default status / no implicit activation:** `installState.js:12-20,61-85` reads only bounded regular manifest/lock/receipt metadata; `neuralTtsController.js:76-86,136-156` queries it without starting a child. With `child_process.spawn` monkey-patched to throw, both default providers returned `not_installed`; no `.local/tts-v2` or neural staging root was created.
- **Fail-closed gates and receipt seam:** `installState.js:31-40,83-127` requires all four enablement gates, matching manifest/lock hashes, an exact receipt, and the declared artifact entries before an installation is eligible. Both manifests currently have false gates. The dedicated descriptor tests prove missing files are `not_installed`, false gates are sanitized `unavailable`, receipt tampering is unavailable, and ordinary status avoids model hashing.
- **Protocol, privacy, and offline behavior:** `protocol.py:40-83,101-192` strictly bounds JSONL and accepts no extra request fields; `sidecarClient.js:11-35,70-90,126-130` passes only an environment allowlist, uses `shell: false`, stdio only, and discards raw stderr. Both server entrypoints set offline variables before adapter import and install the `socket`/subprocess audit hook before loading provider code (`jaitts/server.py:13-23`; `vachaspeech/server.py:13-23`).
- **Provider targeting and delayed heavy imports:** Jai validates the exact installed manifest/reference before constructing its F5 backend (`jaitts/adapter.py:62-99`); Vacha checks exact `VIZINTZOR/VachaSpeech-0.6B` rather than accepting a floating library default (`vachaspeech/adapter.py:63-104`). Neither candidate starts while the unresolved gates remain false.
- **Output and Phase 1 seam:** adapters only receive the controller-injected private staging root (`neuralTtsController.js:121-129`); their output names are constrained and output creation is exclusive (`security.py:80-94`; `wav.py:97-122`). Phase 1's descriptor-to-exclusive-publication, registered verified-buffer `/audio`, cleanup, RVC ordering, legacy providers, and shutdown paths are unchanged and still covered by the 84 completed backend tests.

## Findings

### AUD-TTS-004 — setup root containment is lexical and follows reparse-point ancestors

- **Severity:** High
- **Confidence:** High
- **Exact locations:** `scripts/tts-v2/common.ps1:35-45,82-93,104-123,134-154,167-235`; `scripts/verify-tts-assets.ps1:15-58`
- **Affected requirements:** FR2.2 (separate repo-local roots), FR2.3 (verified artifact/receipt handling), FR4.5 (canonical contained output), FR5.2 (allowlisted private reference), non-functional offline/model-free isolation, and the Phase 2 implementation-plan requirement for an isolated provider root and safe first write/network.
- **Evidence:** `Assert-TtsProviderRoot()` compares only `GetFullPath()` strings. `Test-TtsContainedPath()` likewise uses a lexical `StartsWith()` test. `Assert-TtsPrivateReference()` rejects a reparse-point *leaf*, but accepts a reparse-point ancestor. After `Assert-TtsManifestReady()` succeeds, `Invoke-TtsProviderSetup()` creates `$TtsLocalRoot`/a staging tree, creates a venv, invokes pip, downloads artifacts, writes a receipt, moves the stage, and recursively cleans failures using those lexical paths. `verify-tts-assets.ps1` hashes model paths and can write a receipt through the same helpers.
- **Impact:** A pre-existing Windows directory junction at `.local`, `.local\\tts-v2`, or a nested provider/reference/model/receipt directory can redirect setup, verification, receipt mutation, or recursive failure cleanup outside `<repository-root>`. The setup's first disk write and first network download would then occur in an unapproved location. This defeats the isolated provider-root and containment promise and can make cleanup affect the junction target.
- **Safe reproduction:** Do not execute against a real provider. In a disposable test tree, after gates are represented as complete, make `.local` or `.local\\tts-v2` a directory junction to a sibling external directory. The default lexical provider path still equals the expected string, so current `Assert-TtsProviderRoot()` accepts it. The subsequent `New-Item`, staging creation, pip/download, `Move-Item`, and catch cleanup resolve through the junction. No existing check tests or rejects this ancestor condition before side effects.
- **Short-term fix:** Add one PowerShell 5.1-compatible assertion that walks every existing segment from the repository root through `.local`, `tts-v2`, provider, stage, reference, models, and receipts; reject any `ReparsePoint` ancestor (and the repository root if it cannot be trusted). Create missing segments one at a time only after validating their physical parent. Apply that assertion before the first `New-Item`, `Get-FileHash`, interpreter/pip invocation, `Invoke-WebRequest`, receipt temporary write/move, and every cleanup/delete. Revalidate both source and destination immediately before `Move-Item` and use `-LiteralPath` throughout.
- **Long-term prevention:** Centralize all Phase 2 filesystem-root admission in this one helper and add a model-free PowerShell harness that creates junctions at each ancestor. The harness must demonstrate that setup and verification reject before any write, network call, move, hash, or recursive cleanup.
- **Verification:** Parse the scripts; run the full model-free backend/Python suites; then run junction tests for `.local`, `tts-v2`, provider, `reference`, `models`, and `receipts`. Each must fail closed before observing `New-Item`, pip, `Invoke-WebRequest`, `Get-FileHash`, `Move-Item`, or `Remove-Item`. Repeat for the `-WriteReceipt` verification path. Do not change gates or enable a provider to perform this verification.

## Residual notes

- The Python output helper resolves its supplied staging root and rejects malformed/existing destinations (`security.py:80-94`), while Node's Phase 1 publisher separately validates and publishes the resulting private output. The remediation must preserve those boundaries and ensure a new PowerShell physical-root helper is not mistaken for permission to relax Node/Python contained-path checks.
- The current manifests intentionally retain false gates because primary-source pins, checksums, dependency lock contents, and/or licenses are unresolved. That is correct fail-closed behavior. This audit does not authorize provider setup, model acquisition, reference provisioning, benchmark, or UI enablement.
- The complete backend test run had one timing-sensitive protocol-test timeout; the focused rerun passed. Resolve that test's scheduling sensitivity before relying on its full-suite count as CI evidence, but it is not a substitute for the blocking root-containment correction.

## Disposition

`CHANGES_REQUIRED` — **FIX-THEN-SHIP Phase 2 scaffolding.** Remediate AUD-TTS-004 and independently re-audit the root/junction, first-side-effect, receipt, move, and cleanup paths. Keep both provider manifests disabled; provider enablement remains out of scope.
