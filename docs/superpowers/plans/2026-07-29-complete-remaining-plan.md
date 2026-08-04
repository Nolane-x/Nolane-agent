# Forge Studio 2.8.0 Complete Remaining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all remaining source surfaces and eliminate `not_implemented` items without manufacturing platform evidence.

**Architecture:** Reuse existing browser and credential cores, vendor a pinned Tree-sitter WASM runtime, and add explicit platform sandbox drivers behind a uniform fail-closed contract.

**Tech Stack:** Node.js 22 ESM, SQLite, Go credential helper, WebAssembly Tree-sitter, vanilla browser UI, node:test.

## Global Constraints
- No cloud service or credential is required for local features.
- No plaintext secret may appear in list/status/UI/receipt output.
- Unsupported native isolation must report unavailable, never silently degrade while claiming enforcement.
- Every audit movement requires direct source and test evidence.

### Task 1: Integrated Browser Center
- [ ] Write failing service/API/UI tests.
- [ ] Add authenticated browser session projection and lazy UI.
- [ ] Run focused tests and commit.

### Task 2: Secrets Manager
- [ ] Write failing metadata/receipt/UI tests.
- [ ] Implement service over CredentialVault and authenticated routes.
- [ ] Run focused tests and commit.

### Task 3: Tree-sitter Runtime
- [ ] Vendor pinned runtime/grammar with license and checksums.
- [ ] Write failing parse/query/incremental tests.
- [ ] Implement bounded local runtime and API/UI projection.
- [ ] Run focused tests and commit.

### Task 4: Native Sandbox Drivers
- [ ] Write contract tests for Podman, Windows Job Objects, and macOS sandbox.
- [ ] Implement capability detection and fail-closed process contracts.
- [ ] Wire capability status into Sandbox Manager.
- [ ] Run focused tests and commit.

### Task 5: Release Governance
- [ ] Add 2.8.0 verifier and matrix gate.
- [ ] Regenerate audit and remaining-gaps reports.
- [ ] Run full suite and full release matrix.
- [ ] Package, checksum, and export all changed artifacts.
