# Neural TTS v2 — high-spec machine handoff

Last updated: 2026-08-10

## Operator intent and target machine

- Use case: personal hobby and local noncommercial evaluation. There is no commercial deployment plan.
- Target hardware: AMD Ryzen 7 2700X, NVIDIA RTX 3060 Ti 8 GB, and 16 GB DDR4 RAM.
- Real model installation and inference have **not** been run on the current machine. This handoff exists so the repository can be cloned onto the target machine before enablement work continues.

## Completed and independently audited

The provider-neutral implementation for `jaitts-f5tts` and `vachaspeech-0.6b` is complete through Phase 3:

- isolated Node controller and stdio Python sidecars;
- one active neural provider at a time, bounded queue/timeouts, readiness-gated switching, rollback, shutdown, and gTTS fallback compatibility;
- private staging, exclusive publication, verified buffered audio serving, retention, and link/path/race defenses;
- offline-only provider runtime with isolated provider environments, manifests, receipts, immutable-source fields, and explicit setup scripts;
- control-panel status, fail-closed provider selection, active-ready preview, one abortable audio owner, source-scoped cleanup, and bounded error/log output;
- model-free setup containment/collision regression harness.

Terra's independent `scrutinize` audit passed in `audit-009`. Findings `AUD-TTS-001` through `AUD-TTS-010` are resolved.

Latest model-free verification:

| Check | Result |
| --- | --- |
| Backend Node tests | 85/85 passed |
| Frontend tests | 29/29 passed |
| Frontend lint/build | Passed; established warnings only |
| Python sidecar tests | 20/20 passed |
| PowerShell containment/collision harness | 14/14 passed |
| Provider enablement gates | 2/2 remain `false` |

Audit and detailed status:

- `.agent-work/tracks/tts-v2/reports/audit-009.md`
- `.agent-work/tracks/tts-v2/handoffs/terra-to-sol-phase-3-003.md`
- `.agent-work/tracks/tts-v2/status.md`
- `docs/tts-v2-setup.md`

## Current runtime state

Both neural providers intentionally report `not_installed`. Boot, status, chat, switching, and preview never download or install anything. Do not bypass this by manually changing only `enablementAllowed`.

All model environments, caches, receipts, private reference files, and benchmark output belong under `.local/tts-v2/`, which is Git-ignored. Never commit model weights, voice recordings, transcripts, tokens, receipts, or local paths.

## Phase 4 blockers to resolve before installation

### JaiTTS F5-TTS

Already recorded:

- model revision `50a5aa8986df1e3882873834f689a05bcae06bcb`;
- checkpoint SHA-256 `74a7b9fdeb9632f0b8784de6aa6db9422d408f2a948cd477dd4bd06ca7f206b9`;
- F5-TTS code revision `91f499635cb4f8b8a926e83f1839f5338bc2ef87`;
- hobby/noncommercial purpose is compatible with the recorded CC BY-NC 4.0 restriction, subject to its actual terms.

Still required:

1. Pin the local vocoder source, immutable revision, license, exact artifacts, byte sizes, and SHA-256 values.
2. Record exact size/hash for `vocab.txt` and verify the checkpoint size against the pinned source.
3. Produce a complete Python 3.11 Windows/CUDA dependency lock using `--require-hashes` compatible entries.
4. Independently review the completed manifest and lock before changing any gate.

### VachaSpeech 0.6B

Already recorded:

- model revision `b71f12ca7d9bb760b25a60cd1baf592297ee2f55`;
- model card declares Apache-2.0 for the model.

Still required:

1. Resolve and record the inference repository's immutable revision and repository license.
2. Resolve MioCodec provenance, immutable artifact source, license, byte sizes, and hashes.
3. Hash and size every model/tokenizer/codec artifact.
4. Produce the complete Python 3.11 Windows/CUDA hash-locked dependency set.
5. Keep VachaSpeech disabled if the code or codec license remains unresolved; do not treat the model license as licensing those separate components.

## Resume sequence on the target machine

1. Clone the repository and check out the pushed revision.
2. Confirm GPU/driver visibility with `nvidia-smi`, available disk space of at least 15 GiB per provider, and the intended Python 3.11 runtime. Do not modify machine-wide CUDA, Python, FFmpeg, or drivers through the provider scripts.
3. Install the existing application dependencies in `backend` and `frontend` with `npm.cmd install`. No Node lockfile is committed at this revision, so review any generated lockfiles before deciding whether to preserve them. This step does not authorize neural-provider setup or installation from the placeholder Python lock files.
4. Run the model-free suites before changing manifests:

   ```powershell
   Set-Location .\backend
   npm.cmd test
   Set-Location ..\frontend
   npm.cmd test
   npm.cmd run lint
   npm.cmd run build
   Set-Location ..
   python -m unittest discover -s backend/tts-sidecars/tests -p test_*.py
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\tts-v2\tests\containment.tests.ps1
   ```

5. Resolve the Phase 4 blockers above from primary sources. Update artifact sizes/hashes, dependency locks, licenses, and gates together; obtain another independent audit before setting `enablementAllowed: true`.
6. Prepare a lawful private reference only under `.local/tts-v2/reference/` as described in `docs/tts-v2-setup.md`. Use a 5–10 second mono PCM WAV and an exact UTF-8 transcript that you own or are licensed to use.
7. Enable and test one provider at a time. Only after its manifest is complete and audited, run its explicit setup command from `docs/tts-v2-setup.md`, verify assets/receipt, restart the backend, confirm status changes from `not_installed` to `unavailable`, then select it and wait for `ready`.
8. Start with JaiTTS. Keep VachaSpeech disabled until its separate code/codec licensing and provenance are complete.
9. If a neural provider fails, select Piper or gTTS. Do not delete the environment, cache, private reference, or benchmark evidence while diagnosing.

## Benchmark plan

Use the same Thai evaluation set for both providers and record:

- cold model-load time and peak VRAM/RAM;
- synthesis latency, audio duration, and real-time factor for short/medium/long text;
- Thai pronunciation, tone, number/date reading, punctuation pauses, and mixed Thai/English text;
- stability over repeated requests and recovery after an injected sidecar failure;
- reference-voice similarity and naturalness;
- output with and without the existing RVC stage;
- whether 8 GB VRAM requires reduced settings or makes either provider impractical.

Keep only the provider that is stable, license-compatible, and perceptibly better for this hobby setup. The architecture permits leaving the other provider disabled without affecting Piper/gTTS.

## Security and privacy reminders

- Normal gTTS fallback sends utterance text to an external service. Disable fallback during strictly local/private evaluation.
- Never use a voice without ownership, license, and consent.
- Never place tokens, API keys, local absolute paths, reference transcripts, or model artifacts in Git, logs, receipts, screenshots, or audit documents.
- Do not run `setup-*.ps1` or `verify-tts-assets.ps1 -WriteReceipt` while any manifest gate is false or any field is `UNRESOLVED`.
