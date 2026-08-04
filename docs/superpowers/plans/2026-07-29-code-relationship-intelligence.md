# Code Relationship Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build local inheritance and issue-to-code indexes with authenticated API, UI evidence, audit movement, and release verification.

**Architecture:** Add one SQLite-backed service over the existing codebase knowledge file index. Use the vendored TypeScript compiler AST for inheritance and bounded local Git/source parsing for issue references. Wire the service through app, routes, Codebase Knowledge Center, audit rules, and a fail-closed release gate.

**Tech Stack:** Node.js ESM, node:test, better-sqlite3 through StudioStore, vendored TypeScript 5.8.3, dependency-free browser UI.

## Global Constraints

- Local-only; no network access or provider credentials.
- JS/TS/JSX/TSX inheritance only.
- No Tree-sitter claim.
- No remote issue state claim.
- All reads are principal- and project-bound.
- Bounded results and content-addressed receipts.
- TDD: every production behavior starts with a failing test.

---

### Task 1: Relationship service

**Files:**
- Create: `src/repository/code-relationship-intelligence-service.mjs`
- Test: `tests/code-relationship-intelligence-service.test.mjs`

**Interfaces:**
- Produces: `indexProject(input)`, `inheritance(input)`, `issues(input)`.

- [ ] Write failing tests for AST declarations/heritage, alias imports, unresolved and ambiguous references, contextual issue references, commit-file issue links, bounded queries, principal/project errors, receipts, and deterministic graph hashes.
- [ ] Run the test and confirm module-not-found failure.
- [ ] Implement dedicated tables, indexers, resolvers, query contracts, and canonical receipts.
- [ ] Run the focused test and confirm all cases pass.
- [ ] Commit `feat: add local code relationship intelligence`.

### Task 2: API and application wiring

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/server/routes.mjs`
- Modify: `src/server/http-server.mjs`
- Test: `tests/code-relationship-http-api.test.mjs`
- Test: `tests/code-relationship-app-wiring.test.mjs`

**Interfaces:**
- Consumes: Task 1 service.
- Produces: three authenticated `/api/code-relationships/*` endpoints.

- [ ] Write failing API and app-wiring tests.
- [ ] Implement route validation, principal propagation, app construction, and server injection.
- [ ] Run focused tests and confirm pass.
- [ ] Commit `feat: expose code relationship intelligence API`.

### Task 3: Codebase Knowledge Center UI

**Files:**
- Modify: `ui/codebase-knowledge-center.js`
- Modify: `ui/codebase-knowledge-center.css`
- Test: `tests/code-relationship-center-ui.test.mjs`

**Interfaces:**
- Consumes: Task 2 endpoints.
- Produces: Inheritance and Issue Links tabs with evidence and receipts.

- [ ] Write failing static UI contract test.
- [ ] Add tab state, loading, filters, graph/evidence rendering, and index refresh.
- [ ] Run UI test and existing center tests.
- [ ] Commit `feat: visualize inheritance and issue links`.

### Task 4: Audit and release gate

**Files:**
- Modify: `scripts/audit-feature-checklist.mjs`
- Create: `src/release/code-relationship-verifier.mjs`
- Create: `scripts/verify-code-relationships.mjs`
- Modify: `scripts/full-release-matrix.mjs`
- Test: `tests/code-relationship-release-gate.test.mjs`
- Modify: release identity/docs for 2.7.0.

**Interfaces:**
- Produces: `release/matrix-2.7.0/code-relationship-intelligence.json` and exact audit movement for 13.15/13.19.

- [ ] Write failing release-gate tests.
- [ ] Add item-level audit evidence and fail-closed verifier.
- [ ] Add required Full Release Matrix gate and 2.7.0 documentation/non-claims.
- [ ] Regenerate audit/remaining gaps and verify only two target items move.
- [ ] Run focused release tests and commit `release: verify code relationship intelligence 2.7.0`.

### Task 5: Full verification and artifacts

**Files:**
- Modify generated manifests and release artifacts only.

- [ ] Run focused service/API/UI/release tests.
- [ ] Run full Node suite and confirm zero failures.
- [ ] Commit clean tree.
- [ ] Run Full Release Matrix from gate 1 on the clean commit.
- [ ] Validate source/electron/update/evidence/change-set/VSIX archives and SHA-256 files.
- [ ] Export only changed/generated 2.7.0 artifacts and update `project-manifest.json`.
