# TTS Provider Requirements v2

- Version: 2
- Status: approved
- Track: `.agent-work/tracks/tts-v2/` (independent of root lifecycle v1)
- Prepared by: Sol
- Approved by: repository user
- Approval evidence: user said `ลุยได้เลยครับ` on 2026-08-10, explicitly approving the complete pending draft and all six recommended defaults
- Source draft: `.agent-work/drafts/tts-provider-requirements-v2.md`

## Objective

Add both `JTS-AI/JaiTTS-F5TTS` and `VIZINTZOR/VachaSpeech-0.6B` as local Thai neural TTS providers for controlled A/B evaluation on Ryzen 7 2700X, RTX 3060 Ti 8 GB, and 16 GB RAM. Preserve gTTS, Piper, optional RVC, immediate REST chat replies followed by `tts:done`/`tts:error`, and rollback. Keep both candidates until the user explicitly selects a winner; removal requires later approval.

## Confirmed Facts

- Current contract is `synthesize(text) -> audio filename` inside the shared audio directory.
- `TTSManager` optionally applies RVC and retries normal generation once through gTTS when a non-gTTS provider fails.
- Preview invokes the named provider directly and may apply RVC; it currently has no manager fallback.
- Chat/game return text plus `ttsJobId`, synthesize in background, then emit `tts:done` or `tts:error`; the frontend maps by job ID, plays audio, and drives lip-sync.
- Control-panel switch is API-key protected, but current provider replacement is not readiness-gated.
- RVC is optional and returns unconverted base audio on conversion failure.
- Repo-local Python 3.11.15 exists. The current Piper environment has CPU-only `torch 2.12.1+cpu` and cannot be reused for GPU inference.
- JaiTTS is a Thai/English zero-shot F5-TTS voice-cloning research prototype requiring reference audio and transcript. Its model is currently CC BY-NC 4.0 and uses a roughly 1.35 GB pickle-based checkpoint.
- VachaSpeech is a Thai 0.6B BF16 voice-cloning model with MioCodec and safetensors. Its model is currently Apache-2.0; inference code/dependencies are broad and unpinned, and the exact target must be `VIZINTZOR/VachaSpeech-0.6B` rather than the library default.
- gTTS is network-backed and can disclose utterance text externally. Neural providers are local after explicit setup.
- Audio/model artifacts are expected outside Git; generated audio has retention cleanup.

## Interpretations Requiring Benchmark Validation

- Published sizes omit codec/vocoder, duration model, CUDA workspace, Ollama/embedding, and RVC allocations; exact 8 GB fit is unknown.
- Warm sidecars should reduce latency, but cold/warm performance must be measured locally.
- Voice cloning may remove the need for RVC or degrade when stacked with it; RVC-off is the primary comparison.
- Model license labels do not establish all inference-code, codec, dependency, or redistribution rights.

## Functional Requirements

### FR1 — Providers and compatibility

1. Both candidates are distinct first-class choices with stable IDs and clear labels.
2. gTTS and Piper selection/preview remain functional; gTTS normal fallback is initially enabled and operator-disable-able.
3. Chat response shape, job IDs, WebSocket event names/payloads, audio URLs, playback, and lip-sync remain compatible.
4. Output is a valid browser-playable, RVC-compatible PCM WAV inside the approved audio directory. Absolute paths, traversal, arbitrary URLs, and external files reject.

### FR2 — Explicit reproducible setup

1. Boot, list, status, switch, preview, and chat never clone, install, download, or upgrade.
2. Each candidate has a separate repo-local, gitignored Python environment and cache/model root; neither shares/mutates Piper or the other candidate.
3. Code/model revisions and dependencies are pinned; retrieved artifacts have recorded SHA-256 checksums verified before load/replacement.
4. Missing/invalid installs report `not_installed`/`unavailable` without crashing; legacy providers remain usable.

### FR3 — Local sidecar and one-GPU ownership

1. Neural inference uses a local process boundary with no LAN/public listener and an explicit health/readiness state.
2. The selected neural provider may remain warm. Only one candidate may own GPU residency or inference, with one neural request in flight.
3. Switches are serialized/readiness-gated; configured active state changes only after target readiness. Unready targets receive no traffic.
4. The old model may drain/unload before target load. During transition normal chat uses approved fallback. Failed target load preserves logical selection and attempts bounded old-provider restoration.
5. Shutdown releases process/GPU ownership, settles work once, and removes partial output.

### FR4 — Synthesis, fallback, and RVC

1. Blank or over-limit text rejects; text is data, never command/path/URL input.
2. Normal chat/game attempts selected provider then gTTS once; fallback cannot recurse.
3. Preview/benchmark exercise exactly the named active provider and never silently substitute.
4. Optional RVC follows successful base synthesis, including gTTS fallback. RVC-off is primary; RVC failure retains base audio.
5. Output must exist, be non-empty, bounded, decodable, and canonicalized inside the audio root before success.

### FR5 — Lawful reference voice

1. Use an explicitly configured, repo-local but untracked 5–10 second mono WAV that the user owns or may clone; no third-party voice is bundled/fetched.
2. Reference path/transcript are allowlisted startup configuration, never request input, Git content, or logs.
3. JaiTTS uses an accurate supplied transcript; reference ASR is not default.
4. Use the same private reference set for both where technically valid; document provider-specific normalization.

### FR6 — Control panel and status

1. Preserve list/current/switch/preview interaction.
2. UI distinguishes `not_installed`, `loading`, `ready`, `busy`, `unavailable`, and `failed`, prevents duplicates, and retains prior active selection after failed switch.
3. Switch remains API-key protected/rate-limited; list/status never load/install models.
4. Preview identifies actual provider/RVC state; errors exclude traces, full paths, text, and reference content.

### FR7 — Approved initial bounds

| Boundary | Approved default |
| --- | --- |
| Input | 1,000 Unicode code points |
| Neural concurrency | 1 total |
| Waiting queue | 2 total; excess fails busy |
| Queue + synthesis timeout | 120 seconds |
| Startup/readiness timeout | 180 seconds |
| Output | 120 seconds and 25 MiB maximum |
| Automatic sidecar restart | 1 bounded retry |

Timeout/abort drains ownership before new GPU work. Development logs may include provider/job ID, state, timings, RTF, duration/size, resource snapshots, normalized error code, and fallback occurrence—but never text/audio, private transcript, full paths, raw payloads, or secrets.

## Non-Functional Requirements

1. Neural runtime works offline after setup; gTTS is the disclosed external exception.
2. Benchmark has no CUDA OOM, crash, sustained paging thrash, or system instability and records resource use with Ollama/embedding present.
3. Warm target: median RTF `<=1.0`, p95 `<=1.5`, no request beyond 120 seconds; exceptions require user waiver.
4. At least 59/60 measured warm generations succeed per provider; fallback is not provider success.
5. Pin settings/seed where supported; identical corpus/reference; three randomized repetitions per phrase; record nondeterminism.
6. Provider failure is isolated; model-free contract/lifecycle/privacy tests run without downloads; hardware tests are gated.
7. Preserve gTTS, Piper, RVC, audio cleanup, playback/lip-sync, auth, and async delivery.

## Constraints and Out of Scope

- Single-user loopback only; no LAN/public/multi-user/cloud/mobile inference.
- No training, fine-tuning, quantization, arbitrary speaker uploads, streaming protocol, or emotion/style redesign.
- No LLM/RVC replacement, root-v1 remediation, encoding/vision/Live2D work, migration, or unrelated cleanup.
- Approved implementation code and explicit repo-local setup may proceed only in assigned phases. No machine-wide Python/CUDA/driver/FFmpeg change, destructive deletion, commit/push, or out-of-workspace write is authorized.
- Phase 1 has no install/download. Real model setup/benchmark is gated on lawful reference audio, provenance, disk/driver/resource checks, and an explicit operator invocation.
- Environments, models/caches, references, generated benchmark audio, and large binaries stay outside Git.
- Both candidates remain until explicit winner selection; deletion of code/environment/cache/model/reference/evidence requires later approval.

## Dependencies

- Compatible NVIDIA driver and pinned CUDA PyTorch builds; current CPU-only Piper torch is not a base.
- Separate pinned JaiTTS/F5-TTS/flowtts/vocoder/duration and VachaSpeech/codec/Transformers stacks.
- PCM WAV-only provider I/O; no machine-wide FFmpeg assumption. Any unavoidable executable must already exist or be repo-local, pinned, approved, and recorded.
- Disk-capacity/resource check, lawful reference WAV/transcript, fixed non-sensitive benchmark corpus, and existing Node/Socket.IO/RVC/audio infrastructure.

## Security, Privacy, License, and Provenance

1. Manifest source URL, pinned revision, date, license, filename/size, SHA-256; no floating `main`, unpinned Git install, or silent upgrade.
2. Lock/audit dependencies. Arbitrary `trust_remote_code` is prohibited; unavoidable pinned code requires audit and approval.
3. JaiTTS pickle is executable untrusted serialization: only reviewed pinned hash loads; no API replacement; mismatch fails closed.
4. JaiTTS remains CC BY-NC 4.0/research-benchmark-only; approval is hobby/noncommercial, not redistribution/commercial authority.
5. Vacha model is Apache-2.0, but inference repository, MioCodec, and transitive licenses must be resolved before provider enablement; ambiguity blocks redistribution.
6. Keep reference/transcript/samples private/untracked; record consent/purpose; no arbitrary uploaded cloning.
7. Use bounded structured IPC, reject paths/unexpected fields, prevent command injection, and inherit no unnecessary secrets.
8. gTTS fallback is visibly labeled external, logs no text, and can be disabled.

## Acceptance Criteria

1. Both providers install only explicitly, verify pins, report readiness, synthesize locally, and return valid output through existing contract.
2. Runtime paths never download/upgrade; offline tests prove no neural network access.
3. One neural GPU owner/in-flight; queue, timeout, abort, shutdown, and late-settlement tests prove no overlap/double completion.
4. Switch commits only after readiness; failed target never becomes active/corrupts persistence and legacy/fallback remains available.
5. Single gTTS fallback, optional RVC, exact preview/benchmark, REST/WebSocket delivery, and lip-sync remain correct.
6. Bounds/path/output failures sanitize errors and clean partial files.
7. Private content is absent from logs, metrics, API errors, audit records, Git status, and manifests.
8. Both candidates pass benchmark gates or receive explicit documented waiver; gTTS/Piper remain functional.
9. Reproducible provenance covers executable/model artifacts; no user/root-v1 changes are overwritten; no candidate is deleted.

## Benchmark and Winner Gate

Use at least 20 fixed Thai prompts spanning lengths, pauses, questions, exclamations, numbers, dates/times, currency, abbreviations, names, English/code-switching, and hard word boundaries, with three measured warm runs per prompt/provider. RVC-off is primary; optional RVC-on is separate and cannot rescue primary failure.

Record cold readiness, warm latency, duration, RTF, success/error/timeout/fallback, peak VRAM/RAM, output size, forced-failure recovery, and real sequential chat with LLM/embedding present. Blind labels hide provider; user scores intelligibility, naturalness, pacing/prosody, similarity, and artifacts 1–5.

Eligibility requires privacy/provenance/readiness/isolation/offline gates, 59/60 valid outputs, no OOM/crash/silent fallback, median RTF `<=1.0`, p95 `<=1.5`, 120-second ceiling, average intelligibility/naturalness `>=3.5`, no systematic omission, and recovery without backend restart/state corruption.

Approved ranking: listening 55%, latency 20%, reliability 10%, memory 10%, operations/license 5%; under five points is a tie. User selects the winner; scoring never auto-selects/deletes.

## Recovery

- gTTS remains fallback and Piper selectable; reset can restore legacy without deleting neural assets.
- Failure isolates provider, allows one restart, frees resources, removes partial output, and follows fallback.
- Failed switch does not persist target; bounded old-provider restoration follows unload.
- Restart uses checksum-verified local artifacts only and never downloads.
- Rollback preserves private reference, models/caches, and evidence until separate deletion approval.

## Approved Decisions and Remaining Gates

All six defaults are approved: enabled/disclosed/disable-able gTTS fallback; one private lawful reference for both; FR7 limits; winner weights/tie band; RVC-off primary; and local noncommercial JaiTTS plus Vacha license resolution before enablement.

No product question remains for Phase 1. Later operational gates are: user supplies lawful reference/provenance; exact upstream pins/licenses/checksums are resolved; disk/driver/resource checks pass; and setup/benchmark scripts are explicitly invoked. A material change to privacy, network exposure, license, reference handling, bounds, or winner gate reopens approval.
