import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelArtifact, serializeModelArtifact, loadModelArtifact } from '../src/small-model/model-artifact.mjs';

const H = (char) => char.repeat(64);
const model = {
  schema: 'nolane.small-model.linear-policy.v1', labels: ['read','test'], dimensions: 4,
  weights: [[0, 1, 2, 3], [0, -1, -2, -3]], biases: [0.1, -0.1],
  training: { examples: 4, epochs: 2, seed: 'x', lossHistory: [1, 0.5] },
};

test('model artifact is content-addressed, byte-stable and round-trippable', () => {
  const artifact = createModelArtifact({ model, datasetReceiptSha256: H('a'), trainingConfig: { dimensions: 4, epochs: 2, learningRate: 0.1, seed: 'x' } });
  const bytes = serializeModelArtifact(artifact);
  const loaded = loadModelArtifact(bytes);
  assert.equal(loaded.artifactSha256, artifact.artifactSha256);
  assert.deepEqual(loaded.model.labels, ['read','test']);
  assert.equal(serializeModelArtifact(loaded), bytes);
  assert.equal(loaded.claims.generalCodingIntelligence, false);
});

test('model artifact loader rejects tampered weights and malformed shapes', () => {
  const artifact = createModelArtifact({ model, datasetReceiptSha256: H('a'), trainingConfig: { dimensions: 4, epochs: 2, learningRate: 0.1, seed: 'x' } });
  const tampered = JSON.parse(serializeModelArtifact(artifact));
  tampered.model.weights[0][1] = 99;
  assert.throws(() => loadModelArtifact(JSON.stringify(tampered)), /hash mismatch/i);
  assert.throws(() => createModelArtifact({ model: { ...model, weights: [[1], [2]] }, datasetReceiptSha256: H('a'), trainingConfig: {} }), /shape/i);
});
