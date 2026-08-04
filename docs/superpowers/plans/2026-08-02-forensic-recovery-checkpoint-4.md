# Forensic Recovery Checkpoint 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans with test-driven development and verification-before-completion.

**Goal:** Reduce assertion-unbound requirements with criterion-specific evidence and deliver four additional real trainable specialist models—context scorer, test selector, patch ranker, and risk classifier—wired into authenticated runtime decision support.

**Architecture:** Historical evidence aliases are migrated explicitly, not silently ignored. A requirement is assertion-verified only when at least one fresh non-document production entrypoint and one dedicated test path with named positive and negative behavior exist; stale or over-broad aliases remain visible as warnings. Specialist models reuse the deterministic typed-state linear-policy runtime, but each uses a distinct public dataset, disjoint split, artifact hash, held-out benchmark, promotion receipt, and bounded non-claim.

**Tech Stack:** Node.js 22 ESM, Node test runner, SHA-256 canonical receipts, JSON model artifacts, deterministic hashed features, multiclass softmax training, existing Nolane authenticated HTTP and release matrix.

## Global Constraints

- Canonical NolaneNative archive remains unavailable; all NolaneNative function-level parity and competitor-superiority claims stay false.
- Historical evidence path migration must be explicit and included in the audit receipt.
- Missing and over-broad evidence remains reported even when a separate dedicated path is sufficient.
- No hidden chain-of-thought or private scratchpad data may enter specialist datasets or artifacts.
- Every specialist requires deterministic train/validation/held-out splits and independent held-out evaluation.
- Model promotion requires explicit approval and rollback remains available per specialist.
- Matrix verification is read-only; generators run before the immutable release commit.

---

### Task 1: Evidence Sufficiency Policy and Historical Path Migrations

**Files:**
- Create: `src/forensics/evidence-path-migrations.mjs`
- Modify: `src/requirements/master-ledger.mjs`
- Modify: `src/forensics/master-ledger-assertion-audit.mjs`
- Create: `tests/forensic-evidence-path-migrations.test.mjs`
- Modify: `tests/forensic-master-ledger-assertion-audit.test.mjs`
- Create: `vendor/forge-os/src/context/work-unit-contexts.mjs`
- Create: `vendor/forge-os/src/execution/execution-graph.mjs`

**Deliverable:** Historical source/test paths are migrated through a canonical table; old aliases remain in warnings. A requirement may pass with one fresh production path and one dedicated positive+negative test even when other aliases are stale or shared.

### Task 2: Dedicated Compatibility Evidence Suites

**Files:**
- Create: `tests/patch-engine-read-search.test.mjs`
- Create: `tests/patch-engine-safety-write.test.mjs`
- Create: `tests/patch-engine-transaction.test.mjs`
- Create: `tests/studio-store-compatibility.test.mjs`
- Create: `tests/mission-planner-compatibility.test.mjs`
- Modify: `src/forensics/evidence-path-migrations.mjs`

**Deliverable:** The 52 historical patch-engine requirements are partitioned across three real suites below the over-broad threshold; 19 storage and 13 planner requirements receive dedicated positive and negative evidence; browser and source-as-test aliases resolve to existing real tests.

### Task 3: Generic Specialist Dataset Suite

**Files:**
- Create: `src/small-model/bootstrap-specialist-suite-dataset.mjs`
- Create: `tests/small-model-bootstrap-specialist-suite-dataset.test.mjs`

**Interfaces:**
- `buildBootstrapSpecialistDataset({ root, specialist, variants })`
- Supported specialists: `context-scorer`, `test-selector`, `patch-ranker`, `risk-classifier`.

**Deliverable:** Four distinct public typed-state/action/effect datasets with deterministic labels, scenario groups, verifier receipts, hidden-reasoning exclusion, and disjoint split compatibility.

### Task 4: Train and Verify Four Specialist Artifacts

**Files:**
- Create: `src/small-model/bootstrap-specialist-suite-training.mjs`
- Create: `scripts/train-bootstrap-specialist-suite.mjs`
- Create: `scripts/verify-bootstrap-specialist-suite.mjs`
- Create: `tests/small-model-bootstrap-specialist-suite-training.test.mjs`
- Generate: `models/specialists/*/bootstrap-v1/{model.json,benchmark.json,dataset-receipt.json}`

**Deliverable:** Four content-addressed models with real weights and decreasing loss, independent validation and held-out receipts, bounded claims, tamper rejection, and reproducible output.

### Task 5: Decision Support Runtime and Foundation Wiring

**Files:**
- Create: `src/small-model/specialist-decision-support.mjs`
- Modify: `src/small-model/foundation-service.mjs`
- Modify: `src/server/routes.mjs`
- Create: `tests/small-model-specialist-decision-support.test.mjs`
- Modify: `tests/small-model-foundation-http.test.mjs`

**Interfaces:**
- `SpecialistDecisionSupport.evaluate({ context, testing, patch, risk })`
- `SmallModelFoundationService.bootstrapSpecialistSuite(...)`
- `SmallModelFoundationService.decisionSupport(...)`
- HTTP: `POST /api/small-model/foundation/model/bootstrap-suite`
- HTTP: `POST /api/small-model/foundation/model/decision-support`
- HTTP: `GET /api/small-model/foundation/model/suite-status`

**Deliverable:** The four specialists are registered/promoted independently and can produce one fail-closed decision-support receipt through the authenticated service boundary.

### Task 6: Checkpoint 4 Truth Gate

**Files:**
- Create: `src/forensics/recovery-checkpoint-4.mjs`
- Create: `scripts/verify-forensic-recovery-checkpoint-4.mjs`
- Create: `scripts/package-forensic-recovery-checkpoint-4.mjs`
- Create: `tests/forensic-recovery-checkpoint-4.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify gate-count tests from 150 to 151.

**Deliverable:** Gate 151 requires a materially lower assertion-unbound count than Checkpoint 3, zero missing historical compatibility paths in the targeted cohort, four verified specialist artifacts, authenticated decision-support wiring, and all broad claims locked.

### Task 7: Regeneration, Full Regression, Clean-Room Release

**Commands:**
- Regenerate the Master Ledger, assertion audit, specialist suite artifacts, source custody, symbol inventory, truth ledger, remaining gaps, and Checkpoint 4 docs.
- Run focused tests, all Node tests including integration/packaging/serial groups, and Full Release Matrix 151/151 from an immutable clean commit.
- Package source, change set, patch, evidence, reports, model artifacts, Electron portable, update payload, VS Code extension, manifests, and checksums.

**Acceptance:** Assertion-unbound count falls from 614 to at most 450 without hiding warnings; four specialist models train and infer reproducibly; decision support is authenticated and fail-closed; no NolaneNative/general-intelligence/superiority claim unlocks; delivery artifacts pass checksum, archive, patch, and clean-room validation.
