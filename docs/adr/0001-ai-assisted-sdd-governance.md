# ADR-0001: Use gated SDD and TDD for AI-assisted development

Status: Accepted
Date: 2026-08-04
Deciders: Project owner
Related research: `docs/research/2026-08-04-ai-assisted-development-governance.md`

## Context

The repository is an existing technical-assessment base application that will be extended with an APS Viewer integration. AI agents must preserve the base behavior, maintain clear intent-to-code traceability, avoid unsupervised Git operations, and produce useful tests and living documentation.

One-shot implementation would make requirement drift, credential-handling errors, shallow tests, and undocumented architectural changes harder to detect. At the same time, importing a large external SDD toolchain would add complexity and could perform Git operations that the project owner has not authorized.

## Decision drivers

- Explicit human control over every stage transition.
- Traceability from assessment requirements to design, tasks, tests, and validation.
- Test-first implementation focused on observable behavior and contracts.
- Small, reversible changes and a clean Git history.
- Minimal process overhead appropriate to a small existing application.
- Repository-local guidance that works across Codex sessions and contributors.

## Considered options

### Informal prompt-only workflow

Rejected because durable rules, gates, and artifacts would depend on conversation history.

### Install an external SDD toolchain unchanged

Rejected for the initial bootstrap because it adds tooling and may create branches or otherwise mutate Git automatically. Such adoption can be reconsidered through a later ADR.

### Lightweight repository-local workflow

Selected. Use `AGENTS.md`, `docs/sdd/`, one focused Codex skill, explicit approval gates, and standard Markdown artifacts.

## Decision

All non-trivial features, bug fixes, refactors, dependency changes, and architectural changes must use the workflow in `docs/sdd/README.md` and `.agents/skills/run-sdd-workflow/`.

The workflow separates discovery, specification, technical planning, tasks and test design, failing tests, implementation, convergence, and delivery. The agent must stop after each gate and may advance only with explicit user approval. Production code must follow approved failing tests unless the user explicitly approves a documented exception.

Git mutations require separate explicit authorization. SDD tooling must not silently create branches, stage files, commit, push, or open pull requests.

## Consequences

### Positive

- Intent, architecture, implementation, and validation remain traceable.
- Ambiguities surface before expensive implementation.
- Tests protect behavior rather than merely satisfying a metric.
- Human approval remains an explicit control point.
- The workflow is tool-light and versioned with the repository.

### Negative

- Strict gates add interaction and documentation overhead.
- Small changes require judgment to distinguish trivial work from SDD-governed work.
- The workflow depends on disciplined maintenance until automated checks are approved and added.

### Neutral

- The process does not mandate a test framework, CI provider, branching model, or APS architecture. Those require approved technical decisions.

## Verification

- Root `AGENTS.md` references the workflow and approval boundary.
- `docs/sdd/README.md` defines artifact ownership and gates.
- `.agents/skills/run-sdd-workflow/` validates as a Codex skill.
- No application source or dependency is changed by this decision.
