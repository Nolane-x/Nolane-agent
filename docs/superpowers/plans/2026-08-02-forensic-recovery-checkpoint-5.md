# Forensic Recovery Checkpoint 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace coarse file-level evidence with requirement-bound assertion evidence, build verified repository trajectories from real source/test/verifier outcomes, and train a second specialist suite only from those trajectory receipts.

**Architecture:** Checkpoint 5 adds an explicit assertion-binding schema layered over the existing Master Ledger, migrates the largest agent/execution evidence families to named positive and negative tests, and introduces a repository trajectory pipeline that records source hashes, test commands, exit outcomes, verifier receipts, and grouped held-out splits. The SmallModelFoundationService then exposes a trajectory-trained specialist suite while all NolaneNative, AGI, competitor-superiority, provider-real, and Windows external claims remain fail-closed.

**Tech Stack:** Node.js ESM, `node:test`, Git, SHA-256 content addressing, existing linear softmax trainer/runtime, existing Full Release Matrix and clean-room packaging.

## Global Constraints

- Do not claim complete NolaneNative parity without canonical NolaneNative archive bytes.
- Do not store hidden chain-of-thought, private scratchpads, or reasoning traces.
- Requirement evidence must bind exact requirement IDs to exact named positive and negative tests.
- A passing file alone is never proof.
- Repository trajectories must include real source/test hashes and observed verifier outcomes.
- Synthetic bootstrap models remain available only as legacy bounded artifacts; Checkpoint 5 promotion requires repository-trajectory receipts.
- External Windows, provider, screen-reader, screenshot, and comparative claims remain false.
- Every production change follows RED → GREEN TDD.

---

### Task 1: Requirement-level assertion binding v3

**Files:**
- Create: `src/forensics/requirement-assertion-binding.mjs`
- Modify: `src/forensics/test-assertion-index.mjs`
- Modify: `src/forensics/master-ledger-assertion-audit.mjs`
- Test: `tests/forensic-requirement-assertion-binding.test.mjs`

**Interfaces:**
- Produces: `validateRequirementAssertionBindings({ requirementId, bindings, testIndex })`
- Produces: `auditMasterLedgerAssertions(...).records[].explicitAssertionBindings`

- [ ] Write failing tests for exact positive/negative test-name binding, stale names, wrong test paths, and hidden-reasoning rejection.
- [ ] Run the test and confirm RED.
- [ ] Implement exact named-test indexing and binding validation.
- [ ] Make explicit bindings exempt from file-owner-count heuristics only when both named positive and negative tests exist.
- [ ] Run focused tests and confirm GREEN.
- [ ] Commit `feat(forensics): bind requirements to exact assertions`.

### Task 2: Focused agent and execution contract suites

**Files:**
- Create: `tests/agent-runtime-guardrail-contracts.test.mjs`
- Create: `tests/agent-runtime-budget-recovery-contracts.test.mjs`
- Create: `tests/agent-runtime-context-tool-contracts.test.mjs`
- Create: `tests/mission-runtime-state-verification-contracts.test.mjs`
- Create: `tests/execution-command-governance-contracts.test.mjs`
- Create: `tests/execution-secret-boundary-contracts.test.mjs`
- Create: `tests/execution-process-lifecycle-contracts.test.mjs`
- Create: `tests/terminal-lifecycle-governance-contracts.test.mjs`

**Interfaces:**
- Consumes actual `AgentLoop`, `RunBudget`, task contracts, `ToolBroker`, `AutonomyPolicy`, command governance, and `TerminalManager` APIs.
- Produces stable named positive and negative tests used by explicit requirement bindings.

- [ ] Write failing contract tests around missing or unsafe behavior before any production fix.
- [ ] Run each new file and verify RED where behavior is missing.
- [ ] Implement only root-cause production fixes needed by the tests.
- [ ] Run all eight files and verify GREEN.
- [ ] Commit `test(runtime): add focused agent and execution contracts`.

### Task 3: Migrate high-volume evidence families

**Files:**
- Create: `src/forensics/checkpoint-5-evidence-migration.mjs`
- Create: `scripts/migrate-checkpoint-5-evidence.mjs`
- Modify: `requirements/master-acceptance-ledger.json`
- Test: `tests/forensic-checkpoint-5-evidence-migration.test.mjs`

**Interfaces:**
- Produces: `migrateCheckpoint5Evidence(ledger)` returning immutable migrated ledger and receipt.
- Migrates requirements previously owned by `agent-loop`, `mission-runner`, `tool-broker`, and `terminal-manager` broad tests to exact named assertion bindings.

- [ ] Write failing tests requiring deterministic migration, preserved historical aliases, and no invented requirement IDs.
- [ ] Run and confirm RED.
- [ ] Implement title/domain-based explicit mappings only for supported requirement families.
- [ ] Apply migration and regenerate Master Ledger evidence hashes.
- [ ] Regenerate assertion audit and require a material reduction from 417 unbound.
- [ ] Commit `feat(forensics): migrate runtime evidence to exact bindings`.

### Task 4: Verified repository trajectory collector

**Files:**
- Create: `src/small-model/repository-trajectory-collector.mjs`
- Create: `src/small-model/repository-trajectory-dataset.mjs`
- Create: `scripts/collect-repository-trajectories.mjs`
- Test: `tests/small-model-repository-trajectory-collector.test.mjs`

**Interfaces:**
- Produces: `collectRepositoryTrajectories({ root, probes, gitHead })`
- Produces JSONL episodes containing source/test SHA-256, command argv, exit code, duration, actual effect, verifier identity, and receipt hash.

- [ ] Write failing tests for real command execution, non-zero exit recording, tamper rejection, hidden-reasoning rejection, and deterministic receipt generation.
- [ ] Run and confirm RED.
- [ ] Implement bounded `node --test` probe execution with no shell strings.
- [ ] Build trajectory episodes from actual requirement bindings and observed test outcomes.
- [ ] Write `datasets/trajectories/repository-v1/episodes.jsonl` and receipt JSON.
- [ ] Commit `feat(small-model): collect verified repository trajectories`.

### Task 5: Trajectory-trained specialist suite v2

**Files:**
- Create: `src/small-model/repository-specialist-suite-training.mjs`
- Create: `scripts/train-repository-specialist-suite.mjs`
- Create: `scripts/verify-repository-specialist-suite.mjs`
- Create: `models/specialists-repository/*/repository-v1/{model.json,benchmark.json,dataset-receipt.json}`
- Test: `tests/small-model-repository-specialist-suite.test.mjs`

**Interfaces:**
- Produces trajectory-trained artifacts for `tool-router`, `context-scorer`, `test-selector`, `patch-ranker`, and `risk-classifier`.
- Uses group-disjoint split by test path/source family and independent held-out evaluation.

- [ ] Write failing tests requiring trajectory receipt lineage, non-empty real command receipts, decreasing loss, held-out evaluation, and tamper rejection.
- [ ] Run and confirm RED.
- [ ] Train five bounded specialists from repository trajectory examples.
- [ ] Reject promotion if any artifact lacks repository trajectory lineage or independent held-out evidence.
- [ ] Write model, benchmark, and dataset receipts.
- [ ] Commit `feat(small-model): train repository trajectory specialists`.

### Task 6: Foundation, API, and governed decision support v2

**Files:**
- Modify: `src/small-model/foundation-service.mjs`
- Modify: HTTP route/controller files that expose small-model APIs.
- Create: `src/small-model/repository-specialist-decision-support.mjs`
- Test: `tests/small-model-repository-suite-foundation.test.mjs`
- Test: `tests/small-model-repository-suite-http.test.mjs`

**Interfaces:**
- Adds `bootstrapRepositorySpecialistSuite`, `repositorySpecialistSuiteStatus`, and `runRepositoryDecisionSupport`.
- Adds authenticated API routes for collect/train/status/promote/infer/decision support.

- [ ] Write failing service and HTTP tests.
- [ ] Run and confirm RED.
- [ ] Implement fail-closed suite bootstrap and explicit human-approved promotion.
- [ ] Require all five promoted repository artifacts before autonomous decision support.
- [ ] Keep general-intelligence and competitor claims false.
- [ ] Run focused integration tests and confirm GREEN.
- [ ] Commit `feat(small-model): wire repository-trained decision support`.

### Task 7: Checkpoint 5 gate, matrix, and delivery

**Files:**
- Create: `src/forensics/recovery-checkpoint-5.mjs`
- Create: `scripts/verify-forensic-recovery-checkpoint-5.mjs`
- Create: `scripts/package-forensic-recovery-checkpoint-5.mjs`
- Create: `tests/forensic-recovery-checkpoint-5.test.mjs`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: release gate count tests.

**Interfaces:**
- Adds required matrix gate `forensic-recovery-checkpoint-5`.
- Requires exact assertion bindings, material evidence-backlog reduction, repository trajectory receipts, five verified artifacts, governed decision support, and locked non-claims.

- [ ] Write the failing checkpoint and matrix tests.
- [ ] Run and confirm RED.
- [ ] Implement checkpoint verifier and deterministic report generator.
- [ ] Regenerate custody, inventory, truth ledger, assertion audit, native conformance, and all checkpoint reports.
- [ ] Run focused tests, full Node regression, Full Release Matrix, clean-room reconstruction, and archive integrity.
- [ ] Package source, change-set, evidence, model artifacts, product artifacts, checksums, and recovery backups.
- [ ] Commit `feat(forensics): release checkpoint 5 trajectory evidence`.
