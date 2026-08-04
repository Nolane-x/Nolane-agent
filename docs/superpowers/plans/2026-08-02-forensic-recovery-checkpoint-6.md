# Forensic Recovery Checkpoint 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the remaining Master Ledger evidence backlog with exact contracts, collect multi-runtime mutation/recovery trajectories, and require measured ablation lift before specialist promotion.

**Architecture:** Checkpoint 6 adds seven focused evidence contract families, a project-aware command collector for Node/Go/Python, an isolated mutation/recovery lab, a combined trajectory dataset, and an ablation promotion gate. Existing fail-closed claim locks, content-addressed artifacts, authenticated API boundaries, clean-room packaging, and Full Release Matrix remain mandatory.

**Tech Stack:** Node.js ESM, `node:test`, Git, SHA-256 content addressing, Go and Python subprocesses already present in the repository, existing linear softmax trainer/runtime, existing release matrix and packaging infrastructure.

## Global Constraints

- Do not claim complete NolaneNative parity without canonical NolaneNative archive bytes.
- Do not store hidden chain-of-thought, private scratchpads, or reasoning traces.
- Never mutate production source in place during mutation testing.
- Commands use executable + argv arrays with `shell: false`.
- Requirement evidence binds exact requirement IDs to exact named positive and negative tests.
- A trained model cannot be promoted unless it beats a training-only baseline on group-disjoint held-out data.
- External Windows, provider, screen-reader, screenshot, and comparative claims remain false.
- Every production behavior change follows RED → GREEN TDD.

---

### Task 1: Checkpoint 6 evidence contract families

**Files:**
- Create: `tests/local-frontier-completion-contracts.test.mjs`
- Create: `tests/capability-governance-contracts.test.mjs`
- Create: `tests/context-repository-intelligence-contracts.test.mjs`
- Create: `tests/repository-discovery-contracts.test.mjs`
- Create: `tests/git-workspace-governance-contracts.test.mjs`
- Create: `tests/frontier-governance-contracts.test.mjs`
- Create: `tests/cloud-recovery-contracts.test.mjs`

**Interfaces:**
- Consumes public APIs from the seven production families.
- Produces stable positive and negative named tests used by requirement-level bindings.

- [ ] Write positive and negative contract tests for each family.
- [ ] Run each test and confirm any missing behavior fails for the correct reason.
- [ ] Implement only root-cause production fixes needed by those contracts.
- [ ] Run all seven contract files and confirm GREEN.
- [ ] Commit `test(forensics): add checkpoint 6 evidence contracts`.

### Task 2: Evidence migration and backlog reduction

**Files:**
- Create: `src/forensics/checkpoint-6-evidence-migration.mjs`
- Create: `scripts/migrate-checkpoint-6-evidence.mjs`
- Modify: `requirements/master-acceptance-ledger.json`
- Test: `tests/forensic-checkpoint-6-evidence-migration.test.mjs`

**Interfaces:**
- Produces `migrateCheckpoint6LedgerEvidence(ledger)`.
- Adds exact assertion bindings and preserves historical aliases.

- [ ] Write failing tests for deterministic migration, title/path family matching, no invented IDs, and unsupported-record preservation.
- [ ] Implement explicit family classifiers and named-test mappings.
- [ ] Apply migration and regenerate the Master Ledger assertion audit.
- [ ] Require a material decrease from 265 assertion-unbound records without changing total/external counts.
- [ ] Commit `feat(forensics): migrate checkpoint 6 evidence families`.

### Task 3: Project-aware multi-runtime trajectory collector

**Files:**
- Create: `src/small-model/multi-runtime-trajectory-collector.mjs`
- Create: `src/small-model/multi-runtime-trajectory-probes.mjs`
- Create: `scripts/collect-multi-runtime-trajectories.mjs`
- Test: `tests/small-model-multi-runtime-trajectory-collector.test.mjs`

**Interfaces:**
- Produces `collectMultiRuntimeTrajectories({ root, probes })`.
- Supports allowlisted Node, Go, and Python executable families.

- [ ] Write failing tests for project-root traversal, shell-string rejection, executable allowlists, timeout recording, and deterministic receipts.
- [ ] Implement path-safe project roots and argv execution.
- [ ] Define real Node, Go, and Python probes from existing repository projects.
- [ ] Persist `datasets/trajectories/multi-runtime-v1/execution-episodes.jsonl` and receipt.
- [ ] Commit `feat(small-model): collect multi-runtime trajectories`.

### Task 4: Isolated mutation and recovery laboratory

**Files:**
- Create: `src/small-model/mutation-recovery-lab.mjs`
- Create: `src/small-model/mutation-recovery-scenarios.mjs`
- Create: `scripts/collect-mutation-recovery-trajectories.mjs`
- Test: `tests/small-model-mutation-recovery-lab.test.mjs`

**Interfaces:**
- Produces `runMutationRecoveryLab({ root, scenarios })`.
- Emits baseline, mutation-failure, and recovery-pass receipts.

- [ ] Write failing tests for isolated copy, exact mutation count, expected failure, repair success, path escape rejection, and original source immutability.
- [ ] Implement temporary workspace copy and command execution.
- [ ] Add bounded Node, Go, and Python recovery scenarios.
- [ ] Persist `datasets/trajectories/multi-runtime-v1/recovery-episodes.jsonl` and receipt.
- [ ] Commit `feat(small-model): record mutation recovery trajectories`.

### Task 5: Combined dataset and ablation-governed specialist suite

**Files:**
- Create: `src/small-model/checkpoint-6-specialist-dataset.mjs`
- Create: `src/small-model/checkpoint-6-ablation-runner.mjs`
- Create: `src/small-model/checkpoint-6-specialist-training.mjs`
- Create: `scripts/train-checkpoint-6-specialist-suite.mjs`
- Create: `scripts/verify-checkpoint-6-specialist-suite.mjs`
- Create: `models/specialists-checkpoint-6/*/multi-runtime-v1/{model.json,benchmark.json,dataset-receipt.json,ablation.json}`
- Test: `tests/small-model-checkpoint-6-specialist-suite.test.mjs`

**Interfaces:**
- Produces five content-addressed specialist artifacts and ablation receipts.
- Promotion eligibility requires held-out lift over a majority baseline.

- [ ] Write failing tests for combined lineage, group-disjoint splits, baseline trained only on train data, lift threshold, safety non-regression, and tamper rejection.
- [ ] Implement combined execution + recovery dataset.
- [ ] Train five specialists and evaluate model/baseline on identical held-out groups.
- [ ] Reject artifacts without mutation/recovery and multi-project lineage.
- [ ] Write model, benchmark, dataset, and ablation receipts.
- [ ] Commit `feat(small-model): gate specialists by ablation lift`.

### Task 6: Foundation, API, and governed promotion v3

**Files:**
- Modify: `src/small-model/foundation-service.mjs`
- Modify: `src/server/routes.mjs`
- Create: `src/small-model/checkpoint-6-decision-support.mjs`
- Test: `tests/small-model-checkpoint-6-foundation.test.mjs`
- Test: `tests/small-model-checkpoint-6-http.test.mjs`

**Interfaces:**
- Adds `bootstrapCheckpoint6SpecialistSuite`, `checkpoint6SuiteStatus`, and `runCheckpoint6DecisionSupport`.
- Adds authenticated collect/train/status/promote/infer/decision endpoints.

- [ ] Write failing Foundation and HTTP tests.
- [ ] Require explicit approval and ablation eligibility for promotion.
- [ ] Require all five active artifacts before decision support.
- [ ] Preserve risk/patch/abstention fail-closed behavior.
- [ ] Run integration tests and commit `feat(small-model): wire ablation-governed decision support`.

### Task 7: Checkpoint 6 truth gate and release matrix

**Files:**
- Create: `src/forensics/recovery-checkpoint-6.mjs`
- Create: `scripts/verify-forensic-recovery-checkpoint-6.mjs`
- Create: `tests/forensic-recovery-checkpoint-6.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: release gate count tests.

**Interfaces:**
- Adds required matrix gate `forensic-recovery-checkpoint-6`.

- [ ] Write failing gate tests for evidence counts, three runtime families, mutation/recovery receipts, five ablation-eligible artifacts, safe/unsafe decisions, and locked claims.
- [ ] Implement deterministic checkpoint verification and report generation.
- [ ] Increase required gate count from 152 to 153.
- [ ] Regenerate all dependent evidence receipts.
- [ ] Run focused verification and commit `feat(forensics): gate checkpoint 6 recovery evidence`.

### Task 8: Full regression, clean-room release, and delivery

**Files:**
- Create: `src/forensics/checkpoint-6-delivery-plan.mjs`
- Create: `scripts/package-forensic-recovery-checkpoint-6.mjs`
- Test: `tests/forensic-recovery-checkpoint-6-delivery-plan.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Packages source, patch, evidence, trajectory datasets, model artifacts, ablation receipts, product artifacts, checksums, and recovery backups.

- [ ] Regenerate custody, symbol inventory, truth ledger, Master Ledger, assertion audit, native conformance, and checkpoint reports.
- [ ] Run the full Node suite, runtime/eval, VS Code, Go, Python, ForgeOS, packaging, clean-room reconstruction, and archive integrity.
- [ ] Run Full Release Matrix 153/153 from an immutable clean commit.
- [ ] Package and independently verify every artifact and checksum.
- [ ] Commit `chore(forensics): release checkpoint 6`.
