# Local Semantic Search & Dependency Graph 2.3.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a principal-bound local semantic search API and a dedicated dependency graph viewer, then release Forge Studio 2.3.0 with the full matrix green.

**Architecture:** A new `SemanticDependencyIntelligenceService` composes the existing semantic repository index and codebase graph, performs bounded validation/projection, and emits canonical receipts. Existing HTTP and lazy UI patterns expose the service. A dedicated release verifier promotes only checklist items 4.23 and 13.21.

**Tech Stack:** Node.js 22 ESM, built-in test runner, SQLite-backed `StudioStore`, browser-native DOM/CSS, SHA-256 canonical receipts, existing Forge Studio release matrix.

## Global Constraints

- No cloud service, external credential, hosted embedding provider, or new package dependency.
- Search previews are at most 1,200 characters.
- Dependency projections are at most 500 nodes and 2,000 edges.
- Every service operation requires an authenticated principal ID and durable project ID.
- Absolute paths, credentials, environment values, prompts, and secret-file contents must not leave the service.
- Only checklist items 4.23 and 13.21 may move to `verified_source_test` in this release.
- Run the complete Full Release Matrix from gate 1 on a clean committed tree.

---

### Task 1: Service contract and semantic search

**Files:**
- Create: `src/repository/semantic-dependency-intelligence-service.mjs`
- Create: `tests/semantic-dependency-intelligence-service.test.mjs`

**Interfaces:**
- Consumes: `StudioStore#getProject(id)`, `AdaptiveRepositoryIntelligence#index(project)`, `AdaptiveRepositoryIntelligence#search(projectId, query, options)`, `CodebaseKnowledgeGraphService#snapshot(projectId, options)`.
- Produces: `SemanticDependencyIntelligenceService#indexProject(input)`, `search(input)`, and `dependencies(input)`.

- [ ] **Step 1: Write failing tests for principal/project validation and semantic search**
- [ ] **Step 2: Run `node --test tests/semantic-dependency-intelligence-service.test.mjs` and verify missing-module failure**
- [ ] **Step 3: Implement constructor, canonical hashing, project/principal validation, `indexProject`, and bounded `search`**
- [ ] **Step 4: Re-run the focused test and verify semantic search passes**

### Task 2: Dependency projection

**Files:**
- Modify: `src/repository/semantic-dependency-intelligence-service.mjs`
- Modify: `tests/semantic-dependency-intelligence-service.test.mjs`

**Interfaces:**
- Produces: dependency graph schema `forge.semantic-dependency-graph.v1` with `nodes`, `edges`, `roots`, `leaves`, `cycles`, `focus`, and `receiptSha256`.

- [ ] **Step 1: Add failing tests for incoming/outgoing/both traversal, degree counts, roots/leaves, cycles, and bounds**
- [ ] **Step 2: Run the focused test and verify dependency assertions fail**
- [ ] **Step 3: Implement deterministic graph projection, BFS neighborhood filtering, and Tarjan strongly connected components**
- [ ] **Step 4: Run the focused test and verify all service tests pass**

### Task 3: HTTP API and application wiring

**Files:**
- Modify: `src/server/routes.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/app.mjs`
- Create: `tests/semantic-dependency-http-api.test.mjs`
- Create: `tests/semantic-dependency-app-wiring.test.mjs`

**Interfaces:**
- Produces authenticated routes `POST /api/semantic-dependency/index`, `POST /api/semantic-dependency/search`, and `GET /api/semantic-dependency/graph`.

- [ ] **Step 1: Write failing route and wiring tests**
- [ ] **Step 2: Run both focused tests and verify the service/route wiring is absent**
- [ ] **Step 3: Compose the service in `src/app.mjs` and pass it through the HTTP server to routes**
- [ ] **Step 4: Implement bounded route argument parsing and principal propagation**
- [ ] **Step 5: Run both focused tests and verify they pass**

### Task 4: Semantic and dependency UI

**Files:**
- Modify: `ui/codebase-knowledge-center.js`
- Modify: `ui/codebase-knowledge-center.css`
- Create: `tests/semantic-dependency-center-ui.test.mjs`

**Interfaces:**
- Consumes the three semantic-dependency API routes.
- Produces dedicated `Semantic Search` and `Dependencies` tabs with evidence and receipt rendering.

- [ ] **Step 1: Write a failing source-level UI contract test**
- [ ] **Step 2: Run the UI test and verify tabs/routes/topology classes are absent**
- [ ] **Step 3: Add semantic search controls/result rendering and dependency focus/topology rendering**
- [ ] **Step 4: Add responsive futuristic CSS with reduced-motion safety**
- [ ] **Step 5: Run the UI test and existing codebase center UI tests**

### Task 5: Release gate, audit, version, and reports

**Files:**
- Create: `src/release/semantic-dependency-verifier.mjs`
- Create: `scripts/verify-semantic-dependency.mjs`
- Create: `tests/semantic-dependency-release-gate.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `tests/full-release-matrix.test.mjs`
- Modify: `scripts/audit-feature-checklist.mjs`
- Modify: `src/version.mjs`
- Modify: `package.json`
- Modify: `extensions/vscode/extension/package.json`
- Modify: `extensions/vscode/extension.vsixmanifest`
- Modify: `sdk/python/pyproject.toml`
- Modify: `sdk/typescript/package.json`
- Create: `docs/RELEASE-2.3.0.md`
- Create: `docs/VERIFICATION-REPORT-2.3.0.md`
- Create: `docs/LIMITATIONS-2.3.0.md`

**Interfaces:**
- Produces required gate `local-semantic-dependency-intelligence` and version-coherent 2.3.0 release metadata.

- [ ] **Step 1: Write failing verifier, audit, and full-matrix tests**
- [ ] **Step 2: Run focused release tests and verify failures**
- [ ] **Step 3: Implement verifier and matrix gate**
- [ ] **Step 4: Add exact audit evidence and remove only the two explicit-not-implemented patterns**
- [ ] **Step 5: Bump all product and SDK versions to 2.3.0 and write release/verification/limitations docs**
- [ ] **Step 6: Run focused release tests, feature audit, and version verification**

### Task 6: Complete verification and packaging

**Files:**
- Generated/modified by release tooling: `docs/feature-audit-2.3.0.json`, `docs/FEATURE-COMPLETENESS-AUDIT-2.3.0.md`, `docs/REMAINING-GAPS-2.3.0.md`, `project-manifest.json`, `release/matrix-2.3.0/**`, release archives and checksums.

- [ ] **Step 1: Run `npm test`**
- [ ] **Step 2: Run `npm run audit:features` and verify totals become 630 verified, 91 partial, 52 external, 17 not implemented**
- [ ] **Step 3: Run `npm run verify:version`**
- [ ] **Step 4: Generate manifest and commit all source changes**
- [ ] **Step 5: Run `npm run release:matrix` from gate 1 on the clean commit**
- [ ] **Step 6: Verify all required gates pass and package source, Windows Electron, update payload, VSIX, reports, checksums, and remaining gaps**
