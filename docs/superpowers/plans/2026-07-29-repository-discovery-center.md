# Repository Discovery & Architecture Intelligence Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an evidence-backed repository discovery service and professional UI that closes the section 11 partial requirements without exposing secrets or inventing conclusions.

**Architecture:** A bounded detector reads selected repository manifests/configuration files, normalizes findings with path/line/hash evidence, and exposes a project-scoped immutable snapshot. The application composes it into an authenticated API and lazy-loaded UI; a dedicated release gate verifies behavior and packaging.

**Tech Stack:** Node.js ESM, built-in fs/crypto/child_process, Forge Studio HTTP server, vanilla browser modules/CSS, Node test runner.

## Global Constraints

- Version target: 1.7.0.
- No shell strings; Git uses fixed argv.
- No new runtime dependency.
- Never read or return known secret files or environment values.
- No detected finding without evidence.
- Full release matrix must pass from gate 1 before completion.

---

### Task 1: Evidence-backed discovery service

**Files:**
- Create: `src/repository/repository-discovery-service.mjs`
- Test: `tests/repository-discovery-service.test.mjs`

**Interfaces:**
- Consumes: `store.getProject(projectId)`.
- Produces: `RepositoryDiscoveryService.snapshot({ projectId, principalId, refresh })`.

- [ ] Write failing tests for a representative polyglot monorepo, unknown findings, Git cleanliness, line/hash evidence, and secret exclusion.
- [ ] Run the test and confirm module-not-found failure.
- [ ] Implement bounded detectors and immutable receipt.
- [ ] Run tests and confirm all service tests pass.

### Task 2: Authenticated API and application wiring

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/server/routes.mjs`
- Test: `tests/repository-discovery-http-api.test.mjs`
- Test: `tests/repository-discovery-app-wiring.test.mjs`

**Interfaces:**
- Produces: `GET /api/repository-discovery?projectId=...` and `POST /api/repository-discovery/refresh`.

- [ ] Write failing API and static wiring tests.
- [ ] Confirm failures are caused by missing service wiring/routes.
- [ ] Compose the service and add authenticated project-scoped routes.
- [ ] Run API and wiring tests.

### Task 3: Repository Intelligence Center UI

**Files:**
- Create: `ui/repository-intelligence-center.js`
- Create: `ui/repository-intelligence-center.css`
- Modify: `ui/app.js`
- Modify: `ui/index.html`
- Test: `tests/repository-intelligence-center-ui.test.mjs`

**Interfaces:**
- Consumes: discovery snapshot API.
- Produces: lazy read-only center with overview, architecture, tooling, commands, evidence, risks, and unknowns.

- [ ] Write failing UI surface/lazy-loading tests.
- [ ] Implement the browser module and futuristic visual system.
- [ ] Run UI tests and existing performance/lazy tests.

### Task 4: Release gate, audit, version, and documentation

**Files:**
- Create: `scripts/verify-repository-discovery.mjs`
- Modify: `scripts/full-release-matrix.mjs`
- Modify: release identity/version surfaces and audit evidence mappings.
- Create: `docs/RELEASE-1.7.0.md`
- Create: `docs/REMAINING-GAPS-1.7.0.md`
- Test: `tests/repository-discovery-release-gate.test.mjs`

**Interfaces:**
- Produces: mandatory `repository-discovery-intelligence` release gate and explicit remaining-gaps report.

- [ ] Write a failing test that requires the new gate and report in source artifacts.
- [ ] Add verifier and matrix gate.
- [ ] Update item-level audit only for direct evidence.
- [ ] Generate remaining-gaps report from audit JSON, including every partial/external/missing item with reason and completion condition.
- [ ] Run targeted tests, full Node suite, commit clean tree, then run the entire full release matrix from gate 1.
