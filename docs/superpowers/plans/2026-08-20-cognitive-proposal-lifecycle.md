# Cognitive Proposal Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an evidence-linked lifecycle for cognitive proposals without representing a cognitive decision as an executed external action.

**Architecture:** Keep `DecisionStateMachine` unchanged because it describes executable work. Introduce `CognitiveProposalLifecycle`, which tracks task evidence and proposal-level states using only receipts returned by `CognitiveKernel`. `DecisionPlane` is the sole integration boundary and preserves all existing wrapper return shapes.

**Tech Stack:** Node.js ESM, `node:test`, `node:assert/strict`, existing `signed`, `text`, and SHA-256 receipt conventions.

**Spec:** `docs/superpowers/specs/2026-08-20-cognitive-proposal-lifecycle-design.md`

## Global Constraints

- Do not claim execution, authorization, or observed tool effects from a cognitive commit gate.
- Do not modify `src/cognition/decision-state-machine.mjs`.
- Do not change existing `DecisionPlane` cognitive wrapper return shapes.
- Use kernel-produced receipt hashes; do not create substitute evidence from caller input.
- Keep mission id nullable when the task did not provide one.
- Do not build Electron, portable packages, or run packaged smoke.

---

### Task 1: Define the proposal-level lifecycle

**Files:**

- Create: `src/cognition/cognitive-proposal-lifecycle.mjs`
- Create: `tests/cognitive-proposal-lifecycle.test.mjs`

**Interfaces:**

- `CognitiveProposalLifecycle.registerTask({ taskId, missionId?, specificationReceiptSha256, atMs })`
- `observe(taskId, cognitiveObservationReceipt, { atMs? })`, `propose(taskId, cognitiveProposalReceipt, { atMs? })`, `verify(taskId, verifiedProposalReceipt, { atMs? })`, `settle(taskId, cognitiveCommitGateReceipt, { atMs? })`, and `snapshot(taskId?)`
- `propose` accepts only `forge.cognitive-proposal.v1`; an abstention never enters this method.

- [ ] **Step 1: Write failing lifecycle tests**

```js
test('links a cognitive proposal to real task evidence without claiming execution', () => {
  const lifecycle = new CognitiveProposalLifecycle({ clock: () => 100 });
  lifecycle.registerTask({ taskId: 'task-1', specificationReceiptSha256: sha('a'), atMs: 1 });
  lifecycle.observe('task-1', { receiptSha256: sha('b'), createdAtMs: 2 });
  lifecycle.propose('task-1', proposal('proposal-1', sha('c'), 3));
  lifecycle.verify('task-1', verification('proposal-1', 'verified-1', sha('d'), 4));
  const result = lifecycle.settle('task-1', commit('verified-1', true, sha('e'), 5));
  assert.equal(result.decisions[0].state, 'committed');
  assert.equal(result.decisions[0].claims.executionClaimed, false);
  assert.deepEqual(result.decisions[0].observationReceiptSha256s, [sha('b')]);
});
```

Add independent tests for mismatched task ids, verification before proposal, duplicate evidence, double settlement, and a denied gate ending at `rejected`.

- [ ] **Step 2: Verify the test is red**

Run `node --test tests/cognitive-proposal-lifecycle.test.mjs`.

Expected: FAIL because `CognitiveProposalLifecycle` does not exist.

- [ ] **Step 3: Implement the minimal lifecycle**

```js
export class CognitiveProposalLifecycle {
  registerTask(input) { /* record validated task-start receipt */ }
  observe(taskId, receipt) { /* append receipt-only task evidence */ }
  propose(taskId, receipt) { /* create proposed decision from kernel receipt */ }
  verify(taskId, receipt) { /* transition matching proposal to verified */ }
  settle(taskId, receipt) { /* commit when allowed, reject when denied */ }
  snapshot(taskId = null) { /* signed immutable read projection */ }
}
```

Use private validators for SHA-256, timestamp, task, and decision records. The first history entry is the task specification; observations are linked evidence, not execution transitions. A committed decision has `executionClaimed: false` and `observedToolEffectClaimed: false`.

- [ ] **Step 4: Verify the lifecycle is green**

Run `node --test tests/cognitive-proposal-lifecycle.test.mjs`.

Expected: PASS for valid and invalid transition cases.

- [ ] **Step 5: Commit the standalone lifecycle**

Run `git add src/cognition/cognitive-proposal-lifecycle.mjs tests/cognitive-proposal-lifecycle.test.mjs` followed by `git commit -m "feat(cognition): add receipt-bound proposal lifecycle"`.

### Task 2: Integrate at DecisionPlane while keeping caller contracts

**Files:**

- Modify: `src/decision/decision-plane.mjs:7-8, 27-61, 76-79, 139-144, 331-386`
- Modify: `tests/cognitive-decision-plane-integration.test.mjs`

**Interfaces:**

- Consumes `CognitiveProposalLifecycle` from Task 1.
- Produces `DecisionPlane.cognitiveLifecycleSnapshot(taskId = null)`.
- Existing wrapper return objects are preserved unchanged.

- [ ] **Step 1: Write failing integration tests**

```js
test('DecisionPlane retains cognitive returns while projecting proposal lifecycle', () => {
  const plane = new DecisionPlane();
  const start = plane.startCognitiveTask(taskInput('task-1'));
  const observed = plane.observeCognitiveEvent('task-1', evidenceEvent('ev-1'));
  const proposal = plane.proposeCognitiveAction('task-1', actionInput());
  const verified = plane.verifyCognitiveProposal('task-1', proposal.proposalId, verificationInput());
  const committed = plane.commitCognitiveProposal('task-1', verified.verifiedProposalId);
  const lifecycle = plane.cognitiveLifecycleSnapshot('task-1');
  assert.equal(start.schema, 'forge.cognitive-task-start.v1');
  assert.equal(observed.schema, 'forge.cognitive-observation.v1');
  assert.equal(committed.allowed, true);
  assert.equal(lifecycle.decisions[0].proposalReceiptSha256, proposal.receiptSha256);
  assert.equal(lifecycle.decisions[0].claims.executionClaimed, false);
});
```

Add an abstention path asserting `lifecycle.decisions.length === 0`, and a denied commit path asserting `rejected` without execution evidence.

- [ ] **Step 2: Verify the integration test is red**

Run `node --test tests/cognitive-decision-plane-integration.test.mjs`.

Expected: FAIL because `cognitiveLifecycleSnapshot` does not exist.

- [ ] **Step 3: Implement lazy post-success integration**

```js
get cognitiveLifecycle() {
  this.#assertOpen();
  return this._cognitiveLifecycle ??= new CognitiveProposalLifecycle(this.cognitiveLifecycleOptions);
}

startCognitiveTask(input) {
  const receipt = this.cognition.startTask(input);
  this.cognitiveLifecycle.registerTask({
    taskId: receipt.taskId,
    missionId: input.missionId ?? null,
    specificationReceiptSha256: receipt.receiptSha256,
    atMs: Number(this.clock()),
  });
  return receipt;
}
```

Use the same post-success pattern for observation, proposal, verification, and settlement. Do not call `propose` for abstentions. Settle denied gates as rejection. Add a lifecycle-loaded flag and snapshot to `DecisionPlane.snapshot()` without eagerly loading it merely to inspect state.

- [ ] **Step 4: Verify focused integration and cognition gates**

Run `node --test tests/cognitive-proposal-lifecycle.test.mjs tests/cognitive-decision-plane-integration.test.mjs tests/cognitive-kernel.test.mjs tests/cognitive-policy-gates.test.mjs tests/cognitive-decision-kernel-release-gate.test.mjs tests/cognitive-decision-kernel-measurement.test.mjs`.

Expected: PASS; wrapper return shapes and existing cognition claims remain valid.

- [ ] **Step 5: Commit wiring**

Run `git add src/decision/decision-plane.mjs tests/cognitive-decision-plane-integration.test.mjs` followed by `git commit -m "feat(decision): project cognitive proposal lifecycle"`.

### Task 3: Refresh evidence and verify truth surfaces

**Files:**

- Modify generated files only when their generators change them: `docs/MASTER-ACCEPTANCE-LEDGER.md`, `requirements/master-acceptance-ledger.json`, and `docs/ui-v3/ui-v3-source-release.json`.

- [ ] **Step 1: Generate evidence from final source**

Run `npm run build:ui-v3`, `npm run program:nolane`, and `npm run audit:evidence-freshness` in that order.

Expected: distribution receipt matches, program status is `pass`, and freshness checks all 198 requirements with no failures.

- [ ] **Step 2: Inspect exactly what will be committed**

Run `git diff --check`, `git diff --stat`, and `git status --short`.

Expected: only lifecycle source/tests and required generated evidence change; never stage `.serena/`.

- [ ] **Step 3: Commit evidence and push**

Run the precise `git add` for generated evidence, commit `build(cognition): refresh proposal lifecycle evidence`, push `HEAD` to `refs/heads/codex/external-gate-evidence`, then inspect the latest eight GitHub runs. Do not call CI green until GitHub gives `success`.
