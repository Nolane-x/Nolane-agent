# Adaptive Runtime Microkernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Forge Studio 2.16.0 with low-memory profiles, system-aware shedding, lazy optional modules, event-driven SSE and optional NolaneNative packaging.

**Architecture:** `RuntimeProfileService` resolves bounded defaults. `ResourceGovernor` consumes system and process metrics. `RuntimeModuleManager` owns optional lifecycle. `DurableEventHub` bridges committed SQLite events to SSE. Packaging separates optional components.

**Tech Stack:** Node.js 22 ESM, SQLite-backed StudioStore, native `os` metrics, HTTP SSE, existing release matrix.

## Global Constraints

- No cloud service is required.
- Explicit user configuration overrides profile defaults.
- No module activation during emergency unless marked essential.
- Persist event before publishing it.
- No 250 ms database polling remains in `/events`.
- NolaneNative absence is a capability state, not a startup error.
- Every new lifecycle or release claim requires direct tests and a receipt.

---

### Task 1: Profiles and system-aware governor

**Files:**
- Create: `src/runtime/runtime-profile-service.mjs`
- Create: `src/runtime/system-resource-sampler.mjs`
- Modify: `src/config.mjs`
- Modify: `src/runtime/resource-governor.mjs`
- Test: `tests/runtime-profile-service.test.mjs`
- Test: `tests/resource-governor.test.mjs`

- [ ] Write failing tests for auto/lite/balanced/performance defaults and explicit overrides.
- [ ] Run tests and confirm failure because services/states are missing.
- [ ] Implement profile resolution and system sampler.
- [ ] Add emergency state and profile-aware policies.
- [ ] Run focused tests and commit.

### Task 2: Adaptive module lifecycle and real lazy enterprise/cloud activation

**Files:**
- Create: `src/runtime/runtime-module-manager.mjs`
- Create: `src/runtime/optional-enterprise-cloud-module.mjs`
- Modify: `src/app.mjs`
- Modify: `src/server/http-server.mjs`
- Test: `tests/runtime-module-manager.test.mjs`
- Test: `tests/adaptive-microkernel-app-wiring.test.mjs`

- [ ] Write failing tests for single-flight activation, dependency order, idle suspension, emergency denial and lazy SQLite construction.
- [ ] Implement manager and enterprise/cloud factory.
- [ ] Replace eager enterprise/cloud construction with lazy adapters.
- [ ] Verify no enterprise/cloud database files appear on core startup.
- [ ] Run focused tests and commit.

### Task 3: Event-driven SSE

**Files:**
- Create: `src/runtime/durable-event-hub.mjs`
- Modify: `src/storage/studio-store.mjs`
- Modify: `src/server/http-server.mjs`
- Test: `tests/durable-event-hub.test.mjs`
- Test: `tests/http-event-stream.test.mjs`

- [ ] Write failing tests for persist-before-publish, catch-up, immediate push, heartbeat, reconciliation and cleanup.
- [ ] Implement event hub and store publication.
- [ ] Remove 250 ms polling.
- [ ] Run focused tests and commit.

### Task 4: Renderer policy and optional NolaneNative pack

**Files:**
- Create: `ui/runtime-performance-policy.js`
- Modify: `ui/app.js`
- Modify: `ui/style.css`
- Modify: `src/nolane_native/nolane_native-vendor-service.mjs`
- Modify: `src/release/release-artifacts.mjs`
- Modify: packaging scripts as required
- Test: `tests/runtime-performance-policy.test.mjs`
- Test: `tests/nolane_native-optional-packaging.test.mjs`

- [ ] Write failing tests for profile classes and optional-pack behavior.
- [ ] Implement reduced-effects policy.
- [ ] Make NolaneNative source/archive optional in core and emit separate pack metadata.
- [ ] Run focused tests and commit.

### Task 5: Release gate, documents and full verification

**Files:**
- Create: `src/release/adaptive-microkernel-verifier.mjs`
- Create: `scripts/verify-adaptive-microkernel.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: versioned release/audit/limitation documents
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/SECURITY.md`

- [ ] Add a failing release-gate test.
- [ ] Bump all identities to 2.16.0 and update current architecture/security docs.
- [ ] Generate adversarial performance receipt and release artifacts.
- [ ] Run focused tests, full Node suite and full release matrix from gate 1.
- [ ] Export source, portable/update/VSIX, NolaneNative pack, evidence, change-set, checksums and workspace manifest.
