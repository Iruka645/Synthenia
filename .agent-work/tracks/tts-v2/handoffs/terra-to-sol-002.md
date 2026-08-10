# Terra → Sol: TTS v2 Phase 1 remediation handoff 002

- Audit report: `reports/audit-002.md`
- Disposition: `CHANGES_REQUIRED`
- Open finding: AUD-TTS-003 (Medium, retained)

## Correction order

1. Define the ownership boundary: sidecar output must be a staging artifact, never the final name that `/audio` serves.
2. Validate the staging artifact through one stable descriptor, then publish bytes into a newly and exclusively created Node-owned served filename and return that published name through `NeuralTTSController`/`TTSManager`.
3. Ensure failed validation and late swaps clean only the in-root staging object; they must not delete an external target or a separately published good output.
4. Add a deterministic test that replaces the staging/old name after the validator's final check and before the caller uses the returned name. The test must show that the emitted/returned name resolves only to the verified published bytes.

## Constraints

- Remain in Phase 1 Node TTS/output/test scope. Do not add models, Python adapters, downloads, dependencies, ports/listeners, frontend, schema changes, reference audio, or root lifecycle-v1 changes.
- Preserve existing REST/WebSocket/audio filename behavior externally, legacy providers, gTTS/Piper/RVC fallback semantics, rate limit/auth, no-runtime-install rule, and shutdown/queue bounds.
- Do not "fix" this by omitting the late-swap test, relaxing the external-file rule, or treating a mutable pathname as equivalent to the checked descriptor.

## Required re-audit evidence

- Exact staging and served-root ownership design, including the Windows file/ACL trade-off if no OS isolation is available.
- One late-swap test after the final validation check and one normal success integration test proving the output sent by the controller is the published name.
- Focused TTS tests, full backend suite, syntax check, `git diff --check`, and a new root-to-Terra handoff.

## Re-audit condition

Re-audit requires AUD-TTS-003 fixed with an end-to-end published-artifact trace from fake sidecar to `/audio`, proof that a late replacement cannot alter the returned/served bytes, and no unrelated scope expansion. Terra will recheck the resolved AUD-TTS-001/002 regressions and shutdown alongside it.
