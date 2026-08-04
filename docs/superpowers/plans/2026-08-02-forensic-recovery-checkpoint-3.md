# Forensic Recovery Checkpoint 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans with test-driven development and verification-before-completion.

**Goal:** Close the remaining UI/Audit assertion gaps, reconstruct assertion-level truth across the full Master Acceptance Ledger, and deliver the first real trainable/inferable repository-local specialist model artifact with held-out benchmark and fail-closed promotion.

**Architecture:** Evidence reconstruction remains separate from capability claims. A full-ledger auditor parses named tests and assertions, reports exact blockers, and never upgrades entries from file existence. The small-model runtime uses a deterministic hashed-feature multiclass linear model trained from public state/action/effect examples; model artifacts are content-addressed, replayable, independently benchmarked on a disjoint held-out split, and promoted only through a signed local receipt. No LLM or frontier parity claim is implied.

**Tech Stack:** Node.js 22 ESM, Node test runner, SHA-256 canonical receipts, JSONL datasets, deterministic linear softmax/perceptron training, existing Nolane release matrix.

## Global Constraints

- Canonical NolaneNative source remains unavailable; all NolaneNative function-level parity claims stay false.
- Model artifacts may prove only bounded specialist behavior, never general coding intelligence or model superiority.
- Hidden chain-of-thought is never collected; datasets contain public typed state, action and observed effect only.
- Training and benchmark splits must be repository/task disjoint where configured and deterministic from a recorded seed.
- Promotion requires held-out accuracy, non-worse safety, immutable artifact hash and explicit approval receipt.
- Full-ledger evidence audit is read-only with respect to requirement status.
- Matrix verification is read-only; generators run before the release commit.

---

### Task 1: Close the Three UI/Audit Assertion Gaps

**Files:**
- Modify: `tests/content-ingress-agent-loop.test.mjs`
- Create: `src/release/non-claim-manifest.mjs`
- Create: `tests/release-non-claim-manifest.test.mjs`
- Modify: `requirements/nolane-agent-v5-requirements.json` through the official generator inputs
- Modify: `tests/ui-v3-session-sidebar.test.mjs`

**Deliverable:** `NOL-AUDIT-002`, `NOL-AUDIT-016`, and `NOL-UI-006` each have a non-document production entrypoint, named positive behavior, named negative behavior, and fresh SHA-bound evidence.

### Task 2: Full Master Ledger Assertion Audit

**Files:**
- Create: `src/forensics/test-assertion-index.mjs`
- Create: `src/forensics/master-ledger-assertion-audit.mjs`
- Create: `scripts/generate-master-ledger-assertion-audit.mjs`
- Create: `tests/forensic-test-assertion-index.test.mjs`
- Create: `tests/forensic-master-ledger-assertion-audit.test.mjs`

**Deliverable:** All 1,460 canonical requirements receive an explicit assertion status and blocker list; documentation entrypoints, stale hashes, unnamed tests, missing positive/negative assertions and over-broad evidence are reported separately.

### Task 3: Verified Micro-Trajectory Dataset

**Files:**
- Create: `src/small-model/verified-dataset.mjs`
- Create: `src/small-model/bootstrap-tool-routing-dataset.mjs`
- Create: `tests/small-model-verified-dataset.test.mjs`

**Interfaces:**
- `createVerifiedExample(input)`
- `buildDeterministicSplit({ examples, seed, heldOutRatio, disjointBy })`
- `buildBootstrapToolRoutingDataset({ root })`

**Deliverable:** Public state/action/effect examples with verifier receipts, deterministic train/validation/held-out splits, no hidden reasoning fields, and no overlap across configured groups.

### Task 4: Real Specialist Model Trainer and Artifact Format

**Files:**
- Create: `src/small-model/hashed-feature-encoder.mjs`
- Create: `src/small-model/linear-policy-trainer.mjs`
- Create: `src/small-model/model-artifact.mjs`
- Create: `tests/small-model-linear-policy-trainer.test.mjs`
- Create: `tests/small-model-model-artifact.test.mjs`

**Interfaces:**
- `encodeState(state, { dimensions }) -> Float64Array`
- `trainLinearPolicy({ examples, labels, dimensions, epochs, learningRate, seed })`
- `createModelArtifact({ model, datasetReceiptSha256, trainingConfig })`
- `loadModelArtifact(bytes)`

**Deliverable:** Deterministic, content-addressed weights produced by actual optimization and round-trippable without external dependencies.

### Task 5: Inference, Evaluation, Promotion, and Rollback

**Files:**
- Create: `src/small-model/linear-policy-runtime.mjs`
- Create: `src/small-model/model-artifact-registry.mjs`
- Create: `src/small-model/specialist-evaluation.mjs`
- Create: `tests/small-model-linear-policy-runtime.test.mjs`
- Create: `tests/small-model-model-artifact-registry.test.mjs`

**Deliverable:** Top-k inference with confidence/abstention, held-out evaluation, fail-closed promotion, explicit approval, immutable history and rollback.

### Task 6: Foundation and Authenticated HTTP Wiring

**Files:**
- Modify: `src/small-model/foundation-service.mjs`
- Modify: `src/server/routes.mjs`
- Modify: `tests/small-model-foundation-http.test.mjs`
- Create: `tests/small-model-trained-artifact-foundation.test.mjs`

**Deliverable:** Training, inference, evaluation, promotion and model status are available through the existing authenticated small-model foundation boundary; status distinguishes framework-ready from trained-artifact-ready.

### Task 7: Bootstrap Artifact and Scientific Benchmark

**Files:**
- Create: `scripts/train-bootstrap-tool-router.mjs`
- Create: `scripts/verify-bootstrap-tool-router.mjs`
- Create generated: `models/tool-router/bootstrap-v1/model.json`
- Create generated: `models/tool-router/bootstrap-v1/benchmark.json`
- Create generated: `models/tool-router/bootstrap-v1/dataset-receipt.json`
- Create: `tests/small-model-bootstrap-tool-router.test.mjs`

**Deliverable:** A reproducible repository-local tool-router model artifact trained from the checked-in public dataset, with held-out metrics and bounded non-claims.

### Task 8: Checkpoint 3 Truth Gate and Release Matrix

**Files:**
- Create: `src/forensics/recovery-checkpoint-3.mjs`
- Create: `scripts/verify-forensic-recovery-checkpoint-3.mjs`
- Create: `scripts/package-forensic-recovery-checkpoint-3.mjs`
- Create: `tests/forensic-recovery-checkpoint-3.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify gate-count tests from 149 to 150.

**Deliverable:** Matrix gate requires 48/48 UI/Audit bindings, full-ledger audit receipt, a real trained specialist artifact, held-out benchmark receipt, fail-closed claim policy and unresolved NolaneNative truth.

### Task 9: Regeneration, Full Regression, Clean-Room Release

**Commands:**
- Regenerate requirement registry, evidence hashes, Master Ledger, remaining gaps, assertion bindings, full-ledger audit, symbol inventory, truth ledger, model artifact and Checkpoint 3 docs.
- Run all Node tests including packaging and serial groups.
- Run Full Release Matrix 150/150 from a clean immutable commit.
- Package source, patch, change set, evidence, model artifact, reports, manifest, checksums, Electron portable, update payload and VS Code extension.

**Acceptance:** No UI/Audit assertion gap remains; every Master Ledger item has an explicit evidence disposition; a real specialist model artifact trains and infers reproducibly; no broad AI or NolaneNative claim is unlocked; Git tree and delivery checks are clean.
