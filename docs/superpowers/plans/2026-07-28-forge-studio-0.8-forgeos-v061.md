# Forge Studio 0.8 ForgeOS v0.6.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover the real 0.7 product source, synchronize ForgeOS v0.6.1, expose governed ForgeOS capabilities to agents, and publish a verified 0.8 source release with an honest 28-section feature audit.

**Architecture:** Forge Studio owns product orchestration and user surfaces; ForgeOS owns deterministic routing, context, review, security and execution contracts. A strict task-scoped gateway is the sole model-visible bridge, and remote execution is available only through a configured signed microVM provider plus explicit task capability.

**Tech Stack:** Node.js 22 ESM, node:test, SQLite, Electron, Go native helpers, ForgeOS v0.6.1, JSON Schema, Ed25519.

## Global Constraints

- Preserve local-first behavior and all recovered enterprise/cloud modules.
- Never claim a capability from schema or CI configuration alone.
- All model-visible tools require strict schemas and redacted receipts.
- Remote/physical/production execution requires explicit authorization.
- Candidate ForgeOS skills cannot be self-promoted.
- No secrets in source, logs, prompts, receipts or audit files.

---

### Task 1: Establish recovered baseline

**Files:**
- Modify: `package.json`
- Modify: `src/version.mjs`
- Modify: `tests/electron-packaging.test.mjs`
- Modify: `tests/packaging.test.mjs`

- [ ] Write version assertions for 0.8.0 and verify they fail.
- [ ] Set the package/runtime/launcher version to 0.8.0.
- [ ] Run the full baseline and record any genuine recovered-source failures.

### Task 2: ForgeOS v0.6.1 bridge

**Files:**
- Modify: `src/forge/forgeos-bridge.mjs`
- Create: `tests/forgeos-v061-integration.test.mjs`

- [ ] Write failing tests for universal lanes, v0.6 status, execution graph, security scan, skill intake and remote sandbox probe.
- [ ] Add the minimum bridge methods and strict input bounds.
- [ ] Run targeted tests and then the existing bridge tests.

### Task 3: Governed ForgeOS tool gateway

**Files:**
- Create: `src/forge/forgeos-tool-gateway.mjs`
- Create: `tests/forgeos-tool-gateway.test.mjs`

- [ ] Write failing schema/policy/receipt tests.
- [ ] Implement read-only tools and task-scoped remote sandbox execution.
- [ ] Verify blocked/misconfigured paths fail closed and redact inputs.

### Task 4: AgentLoop and application integration

**Files:**
- Modify: `src/agent/agent-loop.mjs`
- Modify: `src/app.mjs`
- Modify: `tests/agent-loop.test.mjs`
- Create: `tests/app-forgeos-v061-wiring.test.mjs`

- [ ] Write failing progressive-exposure and dispatch tests.
- [ ] Add `forgeGateway` to AgentLoop and dispatch before the local broker.
- [ ] Instantiate the gateway in the application and add observable events.
- [ ] Run AgentLoop and app wiring tests.

### Task 5: Diagnostic HTTP surface

**Files:**
- Modify: `src/server/routes.mjs`
- Modify: `src/server/http-server.mjs`
- Create: `tests/http-forgeos-v061.test.mjs`

- [ ] Write failing authenticated status/lanes/sandbox-probe tests.
- [ ] Add read-only routes; do not add a direct remote execution route.
- [ ] Run all HTTP tests.

### Task 6: Full checklist audit

**Files:**
- Create: `scripts/audit-feature-checklist.mjs`
- Create: `docs/feature-audit-0.8.0.json`
- Create: `docs/FEATURE-COMPLETENESS-AUDIT-0.8.0.md`
- Create: `tests/feature-audit.test.mjs`

- [ ] Parse every requirement from the supplied 28-section text.
- [ ] Require an explicit status and evidence/rationale for every item.
- [ ] Fail if any item is silently marked complete without implementation evidence.
- [ ] Publish group totals and the remaining limits.

### Task 7: Verification and release artifacts

**Files:**
- Modify: `README.md`
- Create: `docs/RELEASE-0.8.0.md`
- Modify: `project-manifest.json`
- Create: `release/ForgeStudio-0.8.0-source.zip`
- Create: `release/ForgeStudio-0.8.0-update-payload.zip`

- [ ] Run complete Node tests, syntax checks, smoke and eval.
- [ ] Run targeted vendored ForgeOS tests and Go tests.
- [ ] Generate/update the project manifest.
- [ ] Build source and update-payload archives with SHA-256 sidecars.
- [ ] Record external gates without claiming completion.
