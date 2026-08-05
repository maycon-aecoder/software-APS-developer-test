# Architecture Decision Records

Use ADRs for durable decisions that materially affect architecture, security, data ownership, integration contracts, dependencies, deployment, or cross-cutting quality attributes.

## Lifecycle

Use one status: `Proposed`, `Accepted`, `Deprecated`, `Superseded`, or `Rejected`.

- Create one short ADR per significant decision.
- Include context, decision drivers, considered options, decision, consequences, and verification.
- Record positive, negative, and neutral consequences.
- Do not edit an accepted ADR to hide history. Create a replacement and mark the old ADR `Superseded by ADR-NNNN`.
- Link the ADR to the SDD artifact that required it and link the feature plan back to the ADR.
- Number files sequentially as `NNNN-short-title.md`.

## Index

| ADR | Status | Decision |
| --- | --- | --- |
| [ADR-0001](0001-ai-assisted-sdd-governance.md) | Accepted | Use repository-local, explicitly gated SDD/TDD governance for AI-assisted development |

## Template

```markdown
# ADR-NNNN: Decision title

Status: Proposed
Date: YYYY-MM-DD
Deciders: Project owner
Related SDD artifact: `docs/sdd/...`

## Context

## Decision drivers

## Considered options

## Decision

## Consequences

## Verification
```
