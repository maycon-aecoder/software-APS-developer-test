# Discovery Registry

Use this area for concise, verified repository facts that are likely to prevent repeated investigation. Feature-specific evidence belongs in that feature's `discovery.md` first.

## Admission rule

A discovery must be:

- verified against current source, tests, runtime evidence, or authoritative documentation;
- reusable beyond one immediate task;
- specific enough to become stale detectably;
- dated and linked to its evidence;
- non-normative unless promoted into architecture, an ADR, an engineering policy, or a runbook.

Do not store guesses, copied logs, secrets, transient task progress, or general programming advice here. When a discovery becomes an architectural rule or operating procedure, move the rule to its owning document and leave only a link.

## Current discoveries

| Date | Fact | Owning source |
| --- | --- | --- |
| 2026-08-04 | Docker-managed storage is required for reliable local MongoDB operation on this Windows setup | `docs/architecture/README.md` and `infrastructure/docker-compose.yml` |
| 2026-08-04 | No automated test or lint script exists in the baseline | `backend/package.json`, `frontend/package.json`, and `docs/engineering/README.md` |
