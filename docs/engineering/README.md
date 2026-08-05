# Engineering Standard

Status: Active
Last updated: 2026-08-04

This standard is intentionally small and specific to the single APS Viewer assessment feature.

## Test-driven development

Work one observable behavior at a time:

1. Write the smallest useful test.
2. Run it and confirm it fails because the behavior is missing.
3. Review the test for false positives, brittleness, realistic data, edge cases, and regression value.
4. Obtain approval for the failing test before writing production code.
5. Write the minimum code required to pass.
6. Refactor only while tests remain green.
7. Run regression checks proportional to the affected boundaries.

Prefer pure domain tests for property normalization and quantity aggregation, backend contract tests for APS token behavior, React tests through accessible user interactions, adapter tests for Viewer lifecycle, and a small manual/live checklist for credential-dependent APS acceptance. Never report mocked or local behavior as a live APS pass.

No test framework exists yet. Select the minimum compatible tooling during the approved technical-plan gate; do not install a broad quality toolchain during bootstrap.

## Senior review

After every SDD gate and implementation increment, review:

- traceability to the approved scope and requirements;
- correctness across success, failure, empty, loading, cleanup, and reload paths;
- regressions to authentication, routing, API shapes, and the existing shell;
- unnecessary abstractions, dependencies, or unrelated cleanup;
- APS credential leakage through browser storage, logs, URLs, errors, fixtures, or Git;
- tests that can pass while user-visible behavior is broken;
- accessibility and actionable user feedback;
- documentation drift and missing validation evidence.

Record material findings and resolve them before declaring the gate complete.

## Git history

Every Git mutation requires explicit user authorization. Permission to stage does not authorize a commit; permission to commit does not authorize a push or pull request.

- Split changes by responsibility into small, reversible commits.
- Stage explicit paths or patches and review `git diff --cached` before committing.
- Do not mix feature code with unrelated refactors, dependency upgrades, formatting churn, generated output, or local data.
- Use English Conventional Commit subjects in imperative form: `<type>(<optional-scope>): <description>`.
- Common types are `feat`, `fix`, `docs`, `test`, `refactor`, `build`, `ci`, `perf`, `style`, `chore`, and `revert`.
- Add a body when motivation, trade-offs, or previous behavior are not obvious.
- Add issue references only when the user requests or supplies them.

Examples:

```text
docs: establish gated SDD workflow
fix(infra): persist MongoDB in a named volume
test(api): cover APS token validation failures
feat(viewer): add door highlight toggle
```
