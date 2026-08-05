---
name: aps-viewer-assessment
description: Implement and review this repository's approved APS Viewer assessment after its SDD gates are approved. Use for APS configuration, secret encryption, 2LO tokens, Viewer 7.118.2 lifecycle, model loading, categories, quantities, UX failures, tests, validation, and delivery work scoped by the approved feature artifacts.
---

# APS Viewer Assessment

## Start from the approved contract

1. Read `AGENTS.md`, `docs/README.md`, and `docs/engineering/README.md`.
2. Read the approved `spec.md`, `plan.md`, and `tasks.md` under `docs/sdd/2026-08-04-aps-viewer/`.
3. Invoke `run-sdd-workflow` and honor its current gate and TDD approval checkpoint.
4. Reuse the existing CommonJS backend, React/Vite frontend, Mongoose, JWT middleware, Axios, and Tailwind patterns. Keep the root `README.md` protected unless the user explicitly authorizes that file.

## Preserve the feature boundaries

- Store one configuration per authenticated user. Derive user identity on the server.
- Keep the Client Secret encrypted at rest with the environment key. Never expose, log, fixture, or retain sensitive values, complete credential-bearing requests, raw APS/OAuth bodies, nested request/response error objects, or unsanitized real credential/model data.
- Acquire APS 2LO tokens on the backend with only `viewables:read`. Deliver each token and lifetime directly to the current Viewer callback and retain no application-owned copy after delivery.
- Use APS Viewer `7.118.2` assets and public APIs. Do not use private setters, retained callback invocation, global endpoint mutation, undocumented refresh functions, `NOP_VIEWER`, or a derivative proxy.
- Consume the backend-authoritative `changeType`: an existing secret with unchanged normalized Client ID and blank submitted secret is `urn-only`; first save, changed normalized Client ID, or any non-empty submitted secret is `credential-replacement`. A failed save performs no lifecycle action. URN-only reuses the current runtime and Viewer. Only after durable credential replacement, invalidate prior callbacks and generations and serialize public `viewer.finish()`, `Autodesk.Viewing.shutdown()`, reference and promise cleanup, new initialization, and one new Viewer, with no overlap.
- Canonicalize the source-design URN once, persist the prefix-free Base64URL payload, and add exactly one lowercase `urn:` prefix for Viewer loading.
- Use public document, bubble-tree, instance-tree, property, toolbar, theming, unload, finish, and shutdown contracts. Guard every asynchronous result against stale configuration, runtime, model, and analysis generations.
- Resolve only the approved English category aliases. Keep counts and Area states deterministic and conservative when evidence or units are incomplete.

## Work test-first and report evidence honestly

- For every behavioral task, write and run the focused Red, review why it fails, record it in `validation.md`, and stop for explicit approval before production Green.
- Prefer pure domain tests, backend HTTP contracts, accessible React interactions, and narrow public-contract Viewer doubles. Do not build exhaustive SDK mocks or claim WebGL/live APS proof from controlled tests.
- Map failures to actionable English user guidance while retaining sanitized operation/cause context on the server. Never swallow a failure or reduce every failure to one generic message.
- Label evidence `Automated`, `Local integration`, `Mocked`, `Manual`, or `Live APS`; never promote controlled evidence to live proof. Update the owning feature documentation append-only and keep unavailable credential/model-dependent checks explicitly open.
- Avoid unrelated refactors, production-platform infrastructure, speculative abstractions, broad dependency changes, and additional assessment-specific skills.

## Review before each handoff

Check requirement and task traceability, secret exposure, authorization boundaries, atomic persistence, stale-result suppression, lifecycle cleanup, user feedback, accessibility, regression risk, dependency and lockfile scope, README preservation, test evidence classification, rollback, and Git diff hygiene.
