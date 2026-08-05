# Tasks: APS Viewer assessment

Status: Approved
Owner: Project owner
Created: 2026-08-05
Last updated: 2026-08-05
Specification: `spec.md`
Technical Plan: `plan.md`

## Execution rules

- Do not start Gate 5 until Gate 3 and Gate 4 are explicitly approved. `PLAN-GAP-004` is resolved in the synchronized Specification and Technical Plan; do not reopen it through an undocumented token mechanism or proxy.
- Preparation uses verification checklists and smoke commands, not behavioral Red labels. Missing files, scripts, packages, imports, environments, or runners are setup facts, not useful failing behavior tests.
- For each behavioral increment, first run the listed Red with working tooling. It must fail because approved observable behavior is missing. Review the Red for regression value and obtain explicit approval before production Green.
- Implement only the minimum Green, refactor only inside the stated boundary, run focused regression, and record evidence immediately in feature-local `validation.md`.
- Label evidence `automated`, `controlled`, `manual`, or `live`. Never store secrets, complete tokens, keys, raw APS responses, complete credential requests, or unsanitized real-model data. Controlled Viewer evidence is never reported as live.
- Every completed task is a reversible checkpoint. If later evidence exposes a defect, return to the owning task's Red/Green cycle rather than widening a later task.
- Do not modify the root README without a separate explicit authorization naming it. Do not mutate Git state without separate explicit authorization for the exact action.

## Dependency order

```text
T-001 Preparation: skill, tooling, evidence baseline
  -> T-002 Canonical URN domain
  -> T-003 Encryption, persistence, index, configuration service
  -> T-004 Configuration HTTP contracts
  -> T-005 APS token service and supported Initializer callback
  -> T-006 Frontend settings and commit-point state
  -> T-007 Viewer runtime, deterministic 3D replacement, cleanup
  -> T-008 Instance/category resolution, native toolbar, theming
  -> T-009 Quantity domain and property orchestration
  -> T-010 Accessible workspace and automated convergence
  -> T-011 Real APS/manual validation and final documentation
  -> T-012 Explicitly authorized Git delivery
```

Security-sensitive persistence precedes token and Viewer behavior. Model lifecycle precedes model analysis. Live claims and documentation follow automated convergence. Git delivery remains last and separately authorized.

## Tasks

- [x] `T-001` Prepare the single skill, focused test tooling, doubles, and continuous evidence
  - Classification: Preparation; not a behavioral Red-Green-Refactor increment.
  - Traceability: `FR-020`, `NFR-004`, `NFR-006`, `NFR-008`; `AC-028`-`AC-030`.
  - Depends on: Approved Gates 3 and 4 and explicit authorization to begin Gate 5.
  - Verification and smoke evidence:
    - Inventory existing guidance and create exactly one concise `.agents/skills/aps-viewer-assessment/SKILL.md`; verify no second assessment-specific skill exists and the new skill references rather than duplicates repository guidance, including runtime reuse for renewal/URN-only replacement and serialized public reset for credential replacement.
    - Select compatible versions, install only approved development test packages, add backend/frontend test scripts, and prove each runner executes one passing smoke test without import/environment errors.
    - Create the minimum fake-key, model/property, bubble-tree, toolbar, async-race, and API fixtures/doubles. They expose only consumed public contracts and contain no real credential, token, URN, or model data.
    - Create `docs/sdd/2026-08-04-aps-viewer/validation.md` and record preparation commands, results, evidence type, limitations, and rollback.
    - Read the authoritative README baseline from the current approved Git object, for example `git show HEAD:README.md`, and record a non-sensitive object/hash identity in `validation.md`; do not modify README or Git state.
  - Smoke success: Both test commands exit successfully for smoke behavior, the one-skill invariant holds, lockfile changes contain only approved development packages, and fixtures can be imported.
  - Regression: Existing frontend build and baseline backend startup path remain available; run the available package audit and record any relevant result without scope-expanding remediation.
  - Rollback: Remove only the new skill, test scripts/configuration, development packages/lockfile entries, fixtures, smoke tests, and feature validation artifact.

- [x] `T-002` Implement canonical Model URN behavior test-first
  - Classification: Behavioral TDD; first behavioral Red.
  - Traceability: `FR-002`, `FR-004`, `FR-015`, `TC-003`, `NFR-005`, `NFR-006`; `AC-002`, `AC-005`, `AC-006`, `AC-031`, `AC-032`, `AC-039`.
  - Depends on: `T-001`.
  - Red evidence: Run table-driven domain tests that accept surrounding whitespace plus no prefix or one lowercase `urn:` prefix; reject empty, mixed/repeated prefix, forbidden alphabet, padding, embedded whitespace, modulo-four-one, decode, noncanonical, and nonzero trailing-bit cases; return the exact canonical prefix-free payload and construct exactly one Viewer prefix.
  - Expected failure: The runner works, but no feature canonicalizer/constructor implements these approved outcomes.
  - Approval checkpoint: Review boundary cases and confirm failure is behavioral before production code.
  - Minimum Green: Add the smallest backend-authoritative pure validator/canonicalizer and a frontend-safe one-prefix identifier helper without decoding/re-encoding for normalization.
  - Refactor boundary: Deduplicate only shared case data inside this domain; do not create a validation framework or touch unrelated auth/forms.
  - Regression: Re-run accepted/rejected tables and ensure invalid input reaches neither crypto, persistence, token, nor model-load doubles.
  - Manual/live: None required for syntax; inaccessible/untranslated canonical URN remains `T-011` live evidence.
  - Validation and rollback: Record Red/Green/regression as `automated`; remove only the URN domain and callers introduced here.

- [x] `T-003` Implement encryption, per-user persistence, deliberate index startup, and atomic configuration service test-first
  - Classification: Behavioral TDD; security-sensitive increment.
  - Traceability: `FR-015`, `FR-016`, `FR-021`, `TC-003`, `TC-004`, `NFR-004`-`NFR-006`; `AC-001`, `AC-003`, `AC-004`, `AC-005`-`AC-007`, `AC-009`, `AC-029`, `AC-033`, `AC-035`, `AC-036`.
  - Depends on: `T-002`.
  - Red evidence: Run focused tests requiring canonical standard-Base64 key validation, exact 32-byte decoding, AES-256-GCM randomized envelope, user-bound AAD, tamper/wrong-user/wrong-key rejection, default secret exclusion, explicit safe/service projections, server-derived user filters, first/update secret rules, and one complete atomic `findOneAndUpdate`. Add startup tests that await the unique `userId` index before accepting APS traffic and fail closed on index error. Inject encryption, duplicate-key, and write failures and assert the previous document remains exact.
  - Expected failure: The runner and generated test key work, but no APS crypto/model/service/startup integration provides the required secure atomic behavior.
  - Approval checkpoint: Review key negative cases, projections, full replacement envelope, failure injection, and index sequencing before Green.
  - Minimum Green: Add one AES-256-GCM service using native `crypto`, one additive per-user model, one configuration service that builds the complete current state including retained/new envelope, and the smallest existing-lifecycle startup hook that awaits `ApsConfiguration.init()` after MongoDB connection and before `listen`.
  - Refactor boundary: Keep key parsing, crypto, model, configuration policy, and startup responsibilities separated; no migration framework, transaction, repository abstraction, key-rotation service, or existing-user schema change.
  - Regression: Prove no plaintext/key/token in serialized documents/errors, no cross-user read/update, unchanged prior state on every injected failure, canonical URN retained, and existing database connection/startup behavior preserved.
  - Manual/live: Later MongoDB inspection confirms unique index and encrypted envelope only.
  - Validation and rollback: Record `automated` evidence and the additive-schema/index limitation; rollback route/startup/model usage without deleting stored data.

- [x] `T-004` Expose authenticated configuration read/save HTTP contracts test-first
  - Classification: Behavioral TDD.
  - Traceability: `FR-015`, `FR-016`, `FR-018`, `FR-021`, `TC-003`, `NFR-004`-`NFR-006`; `AC-001`-`AC-007`, `AC-024`, `AC-029`, `AC-030`, `AC-035`, `AC-036`.
  - Depends on: `T-003`.
  - Red evidence: Run authenticated/unauthenticated HTTP tests for explicit no-record versus configured read, safe save response, field errors, first/update secret rules, server-derived identity, cross-user isolation, duplicate-key/persistence classification, and sanitized status/error envelopes with no secret envelope or readback. Successful save must expose only `changeType: "urn-only" | "credential-replacement"`, derived from prior/new normalized Client ID and whether the submitted secret was non-empty; first save and any non-empty secret are credential replacement.
  - Expected failure: Services exist, but the authenticated `/api/aps/configuration` contracts and safe error mapping do not.
  - Approval checkpoint: Review public payloads/statuses and secret-negative assertions before route/controller Green.
  - Minimum Green: Add the narrow authenticated router/controller wiring for `GET` and `PUT`, reuse existing middleware and app patterns, and return only safe mapped representations plus the non-sensitive authoritative `changeType`.
  - Refactor boundary: Keep HTTP mapping outside domain/persistence; do not change existing auth responses or create global error infrastructure.
  - Regression: Re-run service/crypto tests, unauthorized routes, auth/register/login and health/startup smoke checks; prove a failed PUT cannot look committed to a caller.
  - Manual/live: Inspect representative safe network payloads without using real secrets.
  - Validation and rollback: Record `automated`/`controlled` evidence; remove only APS configuration route wiring and controller.

- [x] `T-005` Implement APS token service and supported Initializer callback test-first
  - Classification: Behavioral TDD.
  - Traceability: `FR-003`, `FR-017`-`FR-019`, `TC-002`, `TC-006`, `TC-007`, `NFR-003`-`NFR-006`; `AC-008`, `AC-009`, `AC-021`, `AC-023`, `AC-029`, `AC-033`, `AC-038`, `AC-045`, `AC-054`.
  - Depends on: `T-004`.
  - Red evidence: Backend tests require current-user configuration/decryption, exact OAuth v2 endpoint and Basic client exchange, only `viewables:read`, ten-second abort, positive lifetime, no cache/persistence/logging, and sanitized missing/rejected/invalid/temporary failures. Controlled provider tests require `getAccessToken(onTokenReady)` to deliver token/lifetime only for its matching user/workspace/authentication/runtime generation, support ordinary Viewer-requested renewal without runtime reinitialization, discard stale token results/errors, stop safely with no active context, and notify only the current registered workspace.
  - Expected failure: Configuration HTTP exists, but neither the token endpoint/service nor the generation-bound supported Initializer callback behavior exists.
  - Approval checkpoint: Review exact scope/exchange, transient token boundary, callback lifetime, stale suppression, no-context behavior, and normal renewal before Green.
  - Minimum Green: Add injected-fetch backend token service/router plus the smallest generation-bound `getAccessToken` provider used by Initializer. Store no token after callback delivery.
  - Refactor boundary: Separate HTTP acquisition from callback context; no token setter, retained-callback invocation, private refresh call, `NOP_VIEWER`, endpoint/header mutation, derivative proxy, token cache, or lifecycle reset logic in this task.
  - Regression: Cover token result after context invalidation, logout/user change, absent context, stale/current notifications, timeout, invalid lifetime, ordinary renewal without shutdown, and no token in React/storage/Mongo/log fixtures.
  - Manual/live: Real ordinary callback renewal without runtime reinitialization is mandatory in `T-011`; controlled results stay non-live.
  - Validation and rollback: Record `automated`/`controlled` results; rollback token route/provider without changing stored configuration.

- [x] `T-006` Implement frontend settings and authoritative save commit-point state test-first
  - Classification: Behavioral TDD.
  - Traceability: `FR-001`, `FR-002`, `FR-013`, `FR-015`, `FR-016`, `FR-018`, `FR-019`, `FR-021`, `NFR-001`-`NFR-006`; `AC-001`-`AC-006`, `AC-021`, `AC-022`, `AC-024`, `AC-029`-`AC-032`, `AC-035`-`AC-039`, `AC-046`, `AC-050`-`AC-052`, `AC-056`.
  - Depends on: `T-005`.
  - Red evidence: Run reducer/API/component tests for loading, explicit empty, ready, read error, saving, and save error; attempted versus committed values; password semantics; disabled concurrent submission plus operation guards; and no token/load on empty/read error. Require safe backend `changeType` classification: unchanged normalized Client ID plus blank submitted secret is `urn-only`; changed normalized Client ID or any non-empty secret is `credential-replacement`. URN-only success advances configuration/model/analysis generations and requests same-runtime model replacement. Credential replacement advances configuration/authentication/runtime/model/analysis generations and requests controlled reset even when visible values are unchanged. Failed save preserves exact committed runtime/Viewer/model state and attempted secret and requests no lifecycle action. Older response after a newer context and logout/user change during read/save publishes nothing.
  - Expected failure: APIs exist, but no feature reducer/orchestrator enforces authoritative save and race semantics.
  - Approval checkpoint: Review URN-only, non-empty-secret, changed-Client-ID, first-save, older-save, user-switch, and failed-save classification/assertions before Green.
  - Minimum Green: Add feature-local API methods, reducer/orchestrator, and settings form using existing Axios/auth/UI patterns. Consume only safe `changeType`, bind operations to user/workspace/save identifiers and monotonic generations, clear only the active successful secret input, and emit the matching lifecycle command.
  - Refactor boundary: Keep presentation separate from orchestration; do not redesign `AuthContext`, Axios, global state, or shared shell components.
  - Regression: Re-run configuration/token contracts; confirm no stale response clears a newer form, blank-secret URN-only never requests shutdown, any non-empty secret requests reset, changed Client ID requests reset, failed save requests neither model replacement nor reset, and actionable errors contain no internal/raw text.
  - Manual/live: Keyboard/password/autofill and error clarity continue in `T-010`/`T-011`.
  - Validation and rollback: Record `automated` evidence; rollback settings/orchestrator while leaving backend behavior intact.

- [x] `T-007` Implement serialized Viewer lifecycle, deterministic 3D loading, replacement, and cleanup test-first
  - Classification: Behavioral TDD.
  - Traceability: `FR-003`, `FR-004`, `FR-013`, `FR-017`-`FR-019`, `TC-001`, `TC-006`, `TC-007`, `NFR-002`-`NFR-006`; `AC-008`, `AC-010`, `AC-021`-`AC-023`, `AC-029`, `AC-036`-`AC-039`, `AC-040`, `AC-041`, `AC-045`, `AC-046`, `AC-050`, `AC-051`, `AC-052`, `AC-053`, `AC-054`, `AC-055`, `AC-056`.
  - Depends on: `T-006`.
  - Red evidence: Controlled tests require exact matching `7.118.2` assets/options; one asset promise; one generation-scoped initialization promise; and at most one runtime, Viewer, and active model. URN-only replacement must reuse runtime/Viewer, unload/clear old model state, and never call global shutdown. Changed Client ID and any non-empty Client Secret must, only after successful save, advance runtime generation and serially call owned `viewer.finish()`, public `Autodesk.Viewing.shutdown()`, clear references/promises, initialize a new callback/runtime, create one Viewer, and load persisted URN. Normal renewal and unchanged-credential retry must not shut down. Failed persistence must call neither finish nor shutdown. Tests cover overlapping reset requests, partial initialization failure cleanup, retry from empty/load-failed current generation, logout, final unmount, StrictMode remount, duplicate-disposal protection, and stale prior-runtime callbacks/promises/models/errors publishing nothing. Selector tests retain exactly one prefix, supported default 3D then public `getChildren()` depth-first pre-order, mixed/nested 2D/3D, default 2D, no default, no 3D, and no 2D fallback.
  - Expected failure: Provider/settings exist, but no serialized runtime coordinator/controller/selector implements both lifecycle branches and failure recovery.
  - Approval checkpoint: Review public call order, no-shutdown branches, at-most-one ownership, partial-failure/retry, StrictMode/logout/unmount, stale suppression, and selector order before Green.
  - Minimum Green: Add one asset loader, one serialized runtime lifecycle coordinator, one public BubbleNode selector, and one Viewer controller. Scope callbacks/promises to runtime generation; make disposal idempotent; use only `getAccessToken`, `finish()`, public `shutdown()`, Initializer, and supported model APIs.
  - Refactor boundary: Keep asset loading, lifecycle coordination, pure selector, and imperative model controller separate; no token setter, retained callback, broad-search ordering, private manifest/implementation fields, endpoint mutation, `NOP_VIEWER`, proxy, Viewer wrapper dependency, or exhaustive SDK simulation.
  - Regression: Re-run callback/token races, URN-only reuse, secret correction/rotation reset, changed-ID reset, failed-save non-reset, reset-failure retry, repeated mount/retry/replacement, no overlapping ownership, exact finish/shutdown counts/order, and stale-success/error/model suppression.
  - Manual/live: `T-011` verifies actual URN-only reuse, credential-reset public lifecycle, new-credential model load, prior-runtime silence, document tree selection, WebGL, failure/retry, and cleanup.
  - Validation and rollback: Record `controlled` results; rollback lifecycle/controller wiring together and leave Viewer disabled/empty rather than downgrade credential replacement to same-runtime loading.

- [x] `T-008` Implement instance/category resolution and native toolbar/theming test-first
  - Classification: Behavioral TDD.
  - Traceability: `FR-005`-`FR-009`, `FR-013`, `FR-018`, `FR-019`, `TC-005`, `TC-006`, `NFR-003`, `NFR-005`, `NFR-006`; `AC-011`, `AC-012`, `AC-013`, `AC-014`, `AC-015`, `AC-016`, `AC-021`-`AC-024`, `AC-029`, `AC-042`.
  - Depends on: `T-007`.
  - Red evidence: Controlled fixtures require unique model-local instance `dbId` results without a leaf assumption: include a qualifying non-leaf instance; exclude explicit type/category/container/organizational records and nested geometry parts; do not accept a terminal node merely for being a leaf; and fail conservatively when identity cannot be proven. Category tests allow only the eight approved exact aliases. Toolbar tests require one native group/control per Furniture/Walls/Doors, readiness/failure isolation, keyboard labels, zero-match feedback, distinct semantic active state, and no stale ids. Theming tests use active-model public calls, turn one category off by clearing/rebuilding feature-owned ids while preserving others, cover overlapping sets, and clear all owned theming on replacement/teardown.
  - Expected failure: Model loads, but no conservative analysis adapter, exact resolver, or owned toolbar/theming behavior exists.
  - Approval checkpoint: Review mixed-node fixtures, conservative failure outcome, public theming calls, overlap behavior, and cleanup before Green.
  - Minimum Green: Implement the narrow public tree/property adapter contract, exact resolver, and feature toolbar controller with active-category map and feature-owned `dbId` set.
  - Refactor boundary: Exact candidate algorithm stays inside the adapter; do not encode a universal Revit ontology, assume leaves, infer translations, use fuzzy matching, touch private fragments, or clear unrelated theming.
  - Regression: Re-run model replacement/stale guards; category zero versus failure; active-model argument; overlapping toggle-off; repeated toolbar creation; and model-local id reset.
  - Manual/live: `T-011` must capture sanitized representative parent/child/type/category/container/organizational/nested-part/leaf/non-leaf instance evidence and native toolbar/theming behavior before acceptance.
  - Validation and rollback: Record `automated`/`controlled` limitations; rollback analysis/toolbar listeners and clear all feature-owned theming.

- [ ] `T-009` Implement quantity domain and progressive property orchestration test-first
  - Classification: Behavioral TDD.
  - Traceability: `FR-005`-`FR-007`, `FR-010`, `FR-011`, `FR-012`, `FR-013`, `TC-005`, `NFR-003`, `NFR-005`, `NFR-006`; `AC-011`-`AC-013`, `AC-017`, `AC-018`, `AC-019`, `AC-020`, `AC-021`, `AC-029`, `AC-034`, `AC-043`, `AC-044`, `AC-048`, `AC-049`.
  - Depends on: `T-008`.
  - Red evidence: Pure tables require unique Door/Window counts including zero; exact Area name; approved whole-string numeric grammar; rejection of booleans, negatives, non-finite, exponent, grouping, partial text, and inference; trim-only units; compatibility/no conversion; and all report states. Multiple Area fixtures use only `dbId`, `displayName`, `displayValue`, `displayCategory`, `attributeName`, `type`, `units`, `hidden`, and `precision`. They contribute once only when every record is valid and identical in numeric value/unit/non-empty stable `attributeName`/`type`; same display category alone is insufficient; missing metadata is ambiguous. Async tests require bounded geometry-first Category then Area phases, count before Area, per-category isolation, Area skip after unsafe count, count retention/no subtotal on operational Area failure, and generation guards for every batch/result/error.
  - Expected failure: Category sets exist, but deterministic quantity functions/property orchestration do not.
  - Approval checkpoint: Review numeric/unit/duplicate tables, public field shapes, and failure-versus-data-state assertions before Green.
  - Minimum Green: Add pure count/Area/report functions and a bounded public `getBulkProperties2` adapter/orchestrator. Keep calculation numeric; formatting stays presentation-only, uses consistent trustworthy precision metadata when available, otherwise a documented simple shortest numeric display, and never changes state/unit.
  - Refactor boundary: Separate public property adaptation, pure domain, orchestration, and formatting; no arbitrary record selection, leaf assumption, unit conversion/inference, 15-significant-digit rule, precision library, or partial subtotal on operational failure.
  - Regression: Cover incompatible/missing/invalid/ambiguous data, operational failure, zero, overlapping/duplicate instance ids, stale batches, model replacement, and no hardcoded production quantity.
  - Manual/live: Before duplicate proof is accepted, `T-011` captures sanitized real property shapes and verifies the selected fields/stable identifier. Unsupported metadata remains ambiguous.
  - Validation and rollback: Record `automated`/`controlled` evidence; rollback report/orchestrator without affecting loaded geometry/toolbar.

- [ ] `T-010` Compose the accessible workspace and converge automated evidence test-first
  - Classification: Behavioral TDD plus convergence review.
  - Traceability: `FR-001`, `FR-003`, `FR-008`-`FR-013`, `FR-017`-`FR-019`, `NFR-001`-`NFR-008`; `AC-014`-`AC-024`, `AC-025`, `AC-026`, `AC-029`, `AC-030`, `AC-034`-`AC-042`, `AC-045`, `AC-046`, `AC-048`-`AC-056`.
  - Depends on: `T-009`.
  - Red evidence: Run integrated React scenarios requiring coherent settings/Viewer/category/report states, distinct URN-only versus credential-reset progress/failure states, retry/reload guidance after reset failure, keyboard-only save/retry, labels/descriptions/password semantics, focus associations, `aria-live` status/error feedback, no color-only meaning or alert, action-specific safe messages, progressive non-blocking results, and preserved shell. Add an AC evidence matrix; any missing lifecycle branch, requirement path, wrong evidence label, flaky setup, stale update, leaked sensitive value, or controlled-as-live claim keeps convergence Red.
  - Expected failure: Individual domains/controllers exist, but the full accessible workspace and complete evidence matrix do not.
  - Approval checkpoint: Review user journeys, failure wording, accessibility assertions, and evidence gaps before integrated Green.
  - Minimum Green: Compose feature-local components in the existing home content and make the smallest corrections needed for approved journeys. Update `validation.md` with current automated/controlled results while preserving prior entries.
  - Refactor boundary: Only feature-owned duplication exposed by integration; no shell redesign, shared-component refactor, new design system, observability platform, or speculative abstraction.
  - Regression: Run all focused suites, frontend build, backend startup/route smoke, auth/shell/unrelated-route checks, lifecycle branch/ordering/ownership tests, lockfile/audit review, English-content check, secret/artifact scan, and complete `FR`/`TC`/`NFR`/`AC` matrix.
  - Manual/live: Mark WebGL, real derivative/tree/properties, native toolbar, browser layout, ordinary renewal, URN-only reuse, credential reset/reinitialization, new-credential load, and prior-runtime silence `pending live` for `T-011`.
  - Validation and rollback: Record `automated`, `controlled`, and pending evidence without rewriting history; rollback only workspace composition/integration corrections.

- [ ] `T-011` Perform real APS/manual validation and append final documentation only when explicitly authorized
  - Classification: Validation and documentation; not a substitute for behavioral TDD.
  - Traceability: `FR-001`, `FR-003`-`FR-014`, `FR-017`-`FR-019`, `TC-001`, `TC-002`, `TC-005`-`TC-007`, `NFR-001`-`NFR-004`, `NFR-006`, `NFR-008`; `AC-008`-`AC-030`, `AC-037`-`AC-056`.
  - Depends on: `T-010`, evaluator-authorized credentials and representative translated Revit source-design URN for live checks, and separate explicit authorization naming root `README.md` before any README write.
  - Initial evidence: Keep every live-only item `Not run` until executed. Before README work, derive authoritative baseline bytes directly from current approved Git, compare working README byte-for-byte, and abort if any pre-existing byte differs. Do not accept a working-tree snapshot as the original baseline.
  - Live/manual checklist:
    - exact Viewer assets/runtime; ordinary callback renewal without reinitialization; URN-only replacement without reinitialization; changed Client ID and non-empty-secret replacement through public `finish()` then `shutdown()` then new Initializer; new persisted credentials loading the configured model; no overlapping runtime/Viewer; no obsolete prior-runtime callback/token/load/model/error publication; reset-failure retry/reload; derivative access; public-tree default/fallback 3D selection; and no 2D fallback;
    - sanitized representative Revit parent/child/type/category/container/organizational/nested-part/leaf/non-leaf instance facts;
    - sanitized real public Area shapes and executable duplicate predicate, exact aliases, counts/states, native controls, independent/overlapping theming, replacement/retry/failure/cleanup;
    - Chrome/Edge layout, keyboard/focus/messages, shell/navigation/logout, MongoDB unique index/encrypted envelope/canonical URN, browser storage/network, and no token persistence.
  - Defect rule: A live defect returns to the owning task's useful Red, approval, minimum Green, focused regression, and affected live rerun. Do not silently change requirements in this task.
  - Documentation Green: After explicit README authorization and successful baseline comparison, append exactly one separated English assessment section to the verified baseline. Preserve original line endings and final-byte behavior; cover configuration, environment key, dependencies, run/validation, Viewer version, assumptions, per-user behavior, limitations, and troubleshooting. Verify the new file begins with the exact baseline byte sequence. Update final sanitized `validation.md` matrix without relabeling evidence.
  - Refactor boundary: Edit only appended README bytes and feature-local validation status; no correction, translation, reformatting, or reordering of base README; no separate redundant assessment document.
  - Regression: Re-run proportionate focused suites/build/scans and byte-prefix/one-section checks; verify no real secret/key/token/URN/raw APS/model data in docs.
  - Rollback: Remove only appended bytes and final validation-status updates, restoring the exact Git-baseline README bytes. No Git mutation is authorized by baseline checks or documentation work.

- [ ] `T-012` Prepare and perform Git delivery only after explicit authorization
  - Classification: Delivery; no behavioral Red-Green-Refactor claim.
  - Traceability: `FR-014`, `FR-022`, `NFR-004`, `NFR-008`; `AC-027`, `AC-030`, `AC-047`.
  - Depends on: `T-011`, final review, and explicit user authorization for each requested branch/stage/commit/push/fork action.
  - Read-only preparation: Review status, tracked/untracked/ignored files, full and staged diffs as applicable, branch state, English small-commit plan, README byte preservation, validation status, and sensitive/generated/dependency-directory exclusions. Read-only inspection is not Git delivery.
  - Delivery Green: Perform only the specifically authorized Git actions, in small English responsibility-based commits, and provide a working branch or fork with all intended files tracked.
  - Regression: Re-run or reuse still-current final evidence proportionate to any delivery-only change; verify intended file set, commit order/messages, branch usability, README prefix, and absence of secrets, environment files, local database data, dependency directories, and runtime artifacts.
  - Rollback: Use only separately authorized, non-destructive Git actions; never reset, rewrite, delete user data, or mutate remote state without explicit scope.

## Acceptance evidence map

| Acceptance criteria | Primary task evidence |
| --- | --- |
| `AC-001`-`AC-007` | `T-002`-`T-004`, `T-006`, `T-010` |
| `AC-008`-`AC-010` | `T-005`, `T-007`, `T-010`, `T-011` |
| `AC-011`-`AC-013` | `T-008`, `T-009`, `T-011` |
| `AC-014`-`AC-016` | `T-008`, `T-010`, `T-011` |
| `AC-017`-`AC-020` | `T-009`-`T-011` |
| `AC-021`-`AC-023` | `T-005`-`T-010`, `T-011` |
| `AC-024`-`AC-026` | `T-004`, `T-006`, `T-008`, `T-010`, `T-011` |
| `AC-027`-`AC-030` | `T-001`, `T-003`-`T-011`, `T-012` |
| `AC-031`-`AC-036` | `T-002`-`T-006`, `T-009`, `T-010` |
| `AC-037`-`AC-042` | `T-005`-`T-011` |
| `AC-043`, `AC-044`, `AC-048`, `AC-049` | `T-009`-`T-011` |
| `AC-045`, `AC-046` | `T-005`-`T-007`, `T-010`, `T-011` |
| `AC-047` | `T-011`, `T-012` |
| `AC-050`-`AC-056` | `T-004`, `T-006`, `T-007`, `T-010`, `T-011` |

## Cross-artifact audit

- Coverage: The traceability fields and evidence map cover every `FR-001`-`FR-022`, `TC-001`-`TC-007`, `NFR-001`-`NFR-008`, and `AC-001`-`AC-056` without adding product behavior beyond approved `spec.md`.
- Security order: Canonical input, crypto/persistence/index, authoritative save classification, and authenticated configuration contracts precede token, settings, serialized Viewer lifecycle, and analysis.
- TDD order: `T-001` is preparation. `T-002` begins behavioral TDD. Each behavioral Red uses a functioning runner and missing behavior as its expected failure, includes approval before Green, and ends with focused regression and rollback evidence.
- Lifecycle correctness: URN-only success reuses runtime/Viewer and advances model/analysis context; changed Client ID or any non-empty secret resets authentication/runtime only after persistence; failed save resets nothing. Lifecycle work is serialized with at-most-one ownership, public `finish()`/`shutdown()`/Initializer ordering, generation-scoped stale suppression, partial-failure retry, and idempotent logout/StrictMode/unmount. No undocumented token setter, proxy, private Autodesk API, leaf-instance assumption, broad-search order, global theming clear, or arbitrary Area record/precision decision remains.
- Evidence integrity: `validation.md` begins in `T-001`, records every increment, labels evidence accurately, keeps unavailable live checks open, and protects sensitive data. Convergence adds current status without rewriting history.
- Delivery boundaries: README uses bytes from the approved Git baseline and aborts on any earlier difference. README and every Git action still require their own explicit authorization. No Gate 5 action is performed by this task document.
- Proportionality: Twelve reversible increments preserve security, deterministic domain behavior, stale-result/lifecycle coverage, accessibility, live APS proof, and professional delivery without production-platform infrastructure or exhaustive Viewer/WebGL automation.

## Senior TDD review

- Useful Red quality: Domain tables and application scenarios assert observable outcomes and negative cases. Setup absence is confined to preparation checks. A behavioral Red that fails from imports, environment, fixtures, or runner configuration must be repaired before approval.
- Race coverage: Direct cases include URN-only reuse, non-empty-secret and changed-ID reset, failed-save non-reset, obsolete save after a newer context, logout/user change during read/save, prior-runtime token/callback/promise/model after replacement, overlapping reset, retry after reset failure, StrictMode remount, and unmount. Current failure reaches only the current workspace; expected obsolete cancellation stays silent.
- Model realism: Controlled fixtures deliberately contain non-leaf instances, leaf instances, types, categories, containers, organizational nodes, and nested parts. Real sanitized Revit evidence is mandatory because doubles cannot prove derivative structure.
- APS honesty: Public callback, `finish()`, `shutdown()`, Initializer, BubbleNode traversal, and model/property/theming contracts are testable with narrow doubles. WebGL, native UI, real property metadata, lifecycle branching, and new-credential model access remain live claims. Private behavior is neither mocked as supported nor used as implementation authority.
- Assessment fit: Consolidation reduces coordination overhead without merging unrelated security and Viewer concerns. Each increment remains independently reviewable and reversible.

## Gate decision

- [x] Tasks are ordered, reversible, traceable, and proportionate.
- [x] Preparation is separated from behavioral TDD.
- [x] Every acceptance criterion has an evidence path.
- [x] No Gate 5 implementation, test, dependency, skill, README, or Git action has started.
- [x] `PLAN-GAP-004` is resolved in the synchronized Specification and Technical Plan.
- [x] Gate 3 is approved.
- [x] Project owner approved Tasks and authorized preparation plus the first behavioral Red on 2026-08-05. Green production code still requires explicit approval after reviewed Red evidence; README and Git actions require their own authorization.

Tasks are `Approved`.
