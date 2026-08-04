# Nolane Agent 5.0.0-beta.4 Native Runtime Wave 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the remaining locally implementable NolaneNative runtime behavior into five production-wired Nolane-native fabrics while preserving external gates for real providers, platforms, GUI and operating-system certification.

**Architecture:** Focused native-core modules provide bounded, typed behavior for agent messages and replay, persistent session lifecycle, tool governance, profile-scoped configuration, and OAuth/security state. `NolaneNativeOrchestrationService` exposes each module through authenticated HTTP routes and immutable status receipts. The conformance catalog maps only exact upstream behavior paths covered by direct and negative tests.

**Tech Stack:** Node.js 22+, ESM, Node test runner, JSON persistence with atomic rename, SHA-256 receipt chains, existing Nolane orchestration and HTTP server.

## Global Constraints

- Do not copy or package executable NolaneNative source.
- Write tests before implementation and observe RED for each module.
- Reject hidden reasoning and raw secrets from all persisted or returned data.
- Fail closed on invalid profile scope, stale version, unsafe URL/path, replay and OAuth state mismatch.
- Do not weaken the 160-static-import microkernel budget.
- Keep real provider/platform/Windows/GUI behavior as external certification.
- Finish with full regression, independent lanes, clean commit, full release matrix, packaging, checksum, archive scan and clean-room verification.

---

### Task 1: Agent behavior runtime
- [ ] Add RED tests for message normalization, hidden-reasoning removal, deterministic titles, error classes, one-shot timeout, independent background review and replay cleanup.
- [ ] Implement `src/native-core/agent-behavior-runtime.mjs`.
- [ ] Run direct and agent regressions.

### Task 2: Persistent session lifecycle runtime
- [ ] Add RED tests for metadata persistence, search/list, branching, rewind, input history, queue drain and safe exports.
- [ ] Implement `src/native-core/session-lifecycle-runtime.mjs` over `NolaneSessionStore`.
- [ ] Run restart and scope-isolation regressions.

### Task 3: Tool governance runtime
- [ ] Add RED tests for schema sanitization, URL/private-network rejection, ANSI stripping, diff/checkpoint receipts, output spill and result classification.
- [ ] Implement `src/native-core/tool-governance-runtime.mjs`.
- [ ] Run tool/security regressions.

### Task 4: Profile configuration and OAuth security
- [ ] Add RED tests for profile CRUD/versioning, credential references, settings migration/export, PKCE state, one-time callbacks, expiry and revocation.
- [ ] Implement `src/native-core/profile-configuration-runtime.mjs` and `src/native-core/oauth-security-runtime.mjs`.
- [ ] Run persistence/security regressions.

### Task 5: Production wiring and exact parity mapping
- [ ] Add RED tests for orchestration, authenticated HTTP routes, status snapshots and exact upstream path mapping.
- [ ] Wire the five fabrics into orchestration and routes.
- [ ] Add five release gates and update conformance catalog without broad residual promotion.

### Task 6: Beta.4 release completion
- [ ] Update canonical version surfaces and release documentation.
- [ ] Regenerate V5 registry, native conformance, Master Ledger, gaps, UI and project manifest in freeze order.
- [ ] Run full Node suite and independent runtime/eval/VSIX/Go/Python/ForgeOS lanes.
- [ ] Commit a clean tree and run the full release matrix.
- [ ] Build and verify source, Electron, update, VSIX, change-set and evidence artifacts.
