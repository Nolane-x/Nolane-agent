# Forge Studio Adaptive Work Fabric 2.17.0 Design

## Goal

Turn Forge Studio's static concurrency limits into a resource-aware work fabric that can schedule repository indexing, provider calls, browser actions, and subagent jobs under one bounded admission model. The release must improve real coordination and recovery without claiming that one-shot third-party CLIs have become persistent processes.

## Scope

Forge Studio 2.17.0 implements four cooperating components:

1. a generic runtime lease pool for provider and browser work;
2. a shared incremental repository-intelligence scheduler;
3. a dynamic subagent graph reconciler;
4. a required release gate with raw scheduling measurements and explicit non-claims.

The release does not implement hosted workers, cloud autoscaling, a universal persistent host for Codex/Claude/Gemini CLIs, or semantic conflict resolution.

## Runtime lease pool

`RuntimeLeasePool` manages keyed logical sessions with FIFO waiters, per-key and global concurrency, mission attribution, abort-safe release, idle eviction, pressure-aware admission and durable event receipts.

A lease records:

- resource kind (`provider` or `browser`);
- key (provider id or project browser session);
- mission/task attribution;
- acquired/released timestamps;
- queue delay;
- active and queued counts;
- governor state and policy limit.

Provider calls are wrapped at registry retrieval time so all model completions pass through the provider pool. Browser actions acquire a project-scoped browser lease before invoking Playwright CLI. The pool reduces uncontrolled process multiplication and exposes queue/attribution evidence. It does not claim process reuse for providers whose protocol is one-shot.

## Repository intelligence scheduler

`RepositoryIntelligenceScheduler` replaces parallel full-index fan-out with a priority queue shared by lexical, semantic, graph and relationship work.

Properties:

- content-generation keys deduplicate equivalent requests;
- newer generations cancel stale queued work;
- priorities are `interactive`, `mission`, `watcher`, `background`;
- worker count is derived from the active runtime policy;
- semantic work obeys `background`, `incremental`, `on-demand`, or `suspended` policy;
- each stage has a bounded timeout and abort signal;
- a bounded journal records queued, coalesced, started, completed, cancelled and failed stages;
- callers can await a receipt or inspect a bounded snapshot.

Interactive search may trigger on-demand semantic completion, while file-watcher changes enqueue low-priority incremental updates instead of starting an independent full rebuild.

## Dynamic subagent graph

`SubagentOrchestrator.runAdaptiveGraph()` executes a mutable work graph in waves. After each wave, a deterministic reconciler may add, revise or revoke pending jobs.

Each job may declare:

- dependencies;
- owned paths and symbols;
- exclusive tools;
- confidence and expected information gain;
- maximum attempts;
- stop conditions.

The scheduler admits only non-conflicting ready jobs up to the current resource-policy concurrency. Path/symbol collisions serialize rather than fail the whole graph. Jobs below configured confidence/information thresholds are stopped with explicit reasons. Reconciliation cannot alter completed handoffs, widen parent authority, or introduce unknown profiles. Every graph mutation and stop decision is receipt-backed.

## Data flow

1. A mission or agent requests provider, browser, index, or subagent work.
2. The work fabric reads the current governor snapshot.
3. Admission either grants a lease, queues the request, coalesces it, or rejects it during emergency.
4. Execution emits attributed lifecycle events.
5. Completion releases capacity and wakes the next eligible waiter.
6. Index and swarm subsystems persist bounded receipts that can be inspected by release verification and future telemetry learning.

## Error handling

- Abort removes queued waiters and releases active leases exactly once.
- Emergency rejects new provider/browser/index work with stable codes while existing bounded work may finish or be aborted by its caller.
- Index stage failure does not silently mark the whole repository current; the failed generation remains visible.
- Reconciler output is schema-validated and authority-intersected.
- Cycles, unknown dependencies, duplicate ids and attempts beyond limits fail closed.
- Ownership collisions produce serialization evidence, not speculative merging.

## Testing and acceptance

TDD must prove:

- FIFO fairness, per-key/global limits, mission attribution, abort cleanup and pressure transitions;
- provider and browser integration through the pool;
- index coalescing, stale cancellation, priority, semantic suspension and bounded journal;
- dynamic add/revoke/revise, collision serialization, uncertainty stop and adaptive concurrency;
- app wiring and clean shutdown;
- a required `adaptive-work-fabric` release gate;
- measured peak concurrency and coalescing reduction;
- full Node suite and Full Release Matrix from a clean commit.

## Explicit non-claims

- Logical provider sessions do not imply that one-shot CLIs reuse an operating-system process.
- Queueing and attribution do not certify OS-level CPU/RAM containment for every child process.
- Dynamic reconciliation does not prove semantic correctness of task decomposition or merges.
- Incremental scheduling does not provide full polyglot AST parity.
- Linux release evidence does not certify Windows Job Objects, WSL, macOS sandboxing, hosted PR/CI, or independent benchmark superiority.
