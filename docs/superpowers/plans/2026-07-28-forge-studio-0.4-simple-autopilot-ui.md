# Forge Studio 0.4 Simple Autopilot UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the engineering dashboard with an Obsidian-inspired chat-first autonomous coding experience while preserving ForgeOS governance and advanced tools behind a lazy drawer.

**Architecture:** Add a persistent conversation/run service and an activity projection layer on top of existing mission events. Start autopilot asynchronously, expose follow-up and control APIs, and rewrite the UI as a small shell with Home, Task, Preview and Review surfaces. Autonomy is a scoped policy grant, never a global permission bypass.

**Tech Stack:** Node.js 22, node:sqlite, existing ForgeOS runtime, vanilla ES modules, CSS, SSE, Monaco/xterm lazy modules, Go native launcher unchanged.

## Global Constraints

- Default UI contains no raw JSON or ForgeOS jargon.
- Workspace Autopilot permits reversible workspace-contained actions without repeated approval.
- Production deploys, credential export, destructive external actions and writes outside managed worktrees remain hard stops.
- Existing Forge Studio and ForgeOS tests must remain green.
- No CDN dependencies at runtime.
- Technical tools remain available through a lazy Advanced Drawer.

---

### Task 1: Persistent conversations and autonomy grants

**Files:**
- Modify: `src/storage/studio-store.mjs`
- Test: `tests/conversation-store.test.mjs`

**Interfaces:**
- Produces: `createMessage`, `listMessages`, `createAutonomyGrant`, `getAutonomyGrant`, `updateAutonomyGrant`.

- [ ] Write failing tests for durable messages, ordering, secret-free metadata and one active grant per project.
- [ ] Run the focused test and confirm the methods are missing.
- [ ] Add migrations and minimal store methods.
- [ ] Re-run the focused and storage tests.
- [ ] Commit.

### Task 2: Scoped autonomy policy

**Files:**
- Create: `src/security/autonomy-policy.mjs`
- Test: `tests/autonomy-policy.test.mjs`

**Interfaces:**
- Produces: `AutonomyPolicy.evaluate(action, context)` and `AUTONOMY_PROFILES`.

- [ ] Test guided, workspace-autopilot and sandbox-autopilot decisions.
- [ ] Test hard stops for external/destructive/secret actions.
- [ ] Implement deterministic policy decisions with user-facing reasons.
- [ ] Run tests and commit.

### Task 3: User activity projection

**Files:**
- Create: `src/orchestration/activity-projection.mjs`
- Test: `tests/activity-projection.test.mjs`

**Interfaces:**
- Produces: `ActivityProjection.snapshot({ missionId })` and `projectEvent(event)`.

- [ ] Test human-readable mapping for planning, routing, file edits, commands, tests, review, failure and completion.
- [ ] Test token aggregation, heartbeat and absence of raw secrets/JSON.
- [ ] Implement projection over durable events, tasks, runs and evidence.
- [ ] Run tests and commit.

### Task 4: Background run coordinator and follow-ups

**Files:**
- Create: `src/orchestration/run-coordinator.mjs`
- Modify: `src/orchestration/mission-runner.mjs`
- Test: `tests/run-coordinator.test.mjs`

**Interfaces:**
- Produces: `createRun`, `sendMessage`, `pause`, `resume`, `stop`, `retry`, `snapshot`.

- [ ] Test that run creation returns before autopilot finishes.
- [ ] Test follow-ups persist and are merged into the next safe task checkpoint.
- [ ] Test stop, resume, failure and completion status.
- [ ] Implement bounded background controllers and event emission.
- [ ] Run tests and commit.

### Task 5: Outcome-first REST APIs

**Files:**
- Modify: `src/server/routes.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/app.mjs`
- Test: `tests/simple-agent-api.test.mjs`

**Interfaces:**
- Produces: `/api/agent/runs`, `/api/agent/runs/:id`, `/messages`, `/pause`, `/resume`, `/stop`, `/retry`, `/activities`, `/autonomy`.

- [ ] Test authenticated create/read/control/follow-up flows.
- [ ] Test response redaction and immediate async start.
- [ ] Wire services into composition root and routes.
- [ ] Run HTTP regression tests and commit.

### Task 6: Obsidian-inspired shell and chat UI

**Files:**
- Replace: `ui/index.html`
- Replace: `ui/style.css`
- Replace: `ui/app.js`
- Create: `ui/icons.svg`
- Modify: `ui/workroom.js`
- Test: `tests/simple-ui.test.mjs`

**Interfaces:**
- Consumes: outcome-first APIs and existing workroom APIs.
- Produces: Home, Task, Preview, Review and Advanced Drawer surfaces.

- [ ] Test that the default DOM has one primary composer, no raw dashboard controls and accessible labels.
- [ ] Test that advanced tools are hidden and lazy.
- [ ] Build the navigation rail, conversation timeline, activity cards, inspector tabs, composer and command palette.
- [ ] Add responsive layout, keyboard shortcuts and reduced-motion handling.
- [ ] Run UI tests and commit.

### Task 7: Live activity, follow-ups and token visibility

**Files:**
- Modify: `ui/app.js`
- Modify: `ui/style.css`
- Test: `tests/simple-ui-runtime.test.mjs`

**Interfaces:**
- Consumes: SSE event stream, activity snapshots and message API.

- [ ] Test event coalescing and snapshot refresh.
- [ ] Test active model call state, elapsed time, token-by-phase and stale heartbeat warning.
- [ ] Implement live updates and safe follow-up queue.
- [ ] Run tests and commit.

### Task 8: Review, preview and rollback experience

**Files:**
- Create: `src/orchestration/review-summary.mjs`
- Modify: `src/server/routes.mjs`
- Modify: `ui/app.js`
- Test: `tests/review-summary.test.mjs`

**Interfaces:**
- Produces: review summary and reversible cleanup endpoint.

- [ ] Test concise result summaries from tasks/evidence/diff.
- [ ] Test managed-worktree rollback only.
- [ ] Add Review cards, preview target detection and rollback confirmation.
- [ ] Run tests and commit.

### Task 9: Performance and accessibility gate

**Files:**
- Modify: `tests/performance.test.mjs`
- Create: `tests/ui-accessibility.test.mjs`
- Modify: `ui/style.css`

**Interfaces:**
- Produces: load-budget and accessibility assertions.

- [ ] Test default asset size, no eager Monaco/xterm, focus order, contrast tokens and reduced motion.
- [ ] Fix failures without adding dependencies.
- [ ] Run full suite and commit.

### Task 10: Version, docs and release artifacts

**Files:**
- Modify: `package.json`
- Modify: `src/version.mjs`
- Modify: `README.md`
- Create: `docs/forge-studio-0.4-user-guide.md`
- Create: `docs/forge-studio-0.4-ui.md`
- Modify: `project-manifest.json`

**Interfaces:**
- Produces: version 0.4.0 source and Windows portable artifacts.

- [ ] Update documentation and manifests without claiming benchmark superiority.
- [ ] Run Studio, ForgeOS, Go, smoke and packaging verification.
- [ ] Build Windows portable/source archives and SHA-256 manifests.
- [ ] Commit release state.
