# World Model & Developmental Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Forge Studio 2.29.0 world-model and developmental-learning planes with bounded receipts, real verification gates, and no autonomous production mutation.

**Architecture:** Add focused modules under `src/world-model/` and `src/development/`, expose one lazy facade through `DecisionPlane`, and add two release gates plus version-aware audit transitions. Existing cognition, verification, memory, resource, and goal services remain the source of truth for execution and promotion.

**Tech Stack:** Node.js ESM, Forge canonical JSON/SHA-256 receipts, Node test runner, existing release-matrix and packaging tooling.

## Global Constraints

- No chain-of-thought, raw prompt/output, secret, or source payload storage.
- World models cannot commit files, execute commands, or write durable memory.
- Developmental policies remain shadow-only; no autonomous production promotion.
- Autotelic goals are sandbox-only and cannot delay critical mission obligations.
- `src/app.mjs` must remain at or below 160 static imports and 180 constructor expressions.
- Every production change follows RED → GREEN → regression verification.

---

### Task 1: World-model registry and foresight controller

**Files:**
- Create: `src/world-model/world-model-utils.mjs`
- Create: `src/world-model/world-model-registry.mjs`
- Create: `src/world-model/foresight-controller.mjs`
- Test: `tests/world-model-portfolio.test.mjs`

**Interfaces:**
- Produces `WorldModelRegistry.register/select/updateOutcome/snapshot`.
- Produces `ForesightController.decide` with simulation decision, horizon, rollout count, and real-probe fallback.

- [ ] Write tests for domain selection, reliability/cost trade-off, failure signatures, horizon, rollout count, and low-reliability fallback.
- [ ] Run tests and verify missing-module failure.
- [ ] Implement bounded immutable receipts.
- [ ] Run tests and verify pass.
- [ ] Commit.

### Task 2: Counterfactual simulator and simulation receipts

**Files:**
- Create: `src/world-model/counterfactual-simulator.mjs`
- Create: `src/world-model/simulation-receipt-ledger.mjs`
- Test: `tests/counterfactual-simulator.test.mjs`

**Interfaces:**
- Produces `CounterfactualSimulator.simulate/validate/snapshot`.
- Produces `SimulationReceiptLedger.record/list`.

- [ ] Write tests for no-change/partial/reuse candidates, reliability pruning, conflicting rollout provenance, blast radius, rollback feasibility, cache invalidation, decision delta, and no-commit claims.
- [ ] Verify RED.
- [ ] Implement adapter-driven bounded simulation.
- [ ] Verify GREEN and regression.
- [ ] Commit.

### Task 3: Verified self-model and tool trust

**Files:**
- Create: `src/development/verified-self-model.mjs`
- Test: `tests/verified-self-model.test.mjs`

**Interfaces:**
- Produces `VerifiedSelfModel.recordOutcome/updateToolTrust/assignResponsibility/snapshot`.

- [ ] Write tests rejecting self-declared capability and accepting only verified outcome receipts.
- [ ] Verify RED.
- [ ] Implement domain capability/limits/tool trust/responsibility with stale-evidence tracking.
- [ ] Verify GREEN.
- [ ] Commit.

### Task 4: Developmental goals and stage controller

**Files:**
- Create: `src/development/developmental-goal-engine.mjs`
- Create: `src/development/developmental-stage-controller.mjs`
- Test: `tests/developmental-learning.test.mjs`

**Interfaces:**
- Produces `DevelopmentalGoalEngine.propose/select/recordOutcome/snapshot`.
- Produces `DevelopmentalStageController.evaluateAdvance/evaluatePolicyUpdate/snapshot`.

- [ ] Write tests for learning-progress scoring, ZPD, teacher challenges, sandbox/resource/safety bounds, novelty addiction, hard constraints, metaplasticity, future-self simulation, and held-out stage advancement.
- [ ] Verify RED.
- [ ] Implement minimal bounded behavior.
- [ ] Verify GREEN.
- [ ] Commit.

### Task 5: Lazy world-development plane integration

**Files:**
- Create: `src/runtime/world-development-plane.mjs`
- Modify: `src/decision/decision-plane.mjs`
- Test: `tests/world-development-plane.test.mjs`
- Modify: lifecycle regression tests as required by the expanded contract.

**Interfaces:**
- Produces lazy wrappers for registry, simulation, self-model, goals, and stages.

- [ ] Write tests proving fast-path laziness, bounded snapshots, lifecycle close, and no direct `app.mjs` imports.
- [ ] Verify RED.
- [ ] Implement facade and DecisionPlane wrappers.
- [ ] Verify GREEN plus Decision/Cognition/Memory regressions and composition budgets.
- [ ] Commit.

### Task 6: Release gates, measurement, audit, version, and packaging

**Files:**
- Create: `scripts/measure-world-development.mjs`
- Create: `src/release/world-model-portfolio-verifier.mjs`
- Create: `src/release/developmental-agent-learning-verifier.mjs`
- Create: `scripts/verify-world-model-portfolio.mjs`
- Create: `scripts/verify-developmental-agent-learning.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `scripts/generate-frontier-feature-audit.mjs`
- Modify: release identity/version surfaces and docs for 2.29.0.
- Test: `tests/world-development-release-gates.test.mjs`

**Interfaces:**
- Produces `docs/world-development-measurement-2.29.0.json` and two mandatory release gates.

- [ ] Write failing release-gate tests.
- [ ] Verify RED.
- [ ] Implement measurement/verifiers, honest audit transitions, limitations, release notes, and version surfaces.
- [ ] Run focused gates, full Node suite, full release matrix, packaging, reconstruction, checksums, and archive verification.
- [ ] Commit release and export all changed artifacts with workspace manifest.
