# Codebase Knowledge Graph 1.9.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax and every production change follows red-green TDD.

**Goal:** Build an evidence-bound persistent codebase knowledge graph that closes the 12 directly implementable partial checklist items in section 13.

**Architecture:** Add a focused SQLite graph service and portable watcher, integrate graph ranking into adaptive retrieval, expose authenticated API and lazy UI, then add a fail-closed release verifier and audit evidence. Existing lexical, semantic, LSP, and repository-map services remain separate and composable.

**Tech Stack:** Node.js ESM, node:sqlite, node:fs/promises, node:child_process/execFile, existing Forge HTTP/UI/release infrastructure.

## Global Constraints

- Never label lexical extraction as AST or Tree-sitter.
- Never read secret, binary, symlink, ignored dependency, or oversize files.
- Never use shell strings for Git.
- Every public entity/edge must have relative-path and line evidence.
- Every completed component must pass the entire Full Release Matrix from gate 1.

---

### Task 1: Persistent graph and extractors

**Files:**
- Create: `src/repository/codebase-knowledge-graph-service.mjs`
- Test: `tests/codebase-knowledge-graph-service.test.mjs`

- [ ] Write failing tests for route/API/database model entities, import/reference/call/test edges, Git history, regex search, incremental hashes, and ranking breakdown.
- [ ] Run the tests and confirm missing-module failures.
- [ ] Implement schema, bounded file admission, detector-labelled extraction, Git history, regex, graph queries, and ranking.
- [ ] Run tests until green.

### Task 2: Portable watcher

**Files:**
- Create: `src/repository/codebase-knowledge-watcher.mjs`
- Extend: `tests/codebase-knowledge-graph-service.test.mjs`

- [ ] Add a failing watcher test proving changed files trigger one incremental refresh and stop prevents later refreshes.
- [ ] Implement bounded polling, debounce, start/status/stop/close.
- [ ] Run tests until green.

### Task 3: Adaptive retrieval, application, and API

**Files:**
- Modify: `src/repository/adaptive-repository-intelligence.mjs`
- Modify: `src/app.mjs`
- Modify: `src/server/routes.mjs`
- Test: `tests/codebase-knowledge-http-api.test.mjs`
- Test: `tests/codebase-knowledge-app-wiring.test.mjs`

- [ ] Write failing tests for authenticated graph snapshot/index/regex/watch endpoints and graph score breakdown in adaptive search.
- [ ] Compose service/watcher, pass graph into adaptive intelligence, add API routes, and close watcher on shutdown.
- [ ] Run tests until green.

### Task 4: Codebase Knowledge Center

**Files:**
- Create: `ui/codebase-knowledge-center.js`
- Create: `ui/codebase-knowledge-center.css`
- Modify: `ui/index.html`
- Modify: `ui/app.js`
- Test: `tests/codebase-knowledge-center-ui.test.mjs`

- [ ] Write failing UI tests for lazy loading, graph/routes/models/references/history/watcher/ranking tabs, no secret fields, and reduced-motion support.
- [ ] Implement the future-facing lazy Center using only authenticated API responses.
- [ ] Run tests until green.

### Task 5: Release gate, audit, gaps, and 1.9.0

**Files:**
- Create: `src/release/codebase-knowledge-verifier.mjs`
- Create: `scripts/verify-codebase-knowledge.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `scripts/audit-feature-checklist.mjs`
- Modify version/docs/manifest surfaces to 1.9.0
- Test: `tests/codebase-knowledge-release-gate.test.mjs`

- [ ] Write a failing release-gate test requiring service, API, UI, tests, matrix gate, and fixture evidence.
- [ ] Implement verifier and add matrix gate.
- [ ] Mark only the 12 directly evidenced section-13 partial items verified.
- [ ] Generate full audit and exhaustive Remaining Gaps report.
- [ ] Run all Node tests, coherence, syntax, and whitespace checks.
- [ ] Commit a clean tree.
- [ ] Run the entire Full Release Matrix from gate 1; fix any root cause and restart the whole matrix until all gates pass.
- [ ] Independently verify receipts, commit binding, checksums, archive contents, reconstruction, and Git cleanliness.
