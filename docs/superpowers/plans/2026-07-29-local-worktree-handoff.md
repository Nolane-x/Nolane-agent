# Local Worktree Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authenticated local task handoff and VS Code worktree-opening flow for Forge Studio 2.6.0.

**Architecture:** Add a focused service above `TaskWorkspaceService`, expose only mission/task identifiers through HTTP, and consume the bounded handoff bundle in the VS Code extension. Persist the public bundle and content-addressed receipt in durable task metadata and events.

**Tech Stack:** Node.js 22 ESM, node:sqlite StudioStore, canonical SHA-256 receipts, TypeScript VS Code extension, Node test runner.

## Global Constraints

- Local-only; no cloud credentials or hosted service.
- Never accept an arbitrary filesystem path from HTTP or the extension.
- Require authenticated principal subject for every prepare operation.
- Do not execute shell commands after handoff.
- Do not change task completion status.
- Preserve all existing 2.5.0 behavior and release gates.

---

### Task 1: LocalTaskHandoffService

**Files:**
- Create: `src/execution/local-task-handoff-service.mjs`
- Test: `tests/local-task-handoff-service.test.mjs`

**Interfaces:**
- Consumes: `StudioStore`, `TaskWorkspaceService.prepare(task)`, `createEvent`, canonical SHA-256 helper.
- Produces: `prepare({ missionId, taskId, principalId })` and `get({ taskId, principalId })`.

- [ ] Write failing tests for authenticated selection, explicit task validation, managed worktree preparation, idempotent reuse, receipt hashing, persistence, and event emission.
- [ ] Run `node --test tests/local-task-handoff-service.test.mjs` and verify failure because the service module does not exist.
- [ ] Implement coded errors, deterministic task selection, path verification, immutable bundle creation, metadata persistence, and durable event append.
- [ ] Run the focused test and verify all assertions pass.
- [ ] Commit service and tests.

### Task 2: HTTP and application wiring

**Files:**
- Modify: `src/server/routes.mjs`
- Modify: `src/app.mjs`
- Create: `tests/local-task-handoff-api.test.mjs`
- Create: `tests/local-task-handoff-app-wiring.test.mjs`

**Interfaces:**
- Consumes: `LocalTaskHandoffService.prepare/get`.
- Produces: `POST /api/local-task-handoffs` and `GET /api/local-task-handoffs/:taskId`.

- [ ] Write failing route and wiring tests that require principal forwarding and reject arbitrary path fields.
- [ ] Run both tests and verify expected failures.
- [ ] Instantiate the service with the existing store/workspace service and add bounded routes.
- [ ] Run both tests and verify pass.
- [ ] Commit API and wiring changes.

### Task 3: VS Code handoff and open-worktree commands

**Files:**
- Modify: `extensions/vscode/src/client.ts`
- Modify: `extensions/vscode/src/extension.ts`
- Modify: `extensions/vscode/extension/package.json`
- Modify: `extensions/vscode/extension.vsixmanifest`
- Create: `tests/vscode-local-worktree-handoff.test.mjs`

**Interfaces:**
- Consumes: local handoff HTTP API.
- Produces: `prepareLocalHandoff`, `getLocalHandoff`, `forge.transferTaskLocal`, and `forge.openWorktree`.

- [ ] Write failing source-level and built-extension tests for API methods, command registration, URI creation, and `vscode.openFolder` without shell execution.
- [ ] Run focused tests and verify failure.
- [ ] Implement client methods, commands, package contributions, and safe validation.
- [ ] Run `npm run build:vscode` and focused tests.
- [ ] Commit extension changes.

### Task 4: Feature audit and release gate

**Files:**
- Create: `scripts/verify-local-worktree-handoff.mjs`
- Create: `tests/local-worktree-handoff-release-gate.test.mjs`
- Modify: `scripts/audit-feature-checklist.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: release identity and documentation files for 2.6.0.

**Interfaces:**
- Produces: fail-closed gate `local-worktree-handoff` and receipt `release/matrix-2.6.0/local-worktree-handoff.json`.

- [ ] Write a failing release-gate test requiring both checklist items to move to `verified_source_test` and prohibiting cloud/arbitrary-path claims.
- [ ] Run the test and verify failure.
- [ ] Add audit evidence rules, verifier, matrix gate, version identity, release notes, limitations, and verification contract.
- [ ] Regenerate feature audit and remaining gaps.
- [ ] Run focused gate, audit, version-coherence, VS Code build, and app tests.
- [ ] Commit release changes.

### Task 5: Full verification and packaging

**Files:**
- Regenerate: `project-manifest.json`, release matrix, receipts, source ZIP, Electron ZIP, update payload, VSIX, checksums.

**Interfaces:**
- Produces: complete Forge Studio 2.6.0 release artifacts and evidence.

- [ ] Run the complete Node suite and confirm every discovered file is scheduled once and exits zero.
- [ ] Run `npm run release:matrix` from gate 1 on a clean committed tree.
- [ ] Confirm every required gate passes and bind receipts to the exact commit.
- [ ] Test every ZIP/VSIX with `unzip -t` and verify SHA-256 values.
- [ ] Export only files created or changed in this response and update `project-manifest.json` statuses.
