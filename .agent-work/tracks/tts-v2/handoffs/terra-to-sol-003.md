# Terra → Sol: TTS v2 Phase 1 audit handoff 003

- Audit report: `reports/audit-003.md`
- Requirements / plan: v2 approved / v1
- Disposition: `PASS` — **SHIP Phase 1**

## Audit result

No Critical, High, or Medium Phase-1 finding remains. AUD-TTS-001 (authenticated switch limit), AUD-TTS-002 (legacy stderr redaction), and AUD-TTS-003 (post-validation output race) are closed by independent source trace and tests.

The resolved ownership path is:

```text
sidecar (private staging root only)
  → stable staging descriptor
  → Node O_EXCL public publication + PCM/SHA-256/identity checks
  → registered reserved name
  → reserved /audio handler
  → one verified bounded Buffer response
```

Reserved names cannot fall through to static; late public replacement fails closed without serving/deleting replacement bytes. Legacy gTTS/Piper/RVC names retain their existing static delivery path.

## Independent validation

- `npm.cmd test`: 79 passed, 0 failed.
- Syntax check: 71 `src/` and `test/` JavaScript files passed `node --check`.
- `git diff --check`: passed (Git emitted only LF→CRLF notices).
- Verified real controller → `SidecarClient` → fake child → staging → publisher integration, late publication/HTTP swap tests, cleanup/restart/shutdown seams, and AUD-TTS-001/002 regressions.

## Next phase constraints

This closes Phase 1 only. Phase 2 must preserve the private staging/publication contract and must not implicitly run install/download/setup logic at boot, status, switch, preview, or chat time. Its execution remains subject to the approved lawful-reference, provenance/checksum, license, driver/disk/resource, and explicit operator-invocation gates.

No remediation correction order, blocking question, or re-audit condition is open for Phase 1. Re-audit is required for any Phase-2 implementation touching the sidecar protocol, runtime descriptors, output roots, or model/setup paths.
