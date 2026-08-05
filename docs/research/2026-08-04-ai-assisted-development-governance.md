# Research: AI-assisted development governance

Status: Complete
Date: 2026-08-04
Researcher: Codex
Consumed by: `AGENTS.md`, `docs/sdd/README.md`, and ADR-0001

## Question

How should this existing React/Express/MongoDB technical-assessment repository be initialized for reliable AI-assisted, specification-driven, test-first development without changing base-application behavior?

## Method

The review combined:

- the current OpenAI Codex manual for repository instructions and skills;
- primary GitHub Spec Kit documentation for an agentic SDD lifecycle;
- GitHub and Git documentation for ignore rules, review templates, and commit hygiene;
- the ADR community's canonical definitions and Michael Nygard's original practice;
- primary test-tool documentation for behavior-focused testing;
- Docker documentation for database persistence;
- a read-only audit of the repository, dependency scripts, worktree, and runtime.

External guidance is summarized below. The final project model is a synthesis adapted to the repository's size and the owner's explicit authorization requirements; it is not claimed to be a universal standard.

## Findings

### Codex repository guidance

OpenAI documents `AGENTS.md` as durable repository guidance loaded before work. It recommends practical content such as repository layout, run/build/test commands, conventions, constraints, completion criteria, and verification. Guidance closer to the working directory overrides broader guidance, and the combined project guidance has a default size limit. Detailed workflows should therefore live in linked documentation or skills rather than bloating the root file.

OpenAI documents `.agents/skills` as the shared repository location for Codex skills. Skills use progressive disclosure: the name and description are always available, while full instructions and references load only when selected. A skill should be focused on a repeatable workflow and should not duplicate general knowledge.

Project conclusion: use one concise root `AGENTS.md`, detailed owning documents in `docs/`, and one repository-local skill for the explicitly recurring gated SDD workflow.

### Spec-driven development

GitHub Spec Kit describes SDD as intent-first, multi-step refinement. Its current agentic flow is:

```text
constitution -> specify -> clarify -> plan -> checklist -> tasks -> analyze -> implement -> converge
```

The specification owns what and why; the plan owns technical design; the checklist tests requirement quality; tasks are dependency ordered; analysis detects cross-artifact inconsistency; convergence compares implementation back to the approved artifacts. The documentation recommends clarification before designing on ambiguity and verification between implementation stages.

Spec Kit also demonstrates strict test-first gates, but some tool-driven workflows can manage branches. Automatic Git operations conflict with this repository's explicit human authorization boundary.

Project conclusion: adopt the artifact separation, Gap Ledger, cross-artifact review, test-first cycle, and convergence concepts without installing a toolchain or permitting automatic Git mutation.

### Architectural decision records

The ADR community defines an ADR as a record of one architecturally significant decision and its rationale, trade-offs, and consequences. Nygard's compact structure uses title, status, context, decision, and consequences; replaced decisions remain in history and become superseded rather than rewritten.

Project conclusion: keep ADRs short, immutable after acceptance, sequentially numbered, and linked to the feature plan that required the decision.

### TDD and useful tests

The widely documented TDD loop is Red, Green, Refactor, one behavior at a time. Testing Library emphasizes using software as users do and interacting with DOM nodes instead of component internals. Playwright recommends user-visible behavior, isolated tests, accessible locators, and retrying web-first assertions. Vitest is Vite-native, while Node provides a stable built-in test runner in supported modern versions.

Project conclusion: prescribe behavior and contract quality, not a framework or coverage quota. Select concrete tooling only in the feature technical-plan gate after checking the repository's Node support range, Vite compatibility, APS/WebGL limitations, and CI needs.

### Git and GitHub hygiene

Git guidance recommends logically separate changesets, useful imperative messages, and staging by patch when responsibilities share files. GitHub supports repository pull-request templates and documents repository `.gitignore` rules as the shared way to exclude non-versionable files. Conventional Commits is a separate specification, but GitHub rulesets explicitly support enforcing it.

Project conclusion: use English Conventional Commit subjects, small responsibility-based commits, explicit-path staging, staged-diff review, and separate authorization for every Git mutation.

### Docker database persistence

Docker documents volumes as the preferred persistence mechanism for container-generated database data. Docker manages volumes independently from host directory structure, and Docker Desktop specifically recommends named volumes for databases and other non-code state.

Project conclusion: retain the separately authorized named MongoDB volume fix, ignore the old host `infrastructure/mongo-data/` state, and document the actual storage boundary without modifying the protected baseline README.

## Repository audit implications

- The backend is CommonJS Express/Mongoose and the frontend is React 18/Vite.
- There are no test, lint, formatting, type-check, or CI scripts.
- The frontend build is the only existing static validation command.
- Existing authentication and shell behavior form the base-application preservation boundary.
- Dependency audit findings and baseline security risks exist, but fixing them is a separate scope.
- The assessment is intentionally limited, so governance must remain lean and avoid speculative tooling.
- APS client-secret handling is the most important future security decision and requires backend mediation in the approved design.

## Adopted model

1. Root `AGENTS.md` stores concise, durable rules.
2. `docs/` stores architecture, ADRs, SDD artifacts, engineering policies, research, discoveries, and runbooks.
3. `.agents/skills/run-sdd-workflow/` operationalizes one repeatable workflow.
4. Every material gate ends with a senior review and explicit user approval.
5. TDD separates reviewed Red evidence from production implementation.
6. Git operations remain outside implicit agent authority.
7. Tooling is added only through an approved plan with a demonstrated need.

## Risks and follow-up

- Strict gate granularity can slow small changes; the SDD applicability rule permits truly trivial, behavior-neutral work to remain lightweight.
- Documentation can drift; convergence and same-change updates are mandatory mitigations.
- A local skill is only useful if its trigger and stop conditions work in future sessions; it must be validated and forward-tested.
- Test tooling, CI, APS architecture, and dependency remediation remain deliberately undecided until their respective approved gates.

## Sources

Accessed 2026-08-04:

- [OpenAI: Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)
- [GitHub Spec Kit: What is Spec-Driven Development?](https://github.github.com/spec-kit/concepts/sdd.html)
- [GitHub Spec Kit: Agentic SDD](https://github.github.com/spec-kit/reference/agentic-sdd.html)
- [GitHub Spec Kit repository](https://github.com/github/spec-kit)
- [Architectural Decision Records](https://adr.github.io/)
- [Michael Nygard: Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [Git: Contributing to a Project](https://git-scm.com/book/en/v2/Distributed-Git-Contributing-to-a-Project.html)
- [GitHub: Ignoring files](https://docs.github.com/en/get-started/getting-started-with-git/ignoring-files)
- [GitHub: Creating a pull request template](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [Testing Library: Guiding Principles](https://testing-library.com/docs/guiding-principles/)
- [Playwright: Best Practices](https://playwright.dev/docs/best-practices)
- [Vitest: Why Vitest](https://vitest.dev/guide/why)
- [Node.js: Test runner](https://nodejs.org/api/test.html)
- [Docker: Volumes](https://docs.docker.com/engine/storage/volumes/)
- [Docker Desktop settings and storage guidance](https://docs.docker.com/desktop/settings-and-maintenance/settings/)
