# Mission Completion & Runtime Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Forge Studio 2.14.0 with all remaining partial checklist items verified by local source and tests.

**Architecture:** Add an architecture stage gate, mission completion orchestrator, and local container preflight service. Wire them into MissionRunner/app/HTTP, then add a release verifier, audit evidence group, versioned documentation and matrix gate.

**Tech Stack:** Node.js ESM, SQLite-backed StudioStore, Git argv processes, existing MissionRunner/Git governance/resource sandbox abstractions.

## Global Constraints

- No cloud operation claim.
- No remote PR creation or provider credential use.
- No container creation in preflight.
- All child processes use argv and `shell:false`.
- Every task must receive bounded resource metadata.
- Reasoning and execution contracts remain distinct.

---

### Task 1: Architecture stage and task governance

**Files:**
- Create: `src/orchestration/architecture-stage-gate.mjs`
- Modify: `src/orchestration/mission-runner.mjs`
- Test: `tests/architecture-stage-gate.test.mjs`
- Test: `tests/mission-runner-runtime-readiness.test.mjs`

- [ ] Write failing tests for ordered stages, source evidence, cloud-last eligibility, task limits and reasoning/execution separation.
- [ ] Run the tests and confirm missing-module/behavior failures.
- [ ] Implement the stage gate and task governance envelope.
- [ ] Run focused tests until green.

### Task 2: Mission completion workflow

**Files:**
- Create: `src/orchestration/mission-completion-orchestrator.mjs`
- Test: `tests/mission-completion-orchestrator.test.mjs`

- [ ] Write failing tests for architecture explanation, repair phases, conflict handling, security, docs, local PR review, commit permission, and independent parallel tasks.
- [ ] Run and confirm feature failures.
- [ ] Implement deterministic phase graph execution with canonical receipts.
- [ ] Run focused tests until green.

### Task 3: Local container preflight

**Files:**
- Create: `src/sandbox/local-container-preflight-service.mjs`
- Test: `tests/local-container-preflight-service.test.mjs`

- [ ] Write failing tests for Docker daemon probe, mount policy and socket escape denial.
- [ ] Run and confirm feature failures.
- [ ] Implement fail-closed preflight using argv processes.
- [ ] Run focused tests until green.

### Task 4: App and authenticated API wiring

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/server/http-server.mjs`
- Modify: `src/server/routes.mjs`
- Test: `tests/runtime-readiness-app-wiring.test.mjs`
- Test: `tests/runtime-readiness-http-api.test.mjs`

- [ ] Write failing wiring and principal-spoofing tests.
- [ ] Add bounded readiness and completion endpoints.
- [ ] Run focused tests until green.

### Task 5: Release evidence and 2.14.0

**Files:**
- Create: `src/release/mission-completion-runtime-readiness-verifier.mjs`
- Create: `scripts/verify-mission-completion-runtime-readiness.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `scripts/audit-feature-checklist.mjs`
- Modify: version identity files and release docs.
- Test: `tests/mission-completion-runtime-readiness-release-gate.test.mjs`
- Test: `tests/feature-audit.test.mjs`
- Test: `tests/full-release-matrix.test.mjs`

- [ ] Write failing release-gate and audit movement tests.
- [ ] Add verifier, evidence group and required matrix gate.
- [ ] Bump all product surfaces to 2.14.0 and regenerate audit/gaps/manifest.
- [ ] Run focused tests, full suite and Full Release Matrix.
- [ ] Export artifacts, checksums, evidence and workspace manifest.
