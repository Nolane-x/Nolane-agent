# Adaptive Work Fabric 2.17.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one resource-aware admission and scheduling fabric for provider calls, browser actions, repository intelligence, and mutable subagent work graphs.

**Architecture:** A generic `RuntimeLeasePool` provides pressure-aware keyed admission and mission attribution. `RepositoryIntelligenceScheduler` and `SubagentOrchestrator.runAdaptiveGraph()` consume the same runtime-policy concepts while preserving their own receipts and failure semantics. App wiring exposes snapshots and closes all schedulers cleanly.

**Tech Stack:** Node.js ESM, existing `ResourceGovernor`, canonical SHA-256 receipts, Node test runner, current release-matrix and artifact tooling.

## Global Constraints

- Version target is `2.17.0`.
- Local-only; no new remote service or package dependency.
- Logical provider leases must not be described as persistent OS-process reuse.
- All queues, journals, snapshots, strings, and mutation counts are bounded.
- Emergency state rejects new provider/browser/index admissions with stable codes.
- Existing callers that do not configure the new fabric remain compatible.
- TDD red-green is required for each production component.
- Final acceptance requires a clean commit and the complete Full Release Matrix.

---

### Task 1: Runtime lease pool

**Files:**
- Create: `src/runtime/runtime-lease-pool.mjs`
- Test: `tests/runtime-lease-pool.test.mjs`

**Interfaces:**
- Consumes: `governor.snapshot()` and `governor.canAdmit(kind, usage)`.
- Produces: `RuntimeLeasePool.acquire(input)`, `run(input, fn)`, `snapshot()`, `sweep()`, and `close()`.

- [ ] Write failing tests proving FIFO order, global/per-key capacity, mission attribution, abort cleanup, emergency rejection, idle-key eviction, and bounded event receipts.
- [ ] Run `node --test tests/runtime-lease-pool.test.mjs`; expect module-not-found failure.
- [ ] Implement keyed wait queues, idempotent releases, stable error codes, policy-limit refresh, bounded journal, and SHA-256 receipts.
- [ ] Run the focused test and commit.

### Task 2: Provider and browser integration

**Files:**
- Modify: `src/providers/provider-registry.mjs`
- Modify: `src/browser/browser-agent-service.mjs`
- Modify: `src/app.mjs`
- Test: `tests/provider-runtime-pool.test.mjs`
- Test: `tests/browser-runtime-pool.test.mjs`
- Test: `tests/adaptive-work-fabric-app-wiring.test.mjs`

**Interfaces:**
- Consumes: `RuntimeLeasePool.run({ key, missionId, taskId, signal, metadata }, fn)`.
- Produces: registry providers whose `complete()` calls are admitted by provider leases and browser methods admitted by project-scoped browser leases.

- [ ] Write failing provider tests proving queued completion calls are bounded and `detect()`/auth methods remain unwrapped.
- [ ] Add optional `executionPool` to `ProviderRegistry`; store raw providers while `get()` returns a stable proxy that wraps only `complete()`.
- [ ] Write failing browser tests proving every action releases on success/failure and emergency rejects before driver execution.
- [ ] Add optional `leasePool` to `BrowserAgentService` and route open/goto/snapshot/find/click/fill/type/press/tabs/screenshot/close/status through one internal admitted runner.
- [ ] Wire provider/browser pools in `src/app.mjs`, emit durable events, expose them in runtime status, and close them during shutdown.
- [ ] Run focused tests and commit.

### Task 3: Shared repository intelligence scheduler

**Files:**
- Create: `src/repository/repository-intelligence-scheduler.mjs`
- Modify: `src/repository/adaptive-repository-intelligence.mjs`
- Modify: `src/repository/codebase-knowledge-watcher.mjs`
- Modify: `src/app.mjs`
- Test: `tests/repository-intelligence-scheduler.test.mjs`
- Test: `tests/repository-intelligence-scheduler-wiring.test.mjs`

**Interfaces:**
- Produces: `enqueue({ project, generation, priority, stages, reason, signal })`, `snapshot(projectId?)`, `cancelProject(projectId)`, and `close()`.
- Stage names are `lexical`, `semantic`, and `graph`; runners are injected functions.

- [ ] Write failing tests for priority order, generation coalescing, stale queued cancellation, semantic suspension/on-demand policy, abort, failure visibility, and bounded journal.
- [ ] Implement a bounded priority queue with shared per-project generations, stage receipts, and adaptive worker capacity.
- [ ] Modify `AdaptiveRepositoryIntelligence.index()` to delegate to the scheduler when configured and preserve its existing result schema.
- [ ] Modify `CodebaseKnowledgeWatcher` to enqueue watcher priority work rather than independently running graph indexing when a scheduler is configured.
- [ ] Wire one scheduler in `src/app.mjs`; interactive repository indexing uses `mission` priority and watcher changes use `watcher` priority.
- [ ] Run focused tests and commit.

### Task 4: Dynamic subagent graph reconciliation

**Files:**
- Modify: `src/agents/subagent-orchestrator.mjs`
- Modify: `src/agent/operating-plane-tool-gateway.mjs`
- Modify: `src/app.mjs`
- Test: `tests/subagent-adaptive-graph.test.mjs`
- Test: `tests/agent-operating-plane-adaptive-graph.test.mjs`

**Interfaces:**
- Produces: `SubagentOrchestrator.runAdaptiveGraph({ parentTask, jobs, reconcile, policy, signal })`.
- Reconciler returns `{ add?: Job[], revise?: JobPatch[], revoke?: string[], stop?: boolean, reason?: string }`.

- [ ] Write failing tests for dynamic add/revise/revoke, cycle rejection, path/symbol collision serialization, uncertainty stop, maximum attempts, adaptive concurrency, and mutation receipts.
- [ ] Implement normalized job state, ownership conflict checks, wave selection, bounded reconciler mutations, and receipt-backed stop decisions.
- [ ] Add `agent.runGraph` operating-plane schema with bounded jobs and invoke the adaptive graph only when explicitly authorized.
- [ ] Wire governor-derived concurrency and event sinks through `subagentFactory`.
- [ ] Run focused tests and commit.

### Task 5: Release gate, version, measurement, and artifacts

**Files:**
- Create: `src/release/adaptive-work-fabric-verifier.mjs`
- Create: `scripts/verify-adaptive-work-fabric.mjs`
- Create: `scripts/measure-adaptive-work-fabric.mjs`
- Create: `tests/adaptive-work-fabric-release-gate.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify version-bearing package/SDK/VSIX/release files.
- Create: `docs/RELEASE-2.17.0.md`
- Create: `docs/LIMITATIONS-2.17.0.md`
- Create: `docs/ADVERSARIAL-WEAKNESS-MATRIX-2.17.0.md`
- Create: `docs/adaptive-work-fabric-measurement-2.17.0.json`

**Interfaces:**
- Produces required release gate `adaptive-work-fabric`, receipt `release/adaptive-work-fabric-2.17.0.json`, and raw concurrency/coalescing measurement.

- [ ] Write the failing gate test and verify matrix inclusion, source wiring, direct tests, measurements, and explicit non-claims.
- [ ] Implement verifier and measurement script; measure provider max concurrency, queue delay, index coalescing, stale cancellation, and adaptive graph mutation count.
- [ ] Bump all coherent version surfaces to `2.17.0` without changing the 790-item audit counts unless checklist evidence directly changes.
- [ ] Generate project manifest, remaining-gaps report, feature audit, release notes, limitations, adversarial matrix, and verification report.
- [ ] Run focused tests, full Node suite, syntax checks, SDK/Go/ForgeOS gates, then commit.
- [ ] Run `npm run release:matrix` from a clean commit and require every gate to pass.
- [ ] Build and verify Core source, Windows Electron x64, update payload, VSIX, NolaneNative optional pack, release-evidence ZIP, and change-set ZIP.
- [ ] Verify SHA-256, `unzip -t`, fresh-source reconstruction, archive integrity, and exported workspace manifest.
