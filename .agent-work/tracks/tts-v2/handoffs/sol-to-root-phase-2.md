# Sol → Root: TTS v2 Phase 2

- Requirements: v2 approved; plan v1 Phase 2
- Phase 1: `audit-003` PASS/SHIP
- Implementer: root/Codex, user-authorized
- Scope: adapters, manifests/locks, explicit setup/verification scripts, inert descriptors, model-free tests/docs only
- Audit exit: Terra `scrutinize` review before Phase 3

No separate upstream research artifact exists in this track. Requirements v2 contains the only approved upstream facts. Exact current revisions, artifact hashes, dependency pins, and transitive licenses require primary-source web verification; never guess them.

## Exact files

Create:

```text
backend/tts-sidecars/common/{__init__.py,protocol.py,security.py,wav.py}
backend/tts-sidecars/jaitts/{server.py,adapter.py,manifest.json,requirements.lock}
backend/tts-sidecars/vachaspeech/{server.py,adapter.py,manifest.json,requirements.lock}
backend/tts-sidecars/tests/{test_protocol.py,test_security.py,test_wav.py,test_adapters.py}
backend/src/services/tts/neural/{providerDescriptors.js,installState.js}
backend/test/provider_descriptors.test.js
scripts/tts-v2/common.ps1
scripts/{setup-jaitts.ps1,setup-vachaspeech.ps1,verify-tts-assets.ps1}
docs/tts-v2-setup.md
```

Modify only as needed: `backend/src/services/tts/neural/neuralTtsController.js`, `sidecarClient.js`, `contracts.js`, `.gitignore`, `.env.example`. Preserve Phase-1 publication/store contracts.

## Python runtime

`protocol.py` owns bounded JSONL on inherited stdin/stdout only. Read at most 64 KiB plus one byte; reject malformed UTF-8/JSON, arrays, unknown fields, duplicate/late IDs, and unsupported types. Never listen or print payloads. Exact Node requests:

```text
{requestId,type:"load",providerId}
{requestId,type:"synthesize",providerId,text,outputName}
{requestId,type:"unload",providerId}
{requestId,type:"shutdown"}
```

Optional `hello` may support direct tests but must not require a Node change. Responses fit `normalizeSidecarResponse`: `{requestId,ok,state?,output?,metrics?,error?}`. Errors use fixed allowlisted codes and omit/fix `message`. stdout is protocol-only; stderr never includes text, reference data, paths, exceptions, or payloads.

`security.py` accepts only the Node basename: `.wav`, <=180 chars, no slash/absolute/traversal/URL. Resolve under canonical `TTS_AUDIO_ROOT` staging, reject links/existing objects, and exclusive-create. `wav.py` writes/validates mono PCM WAV without shell or machine FFmpeg.

Each `server.py` dispatches only the protocol. Set `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, and provider offline flags before ML imports. `load` verifies manifest/receipt and every executable/model hash locally before lazy import/load; `synthesize` treats text as data, uses allowlisted private reference config, writes staging PCM, and returns the same basename; `unload` releases model/CUDA references; `shutdown` exits. No import-time model load, network, install, clone, upgrade, ASR, reference fetch, `shell=True`, `eval`, or arbitrary `trust_remote_code`.

`adapter.py` exposes `load(config)`, `synthesize(text, output_path)`, `unload()`. Provider imports occur inside `load`. JaiTTS rejects missing private WAV/transcript and checkpoint hash mismatch before pickle load. Vacha explicitly targets `VIZINTZOR/VachaSpeech-0.6B`, uses local files only, and rejects unresolved MioCodec/inference-code licenses. Tests inject fake backends; no real stacks, models, or references.

## Manifests, pins, provenance, licenses

Both `manifest.json` files use schema 1:

```json
{
  "schemaVersion": 1,
  "provider": {"id": "...", "modelId": "...", "purpose": "local-noncommercial-evaluation"},
  "python": {"version": "3.11.15", "entrypoint": "server.py"},
  "sources": [{"role": "model|code|codec|vocoder|duration", "url": "...", "revision": "40-hex-or-release", "retrievedAt": "YYYY-MM-DD", "license": "SPDX-or-UNRESOLVED", "licenseUrl": "..."}],
  "artifacts": [{"sourceRole": "...", "relativePath": "...", "sizeBytes": 0, "sha256": "64-hex", "format": "safetensors|pickle|source-archive", "executableSerialization": false}],
  "dependencies": {"lockFile": "requirements.lock", "sha256": "64-hex"},
  "security": {"trustRemoteCode": false, "runtimeNetwork": false},
  "gates": {"pinsVerified": false, "licensesResolved": false, "checksumsComplete": false, "enablementAllowed": false}
}
```

Before filling facts, verify primary upstream repos/model cards/releases/package indexes; record immutable URLs/date. Web verification needed: JaiTTS code/model/vocoder/duration revisions/licenses and reviewed pickle filename/size/SHA; Vacha inference repo, exact model revision, MioCodec revision/license, dependency licenses; compatible CUDA PyTorch wheel index/version/hashes. Requirements establish only JaiTTS model CC BY-NC 4.0/research use and Vacha model Apache-2.0—not surrounding stacks.

Unknowns stay `UNRESOLVED`/false and make setup, receipt, detection, and load fail closed. Never label plausible placeholders verified. JaiTTS pickle sets `executableSerialization:true`; enable only its reviewed exact hash. Each `requirements.lock` pins all direct/transitive packages with `==` and hashes (`--require-hashes` compatible), including index provenance; no Git branch/`main`, range, editable, or unpinned URL.

## Explicit setup — implement, never execute in Phase 2

Scripts use `[CmdletBinding(SupportsShouldProcess)]`, `-ProviderRoot` constrained under `.local/tts-v2/<provider>/`, and mandatory `-ConfirmExplicitSetup`. Without confirmation or with false gates, exit before network/write. They run only on later explicit operator invocation.

`setup-*.ps1` seeds separate `.local/tts-v2/<id>/{venv,cache,models,source,receipts,tmp}` from repo Python 3.11.15. Download only immutable manifest URLs into provider `tmp`; verify SHA-256/size before atomic placement/extraction. Install only with `python -m pip install --require-hashes -r requirements.lock`. Never reuse/mutate `backend/tts-engine/venv` (CPU Piper), the other provider, machine Python/CUDA/driver/FFmpeg, or global caches. Failure preserves prior verified install and removes only new temp files.

`verify-tts-assets.ps1` is local/read-only by default: validate schema/gates, lock hash, venv interpreter/version, files/hashes, isolated roots, and private reference config presence/containment without printing values. Only successful explicit setup/verification writes untracked `receipts/install-state.json` atomically with provider ID, manifest SHA, artifact hashes, Python version, and timestamp. Boot/npm/Node/status/switch/preview/chat/tests never invoke scripts.

## Node descriptors and detection

`providerDescriptors.js` exports stable IDs. Commands are absolute `.local/tts-v2/<id>/venv/Scripts/python.exe`; args are committed `server.py`; cwd is provider code. Env is only provider `HF_HOME`, `TTS_MODEL_ROOT`, `TTS_CACHE_ROOT`, `TTS_REFERENCE_CONFIG`, offline/UTF-8 flags, and controller-overridden staging `TTS_AUDIO_ROOT`. Add `TTS_REFERENCE_CONFIG` to `SidecarClient` allowlist; never inherit/log its global value.

`installState.js` synchronously inspects committed manifest plus untracked receipt locally; never spawn, hash multi-GB assets, load Python, or network. Missing command/receipt => `not_installed`; present but invalid schema/gates/manifest hash/lock hash/path => `unavailable` with sanitized `TTS_INSTALL_INVALID`. Sidecar `load` does full asset hashes. Controller defaults import these descriptors and support richer `getInstallState()` while list/status remain pure. With no `.local`, legacy is ready and neural is `not_installed`.

## Tests and no-download proof

Safe Python command (Piper interpreter runs stdlib tests only, never neural inference):

```powershell
& .\backend\tts-engine\venv\Scripts\python.exe -m unittest discover -s .\backend\tts-sidecars\tests -p "test_*.py"
```

Test strict protocol, redaction, paths/links, exclusive output, PCM, fake lifecycle, checksum/license/reference failure, unload, and socket/HTTP/subprocess-download denial. Patch `socket`, `urllib`, and hub entry points to fail on calls. `provider_descriptors.test.js` proves missing/invalid/valid receipts, no spawn/network/hash-on-status, isolated commands/env, staging override, and unchanged metadata. Run backend `npm.cmd test`, Python command, Python `compileall`, Node syntax, and `git diff --check`; never setup scripts.

## Docs and ignore rules

Ignore `.local/tts-v2/`, `audio-staging/`, provider venv/cache/model/source/receipt/tmp/reference/benchmark paths; explicitly keep committed `backend/tts-sidecars/**`, manifests, locks, tests, scripts, and `docs/tts-v2-setup.md`. Add `!docs/tts-v2-setup.md` because `docs/*` is ignored. `.env.example` lists only non-secret config names. Docs label gTTS external, JaiTTS research/noncommercial, Vacha surrounding-license gate, explicit setup syntax (not run), offline verification/rollback, private references, and environment separation.

## Stop and audit gates

Keep a provider unavailable if any revision, artifact/lock hash, CUDA compatibility, inference/codec/vocoder/duration/transitive license, consent/config, or no-`trust_remote_code` path is unresolved. Stop all work if runtime needs network, remote code, machine-wide changes, listener, Piper reuse, or Phase-1 contract weakening.

Root hands Terra changed files, primary-source evidence, manifest/lock diffs, safe test results, proof setup never ran and Git has no private/large artifacts, and boot/status proof of zero spawn/network/download. Phase 3 waits for Terra PASS or explicit blocker resolution.
