# Planning & Evidence Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Build a local, receipt-backed planning evidence layer and promote 16 checklist items from partial to verified source + test.

**Architecture:** Add one focused orchestration service, integrate it optionally into `MissionPlanner`, add direct tests, then add an item-level release verifier and matrix gate. Audit rules point only to the new source and tests.

**Tech Stack:** Node.js ESM, SQLite-backed `StudioStore`, `RepositoryIndex`, canonical JSON SHA-256, Node test runner.

## Global Constraints

- No network calls or external credentials.
- No caller-supplied workspace root.
- Maximum 12 enriched steps and 8 evidence items per category.
- No file contents in receipts.
- Existing `MissionPlanner` behavior remains compatible when governance is not supplied.

---

### Task 1: Planning evidence service

**Files:**
- Create: `src/orchestration/planning-evidence-governance-service.mjs`
- Test: `tests/planning-evidence-governance-service.test.mjs`

- [ ] Write failing tests for preflight, evidence classification, scope, enrichment, ambiguity, replanning, and receipts.
- [ ] Run the test and confirm failure because the service is missing.
- [ ] Implement the minimal service.
- [ ] Run the test and confirm all cases pass.
- [ ] Commit.

### Task 2: MissionPlanner integration

**Files:**
- Modify: `src/orchestration/mission-planner.mjs`
- Modify: `tests/mission-planner.test.mjs`

- [ ] Write failing integration tests for structured input requests and enriched plan metadata.
- [ ] Run tests and confirm expected failure.
- [ ] Add optional preflight/enrichment wiring and `PlanningInputRequiredError`.
- [ ] Run planner and service tests.
- [ ] Commit.

### Task 3: Release evidence and audit movement

**Files:**
- Create: `src/release/planning-evidence-governance-verifier.mjs`
- Create: `scripts/verify-planning-evidence-governance.mjs`
- Create: `tests/planning-evidence-governance-release-gate.test.mjs`
- Modify: `scripts/audit-feature-checklist.mjs`
- Modify: `tests/feature-audit.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: release identity and 2.12.0 documentation files.

- [ ] Write the failing release-gate test.
- [ ] Add verifier and matrix gate.
- [ ] Promote exactly the 16 intended checklist items.
- [ ] Regenerate audit, gaps, manifest, and version receipt.
- [ ] Run focused tests, full Node suite, and Full Release Matrix.
- [ ] Package artifacts and verify checksums/archive integrity.
