# Nolane Nolane Proof Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a proof-carrying, adversarial, causal, and model-efficient mission control layer that extends Nolane beyond NolaneNative feature parity without making an unverified comparative claim.

**Architecture:** Four focused engines live under `src/superiority/` and are composed by a lazy `SuperiorityPlane`. `DecisionPlane`, `MissionResourceFabric`, HTTP routes, release verification, and the full release matrix provide production wiring and evidence.

**Tech Stack:** Node.js ESM, `node:test`, canonical SHA-256 receipts, existing DecisionPlane/MissionResourceFabric/HTTP architecture.

## Global Constraints

- Clean-room Nolane-owned implementation; do not copy NolaneNative source.
- No hidden reasoning, raw prompts, raw model output, secrets, or credentials in state or receipts.
- No automatic commit, deployment, model promotion, or superiority claim.
- Every production behavior starts with a failing test and ends with direct, negative, integration, and release-gate verification.

---

### Task 1: Proof-Carrying Mission Compiler

**Files:**
- Create: `src/superiority/proof-mission-compiler.mjs`
- Test: `tests/superiority-proof-mission-compiler.test.mjs`

**Interfaces:**
- Produces: `ProofMissionCompiler.compile(input)`, `recordEvidence(planId, input)`, `evaluate(planId)`, `snapshot(planId?)`.

- [ ] Write failing tests for topological claim compilation, cycle rejection, independent verifier enforcement, falsification probes, and deploy lock.
- [ ] Run the focused test and confirm failures are caused by missing implementation.
- [ ] Implement bounded proof plans and canonical receipts.
- [ ] Run the focused test to green and refactor without changing behavior.

### Task 2: Causal Repository Twin

**Files:**
- Create: `src/superiority/causal-repository-twin.mjs`
- Test: `tests/superiority-causal-repository-twin.test.mjs`

**Interfaces:**
- Produces: `registerNode`, `link`, `predictImpact`, `recordObservedOutcome`, `invalidateEvidence`, `snapshot`.

- [ ] Write failing tests for impact traversal, stale-edge exclusion, bounded confidence learning, false-positive/false-negative calibration, and no source mutation.
- [ ] Verify RED.
- [ ] Implement the graph and observed-outcome calibration.
- [ ] Verify GREEN.

### Task 3: Adversarial Solution Tournament

**Files:**
- Create: `src/superiority/adversarial-solution-tournament.mjs`
- Test: `tests/superiority-adversarial-tournament.test.mjs`

**Interfaces:**
- Produces: `open`, `registerCandidate`, `recordAttack`, `recordVerification`, `decide`, `snapshot`.

- [ ] Write failing tests for critical attack rejection, verifier independence, proof-coverage threshold, correctness-first ranking, and real-probe fallback.
- [ ] Verify RED.
- [ ] Implement tournament state and deterministic ranking.
- [ ] Verify GREEN.

### Task 4: Adaptive Model Governor

**Files:**
- Create: `src/superiority/adaptive-model-governor.mjs`
- Test: `tests/superiority-adaptive-model-governor.test.mjs`

**Interfaces:**
- Produces: `registerModel`, `route`, `recordOutcome`, `authorizePromotion`, `snapshot`.

- [ ] Write failing tests for smallest-sufficient routing, privacy constraints, high-risk independent verification, bounded calibration, and human-gated promotion.
- [ ] Verify RED.
- [ ] Implement deterministic routing and Beta-style bounded outcome updates.
- [ ] Verify GREEN.

### Task 5: Superiority Plane and Runtime Integration

**Files:**
- Create: `src/runtime/superiority-plane.mjs`
- Modify: `src/decision/decision-plane.mjs`
- Modify: `src/runtime/mission-resource-fabric.mjs`
- Test: `tests/superiority-plane-integration.test.mjs`

**Interfaces:**
- Produces lazy DecisionPlane methods for all four engines and public snapshot claims.

- [ ] Write failing integration tests for lazy loading, public snapshot privacy, mission-fabric projection, and close lifecycle.
- [ ] Verify RED.
- [ ] Implement the plane and wire it through DecisionPlane/MissionResourceFabric.
- [ ] Verify GREEN.

### Task 6: Authenticated HTTP API

**Files:**
- Modify: `src/server/routes.mjs`
- Test: `tests/superiority-http-api.test.mjs`

**Interfaces:**
- Produces authenticated `/api/superiority/*` compile, evidence, twin, tournament, routing, outcome, and snapshot routes.

- [ ] Write failing HTTP tests for authentication, valid operations, malformed input, and secret-free responses.
- [ ] Verify RED.
- [ ] Add bounded routes backed by `missionResourceFabric.decision`.
- [ ] Verify GREEN.

### Task 7: Release Gate, Measurement, Matrix, and Checkpoint

**Files:**
- Create: `src/release/nolane-proof-intelligence-verifier.mjs`
- Create: `scripts/verify-nolane-proof-intelligence.mjs`
- Create: `scripts/measure-nolane-proof-intelligence.mjs`
- Modify: `scripts/full-release-matrix.mjs`
- Modify: `tests/full-release-matrix.test.mjs`
- Create: `tests/nolane-proof-intelligence-release-gate.test.mjs`
- Create: `docs/NOLANE-PROOF-INTELLIGENCE.md`

**Interfaces:**
- Produces a deterministic measurement and required matrix gate while keeping `superiorityClaimAllowed=false`.

- [ ] Write failing release-gate and matrix tests.
- [ ] Verify RED.
- [ ] Implement measurement/verifier/docs/matrix wiring.
- [ ] Run focused tests, full Node suite, runtime smoke, eval, and full release matrix.
- [ ] Package source, change set, evidence, Windows portable, update payload, VSIX, checksums, and verification report.
