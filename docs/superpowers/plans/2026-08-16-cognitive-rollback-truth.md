# Cognitive Rollback Truthfulness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent CognitiveKernel from representing an unexecuted rollback request as a completed state restoration.

**Architecture:** Retain a pure cognitive kernel and express an absent restoration backend as an explicit request. An injected executor creates an evidence-linked execution; a separately injected verifier alone can promote it to a verified result.

**Tech Stack:** Node.js ESM, `node:test`, existing signed receipt helpers.

## Global Constraints

- Preserve the existing `rollback(taskId, receiptId)` string-call compatibility.
- Do not add a default executor or any filesystem/network side effect.
- An execution requires two SHA-256 evidence receipts; a verified result also requires a verifier-owned SHA-256 receipt.
- Keep all receipts bounded and signed through the existing kernel mechanism.

---

### Task 1: Specify rollback request and verified result behavior

**Files:**
- Modify: `tests/cognitive-kernel.test.mjs`

**Interfaces:**
- Consumes: `CognitiveKernel.rollback(taskId, request)`.
- Produces: Assertions for `forge.cognitive-rollback-request.v1` and a verified result.

- [ ] **Step 1: Write failing tests**

```js
const requested = kernel.rollback('task-rollback', 'checkpoint-a');
assert.equal(requested.schema, 'forge.cognitive-rollback-request.v1');
assert.equal(requested.status, 'requested');

const executed = kernelWithExecutor.rollback('task-rollback', { targetReceiptId: 'checkpoint-a', rollbackPoint: 'base' });
assert.equal(executed.status, 'executed');

const verified = kernelWithVerifier.rollback('task-rollback', { targetReceiptId: 'checkpoint-a', rollbackPoint: 'base' });
assert.equal(verified.status, 'verified');
assert.match(verified.restoredStateReceiptSha256, /^[a-f0-9]{64}$/);
assert.match(verified.effectVerificationReceiptSha256, /^[a-f0-9]{64}$/);
assert.match(verified.verificationReceiptSha256, /^[a-f0-9]{64}$/);
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test tests/cognitive-kernel.test.mjs`

Expected: FAIL because the old receipt schema does not identify an unexecuted request and no executor result exists.

### Task 2: Implement the minimal proven rollback lifecycle

**Files:**
- Modify: `src/cognition/cognitive-kernel.mjs`
- Test: `tests/cognitive-kernel.test.mjs`

**Interfaces:**
- Consumes: optional constructor fields `rollbackExecutor` and `rollbackVerifier`.
- Produces: `rollback(taskId, string | { targetReceiptId, rollbackPoint })` signed receipts.

- [ ] **Step 1: Add constructor injection and input normalization**

```js
this.rollbackExecutor = typeof rollbackExecutor === 'function' ? rollbackExecutor : null;
const request = typeof input === 'string' ? { targetReceiptId: input } : input;
```

- [ ] **Step 2: Record a request before any optional execution**

```js
const requested = this.#record(signed({
  schema: 'forge.cognitive-rollback-request.v1',
  taskId: task.taskId,
  targetReceiptId: text(request.targetReceiptId, 'targetReceiptId', 512),
  rollbackPoint: text(request.rollbackPoint ?? '', 'rollbackPoint', 512),
  status: 'requested',
  requestedAtMs: Number(this.clock()),
}));
```

- [ ] **Step 3: Record a complete executor result without overclaiming verification**

```js
const execution = this.rollbackExecutor?.({ taskId: task.taskId, requestReceiptSha256: requested.receiptSha256, ...request });
if (!execution) return requested;
const restoredStateReceiptSha256 = text(execution.restoredStateReceiptSha256, 'restoredStateReceiptSha256', 64);
const effectVerificationReceiptSha256 = text(execution.effectVerificationReceiptSha256, 'effectVerificationReceiptSha256', 64);
```

- [ ] **Step 4: Validate evidence shape and require an independent verifier for a verified result**

```js
const verification = this.rollbackVerifier?.({ executionReceiptSha256, restoredStateReceiptSha256, effectVerificationReceiptSha256 });
if (!verification) return executed;
const verificationReceiptSha256 = receiptHash(verification.verificationReceiptSha256, 'verificationReceiptSha256');
const status = verification.verified === true ? 'verified' : 'unverified';
```

- [ ] **Step 5: Keep rejected verification state truthful**

```js
assert.equal(rejected.status, 'unverified');
assert.equal('verifiedAtMs' in rejected, false);
assert.equal(typeof rejected.resolvedAtMs, 'number');
```

- [ ] **Step 6: Run the focused test suite to verify GREEN**

Run: `node --test tests/cognitive-kernel.test.mjs`

Expected: PASS.

### Task 3: Verify no regression and commit

**Files:**
- Modify: no additional files.

**Interfaces:**
- Consumes: all cognition test suites.
- Produces: a focused commit with source, tests, design and plan.

- [ ] **Step 1: Run the cognition suites**

Run: `node --test tests/cognitive-kernel.test.mjs tests/cognitive-policy-gates.test.mjs tests/cognitive-decision-plane-integration.test.mjs tests/decision-state-machine.test.mjs tests/agency-ledger.test.mjs`

Expected: PASS.

- [ ] **Step 2: Check the diff**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Commit the focused change**

```bash
git add src/cognition/cognitive-kernel.mjs tests/cognitive-kernel.test.mjs docs/superpowers/specs/2026-08-16-cognitive-rollback-truth-design.md docs/superpowers/plans/2026-08-16-cognitive-rollback-truth.md
git commit -m "fix(cognition): distinguish rollback requests from verified restores"
```

## Self-review

- Spec coverage: Tasks 1–2 implement each listed invariant; Task 3 verifies the affected public cognition surface.
- Placeholder scan: no deferred implementation markers are present.
- Type consistency: the constructor dependency and `rollback` request object use the exact names stated in every task.
