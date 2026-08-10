# TTS v2 Phase 1 — Terra Audit 003

- Requirements: v2 (approved)
- Implementation plan: v1
- Auditor: Terra, independent re-audit using `scrutinize`
- Audit scope: Phase 1 remediation 002 and regressions AUD-TTS-001/002
- Disposition: `PASS` — **SHIP Phase 1**

## Executive summary

The goal is to let a local neural sidecar produce browser-playable PCM WAVs without letting a mutable child-owned pathname become the artifact that the browser, RVC, or legacy delivery flow uses. The previous post-validation pathname race (AUD-TTS-003) is closed: the sidecar receives a sibling staging root only; Node holds and validates the staging descriptor, copies it to an exclusively-created reserved public artifact, registers its identity and SHA-256, and the `/audio` handler reads, verifies, and sends one bounded Buffer rather than delegating reserved names to static middleware.

No Critical, High, or Medium finding remains in the audited Phase 1 scope. This is a Phase-1 ship decision, not approval to install models, download assets, or bypass the later lawful-reference, provenance, setup, benchmark, and frontend gates.

## Intent and simpler-alternative pass

Doing nothing would retain the confirmed post-validation static-path race. A simple `rename()` of the staged pathname is smaller, but it would not preserve the reviewed descriptor-to-served-bytes guarantee across the separate roots or protect the later HTTP open. The implemented small necessary boundary is therefore appropriate: one validated staging handle, one `O_EXCL` public file, and a registered verified-buffer handler. It adds no dependency, listener, model, or runtime setup surface.

## Scope and independent checks

- Read `AGENTS.md`, approved requirements v2, plan v1, `audit-002.md`, both remediation handoffs, current status, the full relevant source/test diff, and unchanged chat/RVC/shutdown call paths.
- Queried the repository graph for `TTS neural staging publication reserved audio middleware cleanup shutdown RVC compatibility`, then traced controller → `SidecarClient` → fake sidecar → validator/publication → manager/chat/RVC → `/audio` → retention/shutdown.
- Searched the TTS runtime/test surface for install, download, upgrade, clone, network, and listener paths. The neural runtime contains only local stdio child spawning; no runtime setup/download path was introduced.
- Ran independently from `backend/`:

  ```text
  npm.cmd test                                           # 79 passed, 0 failed
  Get-ChildItem src,test -Recurse -Filter *.js | node --check
                                                        # 71 files, all passed
  git diff --check                                      # passed
  ```

  The suite exercised the real spawned JSONL fake child, staging-root override, descriptor publisher, post-publication swap, verified middleware, retention, legacy fallback/RVC ordering, rate limiting, and stderr redaction. `git diff --check` emitted Git's existing LF→CRLF notices only.

## Re-verified findings and traces

| Finding | Result | Evidence-backed trace |
| --- | --- | --- |
| AUD-TTS-001 — authenticated switch limiter | Resolved | `backend/src/routes/tts.js:39-50` orders `apiKeyAuth` then `ttsSwitchLimit` before `switchProvider`; `backend/src/middleware/rateLimits.js:38-52` defines the five-per-window control-plane bucket. `backend/test/tts_switch_rate_limit.test.js:37-74` independently proves unauthorized requests do not invoke the manager, five authorized requests do, and the sixth is 429. |
| AUD-TTS-002 — raw gTTS/Piper stderr disclosure | Resolved | `gttsProvider.js:47-85` and `piperProvider.js:50-88` start without a shell, drain stderr without retaining it, and return fixed typed errors. `legacy_provider_redaction.test.js:42-109` injects text/path sentinels through both direct providers and neural→gTTS fallback and proves they are absent from logs and outward messages. |
| AUD-TTS-003 — mutable validated pathname | Resolved | Controller runtime descriptors force only `TTS_AUDIO_ROOT` to `stagingRoot` (`neuralTtsController.js:105-113`); `_runJob()` supplies an unpredictable staging basename to the child, checks response equality, publishes it, and returns only the publication name (`322-346`). `validateAndPublish()` opens/validates staging once (`214-246`), creates public output with `O_CREAT|O_EXCL` (`253-255`), copies descriptor-to-descriptor and validates/hash-checks the public handle (`257-285`), then registers final identity/digest before success (`287-302`). A public swap after the final public validation is rejected and neither replacement nor external bytes are deleted (`output_validator_race.test.js:125-163`). |

## End-to-end verification

- **Private staging and runtime descriptor:** `SidecarClient` passes only a fixed allowlisted environment to a local stdio child (`sidecarClient.js:11-34`, `83-89`), and controller override prevents a provider descriptor from retaining a public `TTS_AUDIO_ROOT` (`neuralTtsController.js:105-113`). The actual controller integration deliberately seeds the descriptor with the public root, yet the fake child writes to `success.stagingRoot`; success returns a reserved public name and leaves staging empty (`neural_tts_controller.test.js:211-238`).
- **Stable publication and failure safety:** The validator rejects escapes, links, swaps, malformed/oversized/non-PCM output, and separately verifies the new public handle before registration (`outputValidator.js:8-15`, `30-46`, `214-316`). Cleanup of a failed publication is identity-matched for the public candidate (`310-315`, `342-346`); staging cleanup stays in the staging root (`338-340`).
- **Served-bytes boundary:** `PublishedAudioStore` accepts only reserved UUID names plus identity/digest/size metadata (`publishedAudioStore.js:42-46`, `73-85`). `serve()` reopens once with no-follow where available, validates `dev`/`ino`/size, reads at most the approved 25 MiB, hashes the actual Buffer, rechecks handle and pathname identity, then responds from that Buffer (`96-162`). A late replacement yields 404, no static fall-through, and does not remove or reveal replacement/external bytes (`published_audio_store.test.js:99-136`).
- **HTTP/compatibility:** Reserved middleware is mounted before `express.static`; non-reserved legacy filenames call `next()` and retain the old static route (`backend/src/index.js:47-56`; `publishedAudioStore.js:198-206`; `published_audio_store.test.js:55-97`). Chat/game still receive the generated filename and emit unchanged `/audio/<filename>` `tts:done` payloads (`backend/src/routes/chat.js:63-85`, `184-197`). `TTSManager` applies optional RVC only after base generation (`services/tts/index.js:86-113`); RVC takes that public PCM filename and returns its legacy/static converted name (`voiceConversionService.js:96-164`). The manager compatibility suite proves one gTTS fallback and RVC ordering (`tts_compatibility.test.js:103-114`).
- **Retention, restart, and shutdown:** Store initialization removes only unregistered reserved orphans and stale staging (`publishedAudioStore.js:48-70`); scheduler delegates registered/staging cleanup and skips reserved names during legacy cleanup (`jobs/scheduler.js:43-71`); tests preserve legacy files while clearing registered and staging artifacts (`published_audio_store.test.js:138-162`). Shutdown rejects queued work, stops the child, cleans staging, clears registrations, and does not delete successful public artifacts (`neuralTtsController.js:385-407`), and server shutdown awaits the manager before RVC/database teardown (`index.js:113-145`).

## Passed checks

- Staging/public roots are resolved, realpathed, distinct, and non-nested before publication (`outputValidator.js:214-234`).
- Public names cannot reach static: any prefix-shaped reserved name is handled by the store and unregistered/malformed names fail closed (`publishedAudioStore.js:42-46`, `96-102`; test lines `77-95`).
- One neural job is active at a time, with two waiting, bounded start/request/shutdown behavior, readiness-gated serialized switches, one restart, and once-only settlement (`neuralTtsController.js:141-244`, `246-407`; `neural_tts_controller.test.js:96-193`).
- API authentication/rate limiting, typed/sanitized errors, compatibility with gTTS/Piper/RVC, and the no-runtime-install rule were rechecked; no changed code adds a port/listener, download, dependency, or model/reference artifact.

## Findings

None. AUD-TTS-001, AUD-TTS-002, and AUD-TTS-003 are closed by trace and independent test evidence.

## Residual risks

- Node and its child use the same Windows principal. This Phase-1 design deliberately does not claim ACL/token isolation; it relies on undisclosed staging capability, unpredictable exclusive public names, stored identity/digest, and the verified-buffer HTTP boundary. Stronger OS-principal isolation is later hardening, not evidence supplied by this patch.
- Real JaiTTS/Vacha model setup, lawful reference handling, pinned provenance/checksums, GPU benchmarks, licenses, and UI/status disclosure are deferred to their approved later phases and were not exercised by model-free tests.
- The RVC service itself remains the existing local conversion component; Phase 1 preserves its filename contract but does not newly audit its external dependency/runtime security beyond the TTS handoff seam.

## Disposition

`PASS` — **SHIP Phase 1.** The prior mutable-path vulnerability is closed end to end, and the two earlier regressions remain resolved. Proceed only through the next approved phase and its explicit operational gates.
