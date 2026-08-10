# Terra → Sol: TTS v2 Phase 3 Audit 003 Handoff

- Audit report: reports/audit-009.md
- Disposition: PASS — SHIP Phase 3 provider-neutral frontend integration
- Closed findings: AUD-TTS-006, AUD-TTS-007, AUD-TTS-008, AUD-TTS-009, AUD-TTS-010
- Provider enablement: remains blocked and out of scope

## Audit result

The strict failed-state allowlist now blocks malformed/unknown failure codes before switch dispatch while retaining exactly the four allowed transient retry codes. The persistent App selector, transient Control Panel selector, and Voice Conversion tab have distinct sources and source-scoped cleanup; a mismatched cleanup cannot stop another surface. Shared preview ownership now survives the audio.play await boundary, returning safe TTS_ABORTED after stop/dispose with one pause, no cancellation log, no success result, and no remaining playing ownership.

AUD-TTS-006/007 regressions also remain closed: the complete neural installed × state matrix fails closed for contradictions, Voice Conversion no longer owns a direct preview/Audio path, and only typed/sanitized error information is rendered or logged. The backend continues to be authoritative for guarded switch and ready-only preview.

## Independent validation

- Direct reproductions: four unsafe failed-code classes made zero dispatches; all four named retryable codes dispatched; three sources preserved mismatch isolation; deferred audio play after both stop and dispose returned TTS_ABORTED with one pause, empty logs, and no owner state.
- Frontend 29/29, lint (exit 0; established warnings only), and production build passed.
- Backend 85/85, Python 20/20, PowerShell parser, and 14/14 containment/collision harness passed.
- Disabled provider gates stayed false; no setup/verify/download/install/inference/reference/model action occurred. Production 180 s/120 s bounds and explicit short timeout tests remain unchanged.

## Next-phase constraints

This handoff approves only the provider-neutral Phase 3 frontend work. Do not treat it as authority to turn either provider on. Any enablement work must be separately approved and independently verify exact upstream pins, licenses, complete hashes/locks, lawful private-reference authority, offline load behavior, resource/quality benchmarks, and manifest gates before setup or verification is executed.
