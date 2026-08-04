import test from 'node:test';
import assert from 'node:assert/strict';
import { DevelopmentalGoalEngine } from '../src/development/developmental-goal-engine.mjs';
import { DevelopmentalStageController } from '../src/development/developmental-stage-controller.mjs';

const sha = (c) => c.repeat(64);

test('developmental goals stay in the ZPD and cannot delay critical mission obligations', () => {
  const engine = new DevelopmentalGoalEngine({ maxGoals: 32 });
  const proposed = engine.propose({
    sandbox: true,
    mission: { completionBlocked: false, criticalObligationsOpen: 0 },
    capability: 0.55,
    budgets: { tokens: 4000, rssMbSeconds: 500, durationMs: 60000 },
    candidates: [
      { id: 'too-easy', kind: 'rename', difficulty: 0.2, learningProgress: 0.1, reuse: 0.3, relevance: 0.9, compute: 0.1, risk: 0.1 },
      { id: 'zpd', kind: 'mutation', difficulty: 0.65, learningProgress: 0.8, reuse: 0.8, relevance: 0.9, compute: 0.3, risk: 0.2 },
      { id: 'too-hard', kind: 'platform', difficulty: 0.98, learningProgress: 0.9, reuse: 0.8, relevance: 0.8, compute: 0.9, risk: 0.9 },
    ],
  });
  assert.equal(proposed.selectedGoalId, 'zpd');
  assert.equal(proposed.selected.kind, 'mutation');
  const blocked = engine.propose({ sandbox: true, mission: { completionBlocked: true, criticalObligationsOpen: 1 }, capability: 0.8, candidates: [{ id: 'novel', kind: 'distractor', difficulty: 0.8, learningProgress: 1, reuse: 1, relevance: 0.1, compute: 0.1, risk: 0.1 }] });
  assert.equal(blocked.status, 'blocked');
  assert.ok(blocked.reasons.includes('mission-completion-delayed'));
});

test('developmental stages require held-out transfer, regression safety, future-self simulation and human policy gate', () => {
  const stages = new DevelopmentalStageController({ stages: [
    { id: 'observe', autonomyCeiling: 0.2, exploration: 0.1, replayRate: 0.2, memoryThreshold: 0.8, promoteRate: 0 },
    { id: 'assist', autonomyCeiling: 0.4, exploration: 0.2, replayRate: 0.3, memoryThreshold: 0.75, promoteRate: 0.05 },
  ] });
  const rejected = stages.evaluateAdvance({ from: 'observe', to: 'assist', heldOutTransfer: { passed: false, receiptSha256: sha('1') }, regression: { passed: true, receiptSha256: sha('2') }, futureSelf: { viable: true, receiptSha256: sha('3') }, humanPolicyGate: { approved: true, receiptSha256: sha('4') } });
  assert.equal(rejected.allowed, false);
  const allowed = stages.evaluateAdvance({ from: 'observe', to: 'assist', heldOutTransfer: { passed: true, receiptSha256: sha('5') }, regression: { passed: true, receiptSha256: sha('6') }, futureSelf: { viable: true, receiptSha256: sha('7') }, humanPolicyGate: { approved: true, receiptSha256: sha('8') } });
  assert.equal(allowed.allowed, true);
  const update = stages.evaluatePolicyUpdate({ stageId: 'assist', proposed: { exploration: 0.7, replayRate: 0.4, memoryThreshold: 0.6, promoteRate: 0.2 }, futureSelf: { backwardTransfer: -0.2, negativeTransfer: 0.3, resourceGrowth: 0.5, receiptSha256: sha('9') }, heldOutTransfer: { passed: true, receiptSha256: sha('a') }, rollbackReceiptSha256: sha('b') });
  assert.equal(update.allowed, false);
  assert.ok(update.reasons.includes('future-self-regression'));
  assert.equal(stages.snapshot().claims.productionPolicyPromotionAllowed, false);
});
