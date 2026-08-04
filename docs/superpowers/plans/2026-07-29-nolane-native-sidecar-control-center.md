# NolaneNative Sidecar & Runtime Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an MIT-compliant NolaneNative ACP sidecar and professional Runtime Control Center without weakening ForgeOS policy or audit boundaries.

**Architecture:** NolaneNative is an immutable content-addressed vendor archive. A Forge-owned service verifies and extracts it, supervises the ACP process, and exposes bounded authenticated operations. The existing vanilla desktop UI receives a new control-center view backed by those APIs.

**Tech Stack:** Node.js ESM, node:test, SQLite-backed capability ledger, Electron static UI, Python ACP sidecar, ZIP/deflate parsing using Node standard library.

## Global Constraints

- Preserve NolaneNative MIT copyright and license.
- Do not expose secrets or hidden reasoning.
- Do not use shell command strings.
- Every mutation requires capability authorization and a receipt.
- Full release matrix must run from a clean committed tree after implementation.

---

### Task 1: Vendor integrity and safe extraction

**Files:**
- Create: `vendor/nolane_native-agent/nolane_native-agent-main.zip`
- Create: `vendor/nolane_native-agent/LICENSE`
- Create: `vendor/nolane_native-agent/UPSTREAM.json`
- Create: `vendor/nolane_native-agent.manifest.json`
- Create: `src/nolane_native/nolane_native-vendor-service.mjs`
- Test: `tests/nolane_native-vendor-service.test.mjs`

**Interfaces:**
- Produces: `NolaneNativeVendorService.verify()`, `prepare()`, `capabilities()`.

- [ ] Write tests for hash verification, tamper detection, traversal rejection, safe extraction, and capability inventory.
- [ ] Run tests and confirm RED because the service is absent.
- [ ] Implement bounded ZIP parsing/extraction and provenance validation.
- [ ] Run tests and confirm GREEN.

### Task 2: Governed runtime lifecycle and HTTP API

**Files:**
- Create: `src/nolane_native/nolane_native-runtime-service.mjs`
- Modify: `src/app.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/server/routes.mjs`
- Test: `tests/nolane_native-runtime-service.test.mjs`
- Test: `tests/nolane_native-http-api.test.mjs`

**Interfaces:**
- Produces: `status`, `capabilities`, `prepare`, `check`, `start`, `stop`, `close`.

- [ ] Write lifecycle, capability-denial, readiness, and authenticated HTTP tests.
- [ ] Run tests and confirm RED.
- [ ] Implement the sidecar service and route composition.
- [ ] Run tests and confirm GREEN.

### Task 3: Runtime Control Center UI

**Files:**
- Modify: `ui/index.html`
- Modify: `ui/style.css`
- Modify: `ui/app.js`
- Test: `tests/nolane_native-control-center-ui.test.mjs`

**Interfaces:**
- Consumes: `/api/nolane_native/runtime/*`.
- Produces: accessible runtime dashboard and governed lifecycle controls.

- [ ] Write UI contract and accessibility tests.
- [ ] Run tests and confirm RED.
- [ ] Implement the new control-center navigation, cards, diagnostics, capability matrix, and controls.
- [ ] Run tests and confirm GREEN.

### Task 4: Release integration

**Files:**
- Create: `scripts/verify-nolane_native-vendor.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `scripts/generate-manifest.mjs`
- Test: `tests/full-release-matrix.test.mjs`
- Test: `tests/source-reconstruction.test.mjs`

**Interfaces:**
- Produces: required `nolane_native-vendor-integrity` release gate.

- [ ] Add failing release-gate and reconstruction tests.
- [ ] Implement vendor verification command and matrix gate.
- [ ] Regenerate project manifest, commit cleanly, run the complete full release matrix, and stop for user approval.
