# Tasks: <feature>

Status: Draft
Owner: <owner>
Created: YYYY-MM-DD
Last updated: YYYY-MM-DD
Plan: `plan.md`

## Task rules

- Keep tasks small, dependency ordered, and independently verifiable.
- Trace each task to requirements and acceptance criteria.
- Mark `[P]` only when tasks are truly independent.
- Use Red -> approval -> Green -> Refactor for every implementation behavior.

## Tasks

- [ ] `T-001` <responsibility>
  - Traceability: `FR-...`, `AC-...`
  - Depends on:
  - Red test and expected failure:
  - Minimum Green implementation:
  - Refactor boundary:
  - Focused and regression validation:
  - Documentation impact:
  - Rollback boundary:

## Cross-artifact analysis

- Missing requirement coverage:
- Unjustified tasks:
- Spec/plan/task conflicts:
- Dependency or ordering risks:

## Senior TDD review

- Observable behavior:
- False-positive risks:
- Brittle implementation details:
- Missing failures and edge cases:
- Mock and fixture realism:

## Gate decision

- [ ] Every task is traceable and verifiable.
- [ ] Cross-artifact analysis is clean.
- [ ] Tests are useful and implementation-independent.
- [ ] User approved Tasks and authorized the first Red phase.
