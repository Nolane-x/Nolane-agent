# Local Operations & Human Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Forge Studio 2.13.0 local operations center and promote ten exact checklist items with source-and-test evidence.

**Architecture:** Add focused sanitizer and controlled-cache units, then an orchestration service that composes existing local services. Expose bounded authenticated routes and a lazy-loaded UI; finish with audit, release gate, versioning, full suite, and artifacts.

**Tech Stack:** Node.js 22 ESM, node:sqlite, existing Forge canonical receipts, browser DOM modules, node:test.

## Global Constraints

- No cloud dependency or new package download.
- Never accept workspace root, raw Git argv, raw shell command, or secret plaintext from viewer routes.
- Every state change must be principal/project scoped and receipt-bearing.
- Promote only checklist items 4.22, 4.24, 4.25, 4.32, 4.43, 4.44, 5.32, 5.33, 14.18, and 20.9.

---

### Task 1: Sanitizer and controlled cache

**Files:**
- Create: `src/security/content-sanitizer.mjs`
- Create: `src/operations/controlled-local-cache.mjs`
- Test: `tests/content-sanitizer.test.mjs`
- Test: `tests/controlled-local-cache.test.mjs`

**Interfaces:**
- Produces: `sanitizeUntrustedContent(value, options)` and `ControlledLocalCache` with `get`, `put`, `list`, `purge`, `close`.

- [ ] Write failing tests for control/bidi removal, injection markers, bounds, scope isolation, TTL, byte quota, LRU eviction, secret denial, and receipts.
- [ ] Run tests and confirm RED because modules do not exist.
- [ ] Implement minimal source.
- [ ] Run tests and confirm GREEN.
- [ ] Commit.

### Task 2: Local operations service

**Files:**
- Create: `src/operations/local-operations-center-service.mjs`
- Modify: `src/browser/image-comparison-service.mjs`
- Modify: `src/sandbox/local-resource-sandbox-service.mjs`
- Test: `tests/local-operations-center-service.test.mjs`

**Interfaces:**
- Consumes: image factory, code intelligence, Git gateway/inspector, mission state, command governance, sandbox service, controlled cache.
- Produces: `inspectImage`, `readImage`, `callGraph`, `gitHistory`, `costSummary`, `editCommandCandidate`, `takeManualControl`, `retainSandbox`, `releaseSandbox`, `cacheStatus`, `purgeCache`.

- [ ] Write failing service tests for every operation and fail-closed scope behavior.
- [ ] Verify RED.
- [ ] Implement minimal orchestration and receipts.
- [ ] Verify GREEN and existing image/sandbox tests.
- [ ] Commit.

### Task 3: API, app wiring, and UI

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/server/routes.mjs`
- Create: `ui/local-operations-center.js`
- Create: `ui/local-operations-center.css`
- Modify: `ui/index.html`
- Modify: `ui/app.js`
- Test: `tests/local-operations-http-api.test.mjs`
- Test: `tests/local-operations-app-wiring.test.mjs`
- Test: `tests/local-operations-center-ui.test.mjs`

**Interfaces:**
- Produces authenticated `/api/local-operations/*` routes and lazy-loaded `initLocalOperationsCenter`.

- [ ] Write failing API/wiring/UI tests.
- [ ] Verify RED.
- [ ] Implement bounded routes, binary response, app wiring, and six-tab UI.
- [ ] Verify GREEN plus existing HTTP UI tests.
- [ ] Commit.

### Task 4: Release evidence and Forge Studio 2.13.0

**Files:**
- Create: `src/release/local-operations-human-control-verifier.mjs`
- Create: `scripts/verify-local-operations-human-control.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `scripts/audit-feature-checklist.mjs`
- Modify version/release/docs/manifests.
- Test: `tests/local-operations-human-control-release-gate.test.mjs`
- Modify: `tests/full-release-matrix.test.mjs`
- Modify: `tests/feature-audit.test.mjs`

**Interfaces:**
- Produces `local-operations-human-control-2.13.0.json` and one required matrix gate.

- [ ] Write failing gate/audit/matrix tests.
- [ ] Verify RED.
- [ ] Add exact audit evidence, version 2.13.0, release docs, verifier, and gate.
- [ ] Run focused tests, full Node suite, and Full Release Matrix.
- [ ] Build/export source, Windows, update, VSIX, evidence, change-set, reports, checksums, and workspace manifest.
