# Adaptive Learning & Trust Fabric Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete eleven learned-routing and developmental-learning partial requirements with a verified-only local Adaptive Learning & Trust Fabric.

**Architecture:** Add focused learning modules under `src/learning`, reuse the existing trajectory calibrator and state capsule store, expose the fabric lazily through existing runtime surfaces, then create deterministic measurement, audit transition, and release verification for 3.5.0.

**Tech Stack:** Node.js ESM, `node:test`, canonical JSON SHA-256 receipts, existing Forge Studio release/audit infrastructure.

## Global Constraints

- Learn only from outcomes carrying a valid SHA-256 verification receipt.
- Never tune on held-out task IDs.
- Never change production routing automatically.
- Never store raw prompts, chain-of-thought, hidden answers, or raw model output.
- Preserve all 3.1.0–3.4.0 verified requirement IDs and all 63 external gates.
- Keep `src/app.mjs` free of direct Adaptive Learning & Trust Fabric construction.

---

### Task 1: Task Feature Encoder and Held-Out Evaluator

**Files:**
- Create: `src/learning/task-feature-encoder.mjs`
- Create: `src/learning/held-out-policy-evaluator.mjs`
- Test: `tests/task-feature-held-out-evaluator.test.mjs`

**Interfaces:**
- Produces: `TaskFeatureEncoder.encode(input)` and `HeldOutPolicyEvaluator.evaluate(input)`.

- [ ] Write tests proving canonical feature encoding, unknown payload rejection, held-out/tuning disjointness, verified-only outcomes, critical-regression blocking, and signed deterministic reports.
- [ ] Run `node --test tests/task-feature-held-out-evaluator.test.mjs` and observe missing-module failure.
- [ ] Implement the minimum production modules.
- [ ] Re-run the test and commit.

### Task 2: Cohort Canary and Strategy Policy Learner

**Files:**
- Create: `src/learning/cohort-canary-governor.mjs`
- Create: `src/learning/strategy-policy-learner.mjs`
- Test: `tests/cohort-canary-strategy-learning.test.mjs`

**Interfaces:**
- Produces: deterministic `assign`, verified `record`, `evaluate`, strategy `recommend`, and delayed `recordPatchSurvival` methods.

- [ ] Write tests for deterministic cohort assignment, cohort-isolated metrics, automatic disable on regression, no production promotion, verified-only strategy outcomes, 7–30 day survival evidence, revert/human rewrite accounting, and premature observation rejection.
- [ ] Verify RED, implement, verify GREEN, and commit.

### Task 3: Domain Trust and Mid-Session Model Switch

**Files:**
- Create: `src/learning/domain-trust-ledger.mjs`
- Create: `src/learning/model-switch-coordinator.mjs`
- Test: `tests/domain-trust-model-switch.test.mjs`

**Interfaces:**
- Consumes: `StateCapsuleStore`.
- Produces: role-conditioned trust projections and `ModelSwitchCoordinator.switchSession(input)`.

- [ ] Write tests proving executor/reviewer/tool trust isolation, domain/task conditioning, verified-only updates, Brier accounting, capsule integrity, harness translation, capability checks, stale-state blocking, and signed switch receipts.
- [ ] Verify RED, implement, verify GREEN, and commit.

### Task 4: Trajectory and Teacher Challenge Runtime

**Files:**
- Create: `src/development/teacher-challenge-lab.mjs`
- Create: `src/learning/adaptive-learning-control-plane.mjs`
- Test: `tests/adaptive-learning-developmental-challenges.test.mjs`

**Interfaces:**
- Consumes: `TrajectoryConfidenceCalibrator` and Tasks 1–3.
- Produces: multi-turn/tool-type trajectory assessments and deterministic hidden-answer teacher challenge packages.

- [ ] Write tests for multiple turn/tool stages, weakest-link calibration, structure/surface task pairs, mutation/rename/distractor/platform/prompt-injection variants, and hidden-answer separation.
- [ ] Verify RED, implement, verify GREEN, and commit.

### Task 5: Lazy Runtime Integration

**Files:**
- Modify: `src/providers/adaptive-harness-lab.mjs`
- Modify: `src/runtime/world-development-plane.mjs`
- Test: `tests/adaptive-learning-trust-fabric-integration.test.mjs`

**Interfaces:**
- Produces: lazy `learning`/`adaptiveLearning` getters and public methods without changing existing fast-path construction.

- [ ] Write tests proving unloaded snapshots, lazy initialization, lifecycle closure, and absence of direct `src/app.mjs` construction.
- [ ] Verify RED, implement, verify GREEN, and commit.

### Task 6: Measurement, Audit, and Release Gate

**Files:**
- Create: `scripts/measure-adaptive-learning-trust-fabric.mjs`
- Create: `src/release/adaptive-learning-trust-fabric-verifier.mjs`
- Create: `scripts/verify-adaptive-learning-trust-fabric.mjs`
- Create: `tests/adaptive-learning-trust-fabric-release-gate.test.mjs`
- Modify: `scripts/generate-frontier-feature-audit.mjs`
- Modify: `src/release/frontier-audit-counts.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `package.json`
- Modify: release version and limitation documents through existing generation scripts.

**Interfaces:**
- Produces: deterministic measurement receipt, exactly eleven audit promotions, expected 3.5.0 counts, and required release gate `adaptive-learning-trust-fabric`.

- [ ] Write release test requiring measurement determinism, exact promotion set, 1028/59/63/0 counts, retention of earlier verified IDs, limitation non-claims, and matrix gate 74.
- [ ] Verify RED.
- [ ] Implement measurement/verifier/audit/version plumbing and regenerate evidence.
- [ ] Run targeted release tests, full `npm test`, and full release matrix.
- [ ] Commit only after all verification is green.
