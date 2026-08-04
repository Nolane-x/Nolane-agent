import test from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveModelGovernor } from '../src/superiority/adaptive-model-governor.mjs';

const H = (c) => c.repeat(64);

function registerBase(governor) {
  governor.registerModel({ modelId: 'small', tier: 'small', privacy: 'remote', status: 'active', costPer1kTokens: 0.1, latencyMs: 50, baselineReliability: 0.86, capabilities: ['coding', 'verification'] });
  governor.registerModel({ modelId: 'large', tier: 'large', privacy: 'remote', status: 'active', costPer1kTokens: 2, latencyMs: 300, baselineReliability: 0.97, capabilities: ['coding', 'verification'] });
  governor.registerModel({ modelId: 'local', tier: 'local', privacy: 'local', status: 'active', costPer1kTokens: 0, latencyMs: 100, baselineReliability: 0.8, capabilities: ['coding', 'verification'] });
}

test('adaptive model governor chooses the smallest sufficient model and escalates high-risk tasks to independent verification', () => {
  const governor = new AdaptiveModelGovernor({ clock: () => 1000 });
  registerBase(governor);
  const easy = governor.route({ taskId: 'easy', taskFamily: 'coding', difficulty: 0.2, uncertainty: 0.1, blastRadius: 0.1, tokenBudget: 2000 });
  assert.equal(easy.primaryModelId, 'small');
  assert.equal(easy.independentVerificationRequired, false);

  const risky = governor.route({ taskId: 'risky', taskFamily: 'coding', difficulty: 0.9, uncertainty: 0.9, blastRadius: 0.9, verificationCritical: true, tokenBudget: 10000 });
  assert.equal(risky.primaryModelId, 'large');
  assert.notEqual(risky.verifierModelId, risky.primaryModelId);
  assert.equal(risky.independentVerificationRequired, true);
  assert.equal(risky.authorization.automaticModelPromotionAllowed, false);

  const privateRoute = governor.route({ taskId: 'private', taskFamily: 'coding', difficulty: 0.3, uncertainty: 0.2, blastRadius: 0.2, privacyRequired: true, tokenBudget: 2000 });
  assert.equal(privateRoute.primaryModelId, 'local');
  assert.equal(privateRoute.claims.rawPromptStored, false);
});

test('adaptive model governor learns only from observed verified outcomes and keeps promotion human-gated', () => {
  const governor = new AdaptiveModelGovernor({ limits: { minimumPromotionSamples: 3 } });
  registerBase(governor);
  governor.registerModel({ modelId: 'candidate-small', tier: 'small', privacy: 'remote', status: 'shadow', costPer1kTokens: 0.05, latencyMs: 40, baselineReliability: 0.7, capabilities: ['coding', 'verification'] });
  const route = governor.route({ taskId: 'calibration', taskFamily: 'coding', difficulty: 0.3, uncertainty: 0.2, blastRadius: 0.2, tokenBudget: 2000 });
  assert.throws(() => governor.recordOutcome({ routeReceiptSha256: route.receiptSha256, modelId: 'candidate-small', observed: false, verified: true, verifierReceiptSha256: H('a') }), /observed/i);
  for (let index = 0; index < 3; index += 1) governor.recordOutcome({ routeReceiptSha256: route.receiptSha256, modelId: 'candidate-small', observed: true, verified: true, verifierReceiptSha256: String(index + 1).repeat(64), latencyMs: 30, cost: 0.01 });
  assert.throws(() => governor.authorizePromotion('candidate-small', { approvedByHuman: false, actor: 'agent', approvalReceiptSha256: H('b') }), /human/i);
  const promoted = governor.authorizePromotion('candidate-small', { approvedByHuman: true, actor: 'maintainer', approvalReceiptSha256: H('b') });
  assert.equal(promoted.status, 'active');
  const snapshot = governor.snapshot();
  assert.equal(snapshot.claims.automaticPromotionAllowed, false);
  assert.equal(snapshot.models.find((item) => item.modelId === 'candidate-small').samples, 3);
  assert.equal('rawPrompt' in snapshot, false);
});
