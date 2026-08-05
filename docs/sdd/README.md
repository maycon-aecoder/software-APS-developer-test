# Spec-Driven Development Workflow

This repository uses a lightweight, brownfield-first SDD workflow. Specifications define intent; plans define implementation; tasks and tests provide traceability; code implements only approved artifacts.

## Applicability

Use the workflow for every non-trivial feature, bug fix, refactor, dependency change, data-model change, API contract change, security change, or architectural change.

A task is trivial only when it is behavior-neutral, requires no meaningful design choice, introduces no dependency or contract change, and can be validated directly. When uncertain, use SDD.

## Feature directory

Create `docs/sdd/<yyyy-mm-dd>-<slug>/` during Gate 1. Use these core files:

```text
discovery.md   Evidence, existing behavior, scope, constraints, and Gap Ledger
spec.md        What and why: requirements, scenarios, acceptance criteria, and non-goals
plan.md        How: architecture, security, data flow, contracts, test strategy, and rollout
tasks.md       Dependency-ordered implementation and documentation tasks with traceability
validation.md  Red/green evidence, command results, manual checks, convergence, and gaps
```

Add `contracts/`, `data-model.md`, `research.md`, or other focused artifacts only when the approved plan needs them.

Every artifact must include `Status`, `Owner`, `Created`, and `Last updated`. Valid statuses are `Draft`, `In Review`, `Approved`, and `Superseded`.

## Gap Ledger

Every gate owns a Gap Ledger with the following states:

- `Open`: a missing decision, contradiction, or uncertainty that can affect the result.
- `Resolved`: answered and incorporated into the owning artifact.
- `Deferred`: explicitly removed from the current scope with user approval.

Do not advance while material gaps remain open. Record a concise question, impact, owner, and resolution. Never hide a guess as a resolved gap.

## Mandatory gates

### Gate 0: Intake

Establish the requested outcome, literal scope, protected behavior, constraints, authorization boundaries, and current progress. Inspect only enough evidence to identify whether SDD applies.

Exit criteria:

- The current gate and requested deliverable are explicit.
- Scope and protected behavior are recorded.
- No material ambiguity is silently assumed.
- The user explicitly authorizes discovery.

### Gate 1: Discovery and research

Create `discovery.md`. Examine current behavior, code paths, tests, runtime evidence, authoritative external sources, security implications, constraints, and viable options.

Exit criteria:

- Evidence is cited and source facts are separated from synthesis.
- Existing behavior and change surface are mapped.
- The Gap Ledger has no material open item.
- A senior review finds no missing stakeholder, boundary, threat, or regression concern.
- The user explicitly approves discovery and authorizes specification.

### Gate 2: Specification

Create `spec.md` describing what users and systems need and why. Avoid implementation decisions. Use stable requirement IDs such as `FR-001` and `NFR-001`.

Exit criteria:

- User journeys, failure paths, edge cases, non-goals, and measurable acceptance criteria are explicit.
- Requirements are testable and free of implementation leakage.
- Each criterion traces to one or more requirements.
- The Gap Ledger is clear and the specification passes senior product/domain review.
- The user explicitly approves the specification and authorizes technical planning.

### Gate 3: Technical plan and decisions

Create `plan.md`. Define architecture, boundaries, data flow, APIs, security, error handling, observability, dependencies, migration/rollback, and testing strategy. Create proposed ADRs for architecturally significant decisions.

Exit criteria:

- Every design choice traces to an approved requirement.
- Alternatives and consequences are documented for significant choices.
- Complexity is justified and no speculative abstraction is introduced.
- Security and credential handling have an explicit threat review.
- The Gap Ledger is clear and the plan passes senior architecture review.
- The user explicitly approves the plan and any proposed ADRs, then authorizes task design.

### Gate 4: Tasks and test design

Create `tasks.md` with dependency-ordered, small, independently verifiable tasks. Define the test matrix by behavior and risk, not by coverage quota.

Exit criteria:

- Every task traces to a requirement and acceptance criterion.
- Each implementation task names its failing test, minimal implementation, refactor, focused validation, documentation, and rollback boundary.
- Parallel markers appear only on truly independent tasks.
- Cross-artifact analysis finds no contradiction among spec, plan, tasks, and ADRs.
- The tests and tasks pass senior TDD and delivery review.
- The user explicitly approves the tasks and authorizes the Red phase.

### Gate 5: TDD implementation increments

For each approved behavior:

1. Write the smallest useful test at the lowest reliable layer.
2. Run it and confirm it fails for the intended missing behavior, not due to setup failure.
3. Review the test for observable behavior, false positives, brittleness, realistic data, edge cases, and regression value.
4. Record Red evidence in `validation.md` and obtain explicit user approval before production code.
5. Write the minimum implementation that makes the approved test pass.
6. Run focused tests and confirm Green.
7. Refactor only while tests remain green.
8. Run proportionate regression checks and perform a senior implementation review.

Return to the earliest affected gate when implementation reveals a requirement, design, task, or test flaw. Do not patch around an invalid upstream artifact.

### Gate 6: Convergence and final review

Compare implementation and documentation against every approved requirement, decision, and task.

Exit criteria:

- Acceptance criteria have explicit evidence.
- Relevant automated tests, build checks, and approved manual/live checks are recorded honestly.
- Mocks and local checks are not reported as live APS acceptance.
- Security, accessibility, operability, maintainability, and regression reviews are complete.
- Documentation and discoveries are synchronized.
- Remaining limitations and deferred work are explicit.
- The user explicitly accepts convergence and authorizes any delivery action.

### Gate 7: Delivery

Prepare small, reversible Git units by responsibility. Stage, commit, branch, push, or open a pull request only when the user explicitly authorizes that specific action.

## Change control

When an approved requirement changes, mark affected downstream artifacts `Draft` and return to the earliest impacted gate. Record what changed, why, who approved it, and which tests or decisions require revision.

Use `.agents/skills/run-sdd-workflow/references/` for artifact templates.
