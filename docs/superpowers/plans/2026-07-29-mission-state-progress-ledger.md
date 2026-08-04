# Mission State & Progress Ledger 2.2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a durable, server-owned mission state and real-progress projection with cost enforcement, authenticated API, professional UI, audit evidence, and release gating.

**Architecture:** A focused service aggregates existing durable stores and computes deterministic public state. Cost and progress decisions are enforced in the service, while API/UI consume only allowlisted output. No duplicate mission database is introduced.

**Tech Stack:** Node.js ESM, node:test, SQLite-backed StudioStore, dependency-free browser UI, ForgeOS canonical receipts.

## Global Constraints

- Every production behavior starts with a failing test.
- Never expose prompts, hidden reasoning, secrets, environment values, or absolute workspace paths.
- Progress requires a new evidence fingerprint; activity count alone is insufficient.
- Cost enforcement fails closed before projected spend exceeds the configured limit.
- The component is complete only after the entire Full Release Matrix passes from gate 1.

---

### Task 1: State and progress projection

**Files:**
- Create: `src/operations/mission-state-progress-service.mjs`
- Test: `tests/mission-state-progress-service.test.mjs`

**Interfaces:**
- Produces: `snapshot({ projectId, missionId, principalId })`
- Produces: `assertWithinCostLimit({ projectId, missionId, principalId, projectedCostUsd })`

- [ ] Write tests for identity, criteria, hypotheses, tests, cost, sandbox, approvals, subagents, progress, redaction, and cost denial.
- [ ] Run tests and confirm missing-module failure.
- [ ] Implement the minimal deterministic projection and receipt.
- [ ] Run tests and confirm pass.

### Task 2: Authenticated API and application wiring

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/server/routes.mjs`
- Test: `tests/mission-state-progress-http-api.test.mjs`
- Test: `tests/mission-state-progress-app-wiring.test.mjs`

**Interfaces:**
- `GET /api/mission-state-progress?projectId=&missionId=`
- `POST /api/mission-state-progress/cost-check`

- [ ] Write failing API/wiring tests.
- [ ] Bind the authenticated principal at the server.
- [ ] Compose the service from existing stores and runtime public views.
- [ ] Run API/wiring tests.

### Task 3: Mission State Center

**Files:**
- Create: `ui/mission-state-center.js`
- Create: `ui/mission-state-center.css`
- Modify: `ui/index.html`
- Modify: `ui/app.js`
- Test: `tests/mission-state-center-ui.test.mjs`

**Interfaces:**
- Lazy center loader and authenticated snapshot API.

- [ ] Write failing UI tests for every required state group.
- [ ] Implement the lazy future UI.
- [ ] Run UI tests.

### Task 4: Release gate, audit, version, and full matrix

**Files:**
- Create: `src/release/mission-state-progress-verifier.mjs`
- Create: `scripts/verify-mission-state-progress.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `scripts/audit-feature-checklist.mjs`
- Modify release identity/docs/manifest for 2.2.0.

- [ ] Write failing verifier and matrix tests.
- [ ] Implement verifier and audit rules for direct item-level evidence.
- [ ] Run focused tests and full Node suite.
- [ ] Commit a clean tree.
- [ ] Run the complete Full Release Matrix from gate 1.
- [ ] Independently verify receipts, checksums, archives, reconstruction, and Git cleanliness.
