# Forensic Recovery Checkpoint 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build syntax-aware and constraint-proven transferable skills, mission-portfolio evidence, and solver-governed promotion without weakening forensic non-claims.

**Architecture:** Verified public mission receipts induce JavaScript AST codemods and bounded SMT/Datalog skill definitions. Transfer runs in copied project workspaces, constraint execution is budgeted and proof-addressed, and promotion v4 requires transfer/proof/process/cost/safety evidence plus explicit approval.

**Tech Stack:** Node.js ESM, `node:test`, SHA-256 content addressing, existing `AstCodemodEngine`, `FiniteDomainSmtAdapter`, `DatalogAdapter`, `MissionTrajectoryEngine`, `ProcessRewardKernel`, `ModelArtifactRegistry`, Full Release Matrix.

## Global Constraints

- No hidden chain-of-thought, raw secret, credential value, `eval`, dynamic source execution or shell string.
- All source mutation occurs only in temporary copied workspaces.
- AST operations are limited to supported token-tree codemods and explicit path scopes.
- Constraint adapters are finite and budgeted; budget exhaustion fails closed.
- Best-known verified candidates are immutable.
- Compilation and promotion are separate; promotion requires explicit approval.
- NolaneNative parity, general coding intelligence, competitor superiority, provider-real and Windows external claims remain false.
- Every production behavior is test-first and each task ends in a focused commit.

---

### Task 1: AST induction and transfer project pack

**Files:**
- Create: `fixtures/checkpoint-8-ast/*`
- Create: `src/small-model/checkpoint-8-ast-pack.mjs`
- Test: `tests/small-model-checkpoint-8-ast-pack.test.mjs`

**Interfaces:**
- Produces: `CHECKPOINT_8_AST_PACKS`, `verifyCheckpoint8AstPack()`.

- [ ] Write failing tests for three project-disjoint packs, stale hash, traversal, shell string and lineage overlap rejection.
- [ ] Implement fixtures and strict manifest verification.
- [ ] Run focused tests and commit.

### Task 2: AST skill compiler v2 and transfer lab

**Files:**
- Create: `src/small-model/ast-skill-compiler.mjs`
- Create: `src/small-model/ast-skill-transfer-lab.mjs`
- Test: `tests/small-model-ast-skill-compiler.test.mjs`

**Interfaces:**
- Produces: `AstSkillCompiler.compile()`, `AstSkillTransferLab.verify()`.

- [ ] Write failing tests for two verified induction episodes, operation matching, syntax preservation, comments/strings preservation, path scope, project-disjoint transfer and rollback.
- [ ] Implement compilation and isolated transfer through `AstCodemodEngine` only.
- [ ] Run focused tests and commit.

### Task 3: Constraint skill compiler and proof lab

**Files:**
- Create: `src/small-model/constraint-skill-compiler.mjs`
- Create: `src/small-model/constraint-proof-lab.mjs`
- Test: `tests/small-model-constraint-skill-compiler.test.mjs`

**Interfaces:**
- Produces: `ConstraintSkillCompiler.compileSmt()`, `compileDatalog()`, `ConstraintProofLab.verify()`.

- [ ] Write failing tests for typed schemas, deterministic SAT/UNSAT, Datalog query, unsafe variable, recursive negation and budget rejection.
- [ ] Implement immutable definitions and proof receipts using existing adapters.
- [ ] Run focused tests and commit.

### Task 4: Mission portfolio and solver evidence bundle

**Files:**
- Create: `src/small-model/checkpoint-8-mission-portfolio.mjs`
- Create: `src/small-model/checkpoint-8-evidence-bundle.mjs`
- Test: `tests/small-model-checkpoint-8-portfolio.test.mjs`

**Interfaces:**
- Produces: `buildCheckpoint8MissionPortfolio()`, `buildCheckpoint8EvidenceBundle()`.

- [ ] Write failing tests requiring at least five ordered missions, best-candidate preservation, positive process value, lower matched-quality cost and proof/transfer lineage.
- [ ] Implement public mission and evidence receipts.
- [ ] Run focused tests and commit.

### Task 5: Promotion v4, registries, foundation and HTTP

**Files:**
- Modify: `src/small-model/model-artifact-registry.mjs`
- Create: `src/small-model/verified-skill-registry.mjs`
- Modify: `src/small-model/foundation-service.mjs`
- Modify: `src/server/routes.mjs`
- Test: `tests/small-model-checkpoint-8-promotion.test.mjs`
- Test: `tests/small-model-checkpoint-8-foundation.test.mjs`
- Test: `tests/small-model-checkpoint-8-http.test.mjs`

**Interfaces:**
- Produces: v4 promotion, skill registration/promotion/rollback, Checkpoint 8 status, prepare/promote/execute service and authenticated API.

- [ ] Write failing tests for missing approval, stale proof, repository overlap, cost/safety regression, legacy evidence and unsafe execution.
- [ ] Implement fail-closed promotion and service/API wiring.
- [ ] Run focused tests and commit.

### Task 6: Checkpoint truth gate, scripts, package and matrix lane

**Files:**
- Create: `src/forensics/recovery-checkpoint-8.mjs`
- Create: `src/forensics/checkpoint-8-delivery-plan.mjs`
- Create: `scripts/generate-checkpoint-8-evidence.mjs`
- Create: `scripts/verify-forensic-recovery-checkpoint-8.mjs`
- Create: `scripts/package-forensic-recovery-checkpoint-8.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `package.json`
- Test: `tests/forensic-recovery-checkpoint-8.test.mjs`
- Test: `tests/forensic-recovery-checkpoint-8-delivery-plan.test.mjs`
- Modify: matrix-count tests.

**Interfaces:**
- Adds matrix gate `forensic-recovery-checkpoint-8` and required gate count 155.

- [ ] Write failing truth-gate and delivery-plan tests.
- [ ] Implement generator, verifier, packager and matrix lane.
- [ ] Run focused tests and commit.

### Task 7: Freshness, full verification and release packaging

- [ ] Regenerate canonical program, Master Ledger, assertion audit, custody, inventory, NolaneNative truth, native conformance and Checkpoints 1–8.
- [ ] Run all freshness/quality verifiers.
- [ ] Run the complete Node suite with zero failures.
- [ ] Commit immutable source/evidence and save pre-matrix source/Git bundle.
- [ ] Run Full Release Matrix and require 155/155.
- [ ] Package source, change-set, patch, evidence, AST/constraint/portfolio receipts, product artifacts and checksums.
- [ ] Independently verify patch apply, source entries, checksums, archives/VSIX, matrix commit/receipt and clean Git tree.
