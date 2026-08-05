# Repository Agent Guide

## Purpose

Extend the existing APS Developer Test base application through small, reviewable, specification-driven changes. Preserve current behavior unless an approved specification explicitly changes it.

## Non-negotiable rules

- Write all repository content, code comments, documentation, branch names, commit messages, and pull request content in English.
- Treat user-defined scope literally. Do not widen a task or silently refactor working behavior.
- Treat the root `README.md` as part of the protected base application. Do not modify it without explicit user authorization naming that file.
- Do not create or switch branches, stage files, commit, amend, rebase, reset, stash, push, open a pull request, or otherwise mutate Git state without explicit user authorization for that action.
- Never commit secrets, local environment files, credentials, tokens, database files, generated output, or dependency directories.
- Use the repository's SDD workflow for every non-trivial feature, bug fix, refactor, dependency change, or architectural change.
- Never advance from one SDD gate to the next without explicit user approval. A generic request to continue authorizes only the current approved gate unless the user clearly names another gate.
- Use test-driven development during implementation. Obtain approval for the reviewed failing tests before writing the corresponding production code.
- After every gate, perform a senior self-review covering correctness, ambiguity, security, maintainability, regressions, unnecessary complexity, documentation drift, and validation gaps.

## Sources of truth

Use the narrowest authoritative source and resolve conflicts explicitly:

1. The user's current instructions and approved decisions.
2. The approved feature artifacts under `docs/sdd/` for feature intent and acceptance criteria.
3. `README.md` for assessment requirements that an approved feature specification has not refined.
4. Accepted ADRs under `docs/adr/` for architectural decisions.
5. Current source code and tests for implemented behavior.
6. Architecture and engineering guides under `docs/` for living repository guidance.
7. Research and discoveries for evidence and context only; they are not normative decisions.

When sources disagree, stop at the current gate, record the conflict in the Gap Ledger, and ask the user to decide. Correct the owning source instead of documenting the same rule in multiple places.

## Repository map

- `backend/`: CommonJS Node.js, Express, Mongoose, JWT authentication, and API routes.
- `frontend/`: React 18, Vite, Tailwind CSS, React Router, and Axios.
- `infrastructure/`: Docker Compose configuration for local MongoDB.
- `docs/architecture/`: Current system boundaries and architecture.
- `docs/adr/`: Immutable architectural decision history.
- `docs/sdd/`: Gated feature artifacts and their lifecycle rules.
- `docs/engineering/`: Testing, review, and Git working agreements.
- `docs/research/`: Source-backed investigations and option analysis.
- `docs/discoveries/`: Verified repository facts that future work should reuse.
- `.agents/skills/`: Shared repository skills discovered by Codex.

Read `docs/README.md` before non-trivial work. Invoke `$run-sdd-workflow` for any change covered by the SDD rule above.

## Baseline commands

Run commands from the repository root unless a command says otherwise.

```powershell
# Start or stop MongoDB
npm --prefix backend run db:dev
npm --prefix backend run db:stop

# Run the backend
npm --prefix backend run dev

# Run or build the frontend
npm --prefix frontend run dev
npm --prefix frontend run build
```

There are currently no lint or test scripts. Do not claim that linting or automated tests passed until those tools exist and were actually run. Select test tooling only during an approved technical-plan gate.

## Engineering expectations

- Follow existing CommonJS conventions in the backend and ES module/React conventions in the frontend unless an approved plan changes them.
- Keep controllers, domain logic, APS integration adapters, viewer lifecycle code, and presentation concerns separated by responsibility.
- Keep APS credentials and secrets out of browser persistence, logs, URLs, Git, and test fixtures. Any credential flow requires explicit threat analysis in the feature plan.
- Prefer behavior and contract tests over implementation-detail assertions. Use realistic boundaries when they are deterministic and safe.
- Add dependencies only when the approved plan justifies them. Review lockfile changes and run an available security audit after installation.
- Treat `.cursor/rules/codacy.mdc` as Cursor/Codacy-specific guidance. Run its Codacy checks only when that integration is available, and never report them as completed otherwise.
- Update the owning documentation in the same change when behavior, architecture, setup, operations, or decisions change.
- Keep changes minimal, cohesive, and reversible. Avoid speculative abstractions and unrelated cleanup.

## Completion and review

Before reporting a gate or implementation increment complete:

- Re-read the approved scope and acceptance criteria.
- Review the full diff and the exact staged diff when staging was authorized.
- Run the narrowest relevant checks, then broader regression checks proportional to risk.
- Record commands, results, intentional skips, and unresolved gaps in the feature's `validation.md`.
- Update affected specs, ADRs, architecture docs, discoveries, research, engineering guidance, and README content.
- Confirm no secrets, generated files, local database state, or unrelated changes are included.
- Report progress as: plan, completed items, current item, remaining items, validation, and decisions needed.

See `docs/engineering/README.md` for the TDD, senior review, and Git conventions.

## Code review rules

- Flag behavior that is not traceable to an approved requirement or task.
- Flag production code added before its approved failing behavior test, unless a documented exception was approved.
- Flag browser exposure or persistence of APS client secrets.
- Flag tests that assert implementation details without protecting observable behavior or a contract.
- Flag documentation that reports a mock, stub, or local check as a live APS acceptance result.
- Flag unrelated refactors, speculative abstractions, swallowed errors, secret leakage, and unverified destructive operations.
