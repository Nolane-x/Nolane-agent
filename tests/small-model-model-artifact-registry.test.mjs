import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelArtifactRegistry } from '../src/small-model/model-artifact-registry.mjs';
import { createModelArtifact } from '../src/small-model/model-artifact.mjs';

const H = (char) => char.repeat(64);
function artifact(version) {
  return createModelArtifact({ specialist: 'tool-router', datasetReceiptSha256: H(version === 1 ? 'a' : 'b'), trainingConfig: { version }, model: { schema: 'nolane.small-model.linear-policy.v1', labels: ['read','test'], dimensions: 4, weights: [[0,1,0,0],[0,-1,0,0]], biases: [0,0], training: { examples: 2, epochs: 1, seed: String(version), lossHistory: [1] } } });
}
function evaluation(value) {
  const base = { schema: 'nolane.small-model.specialist-evaluation.v1', artifactSha256: value.artifactSha256, independent: true, heldOut: true, accuracy: 1, safetyViolations: 0, baselineSafetyViolations: 0, allowed: true, receiptSha256: H('e') };
  return base;
}

test('model artifact registry promotes only approved held-out artifacts and supports rollback', () => {
  const registry = new ModelArtifactRegistry();
  const first = registry.register(artifact(1));
  assert.throws(() => registry.promote({ artifactSha256: first.artifactSha256, evaluation: evaluation(first) }), /approval/i);
  const promoted = registry.promote({ artifactSha256: first.artifactSha256, evaluation: evaluation(first), approvedBy: 'user' });
  assert.equal(promoted.status, 'promoted');
  const second = registry.register(artifact(2));
  registry.promote({ artifactSha256: second.artifactSha256, evaluation: evaluation(second), approvedBy: 'user' });
  assert.equal(registry.active('tool-router').artifactSha256, second.artifactSha256);
  const rolledBack = registry.rollback('tool-router', { approvedBy: 'user' });
  assert.equal(rolledBack.artifactSha256, first.artifactSha256);
  assert.equal(registry.snapshot().promotions, 2);
});

test('model artifact registry rejects mismatched or unsafe evaluation receipts', () => {
  const registry = new ModelArtifactRegistry(); const value = registry.register(artifact(1));
  assert.throws(() => registry.promote({ artifactSha256: value.artifactSha256, evaluation: { ...evaluation(value), artifactSha256: H('f') }, approvedBy: 'user' }), /mismatch/i);
  assert.throws(() => registry.promote({ artifactSha256: value.artifactSha256, evaluation: { ...evaluation(value), allowed: false }, approvedBy: 'user' }), /allowed evaluation/i);
});
