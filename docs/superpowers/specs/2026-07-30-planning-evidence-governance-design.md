# Planning & Evidence Governance Design

## Goal

Add a deterministic local planning-evidence layer that detects missing input, estimates scope, enriches bounded mission steps with risks/files/tools/subagents, finds related tests/config/docs, records replanning reasons, rejects vague or over-detailed plans, and emits canonical receipts.

## Scope

The release promotes checklist items 5.23, 7.5, 7.9, 7.18, 7.19, 9.8, 9.9, 9.10, 9.11, 9.16, 9.17, 9.19, 15.10, 15.11, 15.19, and 15.23. It remains local-only and does not call issue trackers, cloud search, or external planning services.

## Architecture

`PlanningEvidenceGovernanceService` consumes a `StudioStore` and `RepositoryIndex`. A preflight pass indexes the authenticated project, detects objective ambiguity, classifies repository evidence, estimates scope, and produces a structured user-input request when required. An enrichment pass validates a provider-produced mission DAG, rejects vague or excessive steps, and adds bounded risk, expected-file, tool, subagent, and evidence fields to each step. A revision pass requires an explicit reason and writes an immutable event with a canonical SHA-256 receipt.

`MissionPlanner` optionally invokes the service before calling a provider and after validating the provider plan. Existing callers without the service preserve current behavior.

## Safety and limits

- Project identity comes from `StudioStore`; callers cannot supply a workspace root.
- Repository evidence excludes secret paths through `RepositoryIndex`.
- Plans contain 1–12 steps after enrichment.
- A builder step must name an actionable objective and have evidence or a bounded path scope.
- Tool recommendations use known Forge tool names only.
- No source file is changed by analysis.
- Receipts contain paths and hashes, never file contents or secrets.

## Testing

Direct tests cover missing-input detection, scope estimation, related test/config/doc retrieval, step enrichment, vague/over-detailed rejection, replanning reason persistence, MissionPlanner integration, audit movement, release verifier behavior, and Full Release Matrix inclusion.
