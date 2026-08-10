# Neural TTS v2: isolated setup and safety gates

Synthenia has provider adapters for `jaitts-f5tts` and `vachaspeech-0.6b`. Both are deliberately reported as `not_installed` today. Their setup manifests contain unresolved provenance gates, so the setup and verification scripts fail before any network request or local installation. Do not change a gate to `true` without completing and independently reviewing every source, artifact, dependency, and license field.

## Current provenance state

| Provider | Reviewed immutable facts | Blocking facts |
| --- | --- | --- |
| JaiTTS F5-TTS | Model revision `50a5aa8986df1e3882873834f689a05bcae06bcb`; `model.pt` SHA-256 `74a7b9fdeb9632f0b8784de6aa6db9422d408f2a948cd477dd4bd06ca7f206b9`; F5-TTS code revision `91f499635cb4f8b8a926e83f1839f5338bc2ef87` | Exact byte sizes and remaining artifact hashes, vocoder provenance/license, and a complete Python 3.11 Windows/CUDA hash lock |
| VachaSpeech 0.6B | Exact model ID `VIZINTZOR/VachaSpeech-0.6B`; model revision `b71f12ca7d9bb760b25a60cd1baf592297ee2f55`; model card declares Apache-2.0 | Inference repository revision/license, MioCodec provenance/license, all artifact hashes/sizes, and a complete Python 3.11 Windows/CUDA hash lock |

JaiTTS is restricted to local noncommercial research/evaluation under CC BY-NC 4.0. Its PyTorch pickle checkpoint is executable serialization and may load only after its exact reviewed SHA-256 matches. VachaSpeech's model license does not by itself license its inference repository, codec, or dependencies; the provider remains unavailable while those facts are unresolved.

## Runtime boundary

- Backend boot, provider list/status, switch, preview, and chat never install, clone, download, or upgrade.
- Each provider has its own `.local/tts-v2/<provider>/venv`, cache, models, temp files, and receipt. Neither provider uses or mutates Piper's CPU environment.
- Sidecars inherit stdin/stdout only, bind no socket, force Hugging Face and Transformers offline mode before ML imports, and receive a small allowlisted environment.
- Status reads only committed metadata snapshots plus a small untracked receipt. Full model hashes are checked inside sidecar `load`, before any model import.
- Normal gTTS fallback is still enabled for compatibility and sends utterance text to an external service. Piper and the two neural providers are local; use the operator fallback setting if external disclosure is unacceptable.

## Control-panel status

The TTS selector reads `GET /api/tts/status` and displays every provider's normalized `state`, `installed`, and `active` fields. A neural provider in `not_installed`, an invalid installation, an unknown state, or an unknown provider kind is disabled in the browser. A verified provider with `installed: true` and `state: unavailable` may be selected; the backend still performs the authoritative readiness and rollback checks before committing the switch.

Preview is enabled only for the active provider in `ready` state. A failed switch leaves the previous selection visible, and the UI maps typed error codes to bounded messages instead of displaying upstream process output or local paths. The refresh action is observation-only and cannot start or install a provider.

The main TTS selector and the Voice Conversion tab use one shared preview owner. It derives the provider from the current normalized status rather than saved configuration, aborts pending preview work, and pauses only the audio started by a view when that view unmounts. API errors exposed to UI code contain only the normalized message, status, and code; the Axios request object and its authentication headers are not retained.

## Private reference configuration

Create these files only under `.local/tts-v2/reference/`; the whole tree is Git-ignored:

```text
.local/tts-v2/reference/
  reference.json
  voice.wav
  transcript.txt
```

`voice.wav` must be a lawful 5–10 second mono PCM WAV owned by you or licensed for cloning. `transcript.txt` must be an exact UTF-8 transcript. No sample voice, transcript, or ASR replacement is bundled or fetched.

Example `reference.json`:

```json
{
  "schemaVersion": 1,
  "wav": "voice.wav",
  "transcriptFile": "transcript.txt",
  "vachaGender": "female",
  "consent": {
    "ownedOrLicensed": true,
    "purpose": "local-noncommercial-evaluation"
  }
}
```

`vachaGender` must be `female` or `male`; it is not inferred or accepted from synthesis requests. Reference paths and transcript contents never appear in status, API errors, receipts, or logs.

## Explicit setup — blocked until provenance is complete

These are future operator commands, not runtime hooks. Do not run them while either manifest has a false gate or `UNRESOLVED` value:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-jaitts.ps1 -ConfirmExplicitSetup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-vachaspeech.ps1 -ConfirmExplicitSetup
```

Each script validates every gate before writing or networking, rejects symbolic-link/junction/reparse ancestors segment by segment, requires 15 GiB free space, creates a fresh provider-specific staging tree, installs only a `--require-hashes` dependency lock, downloads immutable HTTPS artifact URLs, verifies byte size and SHA-256, and atomically moves a verified new install into place. It refuses to overwrite an existing provider directory or change machine-wide Python, CUDA, drivers, FFmpeg, Piper, or the other provider. `-ExecutionPolicy Bypass` applies only to that child PowerShell process; it does not change the machine or user policy.

Local verification is read-only by default:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-tts-assets.ps1 -Provider jaitts
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-tts-assets.ps1 -Provider vachaspeech
```

Writing a new sanitized receipt requires both `-WriteReceipt` and `-ConfirmExplicitSetup`. Verification never prints private values or artifact paths.

The model-free junction regression harness is safe to run independently of setup and never changes manifest gates:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\tts-v2\tests\containment.tests.ps1
```

## Offline readiness and rollback

After a later reviewed setup, restart the backend so descriptor metadata snapshots are refreshed. `GET /api/tts/status` must move from `not_installed` to `unavailable`; selecting the provider then performs full local hashes, loads it offline, and commits the active selection only after readiness.

Rollback selects gTTS or Piper through the existing provider control. Do not delete neural environments, model caches, private references, or benchmark evidence without separate approval. A failed neural switch retains or restores the previous logical provider and never makes an unready target active.
