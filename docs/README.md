# Documentation Guide

This directory contains the living engineering record for the APS Developer Test. Keep each fact in one owning document and link to it elsewhere.

## Documentation map

| Area | Purpose | Normative? |
| --- | --- | --- |
| `architecture/` | Current system boundaries, data flow, constraints, and known risks | Yes, for current architecture |
| `adr/` | Immutable records of architecturally significant decisions | Yes, when accepted |
| `sdd/` | Approved intent, plans, tasks, and validation for individual changes | Yes, within each approved feature |
| `engineering/` | Testing, review, and Git working agreements | Yes |
| `research/` | Source-backed investigations and option comparisons | No; evidence only |
| `discoveries/` | Verified repository facts that should be reused | No; evidence only |

`README.md` at the repository root remains the protected source for the original assessment and setup overview. Do not modify it without explicit user authorization naming that file. `AGENTS.md` is the concise operating contract for coding agents.

## Maintenance rules

- Write repository documentation in English.
- Put feature-specific artifacts in `docs/sdd/<yyyy-mm-dd>-<slug>/`.
- Give every SDD artifact a status and last-updated date.
- Link every technical plan and validation result back to requirement identifiers.
- Record significant, durable choices as ADRs; do not use ADRs for routine implementation detail.
- Supersede accepted ADRs with a new ADR instead of rewriting decision history.
- Record research with source URLs, access dates, findings, and a clear distinction between source facts and project synthesis.
- Promote stable, verified findings from feature artifacts into architecture, engineering guidance, or discoveries when they will help future work.
- Update the owning document in the same change as the code or configuration it describes.
- Delete or mark stale guidance rather than allowing two competing sources of truth.

## Review cadence

Review documentation at every SDD gate and during final convergence. A document is not "living" merely because it exists; it is living only when changes keep it synchronized with the repository.
