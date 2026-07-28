# Synthenia Requirements

- Version: 1
- Status: approved
- Approval identity: repository user ("only me"; hobby/noncommercial owner)
- Approval evidence: explicit chat statement on 2026-07-28, `อนุมัติ Requirements v1 พร้อมค่าแนะนำ`, accompanied by answers to all ten open questions
- Lifecycle state: IMPLEMENTATION
- Prepared by: Sol (discovery)
- Date: 2026-07-28

## Objective

Audit and stabilize the existing local-first Synthenia application before extending it with opt-in screen understanding and replacing the legacy Illyasviel Live2D character with an original, controllable Syn model. The resulting system should remain practical for a local 2B–4B Ollama model, expose a constrained animation contract that an LLM can reliably drive, and offer visibly more varied emotion-driven animation without weakening privacy, security, provenance, or responsiveness.

## Evidence Summary

### Confirmed facts

- The application is a React 19/Vite frontend and an Express 5/Socket.IO backend.
- The primary chat path builds memory context, calls an Ollama-oriented LLM provider, returns structured `reply` and `emotion`, then generates TTS asynchronously.
- The LLM output schema currently permits eight emotions: `neutral`, `happy`, `laugh`, `embarrassed`, `annoyed`, `sad`, `thinking`, and `surprised`.
- `AvatarCanvas.jsx` renders a Cubism 2 model through `pixi-live2d-display/cubism2`, maps emotions to motion groups/fallbacks, follows the pointer, and drives mouth-open parameters from audio volume.
- The asset named `syn` is still the Illyasviel Cubism 2 model: its manifest references `illyasviel.moc`, and duplicate copies of the same model and texture exist under `illyasviel/` and `frontend/public/live2d-models/syn/`.
- No screen-capture or image-to-vision-model path exists in the inspected backend/frontend source.
- The repository contains no top-level asset license, copyright notice, original editable Live2D source (`.cmo3`) or layered source art (`.psd`) for the current model.
- Existing backend tests pass (20/20); frontend lint completes with 9 warnings; frontend production build succeeds with a chunk-size warning; backend production audit reports zero vulnerabilities; frontend production audit reports four advisories (two high, two critical).
- The worktree was already heavily dirty before this discovery and was checkpointed as commit `1adfc91` while discovery was in progress. Seven current source files contain double-encoded Thai/mojibake, including user-visible errors, stored memory strings, and comments.

### Interpretations to validate

- A browser-based, user-initiated screenshot flow feeding a local vision-capable Ollama model is technically feasible. Its usability will depend heavily on target hardware and capture frequency.
- A genuinely new Syn Live2D model cannot be produced safely by merely renaming or modifying the Illyasviel binary assets. It requires original/licensed art and a Live2D authoring workflow.
- A schema-based animation command is more reliable for small LLMs than arbitrary parameter or file-name generation.
- Cubism 3/4/5 embedded output (`.moc3` plus `.model3.json`) is the preferable long-term target, but the current Cubism 2 path should remain available until the replacement passes visual and runtime acceptance.

## Confirmed Functional Requirements

### R1 — Stabilize and optimize first

1. Preserve all user-owned and pre-existing dirty changes.
2. Triage and correct the known text-encoding regression without changing the intended Thai copy.
3. Resolve or explicitly mitigate production dependency advisories, with special attention to `pixi-live2d-display` and its published dependency tree.
4. Correct misleading readiness behavior so a failed model preload is not reported as ready.
5. Review global conversation history, global WebSocket broadcasts, authentication, resource limits, and cleanup behavior before adding image traffic.
6. Establish reproducible backend, frontend, and end-to-end smoke validation.
7. Profile before optimizing; record cold-start, warm response, memory retrieval, TTS, avatar load, and screen-analysis timings separately.

### R2 — Opt-in screen understanding

1. Screen capture must be off by default and begin only from an explicit user action.
2. The browser/user must select the capture source; permission must be requested per capture session.
3. The UI must show a persistent capture-active indicator and a one-action stop control.
4. The user must be able to submit either a single snapshot or a bounded periodic capture stream. The desired polling opportunity is approximately every 5 seconds when the device can sustain it; the implementation must be single-flight, apply adaptive backpressure, and never queue work every 5 seconds when inference is slower.
5. Captures must be processed locally by default. No image may be sent to an external provider unless the user explicitly enables and confirms that provider.
6. Raw captures, derived descriptions, OCR text, and model prompts must not be logged or retained on disk. A validated derived description may enter bounded short-term conversation context, but it must always be excluded from long-term memory.
7. Image dimensions, encoded byte size, rate, timeout, and concurrency must be bounded server-side. Unsupported media must fail closed.
8. A stopped, revoked, hidden, disconnected, or errored capture session must release tracks and clear in-memory buffers.
9. Screen context must be separated from user-authored text and clearly marked as untrusted observational input to reduce prompt-injection risk from screen content.
10. Screen understanding must degrade gracefully when no approved 2B–4B vision model is available.

### R3 — Original Syn Live2D replacement

1. Define and approve Syn’s visual identity, expressions, outfit, color palette, and motion style before asset production.
2. Use only original or explicitly licensed source art, fonts, textures, motions, and model data; record provenance and redistribution rights.
3. Produce editable source assets and exported runtime assets. Runtime files alone are not an acceptable maintainability handoff.
4. Prefer a current embedded model format (`.moc3`/`.model3.json`) and a reviewed compatible web runtime.
5. Keep the Illyasviel path as a rollback/reference until Syn passes acceptance; do not overwrite it in place.
6. Validate model integrity before loading untrusted or newly exported MOC data.
7. Document any Live2D Editor, SDK, runtime, publication, or commercial-use license obligations before release.

### R4 — LLM-controllable animation contract

1. Extend structured model output through a versioned, allowlisted animation contract rather than accepting arbitrary parameter IDs, paths, expressions, or scripts.
2. The minimum contract should represent dialogue text, primary emotion, animation cue/variant, intensity, and optional bounded duration or emphasis.
3. All values must be server-validated and normalized; invalid or missing values must fall back to a safe neutral animation.
4. The animation renderer must remain deterministic enough to test while supporting bounded variation.
5. The contract must be small-model friendly: concise schema, limited enums, no hidden chain-of-thought, and a parser tolerant of safe omissions but not arbitrary executable data.
6. User emotion, inferred Syn emotion, speaking state, listening/thinking state, and screen-observation state must be distinguishable rather than collapsed into one label.

### R5 — Emotion and motion variety

1. Preserve the existing eight-emotion public vocabulary unless approval changes it.
2. Provide multiple visually distinct, non-repeating variants for each approved emotion where the authored model supports them.
3. Combine authored motions with bounded parameter layers such as gaze, blink, breath, posture, face/expression, and lip sync without unsafe parameter access.
4. Prevent rapid emotion flicker, motion thrashing, and repetitive selection through cooldowns, priority rules, and recent-variant history.
5. Speaking/lip-sync animation must coexist predictably with emotion and idle motion.
6. Reduced-motion and animation-disable behavior must be available.

### R6 — Model evaluation

1. Any Ollama model downloaded or exercised for this task must be within 2B–4B parameters.
2. Model tests may take 5–8 minutes; the harness must use explicit per-case timeouts and preserve results.
3. Use fixed, non-sensitive fixture screenshots and scripted Thai/English prompts for repeatability.
4. Evaluate structured-output validity, response correctness, visual grounding, hallucination rate, character consistency, emotion selection, animation-command validity, cold/warm latency, and resource use.
5. Do not use production/user screenshots as benchmark fixtures.
6. Record model tag, quantization, Ollama version, hardware context supplied by the user, prompt/schema version, and test configuration with results.

## Non-Functional Requirements

- Local-first operation and loopback-only defaults must be preserved.
- No machine-level installation or configuration change is authorized.
- Network downloads must come from trustworthy primary sources and land only inside `D:\Synthenia`.
- Secrets and screenshots must not appear in logs, committed files, fixtures, or diagnostic output.
- The current text-only chat path must remain usable if vision or Live2D fails.
- New image handling must use bounded memory and backpressure and must not block text chat indefinitely.
- Accessibility must include keyboard operation, visible capture state, reduced motion, and useful non-visual status text.
- Browser and model compatibility must be documented; unsupported configurations must fail visibly.
- Implementation must preserve unrelated dirty changes and avoid destructive repository operations.

## Constraints

- Files may be modified only inside `D:\Synthenia`.
- No machine-level changes.
- No destructive operations.
- Only trustworthy sources may be downloaded, and only into the repository.
- Ollama execution is limited to 2B–4B models.
- Requirements approval is mandatory before implementation planning.
- A model-art replacement depends on user-approved art direction and source/licensing rights.

## Out of Scope / Exclusions

- Autonomous or hidden screen surveillance.
- Capturing screen content without a current browser permission grant and visible active state.
- Cloud image upload by default.
- Training or fine-tuning a new foundation/vision model.
- Generating a legally safe “replacement” by copying, tracing, recoloring, or reverse-engineering Illyasviel artwork or binary model data.
- Installing Cubism Editor, GPU drivers, Ollama, system packages, or services at machine scope.
- Supporting models above 4B for task validation.
- Arbitrary LLM control over files, JavaScript, URLs, Live2D parameter IDs, or runtime internals.
- Committing credentials, user screenshots, generated benchmark captures, or vendor installers.

## Dependencies

- Explicit approval of requirements version 1 (satisfied on 2026-07-28).
- A permitted 2B–4B vision-capable Ollama model. The user approved already-installed `gemma3:4b` as the first candidate; no model or machine installation is authorized.
- An original-art workflow and later approval of the concrete Syn concept before asset production. The user has no existing source art and authorized the project to design an original concept.
- Live2D Cubism Editor access suitable for the intended model complexity, plus review of SDK/runtime and publication terms.
- A supported runtime path for the chosen Cubism format.
- PostgreSQL/Ollama/TTS dependencies for full integration testing.

## Assumptions

- Synthenia is strictly single-user and local/loopback-only for the approved scope. LAN, public, and multi-user behavior are excluded.
- Browser screen capture is acceptable if explicitly initiated and visibly active.
- The current Illyasviel asset may remain temporarily as a development fallback but is not assumed to be redistributable.
- “Replacement model” means an original Syn character asset, not only a model-tag change in Ollama.
- Small-model latency is more important than continuous high-frame-rate vision.
- Documentation and tests may describe commercial-license questions but cannot resolve legal ownership without user evidence.
- The target machine is a Ryzen 5 3500U with 16 GB RAM (approximately 14 GB usable after 2 GB reserved) and integrated Vega 8 graphics with shared memory and no discrete VRAM.
- Approved benchmark budgets are: warm vision response target at or below 60 seconds, cold response target at or below 180 seconds, and a hard per-case timeout of 8 minutes. Manual snapshot remains the fallback if periodic analysis is not sustainable.
- Syn is an original adult-presenting young woman, approximately 18–20 years old, initially scoped to simple casual white clothing. Detailed palette, silhouette, expressions, and motion language will be designed in the original-art phase and reviewed before rigging or final asset production.
- The project is a private hobby with no current commercial or distribution plan. Any later commercial, public, distributed, extensible, LAN, or multi-user use reopens licensing and security approval.

## Acceptance Criteria

### Baseline stabilization

- All intended Thai text is valid UTF-8 and renders correctly; a regression check finds no known mojibake markers in application source.
- Backend tests pass; frontend lint has no unexplained warnings; production builds pass.
- No unresolved critical/high production advisory remains without an approved, documented exception and containment.
- Model readiness reports failure distinctly from ready.
- Text chat, reset, STT upload rejection, TTS notification, memory operations, and config authorization have automated coverage at their trust boundaries.
- WebSocket delivery is authenticated/scoped or a documented local-only risk is explicitly accepted.

### Screen understanding

- Starting capture requires an explicit UI action and browser source selection.
- A visible active indicator and stop control work throughout the session; stopping releases all tracks and buffers.
- A fixed fixture screenshot can be submitted to an approved 2B–4B vision model and returns a validated observation within the approved latency budget.
- Oversized, malformed, excessive-rate, unauthorized, and timed-out inputs are rejected.
- Tests demonstrate that capture bytes and extracted text are not logged, persisted, or added to long-term memory by default.
- A screen containing hostile instructions is treated as untrusted visual content and cannot override the system or animation contract.

### Syn model and animation

- Provenance, editable source, export files, and applicable license notes exist for the approved Syn model.
- The new model loads in the production frontend, fits/resizes correctly, and falls back without breaking chat.
- Each approved emotion has at least three distinct selectable variants, or an approved documented exception based on authored asset limits.
- The LLM animation payload validates against a versioned allowlist and never directly addresses a file or model parameter.
- Invalid payloads produce a neutral safe fallback.
- A scripted sequence demonstrates emotion changes, lip sync, gaze/idle behavior, reduced motion, and no obvious motion thrashing.

### Small-model evaluation

- Only 2B–4B model tags are used.
- The benchmark records schema validity, grounding, character/emotion quality, command validity, cold/warm latency, and failures using non-sensitive fixtures.
- Test configuration and results are reproducible, and any 5–8 minute wait is surfaced rather than treated as a hang.
- The user approves the selected model and latency/quality tradeoff.

## Feasibility Breakdown

| Area | Feasibility | Discovery basis | Gate |
| --- | --- | --- | --- |
| Baseline repair/optimization | High | Existing tests/build work; issues are identifiable | Preserve dirty work and approve remediation priority |
| One-shot screen snapshot | High | Browser capture plus Ollama image input are supported | Privacy UX, size/rate contract, 2B–4B model |
| Low-frequency screen awareness | Medium | Technically possible but CPU/GPU and latency sensitive | Hardware and cadence decision |
| Continuous near-real-time vision | Low for 2B–4B local target | Repeated image encoding/inference can starve chat | Explicit performance proof and expanded scope |
| Original Syn visual design | Medium | Requires human art direction and source art | User approval and asset rights |
| Full Live2D rig and motion set | Medium | Established Cubism workflow; labor/tool dependent | Editor access, artist/rigging effort, license |
| LLM animation control | High | Current structured JSON path is extensible | Approve compact versioned schema |
| Emotion variety on current model | Medium-low | Current manifest has only four motion groups and no expression files | New authored parameters/motions |

## Risks

- **Screenshot privacy/security:** captures can expose credentials, personal messages, financial/health data, or other applications. Browser permission is necessary but not sufficient; retention, logs, prompt injection, rate bounds, and clear user state require design and tests.
- **Screen prompt injection:** text visible on screen can instruct the model to ignore policy or leak data. Screen-derived content must be untrusted data, never instructions.
- **Live2D asset ownership:** the current binary/art asset has no repository provenance. Modifying or redistributing it may create copyright/license risk.
- **Live2D toolchain/license:** authoring may require Cubism Editor features beyond FREE limits; AI/chatbot distribution can require review under Live2D publication terms, especially for expandable applications.
- **Legacy format:** the current `.moc`/`.model.json` Cubism 2 asset and runtime path are legacy relative to current `.moc3`/`.model3.json`.
- **Small-model latency/quality:** a 4B vision model is feasible but may be slow or inaccurate on dense UI/OCR; non-streaming chat and cold model swaps can amplify delays.
- **Resource contention:** vision, embedding, chat, TTS, STT, and Live2D rendering can compete for RAM/VRAM/CPU.
- **Global state:** conversation history is process-global; WebSocket TTS completion currently broadcasts globally. These assumptions become unsafe beyond one local user.
- **Encoding regression:** seven dirty application files contain mojibake and some begin with a newly added BOM, so current user-visible Thai text and persisted memory content can be corrupted even though tests pass.
- **Dependency advisories:** the current frontend tree reports critical/high advisories, including a vulnerable `gh-pages` dependency pulled by `pixi-live2d-display@0.4.0`.
- **Test gap:** no frontend component, browser, screenshot privacy, Live2D visual, or end-to-end tests are configured.

## Resolved Approval Decisions

1. Deployment is single-user, local, and loopback-only.
2. Screen understanding supports manual snapshots and periodic operation, targeting a 5-second polling opportunity only when sustainable.
3. Derived descriptions may enter short-term conversation context and must never enter long-term memory, files, or logs.
4. Benchmark hardware and latency budgets are recorded above.
5. `gemma3:4b` is approved as the first vision candidate.
6. Syn is an original adult-presenting 18–20-year-old character in simple casual white clothing; the project is authorized to design the remaining visual details.
7. No PSD, layered art, or Live2D source exists. An original-art workflow is authorized; copying, tracing, recoloring, or reverse-engineering Illyasviel remains prohibited.
8. The current use is private, hobby, and noncommercial.
9. Cubism runtime migration is authorized if required; dual Cubism 2/4 support is acceptable when it provides the safer rollback.
10. The user explicitly deferred repair of the checkpointed mojibake regression and production dependency tree. Do not include either repair in an implementation handoff until renewed approval.

## Approved Stabilization Exception and Completion Gate

- The user-approved sequencing exception permits feature-foundation work before the known mojibake and dependency findings are remediated.
- This exception does not dismiss or downgrade the findings. The two High and two Critical frontend production advisories and the known encoding regression remain open, documented risks.
- No implementation phase may opportunistically rewrite the affected Thai copy, run an automatic dependency fix, change the Live2D dependency/runtime package, or regenerate a lockfile for remediation purposes.
- Under the lifecycle completion contract, Synthenia cannot be marked `COMPLETE` while any Critical or High finding remains. The final stabilization/remediation phase therefore requires renewed user approval before it can execute, or the lifecycle must end `USER_DECISION_REQUIRED`.

## Approval Record

Requirements version 1 was explicitly approved on 2026-07-28 with the decisions and recommended defaults recorded above. Planning may proceed. Approval must be reopened only for a material change to behavior, scope, cost, security/data handling, architecture, licensing posture, or the explicitly deferred remediation boundary.
