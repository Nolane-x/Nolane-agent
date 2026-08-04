# Forensic Recovery Checkpoint 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build project-disjoint long-horizon mission trajectories, process rewards, transferable declarative skills, and transfer-governed specialist promotion while preserving all forensic non-claims.

**Architecture:** Three tracked held-out project packs are copied into isolated workspaces and executed as baseline–mutation–repair missions. Public step receipts feed a process-reward specialist and skill compiler. Promotion v3 requires ablation, transfer, process, cost, safety, lineage, and explicit approval before runtime activation.

**Tech Stack:** Node.js 22 ESM, `node:test`, Go toolchain, Python standard library, SHA-256 content addressing, existing linear policy trainer/runtime, SymbolicSolverCompiler, SolverSandbox, ScientificBenchmarkHarness, Full Release Matrix.

## Global Constraints

- No hidden chain-of-thought, private scratchpad, secret value, or raw credential may be stored.
- No shell strings, `eval`, dynamic JavaScript execution, or arbitrary command execution.
- Held-out packs must be disjoint from Checkpoint 6 training repository IDs.
- Tracked fixture source must never be mutated in place.
- Best-known verified candidates are immutable and cannot be replaced by later regressions.
- Training and promotion are separate; promotion requires explicit approval.
- NolaneNative parity, general coding intelligence, competitor superiority, provider-real, and Windows external claims remain false.
- Every production behavior is implemented test-first and every task ends in a focused commit.

---

### Task 1: Held-out project pack and manifest verifier

**Files:**
- Create: `fixtures/checkpoint-7-heldout/node-normalizer/package.json`
- Create: `fixtures/checkpoint-7-heldout/node-normalizer/src/normalize.mjs`
- Create: `fixtures/checkpoint-7-heldout/node-normalizer/test/normalize.test.mjs`
- Create: `fixtures/checkpoint-7-heldout/go-normalizer/go.mod`
- Create: `fixtures/checkpoint-7-heldout/go-normalizer/normalize.go`
- Create: `fixtures/checkpoint-7-heldout/go-normalizer/normalize_test.go`
- Create: `fixtures/checkpoint-7-heldout/python-normalizer/normalize.py`
- Create: `fixtures/checkpoint-7-heldout/python-normalizer/test_normalize.py`
- Create: `src/small-model/checkpoint-7-heldout-pack.mjs`
- Test: `tests/small-model-checkpoint-7-heldout-pack.test.mjs`

**Interfaces:**
- Produces: `CHECKPOINT_7_HELDOUT_PACKS`, `verifyHeldOutPack({ root, pack, trainingRepositoryIds })`.

- [ ] Write tests that accept all three packs and reject overlap, traversal, symlinks, shell strings, stale hashes, and unsupported runtimes.
- [ ] Run the test and confirm RED because the module and fixtures do not exist.
- [ ] Implement the three minimal repositories and strict manifest verification.
- [ ] Run the test and confirm GREEN.
- [ ] Commit `feat(small-model): add checkpoint 7 held-out project packs`.

### Task 2: Long-horizon mission trajectory engine

**Files:**
- Create: `src/small-model/mission-trajectory-engine.mjs`
- Create: `src/small-model/best-candidate-ledger.mjs`
- Test: `tests/small-model-mission-trajectory-engine.test.mjs`

**Interfaces:**
- Produces: `BestCandidateLedger`, `MissionTrajectoryEngine.run({ root, pack })`.
- Mission receipt schema: `nolane.small-model.mission-trajectory.v1`.

- [ ] Write tests for ordered baseline–mutation–failure–repair–recovery steps, immutable best-candidate preservation, source isolation, and fail-closed invalid verifier behavior.
- [ ] Run and confirm RED.
- [ ] Implement temporary workspace execution with argv arrays, bounded output, hashes, and receipts.
- [ ] Run and confirm GREEN on Node, Go, and Python packs.
- [ ] Commit `feat(small-model): record long-horizon mission trajectories`.

### Task 3: Process reward kernel and specialist

**Files:**
- Create: `src/small-model/process-reward-kernel.mjs`
- Create: `src/small-model/process-reward-specialist.mjs`
- Test: `tests/small-model-process-reward-specialist.test.mjs`

**Interfaces:**
- Produces: `scoreProcessStep(step)`, `buildProcessRewardDataset(missions)`, `trainProcessRewardSpecialist(options)`, `verifyProcessRewardSpecialist(options)`.

- [ ] Write tests for positive progress, neutral no-risk inspection, negative regression, invalid verifier rejection, repository-disjoint splits, majority baseline, artifact tamper rejection, and held-out threshold.
- [ ] Run and confirm RED.
- [ ] Implement bounded reward components and train a three-label linear policy from public step data.
- [ ] Run and confirm GREEN.
- [ ] Commit `feat(small-model): train process reward specialist from mission steps`.

### Task 4: Verified skill compilation and transfer

**Files:**
- Create: `src/small-model/verified-skill-compiler.mjs`
- Create: `src/small-model/skill-transfer-lab.mjs`
- Test: `tests/small-model-verified-skill-compiler.test.mjs`

**Interfaces:**
- Produces: `VerifiedSkillCompiler.compile({ id, version, missions })`, `SkillTransferLab.verify({ skill, sourceRepositoryIds, heldOutPack })`.

- [ ] Write tests requiring two verified recovery missions, declarative operations, verifier obligations, rollback metadata, held-out repository disjointness, passing transfer, and exact rollback hash restoration.
- [ ] Run and confirm RED.
- [ ] Implement compilation through `SymbolicSolverCompiler` and execution through `SolverSandbox` only.
- [ ] Run and confirm GREEN.
- [ ] Commit `feat(small-model): compile transferable verified recovery skills`.

### Task 5: Promotion v3 and scientific transfer evidence

**Files:**
- Modify: `src/small-model/model-artifact-registry.mjs`
- Create: `src/small-model/checkpoint-7-evidence-bundle.mjs`
- Test: `tests/small-model-checkpoint-7-promotion.test.mjs`

**Interfaces:**
- Produces: `ModelArtifactRegistry.promoteWithTransferEvidence(input)`, `activeTransferEligible(specialist)`, `buildCheckpoint7EvidenceBundle(input)`.

- [ ] Write tests rejecting missing approval, legacy promotion, invalid receipt hashes, repository overlap, non-positive process delta, cost regression, safety regression, and artifact mismatch.
- [ ] Run and confirm RED.
- [ ] Implement promotion-v3 receipt and evidence bundle using ScientificBenchmarkHarness receipts.
- [ ] Run and confirm GREEN.
- [ ] Commit `feat(small-model): require transfer and process evidence for promotion`.

### Task 6: Foundation and authenticated HTTP integration

**Files:**
- Modify: `src/small-model/foundation-service.mjs`
- Create: `src/small-model/checkpoint-7-decision-support.mjs`
- Modify: `src/server/routes.mjs`
- Test: `tests/small-model-checkpoint-7-foundation.test.mjs`
- Test: `tests/small-model-checkpoint-7-http.test.mjs`

**Interfaces:**
- Produces: `collectCheckpoint7Missions`, `prepareCheckpoint7Evidence`, `promoteCheckpoint7Suite`, `checkpoint7Status`, `runCheckpoint7DecisionSupport`.

- [ ] Write tests separating collection, preparation, promotion, status, inference, and decision support.
- [ ] Write authenticated route tests and confirm unapproved suites cannot become active.
- [ ] Run and confirm RED.
- [ ] Implement service methods, pending bundle storage, promotion-v3 activation, and fail-closed decision support.
- [ ] Run and confirm GREEN.
- [ ] Commit `feat(small-model): integrate checkpoint 7 mission intelligence`.

### Task 7: Checkpoint truth gate, generator, package, and matrix lane

**Files:**
- Create: `src/forensics/recovery-checkpoint-7.mjs`
- Create: `src/forensics/checkpoint-7-delivery-plan.mjs`
- Create: `scripts/collect-checkpoint-7-missions.mjs`
- Create: `scripts/train-checkpoint-7-process-reward.mjs`
- Create: `scripts/verify-forensic-recovery-checkpoint-7.mjs`
- Create: `scripts/package-forensic-recovery-checkpoint-7.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `package.json`
- Test: `tests/forensic-recovery-checkpoint-7.test.mjs`
- Test: `tests/forensic-recovery-checkpoint-7-delivery-plan.test.mjs`
- Modify: release gate count tests.

**Interfaces:**
- Adds matrix gate `forensic-recovery-checkpoint-7` and required gate count 154.

- [ ] Write truth-gate tests requiring three repositories, six-or-more steps per mission, best-candidate preservation, process model evidence, skill transfer, promotion-v3 receipts, safe/unsafe decisions, local evidence completeness, and locked non-claims.
- [ ] Run and confirm RED.
- [ ] Implement generator, delivery plan, package script, package scripts, and matrix lane.
- [ ] Run and confirm GREEN.
- [ ] Commit `feat(forensics): add checkpoint 7 transfer intelligence gate`.

### Task 8: Freshness, full verification, and release packaging

**Files:**
- Regenerate: canonical program, Master Ledger, assertion audit, custody, symbol inventory, NolaneNative truth ledger, native catalog/conformance, Checkpoints 1–7, release matrix, and release artifacts.

- [ ] Run all freshness and quality verifiers.
- [ ] Run the complete Node suite and require zero failures.
- [ ] Commit the immutable source/evidence tree.
- [ ] Save pre-matrix source snapshot and Git bundle.
- [ ] Run Full Release Matrix and require 154/154.
- [ ] Package Checkpoint 7 source, change-set, patch, evidence, product artifacts, model/process/skill receipts, checksums, and delivery manifest.
- [ ] Independently verify patch apply, source entries, checksum files, archives/VSIX, matrix commit/receipt, and clean Git tree.
