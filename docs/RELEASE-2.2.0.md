# Forge Studio 2.2.0 release notes

## Mission State & Progress Ledger

Forge Studio now derives mission state from durable project, mission, task, run, evidence, event, interrupt, capability, and environment records. It does not accept model-authored completion, cost, test, approval, sandbox, or progress claims as authoritative.

The release adds stable public user/repository identities, completion criteria, hypotheses, verification totals, usage/cost accounting, projected-cost enforcement, sanitized sandbox and approval state, subagent-role state, milestone deduplication, stalled-progress detection, authenticated APIs, and a lazy-loaded Mission State Center.

## Audit movement

Thirteen checklist items moved from partial to source-and-test verified. The exact item-level result and all remaining open conditions are in `docs/FEATURE-COMPLETENESS-AUDIT-2.2.0.md` and `docs/REMAINING-GAPS-2.2.0.md`.
