# Forge Studio 2.17.0 release

## Adaptive Work Fabric

This release addresses the highest-priority weaknesses left by 2.16.0: uncontrolled provider/browser process multiplication, competing repository indexes and a static subagent DAG. It adds shared admission and reconciliation without replacing the proven mission, policy, tool, evidence, patch, Git or completion cores.

### Added

- `RuntimeLeasePool` for keyed provider and browser logical sessions.
- Global and per-key capacity, FIFO-compatible waiters, mission/task attribution, abort cleanup, idle eviction and receipt-backed lifecycle events.
- Provider-registry completion proxies and project-scoped browser action leases.
- `RepositoryIntelligenceScheduler` with interactive/mission/watcher/background priorities.
- Generation coalescing, stale queued-generation cancellation, one active index job per project and pressure-aware semantic stages.
- Shared watcher/adaptive-index wiring instead of independent full-index fan-out.
- `SubagentOrchestrator.runAdaptiveGraph()` with wave reconciliation, bounded add/revise/revoke mutations, path/symbol ownership serialization, uncertainty stops and retry limits.
- Explicit-only `agent.runGraph` operating-plane tool with at most 64 bounded jobs.
- Runtime-status snapshots and clean shutdown for provider, browser and repository work-fabric components.
- Required Full Release Matrix gate `adaptive-work-fabric` and synthetic raw scheduling measurement.

### Audit position

The 790-item audit remains 734 `verified_source_test`, 0 `partial`, 56 `external_gate` and 0 `not_implemented`. These changes strengthen implementation behind existing requirements; they do not convert platform, hosted-provider or independent-certification gates into local claims.
