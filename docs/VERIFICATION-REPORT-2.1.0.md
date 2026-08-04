# Forge Studio 2.1.0 verification contract

A 2.1.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Context orchestration governance gate

`context-orchestration-governance` must prove:

- current-error and pinned-evidence priority;
- old-log decay;
- deterministic conversation/file/log compaction with original references;
- freshness and staleness labels;
- per-source token accounting;
- separate planner, executor, reviewer, debugger, and subagent budgets;
- narrowing-only budget overrides;
- project, principal, and role context permission filtering;
- durable idempotent checkpoints;
- cursor paging;
- authenticated principal-bound API;
- application bootstrap and shutdown wiring;
- observable lazy-loaded Context & Memory Center;
- inclusion in source reconstruction and release packaging.

Evidence is written to `release/matrix-2.1.0/` and bound to the exact Git commit. Every non-verified checklist item must appear exactly once in `docs/REMAINING-GAPS-2.1.0.md` and the machine-readable remaining-gaps report.
