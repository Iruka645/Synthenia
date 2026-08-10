# Terra → Sol: TTS v2 Phase 3 Audit 001 Handoff

- Audit report: `reports/audit-007.md`
- Disposition: `CHANGES_REQUIRED` — **fix-then-ship**
- Provider enablement: remains blocked and out of scope

## Required correction order

1. **AUD-TTS-007 (High): one preview owner.** Replace the reachable direct `VoiceConversionTab` preview path with the shared TTS context (or an equivalent single owner) so it receives current authoritative status, requires active + ready, owns/pauses audio across unmount/error, emits bounded UI text, and logs only a typed code. Remove access to/logging of raw Axios errors in TTS UI paths. Preserve the tab's explicit RVC preview intent through typed options, rather than duplicating `previewTTS` and `Audio` handling.
2. **AUD-TTS-006 (Medium): bidirectional installation invariant.** Treat both neural `installed:false` + non-`not_installed` and neural `installed:true` + `not_installed` combinations as `TTS_INSTALL_INVALID`/unavailable/nonselectable before render or switch dispatch.
3. Add focused proofs, not only happy-path contracts:
   - all neural `installed × state` combinations, especially the reciprocal contradiction;
   - the Voice Conversion tab cannot send preview while provider state is loading/failed/inactive/stale;
   - its audio pauses on unmount and a failed preview logs/renders no sentinel API key, text, local path, reference marker, Axios object, or upstream body;
   - the regular selector still supports active-ready RVC preview and backend route auth remains authoritative.

## Re-audit conditions

- Re-run safe model-free frontend test/lint/build, backend suite or focused status/preview/auth tests, Python suite, PowerShell parser/containment harness, disabled-gate check, syntax/diff checks.
- Preserve production `LIMITS` at 180 s startup / 120 s request; test-only fake-client defaults may remain increased only if explicit 30–40 ms timeout cases remain and pass.
- Do not execute setup or verification scripts; do not download/install models or dependencies; do not access a real model/reference; do not change manifest gates.

## Auditor evidence

The backend status and preview authority are sound and the full independent backend run passed 85/85. The blockers are reachable frontend ingress/normalization gaps: `ttsContracts` makes `{installed:true,state:'not_installed'}` selectable, while the unchanged but reachable Voice Conversion tab bypasses the new context and logs an error retaining Axios request headers via `originalError`.
