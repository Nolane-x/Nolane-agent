# Git Completion Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a durable local Git completion transaction and multi-agent collision map that closes the Git/worktree governance checklist cluster with direct source and test evidence.

**Architecture:** Add one focused service that composes `GitGateway`, `GitInspector`, and `DiffReviewService`, persists immutable receipts in SQLite, exposes authenticated APIs, and renders a read-only Git Governance Center. Low-level Git execution remains argv-only and bounded.

**Tech Stack:** Node.js 22 ESM, `node:sqlite`, Git CLI via `execFile`, existing Forge Studio store/event protocol, vanilla browser UI, Node test runner.

## Global Constraints

- Product version becomes `2.9.0` only after behavior tests are green.
- No shell command strings.
- No arbitrary workspace root or Git argv accepted over HTTP.
- Final commits require passing test evidence and explicit residual-risk evidence.
- Secret or artifact findings fail closed.
- Conflict detection must not mutate candidate worktrees.
- Remote push/PR creation remains outside this release.

---

### Task 1: Git completion transaction

**Files:**
- Create: `src/repository/git-completion-governance-service.mjs`
- Test: `tests/git-completion-governance-service.test.mjs`

**Interfaces:**
- Produces: `checkpoint(input)`, `commit(input)`, `listTaskCompletions(input)`, `collisionMap(input)`, `getMissionCollisionMap(input)`.

- [ ] Write failing tests for path selection, secret/artifact exclusion, expected HEAD, message policy, test/risk evidence, idempotency, remotes, persistence, and receipts.
- [ ] Run the direct test and verify failure because the service is absent.
- [ ] Implement the minimal durable service and rerun until green.
- [ ] Commit the task.

### Task 2: Multi-agent collision and review gating

**Files:**
- Modify: `src/repository/git-completion-governance-service.mjs`
- Modify: `src/execution/worktree-integration-service.mjs`
- Test: `tests/git-completion-governance-service.test.mjs`
- Test: `tests/worktree-integration-service.test.mjs`

**Interfaces:**
- Consumes: `collisionMap({ missionId, principal })`.
- Produces: integration preflight receipt with overlap, merge-tree conflict, and diff-review readiness.

- [ ] Write failing tests for duplicate-file detection, pairwise merge-tree conflicts, pending/rejected review gates, and integration denial.
- [ ] Run tests and verify expected failures.
- [ ] Implement non-mutating conflict analysis and integration preflight.
- [ ] Run tests and commit.

### Task 3: Authenticated API and Git Governance Center

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/server/routes.mjs`
- Create: `ui/git-governance-center.js`
- Create: `ui/git-governance-center.css`
- Modify: `ui/index.html`
- Modify: `ui/app.js`
- Test: `tests/git-governance-http-api.test.mjs`
- Test: `tests/git-governance-center-ui.test.mjs`
- Test: `tests/app-git-governance-wiring.test.mjs`

**Interfaces:**
- Produces authenticated project/task/mission-scoped endpoints and lazy-loaded read-only UI.

- [ ] Write failing API, wiring, and UI tests.
- [ ] Implement routes and UI without raw Git or workspace-root inputs.
- [ ] Run tests and commit.

### Task 4: Release gate, audit movement, and packaging

**Files:**
- Create: `src/release/git-completion-governance-verifier.mjs`
- Create: `scripts/verify-git-completion-governance.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `scripts/audit-feature-checklist.mjs`
- Modify versioned release/documentation files for `2.9.0`
- Test: `tests/git-completion-governance-release-gate.test.mjs`
- Test: `tests/full-release-matrix.test.mjs`
- Test: `tests/feature-audit.test.mjs`

**Interfaces:**
- Produces exact audit movement and a fail-closed required release gate.

- [ ] Write failing release-gate and audit tests.
- [ ] Add verifier and matrix gate.
- [ ] Move only the explicitly proven Git/worktree items to `verified_source_test`.
- [ ] Regenerate audit, gaps, manifests, and release docs.
- [ ] Run focused tests, full suite, and full release matrix from gate 1.
- [ ] Export source, Windows, update, VSIX, evidence, change-set, checksums, and manifests.
