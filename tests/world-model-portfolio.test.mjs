import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldModelRegistry } from '../src/world-model/world-model-registry.mjs';
import { ForesightController } from '../src/world-model/foresight-controller.mjs';

const sha = (c) => c.repeat(64);

test('world model registry selects the best compatible domain model and learns reliability only from verified outcomes', () => {
  const registry = new WorldModelRegistry();
  registry.register({ id: 'repo-fast', domain: 'repository', version: '1', reliability: 0.72, cost: { tokens: 200, rssMbSeconds: 20 }, failureSignatures: ['dynamic-import'], adapter: async () => ({ predictions: [] }) });
  registry.register({ id: 'repo-accurate', domain: 'repository', version: '2', reliability: 0.91, cost: { tokens: 500, rssMbSeconds: 30 }, failureSignatures: [], adapter: async () => ({ predictions: [] }) });
  registry.register({ id: 'browser', domain: 'browser', version: '1', reliability: 0.99, cost: { tokens: 100 }, adapter: async () => ({ predictions: [] }) });
  const selected = registry.select({ domain: 'repository', maxTokens: 600, failureSignature: 'dynamic-import' });
  assert.equal(selected.model.id, 'repo-accurate');
  assert.throws(() => registry.recordOutcome('repo-accurate', { verified: false, success: true, receiptSha256: sha('a') }), /verified outcome/i);
  const updated = registry.recordOutcome('repo-accurate', { verified: true, success: false, receiptSha256: sha('b') });
  assert.ok(updated.reliability < 0.91);
  assert.equal(registry.snapshot().claims.selfDeclaredCapabilityAccepted, false);
});

test('foresight controller chooses bounded simulation economics and falls back to a real probe', () => {
  const controller = new ForesightController({ minimumReliability: 0.65, maximumHorizon: 8, maximumRollouts: 4 });
  const simulate = controller.decide({ risk: 0.9, uncertainty: 0.8, decisionImpact: 0.9, expectedInformationGain: 0.8, modelReliability: 0.85, cost: { tokens: 200, rssMbSeconds: 30 }, candidateCount: 3 });
  assert.equal(simulate.action, 'simulate');
  assert.ok(simulate.horizon >= 2 && simulate.horizon <= 8);
  assert.equal(simulate.rolloutCount, 3);
  const probe = controller.decide({ risk: 0.9, uncertainty: 0.9, decisionImpact: 0.9, expectedInformationGain: 0.8, modelReliability: 0.3, cost: { tokens: 100 }, candidateCount: 2 });
  assert.equal(probe.action, 'real-probe-required');
  const skip = controller.decide({ risk: 0.1, uncertainty: 0.1, decisionImpact: 0.1, expectedInformationGain: 0.05, modelReliability: 0.9, cost: { tokens: 8000, rssMbSeconds: 500 }, candidateCount: 1 });
  assert.equal(skip.action, 'skip-simulation');
});
