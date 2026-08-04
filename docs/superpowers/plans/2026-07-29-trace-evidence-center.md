# Trace & Evidence Center 1.6.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a project-scoped trace and evidence plane with immutable exports and a lazy professional Control Center.

**Architecture:** A single service aggregates existing append-only Store events/evidence, derives bounded public projections, and artifactizes exports. HTTP and UI remain thin authenticated consumers.

**Tech Stack:** Node.js ESM, node:test, SQLite StudioStore, DynamicContextStore, vanilla browser modules/CSS, canonical SHA-256 receipts.

## Global Constraints

- Version target is 1.6.0.
- No raw secrets, environment values, stdin, hidden reasoning, local artifact paths, or provider prompts may cross the public boundary.
- Every public snapshot and export must have a deterministic receipt SHA-256.
- UI modules remain lazy-loaded and support reduced motion.
- Full release matrix must run from gate 1 after the clean commit.

---

### Task 1: Trace aggregation service

**Files:**
- Create: `src/operations/trace-evidence-center-service.mjs`
- Test: `tests/trace-evidence-center-service.test.mjs`

- [ ] Write failing tests for scoping, redaction, graph derivation, clustering, pagination, and export.
- [ ] Run the tests and confirm missing-module failure.
- [ ] Implement the bounded aggregation and export service.
- [ ] Run the tests and confirm pass.

### Task 2: Authenticated API and app composition

**Files:**
- Modify: `src/server/routes.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/app.mjs`
- Test: `tests/trace-evidence-center-http-api.test.mjs`
- Test: `tests/trace-evidence-center-app-wiring.test.mjs`

- [ ] Write failing API/wiring tests.
- [ ] Implement GET snapshot, GET event page, POST export, and composition.
- [ ] Run the API/wiring tests.

### Task 3: Lazy Trace & Evidence UI

**Files:**
- Create: `ui/trace-evidence-center.js`
- Create: `ui/trace-evidence-center.css`
- Modify: `ui/app.js`
- Modify: `ui/index.html`
- Test: `tests/trace-evidence-center-ui.test.mjs`

- [ ] Write failing UI contract tests.
- [ ] Implement lazy navigation, timeline, graph, clusters, claims, and export controls.
- [ ] Add futuristic visual depth and reduced-motion fallback.
- [ ] Run UI tests.

### Task 4: Release identity, audit, and full-matrix gate

**Files:**
- Modify: `config/release-identity.json`
- Modify: `src/version.mjs`
- Modify: `package.json`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `tests/full-release-matrix.test.mjs`
- Modify: audit/docs/manifests generated for 1.6.0

- [ ] Add a failing release-gate expectation.
- [ ] Add the trace/evidence governance gate.
- [ ] Update item-level audit only for directly proven features.
- [ ] Run full Node suite, regenerate manifest, and commit clean.
- [ ] Run the complete full release matrix from gate 1.
- [ ] Independently verify report receipts, commit binding, archive integrity, checksums, and Git cleanliness.
