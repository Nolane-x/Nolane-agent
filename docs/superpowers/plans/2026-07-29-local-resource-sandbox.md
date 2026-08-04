# Local Resource Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Forge Studio 2.5.0 local terminal resource leases with CPU, RAM, process, and disk enforcement plus an authenticated Sandbox Manager.

**Architecture:** A durable `LocalResourceSandboxService` selects cgroup v2 or watchdog enforcement, attaches PTY PIDs, samples bounded process-tree/workspace usage, terminates on sustained violation, and emits canonical receipts. TerminalManager, HTTP routes, and a lazy UI consume the service without exposing arbitrary PID attachment over HTTP.

**Tech Stack:** Node.js 22 ESM, `node:sqlite`, Linux `/proc`, optional cgroup v2 files, native PTY host, vanilla browser JS/CSS, Node test runner.

## Global Constraints

- No cloud service, credential, container daemon, or registry dependency.
- Preserve all existing unsandboxed terminal APIs.
- Never claim Windows Job Objects, macOS sandbox, Podman, namespace isolation, or hard disk quotas.
- Every production behavior starts with a failing direct test.
- Full release proof must run from a clean committed tree.

---

### Task 1: Resource drivers and disk meter

**Files:**
- Create: `src/sandbox/workspace-disk-meter.mjs`
- Create: `src/sandbox/linux-proc-resource-driver.mjs`
- Create: `src/sandbox/cgroup-v2-resource-driver.mjs`
- Test: `tests/local-resource-sandbox-drivers.test.mjs`

**Interfaces:**
- Produces: `measureWorkspace(root, options)`, `LinuxProcResourceDriver.sampleTree(pid)`, `terminateTree(pid)`, `CgroupV2ResourceDriver.available()`, `createLease()`, `attach()`, `sample()`, `remove()`.

- [ ] Write failing tests for bounded workspace bytes, `/proc` tree aggregation, cgroup limit files, PID attachment, sampling, and cleanup.
- [ ] Run the direct test and confirm missing-module failure.
- [ ] Implement the minimum drivers and disk meter.
- [ ] Run the direct test and confirm pass.

### Task 2: Durable local sandbox service

**Files:**
- Create: `src/sandbox/local-resource-sandbox-service.mjs`
- Test: `tests/local-resource-sandbox-service.test.mjs`

**Interfaces:**
- Consumes: Task 1 drivers.
- Produces: `capabilities`, `createLease`, `attachProcess`, `sample`, `list`, `status`, `closeLease`, `close`.

- [ ] Write failing tests for limit validation, principal/project scope, receipts, cgroup selection, watchdog fallback, grace samples, violation termination, and close cleanup.
- [ ] Confirm tests fail because the service does not exist.
- [ ] Implement SQLite state, timers, sampling, enforcement, and receipts.
- [ ] Run tests and confirm pass.

### Task 3: TerminalManager integration

**Files:**
- Modify: `src/terminal/terminal-manager.mjs`
- Modify: `tests/terminal-manager.test.mjs`

**Interfaces:**
- Consumes: `LocalResourceSandboxService`.
- Produces: sandbox-aware `TerminalManager.create`, exit cleanup, and returned `sandboxLeaseId`.

- [ ] Add failing tests for sandbox creation/attach, missing PID rollback, exit cleanup, and termination cleanup.
- [ ] Run the terminal manager test and confirm expected failures.
- [ ] Implement minimal integration while preserving existing behavior.
- [ ] Run terminal tests and confirm pass.

### Task 4: Authenticated API and application wiring

**Files:**
- Modify: `src/server/routes.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/app.mjs`
- Create: `tests/local-resource-sandbox-http-api.test.mjs`
- Create: `tests/local-resource-sandbox-app-wiring.test.mjs`

**Interfaces:**
- Produces: capabilities/list/status/sample/close HTTP endpoints bound to `req.forgePrincipal.subject`.

- [ ] Write failing API and source-wiring tests.
- [ ] Confirm failures.
- [ ] Instantiate the service, pass it into TerminalManager and HTTP server, add routes, and close it on shutdown.
- [ ] Run the direct tests and confirm pass.

### Task 5: Sandbox Manager UI

**Files:**
- Create: `ui/sandbox-manager.js`
- Create: `ui/sandbox-manager.css`
- Modify: `ui/index.html`
- Modify: `ui/app.js`
- Create: `tests/local-resource-sandbox-center-ui.test.mjs`

**Interfaces:**
- Produces: lazy `initSandboxManager({ api, state, toast, setView })` center.

- [ ] Write a failing source-contract UI test.
- [ ] Confirm failure.
- [ ] Implement capability/lease cards, meters, sample/close actions, responsive CSS, and navigation wiring.
- [ ] Run UI tests and confirm pass.

### Task 6: Audit and release gate

**Files:**
- Create: `src/release/local-resource-sandbox-verifier.mjs`
- Create: `scripts/verify-local-resource-sandbox.mjs`
- Create: `tests/local-resource-sandbox-release-gate.test.mjs`
- Modify: `scripts/audit-feature-checklist.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `tests/feature-audit.test.mjs`
- Modify: `tests/full-release-matrix.test.mjs`

**Interfaces:**
- Produces: `forge.studio.local-resource-sandbox-verification.v1` receipt and required matrix gate.

- [ ] Write failing verifier/audit/matrix tests that require exactly items 4.31 and 18.12–18.15 to become verified while 21.4, 21.6, and 21.7 remain missing.
- [ ] Confirm RED.
- [ ] Implement verifier, audit evidence/rules, and matrix gate.
- [ ] Regenerate audit and remaining-gap reports; confirm expected counts.
- [ ] Run focused release tests and confirm pass.

### Task 7: Version, packaging, and full verification

**Files:**
- Modify all versioned metadata/docs from 2.4.0 to 2.5.0 using existing coherence tooling.
- Add release notes, limitations, verification report, manifests, and checksums through existing scripts.

**Interfaces:**
- Produces: clean committed 2.5.0 source and release archives.

- [ ] Update version identity and release documentation without widening claims.
- [ ] Run focused tests, full Node suite, syntax, smoke, and version coherence.
- [ ] Commit the clean source tree.
- [ ] Run Full Release Matrix from gate 1.
- [ ] Verify ZIP integrity and SHA-256 checksums.
