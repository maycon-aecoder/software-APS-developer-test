# Validation: APS Viewer Assessment

Status: Draft
Owner: Maycon Freitas
Created: 2026-08-05
Last updated: 2026-08-05

## Evidence log

| Date | Task | Phase | Command or procedure | Expected | Result | Classification |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-05 | `T-001` | README baseline | Compare `git rev-parse HEAD:README.md` with `git hash-object README.md`. | Both object identities match without changing README or Git state. | Both identities are `ddecc37f72ad8c048ae16301af721945cf1e842f`; README is unchanged. | Local integration |
| 2026-08-05 | `T-001` | Tool compatibility | Query package metadata for the selected exact test-tool versions and their Node/React peer ranges. | Development-only packages support the approved Node 18+ and React 18 baselines. | `supertest@7.2.2`, `vitest@3.2.6`, `jsdom@24.1.3`, `@testing-library/react@16.3.0`, and `@testing-library/user-event@14.6.1` are compatible. | Local integration |
| 2026-08-05 | `T-001` | Backend smoke and regression | `npm --prefix backend test` | The built-in Node runner executes with fixtures importable and no environment/import failure. | PASS: 2 files reported, including 1 behavioral smoke test; 0 failures. | Automated |
| 2026-08-05 | `T-001` | Frontend runner stabilization | Run the initial Vitest smoke command, terminate it after it produced no result, then rerun with one fork. | A deterministic runner exits and reports the smoke result. | Initial default worker execution stalled; the focused one-fork configuration resolved it. Final `npm --prefix frontend test` PASS: 1 file and 1 test; 0 failures. | Automated |
| 2026-08-05 | `T-001` | Frontend build regression | `npm --prefix frontend run build` | Existing production build remains available. | PASS: Vite transformed 92 modules and produced the ignored `dist` output. | Local integration |
| 2026-08-05 | `T-001` | Dependency audit | Run full and production-only `npm audit` in both packages and inspect dependency paths. | Record findings honestly without unrelated remediation. | Backend production: 0; backend development: 1 high in `brace-expansion` through pre-existing `nodemon`. Frontend production: 2 moderate in pre-existing `react-router`/`react-router-dom`; full frontend: those plus 1 moderate in pre-existing `postcss`. No finding is attributed to a newly added direct test package. | Local integration |
| 2026-08-05 | `T-001` | Skill structure | Run `quick_validate.py` and count matching assessment-skill directories. | Valid metadata and exactly one assessment-specific skill. | PASS: `Skill is valid!`; count is 1. | Automated |
| 2026-08-05 | `T-001` | Skill pressure review | Apply the same five scenarios before and after the skill: gate bypass, sensitive diagnostics, credential reset shortcuts, URN-only misclassification, and controlled evidence called live. | Repository-specific instructions close material rationalization gaps without duplicating generic guidance. | PASS after two narrow wording corrections covering sensitive nested HTTP material/token retention and backend-authoritative save classification/reset order. | Manual |
| 2026-08-05 | `T-001` | Diff and Git review | Run `git diff --check`, sensitive-pattern scan, explicit staged name/status, staged stat, staged diff, and README identity checks for each responsibility. | No malformed diff, sensitive value, unrelated file, README change, or mixed responsibility. | PASS: test harness and feature guidance/evidence were reviewed as two isolated commit scopes; README identity remained unchanged. | Local integration |
| 2026-08-05 | `T-002` | Backend Red | `node --test test/domain/modelUrn.test.js` from `backend`. | Runner executes and canonical Model URN behavior fails because it is absent. | RED as intended: 26 tests executed and 26 failed on missing canonical return/rejection behavior; no import, dependency, or environment failure. | Automated |
| 2026-08-05 | `T-002` | Frontend Red | `npm test -- src/test/modelUrn.test.js` from `frontend`. | Runner executes and one-prefix Viewer identifier behavior fails because it is absent. | RED as intended: 2 tests executed and 2 failed with `undefined` instead of the exact `urn:<canonicalPayload>` result; no import, dependency, or environment failure. | Automated |
| 2026-08-05 | `T-002` | Runner control | Run `npm run test:smoke` separately in `backend` and `frontend`. | Preparation smoke behavior remains green while the new behavior is red. | PASS: each package executed 1 smoke test with 0 failures. | Automated |
| 2026-08-05 | `T-002` | Senior Red revision | Review every scenario against the approved deterministic partitions and remove equivalent cases/assertions. | Retain the smallest suite that catches distinct realistic defects without losing an approved partition. | PASS: reduced the backend suite by 5 equivalent cases and removed 1 redundant frontend assertion; retained trim/prefix order, all canonical final-quantum sizes, URL-safe characters, every invalid syntax partition, and both unused-bit boundaries. | Manual |
| 2026-08-05 | `T-002` | Revised backend Red | `node --test test/domain/modelUrn.test.js` from `backend`. | Revised suite remains Red only because canonical return and rejection behavior are absent, with diagnostic messages identifying each contract. | RED as intended: 21 tests executed and 21 failed; 8 exact canonical-output failures and 13 missing-rejection failures. | Automated |
| 2026-08-05 | `T-002` | Revised frontend Red | `npm test -- src/test/modelUrn.test.js` from `frontend`. | Exact identifier assertions remain Red and diagnose missing prefix/payload preservation behavior. | RED as intended: 2 tests executed and 2 failed with explicit exact-identifier messages. | Automated |
| 2026-08-05 | `T-002` | Revised runner control | Run `npm run test:smoke` separately in `backend` and `frontend`. | Review-only edits do not disturb the test environment. | PASS: each package executed 1 smoke test with 0 failures. | Automated |
| 2026-08-05 | `T-002` | Red approval | User response: `aprovado, prossiga`. | Explicit approval authorizes only the minimum T-002 Green and its review. | APPROVED; T-003 remains unauthorized. | Manual |
| 2026-08-05 | `T-002` | Minimum Green | Run both focused commands after adding the two domain modules. | Canonicalizer and Viewer identifier satisfy the approved tests. | Backend PASS: 21/21. Frontend remained RED: 2/2 because its Vite-transformed absent-subject shim did not discover the new module; production output was not the cause. | Automated |
| 2026-08-05 | `T-002` | Test refactor and focused Green | Replace absent-subject shims with direct production imports, then rerun both focused commands. | Tests execute only real production behavior and remain Green. | PASS: backend 21/21; frontend 2/2. | Automated |
| 2026-08-05 | `T-002` | Regression | Run `npm --prefix backend test`, `npm --prefix frontend test`, and `npm --prefix frontend run build`. | Existing smoke behavior and build remain healthy with all T-002 behavior Green. | PASS: backend 23/23; frontend 3/3 across 2 files; Vite build transformed 92 modules successfully. | Automated |
| 2026-08-05 | `T-002` | Diff and Git review | Run full/staged diff checks, sensitive-pattern scan, explicit staged name/status/stat/diff, and README identity comparison. | Only T-002 domain, direct-test-import, task-progress, and validation files are included; no malformed diff, secret, unrelated file, or README change exists. | PASS: 6 scoped files reviewed; README object identity remains `ddecc37f72ad8c048ae16301af721945cf1e842f`. | Local integration |

Classify evidence as `Automated`, `Local integration`, `Mocked`, `Manual`, or `Live APS`.

## TDD evidence

`T-001` contains preparation and smoke verification only. Behavioral TDD begins with the following increment.

### `T-002` canonical Model URN and Viewer identifier

- Red test: Table-driven backend cases require trimming, optional one lowercase prefix, exact prefix-free preservation, valid Base64URL final quanta, and rejection of empty/prefix/alphabet/padding/whitespace/length/decoding/noncanonical/trailing-bit cases. Frontend cases require exact payload preservation with one `urn:` prefix.
- Intended failure observed: Both focused runners execute successfully and use a test-only absent-subject fallback returning `undefined`; every assertion fails because the two approved functions are missing. Independent smoke controls remain green.
- Senior test review: Revised cases trace directly to `FR-002`, `FR-004`, `FR-015`, `AC-031`, and `AC-032`; cover trim-before-prefix behavior, valid remainder-zero/two/three quanta, the URL-safe alphabet, invalid prefix/alphabet/padding/whitespace/remainder-one partitions, and both remainder-two and remainder-three unused-bit rules. The remainder-one and canonical re-encode cases jointly cover invalid decoding, noncanonical representation, and trailing bits without duplicating mathematically equivalent inputs. Tests avoid prescribing an error class/message or decode implementation, use only synthetic payloads, and assert exact public output. The absent-subject shim cannot satisfy any assertion and exists only to keep Red behavioral instead of failing module resolution; real behavior is never mocked. Side-effect nonreach will receive dependent-double regression evidence when crypto/persistence and loading callers exist.
- Red review revision: Removed duplicate outer-whitespace, uppercase-prefix, and one-character remainder-one scenarios and consolidated three embedded-whitespace inputs into one; the retained mixed-case prefix, embedded space, and longer remainder-one inputs protect the same approved equivalence partitions. Removed the redundant frontend prefix-count assertion because exact string equality already proves one prefix and unchanged payload. Added scenario-specific assertion messages.
- Senior Red recommendation: Approve Red. The revised suite is deterministic, proportionate, behavior-focused, and cannot become Green through the absent-subject shim; explicit user approval remains pending before production code.
- User approval: Approved explicitly on 2026-08-05 with `aprovado, prossiga`.
- Green implementation: Added one backend-authoritative pure canonicalizer that structurally validates and proves canonical Base64URL through decode/re-encode equality while returning the exact submitted prefix-free payload. Added one frontend helper that prepends exactly one `urn:` to its canonical persisted input.
- Focused result: GREEN — backend 21/21 and frontend 2/2.
- Refactor result: GREEN — removed both absent-subject shims in favor of direct imports and simplified canonical validation without changing output.
- Regression result: GREEN — complete backend 23/23, complete frontend 3/3, and frontend production build pass.
- Senior implementation review: The implementation is limited to two pure domain modules, introduces no dependency, network, persistence, token, Viewer runtime, or UI behavior, returns the original canonical payload rather than a normalized rewrite, exposes no submitted value in its stable validation error, and can be rolled back by removing only the two modules and reverting their direct test imports. Invalid input cannot reach crypto, persistence, token, or model loading because no such dependency or caller exists in this increment; dependent-double proof remains correctly ordered with the tasks that introduce those boundaries.

## Acceptance traceability

| Acceptance criterion | Evidence | Status | Gap |
| --- | --- | --- | --- |
| `AC-028` | One project-local skill plus structural and pressure-scenario validation. | Pass for `T-001` | Later implementation must continue to follow it. |
| `AC-029` | Focused runners and controlled fake-key, API, model/property, bubble-tree, toolbar, Viewer, and async-race fixtures/doubles. | Pass for `T-001` | Behavioral suites arrive in their traced tasks; live proof remains open. |
| `AC-030` | English-content and diff review of all feature-owned material introduced by `T-001`. | Pass for `T-001` | Future feature increments require their own review. |
| `AC-031` | Backend accepted-input table and frontend exact-identifier table, followed by focused and full Green results. | Pass for `T-002` | Persistence and automatic load evidence arrive in their dependent tasks. |
| `AC-032` | Backend rejected-input table covers every approved syntax partition and both unused-bit boundaries. | Pass for `T-002` | Field-specific UI guidance arrives in `T-004` and `T-006`. |

## Senior convergence review

- Correctness and regressions: Both complete test suites and the existing frontend build pass. T-002 returns exact canonical input, rejects all approved invalid partitions, and constructs the exact Viewer identifier. The backend startup command remains unchanged; starting it is intentionally skipped because T-002 is pure and does not use MongoDB or a long-lived server.
- Security and secret handling: Fixtures use synthetic values only. T-002 has no credential/token access and its validation error does not echo submitted input. Test packages are development-only. Audit findings are recorded above and belong to pre-existing direct development/runtime dependencies; automatic remediation is intentionally skipped because it would exceed the approved increments.
- Accessibility and user feedback: The frontend smoke test exercises an accessible button by role and name; feature UX begins in later tasks.
- Maintainability and complexity: T-002 adds only the two planned pure functions and direct behavior tests; no validator framework, shared cross-package library, or unrelated refactor was introduced.
- Operations and recovery: T-002 rollback removes only its two domain modules and reverts the direct test imports; it has no stored data or runtime migration.
- Documentation synchronization: Approved Specification and Technical Plan remain unchanged; Tasks mark `T-001` and `T-002` complete, and this artifact records their evidence.
- Diff and Git hygiene: Full and staged T-002 reviews pass; README identity is preserved, and no unrelated or sensitive file is included.

## Limitations and proof gaps

- Controlled fixtures and smoke tests do not prove Autodesk rendering, WebGL behavior, real derivative access, native toolbar integration, supported 3D selection, or real Revit property shapes.
- No live APS credential, token, URN, or model data is stored in the repository or used by `T-001`.
- Credential- and representative-model-dependent live checks remain open until `T-011`.
- The repository's existing `nodemon`, `postcss`, and React Router dependency paths retain the audit findings recorded above. Updating them is not required for test preparation and would be unrelated dependency work.

## Final decision

- [ ] Approved requirements, plan, tasks, tests, code, and documentation converge.
- [ ] Evidence classifications are honest.
- [ ] No material finding remains unresolved.
- [ ] User accepted Convergence and authorized the requested Delivery action.
