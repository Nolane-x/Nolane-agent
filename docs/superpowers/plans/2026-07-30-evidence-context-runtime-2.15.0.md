# Evidence Context Runtime 2.15.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a durable local evidence graph, five-source hybrid retrieval, structured context packets, evidence leases, lossless compaction, evidence-backed memory/subagent handoffs, and context-aware recovery.

**Architecture:** SQLite stores typed evidence nodes, relations, leases, invalidations, and audit receipts. Pluggable retrievers feed an RRF fusion layer. The resulting packet is budgeted through the existing context kernel and injected into AgentLoop as a governed reference.

**Tech Stack:** Node.js ESM, `node:sqlite`, existing repository intelligence, DynamicContextStore, ProjectMemorySidecar, ContextOrchestrationKernel, canonical SHA-256 receipts.

## Global Constraints

- Version target is `2.15.0`.
- Local-only; no new remote service or network dependency.
- No raw workspace root accepted by HTTP routes.
- No hidden reasoning or chain-of-thought persistence.
- Retrieval, graph size, packet size, and compaction size are bounded.
- All persisted records are project-scoped and receipt-backed.
- TDD red-green is required for each production component.

---

### Task 1: Durable evidence graph and leases

**Files:**
- Create: `src/context/evidence-graph-runtime-service.mjs`
- Test: `tests/evidence-graph-runtime-service.test.mjs`

**Interfaces:**
- Produces: `EvidenceGraphRuntimeService.index`, `connect`, `graph`, `invalidate`, `compact`, `proposeMemory`, `validateSubagentResult`.

- [ ] Write failing tests for typed nodes, typed edges, source provenance, idempotency, stale filtering, and four invalidation kinds.
- [ ] Run `node --test tests/evidence-graph-runtime-service.test.mjs` and verify failure because the module does not exist.
- [ ] Implement SQLite schema, canonical receipts, project/principal scope, bounded graph output, and lease invalidation.
- [ ] Add failing tests for compaction, evidence-backed memory, and structured subagent validation.
- [ ] Implement DynamicContextStore and ProjectMemorySidecar adapters.
- [ ] Run the direct test file and commit.

### Task 2: Five-source retrieval and structured packet

**Files:**
- Create: `src/context/hybrid-evidence-retrieval-service.mjs`
- Create: `src/context/context-packet-runtime-service.mjs`
- Test: `tests/hybrid-evidence-retrieval-service.test.mjs`
- Test: `tests/context-packet-runtime-service.test.mjs`

**Interfaces:**
- Produces: `decomposeEvidenceQuery`, `HybridEvidenceRetrievalService.retrieve`, `ContextPacketRuntimeService.build`, `audit`, and `recover`.

- [ ] Write failing tests for bounded decomposition and exact RRF `1/(60+rank)` fusion across five retrievers.
- [ ] Implement normalization, dedupe, freshness/runtime/graph reranking, and counter-evidence retrieval.
- [ ] Write failing packet tests for schema, leases, counter-evidence, token budget, omissions, and completion criteria.
- [ ] Implement packet construction through `ContextOrchestrationKernel`.
- [ ] Write failing recovery tests for repeated tool calls, repeated failures, stale context, no graph progress, and rejected hypotheses.
- [ ] Implement non-mutating recovery recommendations and context audit.
- [ ] Run both test files and commit.

### Task 3: Product wiring and AgentLoop integration

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/server/routes.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/agent/agent-loop.mjs`
- Modify: `src/agents/subagent-orchestrator.mjs`
- Create: `ui/evidence-runtime-center.js`
- Modify: `ui/index.html`
- Modify: `ui/app.js`
- Test: `tests/evidence-runtime-http-api.test.mjs`
- Test: `tests/evidence-runtime-app-wiring.test.mjs`
- Test: `tests/evidence-runtime-ui.test.mjs`
- Test: `tests/agent-loop-evidence-runtime.test.mjs`
- Test: `tests/subagent-structured-handoff.test.mjs`

**Interfaces:**
- Consumes: graph/retrieval/packet services.
- Produces: authenticated bounded API, lazy UI center, governed AgentLoop packet, validated structured subagent output.

- [ ] Write failing API tests proving authenticated principal override and rejection of raw workspace roots.
- [ ] Wire app retrievers to lexical, semantic, structural, runtime, and historical sources.
- [ ] Add routes and verify bounded fields.
- [ ] Write failing AgentLoop test proving packet insertion before model call.
- [ ] Add optional packet provider and structured subagent validator without breaking callers that do not configure them.
- [ ] Add lazy Evidence Runtime Center using DOM text APIs only.
- [ ] Run focused integration tests and commit.

### Task 4: Release gate and 2.15.0 artifacts

**Files:**
- Create: `src/release/evidence-context-runtime-verifier.mjs`
- Create: `scripts/verify-evidence-context-runtime.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Create: `tests/evidence-context-runtime-release-gate.test.mjs`
- Modify version and release documentation files.

**Interfaces:**
- Produces: required release gate `evidence-context-runtime` and receipt `evidence-context-runtime-2.15.0.json`.

- [ ] Write a failing release-gate test.
- [ ] Verify source, tests, APIs, AgentLoop integration, non-claims, and matrix inclusion.
- [ ] Bump runtime, SDK, VSIX, release identity, README, and documents to 2.15.0.
- [ ] Keep checklist counts unchanged unless the source checklist contains a directly matching item; do not invent audit movement.
- [ ] Run focused tests, full Node suite, version coherence, and Full Release Matrix.
- [ ] Build source, Windows Electron, update payload, VSIX, evidence, and change-set archives.
- [ ] Verify SHA-256, `unzip -t`, source reconstruction, manifest hashes, and clean Git state.
