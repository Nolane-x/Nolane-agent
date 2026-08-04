# Forge Studio 2.1.0 release notes

## Context Orchestration Kernel

Forge Studio 2.1.0 adds a deterministic context policy layer rather than leaving context selection to prompt convention.

- Current diagnostics and pinned evidence receive explicit priority.
- Old terminal/log output decays instead of crowding out active evidence.
- Long conversations, source files, and logs are compacted deterministically while retaining original artifact and SHA-256 references.
- Source/current hashes produce fresh or stale labels.
- Every source reports estimated and selected token usage.
- Planner, executor, reviewer, debugger, and subagent use separate built-in budgets; overrides may only reduce them.
- Cross-project, unauthorized-principal, and unauthorized-role context is omitted with an explicit reason.
- Plans have canonical receipts.
- Idempotent SQLite checkpoints persist plans and expose stable cursor paging.

## Context & Memory Center

The existing lazy-loaded Center now includes an Orchestration tab showing current errors, freshness, staleness, compaction, token usage by source, permission omissions, selected context, checkpoint creation, and checkpoint paging.

## Release gate

The Full Release Matrix adds `context-orchestration-governance`, which proves kernel behavior, durable checkpoints, authenticated API, application wiring, UI observability, tests, and matrix integration.
