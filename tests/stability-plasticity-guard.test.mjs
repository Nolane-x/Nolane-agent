import assert from 'node:assert/strict';
import test from 'node:test';
import { StabilityPlasticityGuard } from '../src/skills/stability-plasticity-guard.mjs';

const h = (c) => c.repeat(64);
function base(extra = {}) {
  return {
    candidateSkillId: 'skill-1', candidateState: 'transfer-tested',
    baseline: { oldTaskSuccess: 0.9, newTaskSuccess: 0.4, lateTaskSuccess: 0.6, memoryItems: 100 },
    candidate: { oldTaskSuccess: 0.9, newTaskSuccess: 0.75, lateTaskSuccess: 0.72, memoryItems: 112 },
    exceptionRetention: true, sourceTaskOnly: false,
    policyLineage: ['policy-v1', 'policy-v2'], rollbackTarget: { policyId: 'policy-v1', receiptSha256: h('a') },
    verificationReceiptSha256: h('b'), ...extra,
  };
}

test('StabilityPlasticityGuard promotes positive transfer without old-skill regression', () => {
  const guard = new StabilityPlasticityGuard();
  const decision = guard.evaluate(base());
  assert.equal(decision.promotable, true);
  assert.ok(decision.metrics.forwardTransfer > 0);
  assert.equal(decision.metrics.backwardTransfer, 0);
  assert.equal(decision.rollbackTarget.policyId, 'policy-v1');
});

test('StabilityPlasticityGuard blocks backward regression and negative transfer', () => {
  const guard = new StabilityPlasticityGuard({ maxBackwardLoss: 0.03, maxNegativeTransfer: 0.02 });
  const backward = guard.evaluate(base({ candidate: { oldTaskSuccess: 0.7, newTaskSuccess: 0.75, lateTaskSuccess: 0.72, memoryItems: 110 } }));
  assert.equal(backward.promotable, false);
  assert.ok(backward.reasons.some((x) => /backward/i.test(x)));
  const negative = guard.evaluate(base({ baseline: { oldTaskSuccess: 0.9, newTaskSuccess: 0.8, lateTaskSuccess: 0.6, memoryItems: 100 }, candidate: { oldTaskSuccess: 0.9, newTaskSuccess: 0.6, lateTaskSuccess: 0.7, memoryItems: 105 } }));
  assert.equal(negative.promotable, false);
  assert.ok(negative.metrics.negativeTransfer > 0);
});

test('StabilityPlasticityGuard blocks excessive memory growth and lost exceptions', () => {
  const guard = new StabilityPlasticityGuard({ maxMemoryGrowthRatio: 0.25 });
  const growth = guard.evaluate(base({ candidate: { oldTaskSuccess: 0.9, newTaskSuccess: 0.8, lateTaskSuccess: 0.8, memoryItems: 150 } }));
  assert.equal(growth.promotable, false);
  assert.ok(growth.reasons.some((x) => /memory growth/i.test(x)));
  const exception = guard.evaluate(base({ exceptionRetention: false }));
  assert.equal(exception.promotable, false);
  assert.ok(exception.reasons.some((x) => /exception/i.test(x)));
});

test('StabilityPlasticityGuard rejects source-task-only success and missing transfer state', () => {
  const guard = new StabilityPlasticityGuard();
  assert.equal(guard.evaluate(base({ sourceTaskOnly: true })).promotable, false);
  assert.equal(guard.evaluate(base({ candidateState: 'draft' })).promotable, false);
});

test('StabilityPlasticityGuard requires exact lineage and rollback receipts', () => {
  const guard = new StabilityPlasticityGuard();
  assert.throws(() => guard.evaluate(base({ policyLineage: [], rollbackTarget: null })), /lineage|rollback/i);
  assert.throws(() => guard.evaluate(base({ rollbackTarget: { policyId: 'policy-v1', receiptSha256: 'bad' } })), /SHA-256/i);
});
