---
name: run-sdd-workflow
description: Run this repository's explicitly gated, test-first SDD lifecycle for the APS Viewer assessment. Use for any non-trivial feature, bug fix, refactor, dependency change, API or data contract change, security change, or architectural change; create and review the current gate artifact, maintain a Gap Ledger, stop for user approval between gates, and keep implementation, tests, validation, and documentation traceable.
---

# Run SDD Workflow

Guide one change through the next explicitly authorized gate. Do not run the whole lifecycle in one pass.

## Establish context

1. Read `AGENTS.md` and `docs/README.md`.
2. Read `docs/sdd/README.md` completely.
3. Read the active feature directory, relevant ADRs, architecture guidance, current source, tests, and runtime evidence.
4. State the current gate, approved scope, protected behavior, known gaps, and requested output.
5. Respond in the user's language, but write every repository artifact in English.

If no active feature directory exists, create one only during an authorized Discovery gate as `docs/sdd/<yyyy-mm-dd>-<slug>/`.

## Apply the approval boundary

- Complete only the current authorized gate.
- Never interpret a generic `continue` as permission to skip or combine gates.
- Stop when a material Gap Ledger item needs a user decision.
- Stop after the gate review and ask for explicit approval before advancing.
- If new evidence invalidates an approved artifact, return to the earliest affected gate.
- Do not create or switch branches, stage, commit, push, or open a pull request without separate explicit authorization.

## Run the gates

### Gate 0: Intake

Confirm outcome, literal scope, protected baseline behavior, constraints, Git authorization, and whether SDD applies. Do not create implementation artifacts.

### Gate 1: Discovery

Use [discovery-template.md](references/discovery-template.md). Inspect the existing behavior and change surface, gather authoritative evidence, identify security and regression risks, compare viable options, and close or explicitly defer every material gap.

Review as a senior engineer. Challenge assumptions, missing boundaries, stale sources, unsupported claims, and accidental scope expansion.

### Gate 2: Specification

Use [spec-template.md](references/spec-template.md). Define what and why with stable requirement IDs, user journeys, failure paths, measurable acceptance criteria, and non-goals. Keep technical design out of the specification.

Review as a senior product/domain engineer. Check completeness, ambiguity, testability, consistency, and traceability.

### Gate 3: Technical plan

Use [plan-template.md](references/plan-template.md). Define the minimum architecture, data and credential flow, contracts, dependencies, error handling, test strategy, rollout, and recovery required by the approved specification. Propose an ADR only for a durable, significant decision.

Review as a senior architect and security engineer. Reject speculative abstractions and unapproved changes to the base application.

### Gate 4: Tasks and test design

Use [tasks-template.md](references/tasks-template.md). Create small, dependency-ordered tasks that trace to requirements. For each behavior, identify the failing test, minimum implementation, refactor boundary, focused validation, documentation impact, and rollback boundary.

Run a read-only consistency review across discovery, spec, plan, ADRs, and tasks. Review the tests as a senior TDD engineer for false positives, brittle implementation detail, missing failure cases, unrealistic mocks, and weak regression value.

### Gate 5: TDD increments

For one approved behavior at a time:

1. Write the smallest behavior or contract test.
2. Run it and confirm Red for the intended reason.
3. Review the test and record evidence in `validation.md` using [validation-template.md](references/validation-template.md).
4. Stop for explicit approval before writing production code.
5. Implement the minimum Green change.
6. Refactor only with tests green.
7. Run focused and proportionate regression checks.
8. Perform a senior implementation review and update the owning documentation.

Never claim TDD when the test was written after production code or when Red was not observed. Record any user-approved exception honestly.

### Gate 6: Convergence

Compare every approved requirement, decision, task, test, implementation change, and documentation update. Record exact automated, local, mocked, manual, and live evidence separately. Do not report local or mocked checks as live APS acceptance.

Review correctness, security, regressions, accessibility, maintainability, operations, secrets, diff scope, and documentation drift. Stop for final user acceptance.

### Gate 7: Delivery

Prepare responsibility-based Git groups only when authorized. Review the complete worktree and staged patch. Exclude secrets, database files, generated output, and unrelated changes. Perform only the specific Git action the user authorized.

## Keep documentation alive

Update only the owning artifact:

- feature intent and acceptance -> `spec.md`;
- implementation design -> `plan.md`;
- significant durable decision -> `docs/adr/`;
- current system boundary -> `docs/architecture/`;
- local setup and operation -> the approved feature artifacts unless the user explicitly authorizes a root `README.md` change;
- reusable verified fact -> `docs/discoveries/`;
- external evidence -> `docs/research/` or feature `research.md`;
- commands and results -> `validation.md`.

Do not copy the same rule into multiple documents.

## Report progress

Every user response must include:

- the plan;
- completed items;
- current item and gate;
- remaining items;
- validation performed and proof gaps;
- decisions or approval needed.

Keep progress concise and never imply that an unapproved next gate has started.
