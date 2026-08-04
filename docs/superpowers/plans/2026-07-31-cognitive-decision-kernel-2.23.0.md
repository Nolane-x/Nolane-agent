# Cognitive Decision Kernel 2.23.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bounded cognitive control layer that maintains multiple task interpretations and hypotheses, chooses information-efficient actions, attributes failures, binds causal episodes, and gates commits without storing private reasoning.

**Architecture:** Add a focused `src/cognition/` package behind one lazy `CognitiveKernel` facade. Integrate it with the existing Decision Plane and Agent Loop without adding direct cognitive imports to `src/app.mjs`; expose only privacy-safe projections and content-addressed receipts.

**Tech Stack:** Node.js ESM, `node:test`, canonical JSON SHA-256 from ForgeOS, existing Decision Plane, Agent Loop, acceptance-criteria receipts, release matrix and frontier audit tooling.

## Global Constraints

- No raw prompt, model output, chain-of-thought, secret, cookie, authorization header, or environment dump may be stored.
- All collections are bounded and all snapshots are immutable.
- The default low-risk Agent Loop path must not instantiate the Cognitive Kernel.
- The kernel does not directly mutate source files, semantic memory, policy, permissions, or commitments.
- Commit authorization requires a concentrated context posterior, a dominant non-falsified hypothesis, bounded scope, a known verification probe, and no blocked invariant.
- Historical audit counts for releases 2.20.0–2.22.0 must remain unchanged.
- `src/app.mjs` must stay at or below 160 static imports and 180 constructor expressions.
- A new required release gate and deterministic raw measurement are mandatory.

---

### Task 1: Context Posterior Manager

**Files:**
- Create: `src/cognition/context-posterior-manager.mjs`
- Test: `tests/context-posterior-manager.test.mjs`

**Interfaces:**
- Produces: `new ContextPosteriorManager(options)`, `start(taskId, contexts)`, `observe(taskId, evidence)`, `snapshot(taskId)`, `canWriteDurableMemory(taskId)`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextPosteriorManager } from '../src/cognition/context-posterior-manager.mjs';

test('concentrates posterior after discriminating evidence and gates memory writes', () => {
  const manager = new ContextPosteriorManager({ maxContexts: 5, maxNormalizedEntropyForMemory: 0.45, minLeaderProbabilityForMemory: 0.7 });
  manager.start('task-1', [
    { id: 'regression', probability: 0.5 },
    { id: 'environment', probability: 0.5 },
  ]);
  assert.equal(manager.canWriteDurableMemory('task-1').allowed, false);
  manager.observe('task-1', { supports: ['regression'], contradicts: ['environment'], supportLikelihood: 4, contradictionLikelihood: 0.25, evidenceId: 'ev-1' });
  const snapshot = manager.snapshot('task-1');
  assert.equal(snapshot.contexts[0].id, 'regression');
  assert.ok(snapshot.contexts[0].probability >= 0.8);
  assert.equal(manager.canWriteDurableMemory('task-1').allowed, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/context-posterior-manager.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement bounded normalization, entropy, evidence update, immutable snapshots, and memory gate**

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/context-posterior-manager.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cognition/context-posterior-manager.mjs tests/context-posterior-manager.test.mjs
git commit -m "feat: add context posterior manager"
```

### Task 2: Polyhypothesis Workspace

**Files:**
- Create: `src/cognition/hypothesis-population.mjs`
- Test: `tests/hypothesis-population.test.mjs`

**Interfaces:**
- Produces: `HypothesisPopulation.start(taskId, hypotheses)`, `observe(taskId, evidence)`, `falsify(taskId, hypothesisId, evidenceId)`, `dominant(taskId)`, `snapshot(taskId)`.

- [ ] **Step 1: Write failing tests for the three-hypothesis bound, evidence fields, probability update, survival of a lower-ranked hypothesis, and explicit falsification**
- [ ] **Step 2: Run `node --test tests/hypothesis-population.test.mjs` and confirm missing-module failure**
- [ ] **Step 3: Implement probability normalization, age, predictions, support, counter-evidence, falsification condition, test cost, and immutable receipts**
- [ ] **Step 4: Run the focused test and confirm PASS**
- [ ] **Step 5: Commit with `git commit -m "feat: add bounded hypothesis population"`**

### Task 3: Epistemic Action Selector

**Files:**
- Create: `src/cognition/epistemic-action-selector.mjs`
- Test: `tests/epistemic-action-selector.test.mjs`

**Interfaces:**
- Produces: `select({ actions, uncertainty, reversibilityLimit, weights })` returning ranked actions and a signed selection receipt.

- [ ] **Step 1: Write a failing test where a two-second targeted test beats reading twenty files and a broad irreversible patch is rejected under high uncertainty**
- [ ] **Step 2: Run the focused test and confirm missing-module failure**
- [ ] **Step 3: Implement normalized scoring using task utility, information gain, token cost, RAM cost, time cost, and irreversibility risk**
- [ ] **Step 4: Run the focused test and confirm PASS**
- [ ] **Step 5: Commit with `git commit -m "feat: select information-efficient cognitive actions"`**

### Task 4: Structured Error Router

**Files:**
- Create: `src/cognition/structured-error-router.mjs`
- Test: `tests/structured-error-router.test.mjs`

**Interfaces:**
- Produces: `route(errorEvent)` returning `errorPosterior`, `ownerMask`, `primarySubsystem`, and a receipt.

- [ ] **Step 1: Write failing tests for missing binary → execution, stale symbol memory → memory/context, and green tests with unmet criteria → causalModel/goal**
- [ ] **Step 2: Run focused tests and confirm missing-module failure**
- [ ] **Step 3: Implement bounded evidence rules, posterior normalization, thresholded owner masks, and privacy validation**
- [ ] **Step 4: Run focused tests and confirm PASS**
- [ ] **Step 5: Commit with `git commit -m "feat: route failures to responsible cognitive subsystems"`**

### Task 5: Episodic Binder and Agency Delta

**Files:**
- Create: `src/cognition/episodic-binder.mjs`
- Create: `src/cognition/agency-ledger.mjs`
- Test: `tests/episodic-binder.test.mjs`
- Test: `tests/agency-ledger.test.mjs`

**Interfaces:**
- Produces: `EpisodicBinder.bind(input)`, `get(episodeId)`, `snapshot()`; `AgencyLedger.record(input)` and `snapshot()`.

- [ ] **Step 1: Write failing tests for expected-versus-actual outcome binding, rollback point, causal attribution, controllability, and recursive secret rejection**
- [ ] **Step 2: Run focused tests and confirm missing-module failures**
- [ ] **Step 3: Implement bounded immutable episode and agency receipts without transcripts**
- [ ] **Step 4: Run focused tests and confirm PASS**
- [ ] **Step 5: Commit with `git commit -m "feat: bind causal episodes and agency outcomes"`**

### Task 6: Recovery Lease, Commit Gate, and Stop Gate

**Files:**
- Create: `src/cognition/cognitive-policy-gates.mjs`
- Test: `tests/cognitive-policy-gates.test.mjs`

**Interfaces:**
- Produces: `RecoveryLease`, `evaluateCommitGate(input)`, and `evaluateStopGate(input)`.

- [ ] **Step 1: Write failing tests showing failed strategy reuse is denied within a lease, commit is denied without a dominant hypothesis or verification probe, and stop is allowed after all criteria receipts or low marginal information gain**
- [ ] **Step 2: Run focused tests and confirm missing-module failure**
- [ ] **Step 3: Implement bounded strategy fingerprints, lease expiry, commit reasons, stop reasons, and receipts**
- [ ] **Step 4: Run focused tests and confirm PASS**
- [ ] **Step 5: Commit with `git commit -m "feat: gate cognitive commit recovery and stopping"`**

### Task 7: Cognitive Kernel Facade

**Files:**
- Create: `src/cognition/cognitive-kernel.mjs`
- Create: `src/cognition/index.mjs`
- Test: `tests/cognitive-kernel.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: `CognitiveKernel.startTask`, `observe`, `propose`, `verify`, `commit`, `rollback`, `snapshot`, and `close`.

- [ ] **Step 1: Write a failing integration test for observe → posterior/hypothesis update → probe proposal → verification → commit authorization → episode binding**
- [ ] **Step 2: Run focused test and confirm missing-module failure**
- [ ] **Step 3: Implement one lazy facade, task state bounds, privacy-safe projection, receipt journal, and closed-state rejection**
- [ ] **Step 4: Run Tasks 1–7 tests together and confirm PASS**
- [ ] **Step 5: Commit with `git commit -m "feat: add cognitive decision kernel"`**

### Task 8: Decision Plane and Agent Loop Integration

**Files:**
- Modify: `src/decision/decision-plane.mjs`
- Modify: `src/agent/agent-loop.mjs`
- Modify: `src/agent/adaptive-intelligence-plane.mjs`
- Test: `tests/cognitive-decision-plane-integration.test.mjs`
- Test: `tests/agent-loop-cognitive-mode.test.mjs`

**Interfaces:**
- Decision Plane exposes lazy `cognition`, `startCognitiveTask`, `observeCognitiveEvent`, `proposeCognitiveAction`, and privacy-safe snapshot metadata.
- Agent Loop activates cognitive mode only through explicit triggers and otherwise preserves the fast path.

- [ ] **Step 1: Write failing tests proving the low-risk path does not instantiate cognition and repeated failure activates a bounded cognitive recommendation without exposing private rationale**
- [ ] **Step 2: Run focused tests and confirm failures at missing integration methods**
- [ ] **Step 3: Add lazy integration, public metadata only, and lifecycle close without importing cognition directly in `src/app.mjs`**
- [ ] **Step 4: Run existing Decision Plane and Agent Loop suites plus new tests**
- [ ] **Step 5: Commit with `git commit -m "feat: integrate bounded cognition into agent decisions"`**

### Task 9: Version-aware Frontier Audit and Release Measurement

**Files:**
- Create: `src/release/cognitive-decision-kernel-verifier.mjs`
- Create: `scripts/verify-cognitive-decision-kernel.mjs`
- Create: `scripts/measure-cognitive-decision-kernel.mjs`
- Create: `tests/cognitive-decision-kernel-release-gate.test.mjs`
- Modify: `scripts/generate-frontier-feature-audit.mjs`
- Modify: `src/release/full-release-matrix.mjs`

**Interfaces:**
- Produces required release gate `cognitive-decision-kernel` and measurement `release/cognitive-decision-kernel-measurement-2.23.0.json`.

- [ ] **Step 1: Write a failing release-gate test that requires posterior concentration, memory suppression before concentration, preservation then falsification of a hypothesis, low-cost probe selection, targeted error routing, episode binding, recovery strategy ban, commit authorization, stop gate, privacy claims, and composition budgets**
- [ ] **Step 2: Run focused gate test and confirm missing verifier/measurement failure**
- [ ] **Step 3: Implement deterministic measurement, verifier, matrix gate, and version-aware audit transitions while preserving historical counts**
- [ ] **Step 4: Run all architecture gates from 2.16 through 2.23 and verify PASS**
- [ ] **Step 5: Commit with `git commit -m "release: certify cognitive decision kernel"`**

### Task 10: Release Identity, Documentation, Full Verification, and Artifacts

**Files:**
- Modify all canonical version surfaces from `2.22.0` to `2.23.0`.
- Create release/audit/limitations documents and generated manifests for 2.23.0.
- Generate source, Windows x64, update payload, VSIX, NolaneNative optional pack, release evidence, change set, matrix reports, and checksums.

**Interfaces:**
- Produces a clean release commit and downloadable artifacts governed by `project-manifest-2.23.0.json`.

- [ ] **Step 1: Run focused cognition tests and all historical architecture gates**
- [ ] **Step 2: Run `npm test` and require every discovered Node test file to execute exactly once**
- [ ] **Step 3: Run the complete Full Release Matrix with the verified NolaneNative pack root; split only when the interactive command limit requires it, and merge by canonical gate ID/commit/receipt validation**
- [ ] **Step 4: Package all artifacts, generate SHA-256 files, open-test ZIP/VSIX files, verify source reconstruction, matrix receipt, audit count, source version, and clean Git tree**
- [ ] **Step 5: Keep `feat/forge-studio-2.23` worktree because no remote integration target is configured**
