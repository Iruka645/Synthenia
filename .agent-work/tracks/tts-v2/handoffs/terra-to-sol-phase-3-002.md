# Terra → Sol: TTS v2 Phase 3 Audit 002 Handoff

- Audit report: `reports/audit-008.md`
- Disposition: `CHANGES_REQUIRED` — **fix-then-ship**
- Closed findings: AUD-TTS-006 and AUD-TTS-007
- Provider enablement: remains blocked and out of scope

## Required correction order

1. **AUD-TTS-008 (Medium): make failed status fail closed without a recognized retry code.** For a neural provider in `failed`, permit selection only for the named retryable code allowlist. Add missing/blank/overlong/unknown code cases and zero-dispatch assertions.
2. **AUD-TTS-009 (Medium): make every selector a distinct preview source.** Give `TTSProviderSelector` a stable source prop, pass it to `playTest`, and clean it up on unmount with `stopPreview(source)`. Assign different sources to the persistent App selector and transient `TTSConfigTab` selector, or deliberately remove the duplicated selector. Do not make a generic cleanup that can stop the other selector's preview.
3. **AUD-TTS-010 (Medium): retain cancellation ownership through `audio.play()`.** Recheck generation/disposal after its await; if stopped, pause that local audio and reject safe `TTS_ABORTED` rather than return a success object.

## Re-audit conditions

- Directly prove the full status matrix plus missing/unknown error-code dispatch blocking.
- Prove each preview surface's unmount aborts/pauses only its own request/audio; test the Control Panel tab transition and the persistent-selector source mismatch.
- Use deferred `audio.play()` to prove stop/dispose yields `TTS_ABORTED`, no late success, no cancellation log, no lingering playing state, and one pause.
- Re-run safe model-free frontend test/lint/build, backend suite or focused status/preview/auth tests, Python suite, PowerShell parser/containment harness, disabled-gate check, syntax/diff checks.
- Preserve runtime 180 s startup / 120 s request bounds and explicit 30–40 ms timeout tests. Do not run setup/verify, download/install, access real assets/references, or change provider gates.

## Auditor evidence

The prior two findings are actually closed: reciprocal installation contradiction made zero switch dispatches; Voice Conversion now uses the snapshot-based owner, has source cleanup, removes Axios original causes, and its sentinel redaction test passes. The remaining blockers are narrow frontend fail-closed/lifecycle seams; all safe model-free suites nonetheless pass, so focused adversarial tests are required before shipment.
