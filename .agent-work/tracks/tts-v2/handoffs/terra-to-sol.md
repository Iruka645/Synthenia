# Terra → Sol: TTS v2 Phase 1 remediation handoff

- Audit report: `reports/audit-001.md`
- Disposition: `CHANGES_REQUIRED`
- Blocking findings: AUD-TTS-001 (High), AUD-TTS-002 (High), AUD-TTS-003 (Medium)

## Correction order

1. **AUD-TTS-002 privacy boundary:** Remove raw `stderrData` logging from gTTS and Piper while retaining only fixed error codes/messages. Add logger-spy tests for direct legacy failure and neural-to-gTTS fallback with a private sentinel.
2. **AUD-TTS-001 control-plane rate limit:** Put a named authenticated rate limit on `POST /api/tts/switch`. Test that excess requests return 429 before the manager is invoked.
3. **AUD-TTS-003 output publication:** Close the lstat/realpath/open race by validating a stable open file descriptor (or failing closed where equivalent guarantees are unavailable). Add deterministic swap/link tests and preserve ordinary contained PCM WAV behavior.
4. Add one end-to-end model-free test that drives `NeuralTTSController` through the real fake sidecar and actual output validator, including a failure/restart or cleanup case.

## Constraints

- Stay within Phase 1 Node/TTS modules and tests. Do not add model downloads, Python adapters, dependencies, ports/listeners, frontend work, database/schema changes, reference audio, or Phase 2 setup.
- Preserve legacy selection, REST/WebSocket payloads, RVC behavior, async chat delivery, API-key auth, and existing test behavior.
- Do not weaken path/output validation or expose raw text, stderr, reference paths, or child errors in logs/API/WebSocket responses.

## Required regression evidence

- Focused TTS tests, full `backend` test suite, syntax checks, and `git diff --check` pass.
- A logger test proves sentinel stderr is absent from all observed log/error surfaces.
- A route test proves rate limiting occurs before switching work.
- A filesystem swap/link test proves validation cannot publish an external WAV.
- Handoff names exact changed files, tests, and any Windows-specific no-follow/identity trade-off.

## Re-audit conditions

Terra will re-audit only after all three findings are classified and corrected with the requested tests, no approved-scope expansion appears, no models/dependencies are installed, and a Luna/root-to-Terra remediation handoff records validation evidence. Re-audit must retrace fallback logging, authorization/rate-limit order, output-file lifecycle, controller-to-sidecar integration, and shutdown.
