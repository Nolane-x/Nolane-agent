# Context Orchestration Kernel 2.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an evidence-bound context policy kernel and expose its real decisions through authenticated API and the existing Context & Memory Center.

**Architecture:** A pure normalization/ranking/compaction layer produces canonical plans; SQLite persists immutable checkpoints; existing artifact/history/memory services remain the source of originals. Server routes bind project and principal, while the UI renders only allowlisted plan metadata.

**Tech Stack:** Node.js ESM, built-in SQLite, ForgeOS canonical SHA-256, dependency-free browser UI, Node test runner.

## Global Constraints

- No hidden reasoning, secret, environment value, terminal stdin, or absolute path may enter a public context plan.
- Role budgets may only be reduced per request.
- Compaction must retain an immutable reference to original content.
- Every plan and checkpoint must have a canonical receipt.
- Full Release Matrix must run from gate 1 after the component commit.

### Task 1: Kernel policy and deterministic compaction

**Files:**
- Create: `src/agent/context-orchestration-kernel.mjs`
- Test: `tests/context-orchestration-kernel.test.mjs`

**Interfaces:**
- Produces: `ContextOrchestrationKernel.plan({ projectId, principalId, role, items, budgetTokens })`.

- [ ] Write failing tests for prioritization, freshness, old-log decay, long-file/conversation compaction, token accounting, role budgets, pins, and permissions.
- [ ] Run the tests and confirm failure because the kernel is absent.
- [ ] Implement normalization, deterministic summaries, scoring, token estimates, omissions, and canonical receipts.
- [ ] Run tests and confirm pass.

### Task 2: Durable checkpoint and paging

**Files:**
- Create: `src/context/context-orchestration-service.mjs`
- Test: `tests/context-orchestration-service.test.mjs`

**Interfaces:**
- Consumes: kernel plans.
- Produces: `plan`, `checkpoint`, `getCheckpoint`, and `pageCheckpoint`.

- [ ] Write failing SQLite persistence, idempotency, project-scope, principal, and paging tests.
- [ ] Implement immutable checkpoint storage and opaque bounded cursors.
- [ ] Run tests and confirm pass.

### Task 3: Application and API wiring

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/server/routes.mjs`
- Test: `tests/context-orchestration-http-api.test.mjs`
- Test: `tests/context-orchestration-app-wiring.test.mjs`

**Interfaces:**
- Produces authenticated `/api/context-orchestration/*` routes.

- [ ] Write failing API and bootstrap tests.
- [ ] Compose the service and bind authenticated project/principal fields.
- [ ] Run tests and confirm pass.

### Task 4: Context & Memory Center orchestration UI

**Files:**
- Modify: `ui/context-memory-center.js`
- Modify: `ui/context-memory-center.css`
- Test: `tests/context-orchestration-center-ui.test.mjs`

- [ ] Write a failing test for the Orchestration tab, budgets, freshness, source tokens, checkpoints, paging, and reduced motion.
- [ ] Implement the lazy UI using authenticated APIs.
- [ ] Run tests and confirm pass.

### Task 5: Release gate, audit, and 2.1.0 artifacts

**Files:**
- Create: `src/release/context-orchestration-verifier.mjs`
- Create: `scripts/verify-context-orchestration.mjs`
- Create: `tests/context-orchestration-release-gate.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `scripts/audit-feature-checklist.mjs`
- Update: release identity, SDK/IDE versions, README, audit, Remaining Gaps, manifest, and 2.1.0 docs.

- [ ] Prove the verifier fails before source/matrix evidence exists.
- [ ] Add the release gate and direct item-level audit evidence.
- [ ] Run focused tests, then the complete Node suite.
- [ ] Commit a clean tree.
- [ ] Run the complete Full Release Matrix from gate 1 and independently verify receipts, checksums, archives, source reconstruction, and Git cleanliness.
