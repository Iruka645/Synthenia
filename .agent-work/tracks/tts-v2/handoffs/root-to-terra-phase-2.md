# Root to Terra: TTS v2 Phase 2 audit handoff

- Requirements: v2 approved
- Prior gate: Phase 1 `audit-003` PASS/SHIP
- Implementer: root/Codex (user-authorized role exception)
- Auditor: Terra using the named `scrutinize` skill
- Scope: provider adapters, provenance gates, explicit setup/verification, pure descriptors, model-free tests/docs
- Setup/model acquisition executed: **no**

## Intended outcome

Add both provider implementations without making an unverified provider runnable. Boot/list/status/switch/preview/chat remain free of installation, download, upgrade, model import, listener, and reference processing. Missing local state reports `not_installed`; a present but invalid receipt or provenance state reports sanitized `unavailable` / `TTS_INSTALL_INVALID`.

Phase 2 currently ends fail-closed: both committed manifests have `enablementAllowed:false`. This is deliberate evidence, not a claim that either real model is installed or benchmark-ready.

## Primary-source evidence and stop gates

Reviewed 2026-08-10:

- JaiTTS model repository: <https://huggingface.co/JTS-AI/JaiTTS-F5TTS/tree/50a5aa8986df1e3882873834f689a05bcae06bcb>
  - immutable revision `50a5aa8986df1e3882873834f689a05bcae06bcb`
  - current repository license change recorded as CC BY-NC 4.0
  - `model.pt` page reports SHA-256 `74a7b9fdeb9632f0b8784de6aa6db9422d408f2a948cd477dd4bd06ca7f206b9` and detected pickle imports
- F5-TTS code: <https://github.com/SWivid/F5-TTS/commit/91f499635cb4f8b8a926e83f1839f5338bc2ef87>
  - v1.1.21 commit, MIT code license
- Vacha model: <https://huggingface.co/VIZINTZOR/VachaSpeech-0.6B/tree/b71f12ca7d9bb760b25a60cd1baf592297ee2f55>
  - exact target/revision; model card declares Apache-2.0 and MioCodec-25Hz-44.1kHz-v2
- Vacha inference code: <https://github.com/VYNCX/VachaSpeech>
  - repository page exposes broad unpinned dependencies and no repository LICENSE file; exact code revision/license remains unresolved

Consequent stop gates:

- JaiTTS: unresolved remaining sizes/hashes, vocoder provenance/license, and complete Windows Python 3.11 CUDA hash lock.
- Vacha: unresolved inference-code revision/license, MioCodec provenance/license, model/codec artifact sizes/hashes, and complete Windows Python 3.11 CUDA hash lock.
- `requirements.lock` files are explicitly labeled fail-closed placeholders. Their exact hashes are recorded in manifests, but `dependencies.status` and all enablement gates remain unresolved/false.

## Changed Phase 2 files

Python/common and providers:

- `backend/tts-sidecars/common/{__init__.py,protocol.py,security.py,wav.py}`
- `backend/tts-sidecars/jaitts/{__init__.py,server.py,adapter.py,manifest.json,requirements.lock}`
- `backend/tts-sidecars/vachaspeech/{__init__.py,server.py,adapter.py,manifest.json,requirements.lock}`
- `backend/tts-sidecars/tests/{__init__.py,test_protocol.py,test_security.py,test_wav.py,test_adapters.py}`

Node integration:

- `backend/src/services/tts/neural/{installState.js,providerDescriptors.js}`
- `backend/src/services/tts/neural/{contracts.js,sidecarClient.js,neuralTtsController.js}`
- `backend/test/provider_descriptors.test.js`

Explicit operator assets:

- `scripts/tts-v2/common.ps1`
- `scripts/{setup-jaitts.ps1,setup-vachaspeech.ps1,verify-tts-assets.ps1}`
- `.gitignore`
- `docs/tts-v2-setup.md`

Phase 1 files remain part of the same uncommitted track and must be regression-reviewed, but their audit disposition is unchanged.

## Security and lifecycle trace

1. Node descriptors point at separate `.local/tts-v2/{jaitts,vachaspeech}` roots and a shared private untracked reference config.
2. `getInstallState()` snapshots only committed manifest/lock metadata at module load. Status then checks command plus a bounded receipt without spawning, networking, importing Python, or hashing artifacts.
3. Controller injects only the private Phase 1 staging output root at activation. The sidecar environment is allowlisted and forces offline flags.
4. Python server installs an audit hook before provider imports; all socket audit events and child-process/system-spawn events raise `PermissionError`.
5. `load` verifies manifest gates, lock/receipt hashes, every model artifact size/SHA, and lawful private reference configuration before ML import or JaiTTS pickle deserialization.
6. `synthesize` accepts bounded text and a validated basename only, creates provider-private temporary output, converts only mono PCM WAV to an exclusive staging destination, and returns the same basename.
7. Phase 1 then validates, exclusively publishes, registers identity/digest, and serves verified buffered bytes.
8. Setup is outside every runtime entry point. Scripts require mandatory explicit confirmation plus PowerShell confirmation, validate all gates before writes/network, stage in an isolated root, use pip `--require-hashes`, verify downloads, refuse replacement, and atomically move only a verified new install.

## Independent validation requested

Root evidence before handoff:

- Backend: `npm test` -> 85/85 pass, no hang.
- Python sidecars: stdlib `unittest` -> 20/20 pass in 0.529 s.
- Python compileall: pass.
- Node syntax: 74 repository JS files pass.
- PowerShell parser: 4/4 scripts pass without executing setup.
- Manifest JSON/lock SHA consistency: 2/2 pass; both confirmed disabled.
- `git diff --check`: pass (line-ending warnings only).
- Graph: `graphify update .` pass, 2,655 nodes / 3,744 edges.
- No file under the new sidecar/script trees exceeds 1 MiB; `.local/tts-v2` and `audio-staging` are ignored; no model/reference/setup receipt was created.

Terra should independently rerun the safe tests and use `scrutinize` to trace:

- boot/status/factory to prove zero spawn/network/setup/model import;
- receipt snapshot versus sidecar full-hash boundary;
- false manifest gates versus setup's first possible write/network side effect;
- Python stdout/stderr privacy, malformed/duplicate JSONL, offline audit guard, output exclusive creation, and cleanup;
- command/path/root containment and junction/symlink/reparse behavior on Windows;
- exact provider targeting and prevention of Vacha's floating default;
- setup rollback/atomicity and whether PowerShell 5.1 semantics preserve the safety claims;
- Phase 1 staging/publication/store invariants and legacy gTTS/Piper/RVC fallback compatibility.

Verdict should be `ship`, `fix-then-ship`, `rework`, or `reject`, with Critical/High/Medium findings blocking Phase 3. Provider enablement is not requested and must remain blocked while recorded provenance gates are unresolved.
