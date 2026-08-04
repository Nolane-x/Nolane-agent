import assert from 'node:assert/strict';
import test from 'node:test';

import { TaskFeatureEncoder } from '../src/learning/task-feature-encoder.mjs';
import { HeldOutPolicyEvaluator } from '../src/learning/held-out-policy-evaluator.mjs';

const H = (ch) => ch.repeat(64);

function outcome(taskId, policyId, success, utility, critical = false, receipt = H('a')) {
  return { taskId, policyId, success, utility, critical, verified: true, verificationReceiptSha256: receipt };
}

test('TaskFeatureEncoder canonicalizes routing features and rejects unbounded raw payloads', () => {
  const encoder = new TaskFeatureEncoder({ capabilityMatrixRevision: H('1') });
  const first = encoder.encode({
    taskId: 'task-1', taskType: 'refactor', languages: ['TypeScript', 'javascript', 'TypeScript'],
    repoSize: { files: 120, bytes: 50_000, symbols: 450 }, risk: 0.7,
    context: { tokenBudget: 16_000, selectedTokens: 8_000 }, tools: ['test', 'git', 'test'], localOnly: true,
  });
  const second = encoder.encode({
    tools: ['git', 'test'], localOnly: true, risk: 0.7,
    languages: ['javascript', 'typescript'], taskType: 'refactor', taskId: 'task-1',
    context: { selectedTokens: 8_000, tokenBudget: 16_000 }, repoSize: { symbols: 450, bytes: 50_000, files: 120 },
  });
  assert.equal(first.receiptSha256, second.receiptSha256);
  assert.deepEqual(first.languages, ['javascript', 'typescript']);
  assert.deepEqual(first.tools, ['git', 'test']);
  assert.equal(first.capabilityMatrixRevision, H('1'));
  assert.equal(first.claims.rawPromptStored, false);
  assert.throws(() => encoder.encode({ taskId: 'x', taskType: 'code', rawPrompt: 'secret' }), /unknown feature field/i);
});

test('HeldOutPolicyEvaluator blocks tuning leakage and unverified outcomes', () => {
  const evaluator = new HeldOutPolicyEvaluator({ minHeldOutTasks: 2 });
  assert.throws(() => evaluator.evaluate({
    tuningTaskIds: ['a'], heldOutTaskIds: ['a', 'b'], baselinePolicyId: 'base', candidatePolicyId: 'candidate',
    outcomes: [outcome('a', 'base', true, 1), outcome('a', 'candidate', true, 2), outcome('b', 'base', true, 1), outcome('b', 'candidate', true, 2)],
  }), /held-out leakage/i);
  assert.throws(() => evaluator.evaluate({
    tuningTaskIds: ['train'], heldOutTaskIds: ['a', 'b'], baselinePolicyId: 'base', candidatePolicyId: 'candidate',
    outcomes: [{ ...outcome('a', 'base', true, 1), verified: false }, outcome('a', 'candidate', true, 2), outcome('b', 'base', true, 1), outcome('b', 'candidate', true, 2)],
  }), /verified outcome/i);
});

test('HeldOutPolicyEvaluator promotes only a verified candidate with no critical regression', () => {
  const evaluator = new HeldOutPolicyEvaluator({ minHeldOutTasks: 2, minUtilityImprovement: 0.1 });
  const pass = evaluator.evaluate({
    tuningTaskIds: ['train'], heldOutTaskIds: ['a', 'b'], baselinePolicyId: 'base', candidatePolicyId: 'candidate',
    outcomes: [
      outcome('a', 'base', true, 1, true, H('a')), outcome('a', 'candidate', true, 1.4, true, H('b')),
      outcome('b', 'base', true, 1, false, H('c')), outcome('b', 'candidate', true, 1.3, false, H('d')),
    ],
  });
  assert.equal(pass.promotable, true);
  assert.equal(pass.heldOutOnly, true);
  assert.equal(pass.candidate.verifiedTasks, 2);
  assert.match(pass.receiptSha256, /^[a-f0-9]{64}$/);

  const blocked = evaluator.evaluate({
    tuningTaskIds: [], heldOutTaskIds: ['a', 'b'], baselinePolicyId: 'base', candidatePolicyId: 'candidate',
    outcomes: [
      outcome('a', 'base', true, 1, true, H('a')), outcome('a', 'candidate', false, 2, true, H('b')),
      outcome('b', 'base', true, 1, false, H('c')), outcome('b', 'candidate', true, 3, false, H('d')),
    ],
  });
  assert.equal(blocked.promotable, false);
  assert.equal(blocked.criticalRegressions, 1);
  assert.ok(blocked.reasons.some((item) => /critical regression/i.test(item)));
});
