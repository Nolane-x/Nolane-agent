# Nolane Agent 5.0.0-alpha.4 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development. Every promoted requirement needs one production entrypoint, one exact behavior test and fresh evidence hashes.

**Goal:** Complete the highest-ROI local-first gaps in distillation, recursive compute, symbolic solvers, plasticity, curriculum generation and Nolane-native operational boundaries, while preserving non-claims for provider-real, Windows-hardware and trained-model capabilities.

**Architecture:** New small-model subsystems are bounded ESM services under `src/small-model/` and are composed by `SmallModelFoundationService`. Nolane-native operational replacements reuse existing security/runtime contracts but add explicit product-owned facades and differential acceptance tests. Requirement promotion is generated only after exact tests pass.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, local filesystem fixtures, existing HTTP server and release matrix, no new runtime dependency.

## Global Constraints

- Never store hidden chain-of-thought; only typed public state, action, effect, scores and receipts.
- Never mark actual training, provider-real dogfooding, Windows 8 GB performance or competitor parity as verified without external evidence.
- Never import or execute NolaneNative runtime code from Nolane production paths.
- Every generated solver and mutation runs inside bounded, deterministic policy gates.
- Every student policy, solver, memory update and dataset snapshot is hash-addressed and rollback-capable.
- Keep exact source ZIP clean-room reconstruction and full release matrix mandatory.

---

### Task 1: Distillation Orchestrator and Promotion Gate

**Files:**
- Create: `src/small-model/distillation-orchestrator.mjs`
- Create: `tests/small-model-distillation-orchestrator.test.mjs`
- Modify: `src/small-model/foundation-service.mjs`

**Produces:** `DistillationOrchestrator.recordStep()`, `buildOfflineDataset()`, `recordOnPolicyStep()`, `selfConsistentAction()`, `promoteStudentPolicy()`.

- [ ] Write failing tests for oracle-required steps, hallucination/loop/effectless rejection, offline/on-policy lanes, divergence-aware supervision, multi-teacher trust, self-consistency and held-out promotion.
- [ ] Run the test and confirm expected failures.
- [ ] Implement the minimal immutable receipt-based orchestrator.
- [ ] Wire it into `SmallModelFoundationService` and snapshot.
- [ ] Run focused tests.

### Task 2: Hidden Verification and Verifier Red-Team

**Files:**
- Create: `src/small-model/hidden-verification-suite.mjs`
- Create: `src/small-model/verifier-red-team.mjs`
- Create: `tests/small-model-hidden-verification.test.mjs`
- Modify: `src/small-model/foundation-service.mjs`

**Produces:** compositional hidden test registration/execution without exposing cases, exploit probes and signed receipts.

- [ ] Write failing tests proving candidate code cannot enumerate hidden inputs and malicious verifier outputs are rejected.
- [ ] Implement read-only closures, compositional case execution, exploit taxonomy and receipt hashing.
- [ ] Run focused tests.

### Task 3: Recursive Policy Sidecar

**Files:**
- Create: `src/small-model/recursive-policy-sidecar.mjs`
- Create: `src/small-model/recursive-graph-solver-pack.mjs`
- Create: `tests/small-model-recursive-policy.test.mjs`
- Modify: `src/small-model/foundation-service.mjs`

**Produces:** fixed-size recurrent state, adaptive halting, convergence/collapse detection, dynamic depth, deterministic fallback, graph solver packs and puzzle-claim guard.

- [ ] Write failing tests for fixed memory, halting, collapse, depth routing, fallback and non-claim behavior.
- [ ] Implement deterministic loop controller and graph solvers.
- [ ] Run focused tests.

### Task 4: Symbolic Solver Compiler

**Files:**
- Create: `src/small-model/symbolic-solver-compiler.mjs`
- Create: `src/small-model/solver-sandbox.mjs`
- Create: `tests/small-model-symbolic-solver.test.mjs`
- Modify: `src/small-model/foundation-service.mjs`

**Produces:** typed DSL, verified-episode induction, bounded AST/text transformations, property generators, soundness metadata, transfer/composition gates, provenance/version/rollback, amortized value and model fallback.

- [ ] Write failing tests for each behavior.
- [ ] Implement a declarative solver format; do not execute generated source or shell commands.
- [ ] Run focused tests.

### Task 5: Plasticity and Memory Learning Plane

**Files:**
- Create: `src/small-model/plasticity-plane.mjs`
- Create: `tests/small-model-plasticity-plane.test.mjs`
- Modify: `src/small-model/foundation-service.mjs`

**Produces:** non-parametric memory reinforcement, bounded adapter deltas, KL/norm/regression gates, fast/slow consolidation, surprise/forgetting replay, transfer gate, negative-transfer rollback, shadow promotion, lineage and frozen-core policy.

- [ ] Write failing tests.
- [ ] Implement immutable snapshots and explicit promotion/rollback.
- [ ] Run focused tests.

### Task 6: Curriculum and Dataset Factory

**Files:**
- Create: `src/small-model/curriculum-factory.mjs`
- Create: `tests/small-model-curriculum-factory.test.mjs`
- Modify: `src/small-model/foundation-service.mjs`

**Produces:** real-repository environment manifests, safe mutation validation, separated roles, capability-conditioned tasks, shortest-path reduction, weakest-step scoring, repository splits, retention curriculum, safety/reward-hacking tracks, license provenance and reproducible snapshots.

- [ ] Write failing tests using temporary Gitless repositories.
- [ ] Implement filesystem-only manifests and declarative mutations.
- [ ] Run focused tests.

### Task 7: Specialist Trust, Shared Schemas and Benchmark Receipts

**Files:**
- Modify: `src/small-model/specialist-model-fabric.mjs`
- Create: `tests/small-model-specialist-alpha4.test.mjs`

**Produces:** domain-conditioned trust updates, shared typed embedding/state schema validation and independent specialist benchmark receipts.

- [ ] Write failing tests.
- [ ] Implement without claiming mmap support or multi-agent distillation.
- [ ] Run focused tests.

### Task 8: Compute Calibration

**Files:**
- Modify: `src/small-model/adaptive-compute-governor.mjs`
- Create: `tests/small-model-compute-calibration.test.mjs`

**Produces:** held-out threshold calibration receipts and rollback; does not claim same-quality benchmark completion.

- [ ] Write failing tests.
- [ ] Implement deterministic calibration over labeled held-out cases.
- [ ] Run focused tests.

### Task 9: Nolane-native Operational Replacements

**Files:**
- Create: `src/nolane-native/operational-boundary-service.mjs`
- Create: `src/release/dependency-preflight-service.mjs`
- Create: `tests/nolane-native-operational-boundaries.test.mjs`
- Create: `tests/nolane-native-differential-contract.test.mjs`
- Modify: `src/app.mjs`

**Produces:** product-owned CLI commands, configuration/migration contract, credential references, secret-safe projection, path/irreversible-action boundary, dependency diagnosis and differential behavior fixtures that never import NolaneNative runtime.

- [ ] Write failing tests for CLI/config/auth/secrets/sandbox/preflight/differential contracts.
- [ ] Implement facades over existing Nolane services.
- [ ] Wire status and routes without enabling NolaneNative execution.
- [ ] Run focused tests.

### Task 10: HTTP and Control Plane Wiring

**Files:**
- Modify: `src/small-model/foundation-service.mjs`
- Modify: `src/server/routes.mjs`
- Modify: `ui-v3/control-plane/domains.mjs`
- Create: `tests/small-model-alpha4-http.test.mjs`
- Create: `tests/ui-v3-small-model-alpha4.test.mjs`

**Produces:** authenticated endpoints for status/snapshots and safe commands, plus truthful Control Plane summaries.

- [ ] Write failing route and UI tests.
- [ ] Implement bounded JSON endpoints and non-claim copy.
- [ ] Run focused tests.

### Task 11: Requirement Ledger and Alpha.4 Identity

**Files:**
- Modify: `requirements/nolane-requirement-definitions.mjs` only if descriptions need precision.
- Modify: `scripts/generate-nolane-program.mjs`
- Modify: package/version/SDK/extension/release documentation surfaces.
- Create: `tests/nolane-alpha4-requirement-coverage.test.mjs`
- Create: `docs/RELEASE-5.0.0-alpha.4.md`
- Create: `docs/LIMITATIONS-5.0.0-alpha.4.md`

**Produces:** fresh evidence mappings and an honest remaining-gaps report.

- [ ] Add exact entrypoint/test mappings only for requirements proven by Tasks 1–10.
- [ ] Regenerate ledger and gaps.
- [ ] Verify evidence freshness/quality and version coherence.

### Task 12: Full Verification and Release Matrix

**Files:**
- Modify: `scripts/full-release-matrix.mjs` to add alpha.4 gates.
- Generate all source, Windows, update, VSIX, evidence, checksum and matrix artifacts.

- [ ] Run focused alpha.4 tests.
- [ ] Run full Node suite, runtime smoke, SDK, Go, Python and ForgeOS validation.
- [ ] Commit a clean source snapshot.
- [ ] Run the full release matrix from the clean commit.
- [ ] Verify exact source ZIP clean-room reconstruction and delivery checksums.
