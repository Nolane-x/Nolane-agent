# Agent Modes & Autonomy Profiles 2.0.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 20 enforceable coding-agent modes and a professional Agent Modes Center.

**Architecture:** A registry defines immutable mode boundaries, a service resolves and narrows policies, RunCoordinator propagates policy into tasks, and the autonomy broker enforces it. API/UI expose safe summaries and run creation.

**Tech Stack:** Node.js ESM, node:test, Forge SQLite/event store, existing autonomy policy, vanilla JS/CSS UI.

## Global Constraints

- No mode may broaden permissions through request overrides.
- Read-only modes must be blocked at the broker boundary, not merely prompted.
- Offline mode must require a local provider and deny network.
- Background mode must require Workspace Trust.
- UI must remain lazy-loaded.
- Full Release Matrix must run from gate 1 before release status is claimed.

---

### Task 1: Mode registry and resolver

**Files:**
- Create: `src/agents/agent-mode-registry.mjs`
- Create: `src/agents/agent-mode-service.mjs`
- Test: `tests/agent-mode-service.test.mjs`

- [ ] Write failing tests for 20 definitions, immutable output, and narrowing-only overrides.
- [ ] Run the tests and verify RED.
- [ ] Implement the registry and resolver.
- [ ] Run tests and verify GREEN.

### Task 2: Runtime enforcement and propagation

**Files:**
- Modify: `src/orchestration/run-coordinator.mjs`
- Modify: `src/security/autonomy-policy.mjs`
- Modify: `src/security/autonomy-guarded-broker.mjs`
- Test: `tests/agent-mode-runtime.test.mjs`

- [ ] Write failing tests for task propagation, read-only denial, offline network denial, and receipt mode refs.
- [ ] Run the tests and verify RED.
- [ ] Implement propagation and enforcement.
- [ ] Run tests and verify GREEN.

### Task 3: API and app wiring

**Files:**
- Modify: `src/server/routes.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/app.mjs`
- Test: `tests/agent-modes-http-api.test.mjs`
- Test: `tests/agent-modes-app-wiring.test.mjs`

- [ ] Write failing authenticated API and wiring tests.
- [ ] Run the tests and verify RED.
- [ ] Add list/resolve/run endpoints and app composition.
- [ ] Run tests and verify GREEN.

### Task 4: Agent Modes Center UI

**Files:**
- Create: `ui/agent-modes-center.js`
- Create: `ui/agent-modes-center.css`
- Modify: `ui/app.js`
- Modify: `ui/index.html`
- Test: `tests/agent-modes-center-ui.test.mjs`

- [ ] Write a failing lazy-loading and behavior test.
- [ ] Run it and verify RED.
- [ ] Implement the mode matrix and run composer.
- [ ] Run it and verify GREEN.

### Task 5: Release gate, audit, and 2.0.0 identity

**Files:**
- Create: `src/release/agent-modes-verifier.mjs`
- Create: `scripts/verify-agent-modes.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `scripts/audit-feature-checklist.mjs`
- Modify: release identity and version surfaces
- Test: `tests/agent-modes-release-gate.test.mjs`

- [ ] Write a failing release verifier test.
- [ ] Run it and verify RED.
- [ ] Implement verifier, matrix gate, item-level audit evidence, and 2.0.0 version identity.
- [ ] Run focused tests, full Node suite, regenerate audit/gaps/manifest, commit cleanly.
- [ ] Run Full Release Matrix from gate 1 and verify all gates and artifacts independently.
