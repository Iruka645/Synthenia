# TTS v2 Phase 2 — Terra Audit 005

- Requirements: v2 (approved)
- Implementation plan: v1, Phase 2
- Auditor: Terra, independent re-audit using `scrutinize`
- Scope: AUD-TTS-004 physical containment remediation; setup/verify first-side-effect, receipt, promotion, cleanup, pure status, sidecar, and Phase 1 regressions
- Disposition: `CHANGES_REQUIRED` — **FIX-THEN-SHIP**

## Executive summary

This remediation is meant to stop a junction/reparse ancestor from redirecting the future explicit provider setup or verification process outside the approved repo-local root. It succeeds for AUD-TTS-004: `Assert-TtsPhysicalPath()` walks existing segments and `New-TtsPhysicalDirectory()` creates and immediately re-admits physical segments; the permitted disposable harness rejected all six required junction locations before its simulated side effect and safely cleaned up.

One new Medium finding blocks Phase 2 ship. The final stage promotion still relies on `Move-Item` after an early destination-absence check. Immediately before the move, the new helper accepts an existing ordinary directory as a valid `Directory` leaf instead of requiring that the provider destination remain absent. A second concurrent explicit setup (or a late local directory creation) can therefore cause PowerShell to move the stage *inside* the existing provider directory and then return success, leaving a nested large partial install rather than atomically promoting the intended provider root.

Provider enablement remains out of scope. Both manifests still have `enablementAllowed: false`; neither setup nor verification script, model/reference provisioning, install, download, or gate mutation was executed by this audit.

## Intent and simpler-alternative pass

Doing nothing would leave the confirmed external-root reparse route. The new central physical-path helper is the smallest adequate repair for that problem; a separate sandbox or provider rewrite is not necessary. For the remaining promotion race, the smallest correct change is also local: require an absent final destination and use a directory-rename primitive that fails if it exists, rather than adding a lock service or changing provider architecture.

## Scope and independent checks

- Re-read the required `scrutinize` instructions, `AGENTS.md`, `audit-004.md`, `terra-to-sol-phase-2-004.md`, root's remediation handoff, current status, and the actual source/test/script diff. Queried the repository graph before tracing the code.
- Traced setup from wrapper → `Assert-TtsProviderRoot` → committed manifest/lock admission and hashes → false-gate check → private-reference admission → local/stage creation → bootstrap Python/venv/pip → artifact download/hash/move → receipt replace → final stage promotion → failure cleanup. Traced verify's Python/model/hash/receipt route independently. Rechecked controller/status → `SidecarClient` → stdio protocol/adapter → Phase 1 publication, `/audio`, RVC/legacy, retention, and shutdown seams.
- Ran safe model-free validation only:

  ```text
  PowerShell parser (5 scripts/harness)                 # 5/5 passed
  scripts/tts-v2/tests/containment.tests.ps1            # 13/13 passed; temp cleanup clean
  Python sidecar unittest suite                          # 20/20 passed
  focused malformed-sidecar protocol test                # passed
  npm.cmd test                                           # 85/85 passed
  node --check src/ and test/                            # 74 files passed
  default status with spawn monkey-patched               # two not_installed; no roots created
  disabled-manifest check                                # 2/2 enablementAllowed=false
  git diff --check                                       # passed; existing LF→CRLF notices only
  ```

## Re-verified AUD-TTS-004

**Resolved.** `common.ps1:8-61` rejects a reparse point in every existing target segment below a trusted physical repository root; `New-TtsPhysicalDirectory()` at `63-87` validates the parent before .NET creation and validates each created segment immediately afterwards. The hardened calls surround committed metadata reads/hashes (`95-128`), provider/reference admission (`131-228`), receipt write/replace/cleanup (`231-277`), Python/venv/pip/download/artifact hash/move (`279-370`), final promotion/cleanup (`371-388`), and the independent verify script (`verify-tts-assets.ps1:15-68`).

The permitted harness covers a junction at `.local`, `.local/tts-v2`, provider root, reference root, model root, and receipt root (`containment.tests.ps1:36-98`). Each case rejected both admission and physical directory creation, left an outside marker unchanged, deleted only the checked junction with `.NET Directory.Delete(..., false)`, and left no disposable root after completion (`76-115`). This directly closes the High out-of-workspace reparse path reported as AUD-TTS-004.

## Findings

### AUD-TTS-005 — final provider promotion is not collision-safe or atomic

- **Severity:** Medium
- **Confidence:** High
- **Exact locations:** `scripts/tts-v2/common.ps1:301-302,371-377`; missing coverage in `scripts/tts-v2/tests/containment.tests.ps1:36-121`
- **Affected requirements:** FR2.2 (separate provider-local environment), FR2.3 (reproducible verified installation), failure isolation/recovery, and the approved Phase 2 requirement to promote one verified staged install atomically without replacing or leaving partial provider state.
- **Evidence:** The first `Test-Path $providerRootFull` absence check occurs before virtualenv creation, pip, downloads, receipt writing, and a potentially long setup (`301-302`). Immediately before promotion, `Assert-TtsPhysicalPath(... -LeafType Directory)` only asserts that an existing destination is a safe directory; it does not require absence (`371-374`). PowerShell `Move-Item` moves a directory into an existing directory rather than providing an exclusive directory rename. Thus a second setup of the same provider can pass the early absence check, create a separate stage, observe a provider root promoted by the first process at `373`, move its stage beneath that directory at `375`, pass the final directory assertion, and return success. The harness tests reparse rejection and ordinary creation, but never simulates a destination created after the precheck or asserts promotion collision behavior.
- **Impact:** A concurrent/retried explicit setup can report success while leaving its verified venv/cache/models/receipt under `providerRoot\.setup-...` instead of at the stable provider root. It consumes disk, violates the single isolated-install contract, leaves an ambiguous recovery state, and can leave status governed by an unrelated pre-existing directory rather than the invocation that reported success.
- **Safe reproduction:** In a disposable test root with valid fake gates and no provider root, begin two same-provider setup flows. Let both complete line 301 before either promotion; let the first promote its stage. The second's line 373 accepts that physical directory and `Move-Item` nests its stage below it, after which line 376 still succeeds. No provider download/model/reference is needed for a unit-level promotion helper test.
- **Short-term fix:** Introduce an explicit `MustNotExist` admission for the final provider root and replace `Move-Item` with `[IO.Directory]::Move($stageFull, $providerRootFull)` (same-volume directory rename). Re-admit the source and parent immediately before the call; `Directory.Move` must fail if the destination exists. On failure, the existing physical-stage cleanup path may remove only the still-present checked stage. Apply equivalent fail-on-existing semantics to artifact moves where a directory container could otherwise change `Move-Item` behavior.
- **Long-term prevention:** Factor stage promotion into a narrow helper whose contract is “physical source directory + physical parent + absent leaf → one promoted root or error,” then test concurrent/collision, source disappearance, and destination substitution paths. Do not use a broad global lock as a substitute for an exclusive filesystem operation.
- **Verification:** Add a model-free PowerShell harness case that creates a physical provider destination after the initial absence check and proves promotion throws, creates no nested `.setup-*`, preserves the existing destination byte-for-byte, and cleans only the verified stage. Re-run the six reparse cases, parser, Python suite, focused/full backend suites, syntax, disabled-gate check, and diff check. Do not execute setup/verify scripts or enable a provider.

## Residual notes

- The ordinary boot/status path remains pure: `installState.js:12-20,61-85` reads bounded metadata and `neuralTtsController.js:76-86,136-156` returns state without child spawn. With `spawn` patched to throw, both default providers returned `not_installed` and no install/staging root appeared.
- The sidecar's bounded JSONL, offline guard, error privacy, exact Jai/Vacha targeting, and Phase 1 private-staging → exclusive publication → verified-buffer delivery/legacy/RVC/shutdown seams did not regress in the independent full suites.
- Reparse containment now rejects existing normal junction/symlink ancestors as required by AUD-TTS-004. This audit does not alter the documented same-Windows-principal residual risk for arbitrary post-admission filesystem races; AUD-TTS-005 is the deterministic existing-directory promotion race that the setup code itself can trigger through concurrent operator invocations.

## Disposition

`CHANGES_REQUIRED` — **FIX-THEN-SHIP.** AUD-TTS-004 is closed, but AUD-TTS-005 Medium requires a collision-safe exclusive final promotion and regression proof. Keep both providers unavailable and all enablement gates false.
