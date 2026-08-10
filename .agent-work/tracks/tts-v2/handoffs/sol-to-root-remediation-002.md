# Sol → Root: TTS v2 Remediation 002

- Source: `reports/audit-002.md`, `handoffs/terra-to-sol-002.md`
- Audit cycle: 2
- Scope: retained AUD-TTS-003 only; Phase 1 Node/output/tests
- Implementer: root/Codex, explicitly authorized by the user
- Exit: evidence handoff to Terra for cycle 3 `scrutinize` re-audit

## Classification

**AUD-TTS-003 (Medium): ACCEPT.** `outputValidator.js:123-150` validates a descriptor but returns its mutable path; `neuralTtsController.js:282-287` returns it and `index.js:41-47` reopens it through `express.static`. A post-check swap changes served bytes. AUD-TTS-001/002 stay resolved; model/reference/frontend work stays deferred.

## Required ownership model

```text
untrusted sidecar -> private staging root (never served)
stable staging descriptor -> Node exclusive publication -> public audio root
public name -> Node verified-audio handler -> bounded verified Buffer -> HTTP response
```

Sidecar receives only staging root/basename. Node chooses the reserved public name, publishes from the validated staging descriptor, and returns only that name. `/audio/<filename>` remains unchanged.

### Windows ownership/ACL trade-off

Sidecar and Node share one Windows account/token, so NTFS ACLs cannot deny the child while allowing its same-principal parent; `chmod`/read-only is not a security boundary. Do not add accounts, elevation, `icacls`, or dependencies. Rely on hidden capability, exclusive creation, identity checks, and HTTP-boundary digest verification: read once into a bounded Buffer, verify, then send that Buffer. OS-token isolation is later hardening, not acceptance evidence.

## Exact files and APIs

### `backend/src/services/tts/neural/outputValidator.js`

Retain descriptor-based PCM checks. Replace the validate-and-return-same-name contract with:

```js
validateAndPublish(stagingName, {
  stagingRoot, publishedRoot, limits,
  registerPublished, testHooks
}) -> { filename: publishedName, sizeBytes, durationSeconds, sha256 }

removeStaging(name, { stagingRoot }) -> boolean
removePublished(name, { publishedRoot, expectedIdentity? }) -> boolean
```

Contract:

1. Roots are absolute, distinct, canonical, non-nested; staging is outside public `audio`.
2. Open staging once no-follow; require contained regular one-link file and stable `lstat/fstat`. Parse/read/hash/copy only through that handle.
3. Generate `tts_neural_pub_<uuid>.wav`; exclusive-open public with `'wx+'`.
4. Copy handle-to-handle under 25 MiB; inspect/hash public handle, compare metrics/SHA-256, `sync()`, capture `dev/ino/size`; never reopen staging.
5. Invoke `afterPublishedBeforeRegister` after final public check. Register `{filename,sha256,sizeBytes,dev,ino}` before success.
6. Close once. Unlink only in-root entries matching captured identity; never follow/delete replacements. On success remove staging and return public name.

### New `backend/src/services/tts/neural/publishedAudioStore.js`

Export a singleton plus an injectable class for tests:

```js
register(meta)                         // reject duplicates/unsafe names
serve(filename, req, res) -> Promise<boolean>
remove(filename) -> Promise<boolean>
cleanup({publishedCutoff, stagingCutoff}) -> Promise<count>
shutdown() -> Promise<void>
```

- Keep digest/size/identity in memory. Unregistered reserved names return 404 and never reach static.
- `serve` no-follow-opens once, checks containment/identity/size, reads <=25 MiB, hashes, rechecks identity, compares metadata, then sends the verified Buffer as `audio/wav`. Mutation yields sanitized 404/410.
- Never log names/paths/content. Restart invalidates reserved registrations; startup safely removes reserved orphans. Legacy audio is unchanged.

### `backend/src/services/tts/neural/neuralTtsController.js`

- Add `stagingRoot` (sibling of public `audio`, e.g. `audio-staging/neural`) and injected publisher/store.
- Force each sidecar descriptor's allowlisted `TTS_AUDIO_ROOT` to this staging root; do not expose `publishedRoot` in descriptor env, request payload, cwd, logs, or errors.
- Generate a staging-only random basename; after sidecar response equality, call `validateAndPublish`. Return `result.filename`, not the staging name.
- Retry/failure removes staging/unregistered publication only. Retention owns registered output; retries never delete prior success.
- Shutdown stops the child first, cleans abandoned staging entries, and settles once; it must not delete successfully published audio.

### `backend/src/index.js`

- Before static, mount a flat `/audio/:filename` reserved handler. `tts_neural_pub_*.wav` calls store `serve` and never `next()`. Preserve chat/preview URL and payload.
- Non-reserved gTTS/Piper/RVC filenames continue through existing `express.static(audioDir, ...)` unchanged.
- At startup, initialize roots and safely clear unregistered reserved neural orphans/stale staging. During graceful shutdown, stop `ttsManager` before store shutdown and DB close.

### `backend/src/jobs/scheduler.js`

- Keep legacy retention. Store cleanup evicts neural registry/files/staging together without following missing/replaced entries.

### Tests (direct `backend/test/*.test.js` discovery)

- `output_validator_race.test.js`: `afterPublishedBeforeRegister` swaps public path with external/sentinel WAV; reject or register original identity only; external survives.
- `neural_tts_controller.test.js`: fake child writes staging; controller returns public reserved name; staging disappears; public PCM works.
- New `published_audio_store.test.js`: swap after registration immediately before HTTP read; no static fallthrough or sentinel/external serve/delete. Normal `/audio/<publishedName>` is byte-identical/playable.
- Test restart-unregistered 404, legacy static behavior, and retention/shutdown root separation.

## Compatibility and security invariants

- Preserve chat/game immediate REST response, `ttsJobId`, `tts:done`/`tts:error`, `/audio/<filename>`, preview response, playback/lip-sync, gTTS/Piper, optional RVC, one fallback, auth/rate limits, queue/timeouts, and output retention.
- Neural output remains RVC-compatible PCM WAV in approved audio. RVC sees only the public name; sidecar never does. RVC output stays legacy/static.
- No frontend/schema/root-v1 changes, dependencies, ports, Python adapters, models, installs/downloads, reference processing, machine-wide ACL changes, commit/push, or unrelated cleanup.

## Stop conditions

Stop if reserved names can reach static, publication cannot copy from the validated handle, Windows identity is unavailable, RVC needs staging, or cleanup cannot distinguish roots. Never downgrade to validate-then-static-open.

## Required re-audit evidence

- Changed files and sidecar staging→validation→publication→controller→verified-Buffer HTTP trace with file/line citations.
- Deterministic post-final-check/publication swap and pre-HTTP late-swap results; normal playback and controller integration results.
- Proof reserved names never hit `express.static`, replacements/external files are not served/deleted, and Windows behavior does not rely on ACL isolation.
- Focused TTS tests, full backend suite, all changed/source/test JS syntax checks, and `git diff --check` pass; AUD-TTS-001/002 and graceful shutdown remain green.
- Root writes `root-to-terra-remediation-002.md`; Phase 2 waits for Terra `ship` or explicit blocker resolution.
