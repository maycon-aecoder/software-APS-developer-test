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

Classify evidence as `Automated`, `Local integration`, `Mocked`, `Manual`, or `Live APS`.

## TDD evidence

`T-001` contains preparation and smoke verification only. Behavioral TDD begins with the following increment.

### `T-002` canonical Model URN and Viewer identifier

- Red test: Table-driven backend cases require trimming, optional one lowercase prefix, exact prefix-free preservation, valid Base64URL final quanta, and rejection of empty/prefix/alphabet/padding/whitespace/length/decoding/noncanonical/trailing-bit cases. Frontend cases require exact payload preservation with one `urn:` prefix.
- Intended failure observed: Both focused runners execute successfully and use a test-only absent-subject fallback returning `undefined`; every assertion fails because the two approved functions are missing. Independent smoke controls remain green.
- Senior test review: Cases trace to `FR-002`, `FR-004`, `FR-015`, `AC-031`, and `AC-032`; cover both remainder-two and remainder-three unused-bit rules; avoid prescribing an error class/message or decode implementation; use only synthetic payloads; and require exact output rather than implementation details. The short and longer modulo-four-one cases jointly cover incomplete decoding and invalid length. Side-effect nonreach is enforced by the pure production boundary and will receive dependent-double regression evidence when crypto/persistence and loading callers exist.
- User approval: Pending explicit approval of this reviewed Red.
- Green implementation: Not started.
- Focused result: RED as intended.
- Refactor result: Not started.
- Regression result: Existing backend and frontend smoke tests pass; broader suites are intentionally red until Green.

## Acceptance traceability

| Acceptance criterion | Evidence | Status | Gap |
| --- | --- | --- | --- |
| `AC-028` | One project-local skill plus structural and pressure-scenario validation. | Pass for `T-001` | Later implementation must continue to follow it. |
| `AC-029` | Focused runners and controlled fake-key, API, model/property, bubble-tree, toolbar, Viewer, and async-race fixtures/doubles. | Pass for `T-001` | Behavioral suites arrive in their traced tasks; live proof remains open. |
| `AC-030` | English-content and diff review of all feature-owned material introduced by `T-001`. | Pass for `T-001` | Future feature increments require their own review. |

## Senior convergence review

- Correctness and regressions: Both runners pass their smoke behavior and the existing frontend build passes. The backend startup command remains unchanged; starting it is intentionally skipped because it requires a long-lived process and MongoDB rather than preparation behavior.
- Security and secret handling: Fixtures use synthetic values only. Test packages are development-only. Audit findings are recorded above and belong to pre-existing direct development/runtime dependencies; automatic remediation is intentionally skipped because it would exceed `T-001`.
- Accessibility and user feedback: The frontend smoke test exercises an accessible button by role and name; feature UX begins in later tasks.
- Maintainability and complexity: Preparation is limited to one skill, focused runners, and reusable narrow doubles.
- Operations and recovery: Rollback removes only the `T-001` skill, test scripts, development packages, fixtures, smoke tests, and this validation artifact.
- Documentation synchronization: Approved Specification and Technical Plan remain unchanged; Tasks mark only `T-001` complete, and this artifact records its evidence.
- Diff and Git hygiene: Full and responsibility-isolated staged reviews pass; README identity is preserved, and no unrelated or sensitive file is included.

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
