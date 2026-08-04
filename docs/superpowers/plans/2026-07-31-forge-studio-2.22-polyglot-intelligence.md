# Forge Studio 2.22.0 Polyglot Runtime Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit polyglot capabilities, complete LSP operations, fused static/runtime relationship evidence, source classification and architecture drift enforcement.

**Architecture:** A single lazy facade owns bounded capability, LSP, graph, runtime and sentinel services. Existing repository intelligence and Digital Twin consume normalized evidence; missing external runtimes remain explicit non-claims.

**Tech Stack:** Node.js 22 ESM, JSON-RPC/LSP, external Tree-sitter/LSP commands, SQLite-backed existing store, deterministic SHA-256 receipts, Node test runner.

## Global Constraints

- Preserve local-first operation and no mandatory network dependency.
- Keep `src/app.mjs` at or below 160 static imports and 180 constructor expressions.
- Do not store prompts, secrets or unbounded runtime payloads.
- Do not mark Tree-sitter/LSP production-operated without target runner raw evidence.
- Every graph edge requires provenance, confidence and ambiguity state.
- Use RED→GREEN tests before production code.

---

### Task 1: Language Capability Matrix and Grammar Pack Registry

**Files:** Create `src/repository/language-capability-matrix.mjs`, `src/repository/grammar-pack-registry.mjs`; test `tests/language-capability-matrix.test.mjs`, `tests/grammar-pack-registry.test.mjs`.

- [ ] Write failing tests for status honesty, version pinning and extension resolution.
- [ ] Run tests and confirm missing-module failures.
- [ ] Implement immutable capability receipts and external runtime probes.
- [ ] Run tests and commit.

### Task 2: Complete LSP Operations and Session Pool

**Files:** Create `src/repository/lsp-session-pool.mjs`; modify `src/repository/lsp-client.mjs`, `src/repository/code-intelligence-service.mjs`; test `tests/lsp-session-pool.test.mjs`, `tests/code-intelligence-v2.test.mjs`.

- [ ] Write failing tests for hover, rename, type definition, diagnostics, reuse, timeout and idle eviction.
- [ ] Run RED tests.
- [ ] Implement protocol methods and bounded pool.
- [ ] Run existing and new LSP tests; commit.

### Task 3: Source Classification and Framework Capability Probes

**Files:** Create `src/repository/source-classifier.mjs`, `src/repository/framework-capability-registry.mjs`; tests with repository fixtures.

- [ ] Write failing tests for source/test/generated/vendor/migration/lock/build/config and explicit framework unavailable states.
- [ ] Implement rules with citations and no silent framework inference.
- [ ] Verify and commit.

### Task 4: Relationship Graph Fusion

**Files:** Create `src/repository/relationship-graph-fusion-service.mjs`; modify Digital Twin service; tests.

- [ ] Write failing tests for AST/LSP/build/test/type/call edges, ambiguity and provenance.
- [ ] Implement canonical nodes/edges and deduplication.
- [ ] Verify and commit.

### Task 5: Bounded Runtime Observation Store

**Files:** Create `src/repository/runtime-observation-store.mjs`; tests.

- [ ] Write failing tests for call/exception/request/event/state/database/file/network/process observations, secret redaction and payload bounds.
- [ ] Implement append/query/expire and graph projection.
- [ ] Verify and commit.

### Task 6: Architecture Drift Sentinel

**Files:** Create `src/repository/architecture-drift-sentinel.mjs`; tests.

- [ ] Write failing tests for cycle, layer violation, duplicate logic, public boundary and generated edit findings.
- [ ] Implement deterministic rules and blocking policy.
- [ ] Verify and commit.

### Task 7: Lazy Polyglot Intelligence Plane and Runtime Wiring

**Files:** Create `src/repository/polyglot-intelligence-plane.mjs`; modify repository fabric, app/runtime status and HTTP routes minimally; integration tests.

- [ ] Write RED integration tests for lazy activation, pressure behavior and sanitized status.
- [ ] Implement facade and wiring without composition budget increase.
- [ ] Verify runtime smoke and commit.

### Task 8: Release Gate, Measurement, Audit and Packaging

**Files:** Create verifier and measurement script; update version/audit/release matrix/docs/manifests.

- [ ] Write RED verifier test.
- [ ] Produce measurement with real capability probes and synthetic repository graph/runtime fixture, with explicit boundaries.
- [ ] Update 1,150-item audit honestly.
- [ ] Run focused tests, full Node suite and Full Release Matrix.
- [ ] Build and verify source, Windows, update, VSIX, NolaneNative, evidence, change-set and checksums.
