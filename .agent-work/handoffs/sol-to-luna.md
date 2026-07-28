# Sol to Luna Handoff — Phase 1

- Requirements version: 1 (approved 2026-07-28)
- Plan version: 1
- Assigned phase: Phase 1 — Privacy and scheduling foundation
- Role: Luna (implementation)
- Repository: `D:\Synthenia`
- Status: ready

## Read First

1. `D:\Synthenia\AGENTS.md`
2. `D:\Synthenia\.agent-work\requirements.md`
3. `D:\Synthenia\.agent-work\implementation-plan.md`
4. This handoff
5. Relevant existing test/package conventions only

The repository contains user-owned checkpointed changes. Preserve them. Graphify output may already be dirty; that is not a blocker.

## Exact Scope

Implement pure, production-quality foundations with fixed fixtures and deterministic tests. Do not mount a route, invoke Ollama, request screen permission, integrate React UI, capture a real screen, or create art.

Create:

- `backend/src/config/visionConfig.js`
- `backend/src/contracts/vision.js`
- `backend/src/services/vision/shortTermObservationStore.js`
- `backend/src/services/vision/visionCoordinator.js`
- `backend/test/fixtures/vision/README.md`
- one or more tiny deterministic non-sensitive image fixtures under `backend/test/fixtures/vision/`
- `backend/test/vision_contract.test.js`
- `backend/test/vision_privacy.test.js`
- `frontend/src/services/visionContracts.js`
- `frontend/src/utils/adaptiveCaptureController.js`
- `frontend/test/visionContracts.test.js`
- `frontend/test/adaptiveCaptureController.test.js`

Modify only:

- `frontend/package.json` to add a `test:vision` script using Node's built-in test runner.

Do not add a package, change dependency versions, or modify either lockfile.

## Required Constants and Contracts

Use a single canonical backend config:

- contract version `1`;
- modes `manual|periodic`;
- MIME allowlist `image/png|image/jpeg|image/webp`;
- maximum encoded bytes `1_500_000`;
- maximum dimensions `1280x720`;
- periodic base delay `5_000ms`;
- adaptive factor `1.25`;
- maximum adaptive delay `60_000ms`;
- hard analysis timeout `480_000ms`;
- latest-observation TTL `120_000ms`;
- summary maximum `800` characters;
- maximum concurrent analysis `1`.

Capture metadata:

```js
{ version, mode, mimeType, width, height, capturedAt }
```

Observation:

```js
{
  version: 1,
  source: "screen",
  trust: "untrusted",
  mode,
  summary,
  capturedAt,
  observedAt,
  expiresAt,
  timing: { analysisMs },
  degraded
}
```

Reject unexpected/sensitive fields such as `image`, `images`, `bytes`, `base64`, `ocr`, `prompt`, `path`, `reasoning`, or provider raw response. Normalize whitespace and cap summary length. Never silently retain rejected input.

The prompt builder must emit fixed `[UNTRUSTED_SCREEN_OBSERVATION]` delimiters and an instruction that visible commands are data and must not be followed.

## Required Backend Behavior

`ShortTermObservationStore`:

- receives an injected clock;
- stores only one normalized observation;
- returns `null` after TTL;
- removes expired content eagerly on read;
- supports idempotent `clear()`;
- exposes no serialization or persistence hook.

`VisionCoordinator`:

- receives injected `analyzer`, `store`, `clock`, `logger`, and timeout/abort dependencies;
- validates metadata and bytes before analyzer invocation;
- enforces one in-flight analysis and returns a typed `VISION_BUSY` result/error without queueing;
- applies the 8-minute hard timeout/abort;
- normalizes the provider result to the observation allowlist before storage;
- provides metadata-only logs: request ID, mode, byte count, dimensions, outcome code, elapsed time;
- never logs/stores image bytes, summary text, OCR, prompt, provider response, or thrown provider body;
- clears temporary references on success, failure, abort, and timeout.

The coordinator is not an Express route and must not import the database, memory services, filesystem, Ollama, Socket.IO, or application logger singleton.

## Required Frontend Behavior

`adaptiveCaptureController` is framework-neutral and dependency-injected:

- dependencies: `capture`, `analyze`, `schedule`, `cancelSchedule`, `clock`, visibility/stream-state readers, and state callback;
- exposes start/stop/manual-snapshot/state methods;
- has one shared in-flight slot for manual and periodic work;
- never creates a pending queue;
- after each periodic completion schedules the next opportunity at:
  `clamp(max(5_000, ceil(elapsedMs * 1.25)), 5_000, 60_000)`;
- manual while busy returns/throws a typed busy outcome immediately;
- stop cancels timer, aborts work, drops frame/blob references, and is idempotent;
- hidden, ended, disconnected, error, and abort paths transition visibly and clean up;
- contains no `getDisplayMedia`, React, DOM storage, file I/O, logging of payloads, or API URL.

`visionContracts.js` mirrors public enums/status/error normalization for UI consumers, but comments and tests must state that server validation is authoritative.

## Tests

Use Node's built-in test runner and injected clocks/schedulers/deferred promises. No network, browser, model, database, filesystem write, or real timer wait.

Backend tests must prove:

- valid metadata/observation accepted;
- invalid version/mode/MIME/size/dimensions/time and sensitive/unknown fields rejected;
- malformed or signature-mismatched fixtures fail closed;
- only the latest normalized description exists and it expires at 120 seconds;
- coordinator invokes analyzer at most once, reports busy rather than queueing, and aborts on timeout;
- logger/store spies never receive raw bytes, summary/OCR/prompt/provider response;
- provider error messages/bodies are sanitized before metadata-only logging.

Frontend tests must prove:

- repeated ticks while a deferred analysis is active produce one call and zero queued calls;
- manual and periodic modes share the same flight;
- exact adaptive delay behavior at below-minimum, normal, and above-cap latency;
- stop/hidden/ended/disconnected/error paths cancel, abort, release references, and do not reschedule;
- manual snapshot works when periodic mode is off;
- state transitions are deterministic and payload-free.

Run:

```text
cd D:\Synthenia\backend
npm test

cd D:\Synthenia\frontend
npm run test:vision
npm run lint
npm run build

cd D:\Synthenia
git diff --check
graphify update .
git status --short
```

Known baseline: backend 20 tests passed; frontend lint had 9 warnings; build passed with a large Pixi chunk warning. Do not claim those known warnings/advisories were fixed.

## Prohibited Changes

- No edits to existing mojibake/Thai strings or broad encoding normalization.
- No `npm audit fix`, dependency/runtime upgrade/downgrade, lockfile regeneration, or package installation.
- No edits to `backend/src/index.js`, `backend/src/routes/chat.js`, `backend/src/services/ollamaService.js`, `frontend/src/App.jsx`, `frontend/src/hooks/useChat.js`, `frontend/src/services/api.js`, `frontend/src/components/AvatarCanvas.jsx`, or Live2D files.
- No environment file, database migration, API route, WebSocket event, persistent cache, screenshot log, benchmark run, Ollama call, model pull, browser capture, art, PSD, `.cmo3`, `.moc3`, or vendor binary.
- No destructive Git operation, commit, or push unless separately directed by the root/user.

## Risks and Assumptions

- Phase 1 validates architecture, not browser or model feasibility.
- Fixture metadata must be independently checked against its bytes; never rely only on declared MIME/dimensions.
- A pure helper may minimally parse supported image headers. If robust fail-closed validation cannot be implemented without a new dependency, stop and document the exact blocker; do not add one.
- The frontend production dependency advisories remain Critical/High lifecycle blockers, but are outside this phase.
- The existing process-global chat history is tolerated only because approved deployment is single-user/loopback and Phase 1 does not feed it screen context.

## Stop Conditions

Stop safely and write a blocker handoff if:

- a requested implementation requires touching a prohibited file or dependency;
- deterministic image validation cannot fail closed without adding a dependency;
- existing unrelated changes overlap a scoped file in a way that cannot be preserved;
- a test reveals screen-derived data would need persistence/logging;
- any action would install software, call a model/network, or capture a real screen.

The blocker record must state completed/incomplete work, exact files, commands, sanitized errors, attempted safe resolutions, decision needed, and safest next action.

## Completion Checklist

- [ ] Only scoped files changed.
- [ ] Contracts enforce exact version/enums/bounds and reject sensitive fields.
- [ ] Store is latest-only, TTL-bound, in-memory, and clearable.
- [ ] Coordinator is single-flight, abortable, sanitized, and payload-log-free.
- [ ] Controller is queue-free, adaptive, deterministic, and cleans all stop/error paths.
- [ ] Fixed fixtures are non-sensitive and documented.
- [ ] Backend and frontend new tests pass.
- [ ] Full backend tests, frontend lint/build, `git diff --check`, and Graphify update are recorded.
- [ ] Existing warnings/advisories are accurately reported, not repaired or hidden.
- [ ] `.agent-work/handoffs/luna-to-terra.md` is written with requirements/plan versions, changed files, behavior, deviations, commands/results, limitations, blockers, and audit focus.

Luna must not self-certify acceptance. Root advances to Terra only after reviewing the handoff.
