# Root → Terra: TTS v2 Remediation 002

- Source: `reports/audit-002.md`, `handoffs/terra-to-sol-002.md`, `handoffs/sol-to-root-remediation-002.md`
- Audit cycle requested: 3
- Scope: retained AUD-TTS-003 only; Phase 1 Node/output/tests
- Implementer: root/Codex, explicitly authorized by the user
- Requested reviewer: Terra using the named `scrutinize` skill

## Implemented ownership trace

```text
sidecar -> sibling audio-staging/neural root -> stable descriptor validation
        -> Node O_EXCL public creation -> descriptor copy + PCM/SHA-256/identity checks
        -> in-memory publication metadata -> controller returns reserved public name
        -> /audio reserved middleware reopens once, verifies identity/size/SHA-256
        -> sends only the already-verified bounded Buffer
```

- `neuralTtsController.js` overrides every runtime sidecar descriptor's allowlisted `TTS_AUDIO_ROOT` with the private staging root. The public root/name is absent from sidecar env and synthesize payload.
- `outputValidator.js` adds `validateAndPublish()`. It retains the validated staging handle, creates `tts_neural_pub_<uuid>.wav` with `O_CREAT|O_EXCL`, copies handle-to-handle, validates PCM through the public handle, compares SHA-256/size/duration, rechecks `dev`/`ino`/size/nlink/path identity, registers metadata, closes once, and removes staging.
- Publication failure cleanup unlinks only a path matching the captured created-file identity. A replaced public path and external object are not deleted.
- `publishedAudioStore.js` owns registered SHA-256/size/BigInt `dev`/`ino`. Reserved names never fall through to static. HTTP serving reads at most the configured 25 MiB through one no-follow/stable handle, hashes and rechecks identity, then sends the verified Buffer (including bounded Range support). A swap or digest mismatch returns sanitized 404 and invalidates the registration without deleting a replacement.
- `index.js` mounts the reserved handler before `express.static`; legacy gTTS/Piper/RVC files still use the prior static route and `/audio/<filename>` remains unchanged.
- `scheduler.js` cleans registered neural output and private staging through the store, skips reserved names in legacy cleanup, and leaves legacy retention unchanged.
- Startup removes unregistered reserved orphans/stale staging; shutdown stops the child, cleans staging, clears in-memory registrations, and does not delete successful public audio.

## Windows boundary

Node and its child share the same Windows account/token, so this remediation does not claim `chmod` or NTFS ACL isolation. Security comes from capability separation (sidecar receives only the staging root/name), exclusive unpredictable public naming, stored file identity/digest, and the HTTP-boundary verified Buffer. Even a mutation after the last disk check cannot change bytes already buffered for the response. No elevation, account, ACL, dependency, listener, or machine-wide change was added.

## Deterministic race and compatibility evidence

- `output_validator_race.test.js` swaps the public path in `afterPublishedBeforeRegister`, after its initial final validation. Publication rejects, registration count stays zero, staging is removed, and both the external file and replacement remain unchanged.
- `published_audio_store.test.js` first proves registered output is byte-identical and playable through the real reserved middleware with no static fallthrough. It then swaps the public path after registration but before HTTP read; the response is 404 with no body, no fallthrough, and external/replacement bytes are neither served nor deleted.
- The store test also proves malformed/unregistered reserved names fail closed, legacy names fall through, restart loses reserved registrations, and retention removes only registered neural/staging files while preserving legacy audio.
- `neural_tts_controller.test.js` drives the actual controller → `SidecarClient` → spawned fake child → staging → actual publisher. The returned name is reserved/public, the final WAV exists, staging is empty, invalid WAV is removed, settlement remains once, and ownership is released on shutdown.
- RVC compatibility is preserved because RVC receives the public PCM filename in the same approved `audio/` root; a successful RVC result remains a legacy/static filename.

## Validation

- Focused remediation/TTS suite: 35 tests, 35 passed, 0 failed.
- Full backend suite: `npm test` — 79 tests, 79 passed, 0 failed, 0 skipped.
- Node syntax check: 71 JavaScript files under `backend/src` and `backend/test`, all passed.
- `git diff --check`: passed; only Git CRLF notices were emitted.
- `graphify update .`: passed; graph rebuilt to 2,375 nodes, 3,315 edges, 191 communities. Existing warning remains for seven non-code JSON sources producing zero nodes.
- AUD-TTS-001 switch limiter and AUD-TTS-002 stderr-redaction regression tests remain green.

## Scope confirmation

No dependency/lockfile, frontend, schema, Python adapter, model/cache/reference, download/install, port/listener, ACL/account, root lifecycle-v1, commit/push, or unrelated cleanup changes were made.

Please independently re-audit AUD-TTS-003 end to end, recheck the already-resolved findings and graceful shutdown, and issue the cycle-3 disposition before Phase 2 begins.
