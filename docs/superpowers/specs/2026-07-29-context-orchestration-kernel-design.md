# Context Orchestration Kernel 2.1.0 Design

## Goal

Close the remaining item-level context-management gaps with one evidence-bound kernel that ranks, compacts, budgets, authorizes, checkpoints, pages, and explains context before it reaches any model role.

## Architecture

`ContextOrchestrationKernel` consumes typed context candidates and produces a canonical context plan. It reuses `DynamicContextStore` for immutable large-content artifacts, `ContextHistoryArchive` for original conversation and terminal history, and `ContextMemoryCenterService` for project-scoped pins and cited memory. It does not create a second history or memory store.

The kernel applies this order:

1. Validate project, role, source type, timestamps, hashes, and permission metadata.
2. Redact secrets before scoring or persistence.
3. Mark freshness as fresh, stale, or unknown using source/current hashes and age.
4. Assign explainable priority: current diagnostics and task constraints first, pinned evidence next, related tests/code next, old logs/history last.
5. Deterministically summarize old conversation and long files while retaining an immutable original reference.
6. Estimate tokens for every source and enforce a role-specific token budget.
7. Persist a content-addressed checkpoint and expose bounded cursor paging.

## Roles and budgets

Planner, executor, reviewer, debugger, and subagent have separate default budgets. A request may lower a budget but cannot exceed the configured role limit. Debugger prioritizes current diagnostics; reviewer prioritizes diff/tests; planner prioritizes task/instructions/architecture; executor prioritizes task/code/current diagnostics.

## Permission boundary

Every candidate may carry allowed roles and principals. Unauthorized candidates are omitted with an explicit reason. Cross-project artifacts and checkpoints are denied. API responses expose only relative identifiers, source type, freshness, summary/preview, token estimates, selection reasons, and receipts; they do not expose hidden reasoning, environment variables, terminal stdin, secrets, or absolute paths.

## Compaction and freshness

Compaction is deterministic and labelled. It never claims a model-generated summary. The original artifact remains addressable through its content hash and artifact identifier. Long files retain the first relevant lines, matched headings/signatures, and the final bounded segment. Old conversations retain objective/decision/result lines and the latest bounded turns. Logs decay by age and are never allowed to displace a current error solely because they are longer.

## Checkpoints and paging

A selected plan can be checkpointed in SQLite with a canonical SHA-256 receipt. Checkpoints are immutable, project-scoped, principal-audited, and page selected items with an opaque cursor and bounded limit. Repeating the same checkpoint payload is idempotent.

## UI

Context & Memory Center gains an Orchestration tab showing role budgets, selected versus omitted tokens, per-source usage, freshness, current-error priority, compaction links, permission omissions, and checkpoint pages. It remains lazy-loaded and supports reduced motion.

## Verification

Direct tests cover all eighteen Section 10 partial requirements. A dedicated `context-orchestration-governance` release gate verifies kernel source, API, UI, tests, audit evidence, source packaging, and Full Release Matrix integration.
