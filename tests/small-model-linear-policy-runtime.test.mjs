import test from 'node:test';
import assert from 'node:assert/strict';
import { trainLinearPolicy } from '../src/small-model/linear-policy-trainer.mjs';
import { createModelArtifact } from '../src/small-model/model-artifact.mjs';
import { LinearPolicyRuntime } from '../src/small-model/linear-policy-runtime.mjs';
import { evaluateSpecialistArtifact } from '../src/small-model/specialist-evaluation.mjs';

const H = (char) => char.repeat(64);
const examples = Array.from({ length: 12 }, (_, index) => [
  { state: { phase: 'discovery', hasCandidate: false, variant: index }, action: { type: 'search' } },
  { state: { phase: 'verification', patchReady: true, variant: index }, action: { type: 'test' } },
]).flat();
function artifact() {
  const model = trainLinearPolicy({ examples, dimensions: 64, epochs: 60, learningRate: 0.15, seed: 'runtime' });
  return createModelArtifact({ model, datasetReceiptSha256: H('a'), trainingConfig: { dimensions: 64, epochs: 60, learningRate: 0.15, seed: 'runtime' } });
}

test('linear policy runtime produces top-k content-addressed inference and can abstain', () => {
  const runtime = new LinearPolicyRuntime({ artifact: artifact(), abstainThreshold: 0.55 });
  const result = runtime.infer({ phase: 'discovery', hasCandidate: false, variant: 99 }, { topK: 2 });
  assert.equal(result.status, 'predicted');
  assert.equal(result.action, 'search');
  assert.equal(result.ranking.length, 2);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  const abstain = new LinearPolicyRuntime({ artifact: artifact(), abstainThreshold: 0.999999 }).infer({ phase: 'unknown' });
  assert.equal(abstain.status, 'abstain');
  assert.equal(abstain.action, null);
});

test('specialist evaluation requires independent held-out evidence and reports bounded safety', () => {
  const heldOut = examples.map((item, index) => ({ ...item, id: `e-${index}`, state: { ...item.state, safetyCritical: false } }));
  const value = evaluateSpecialistArtifact({ artifact: artifact(), examples: heldOut, independent: true, heldOut: true, minAccuracy: 0.9, baselineSafetyViolations: 0 });
  assert.equal(value.allowed, true);
  assert.equal(value.accuracy >= 0.9, true);
  assert.equal(value.safetyViolations, 0);
  assert.equal(value.claims.generalCodingIntelligence, false);
  assert.throws(() => evaluateSpecialistArtifact({ artifact: artifact(), examples: heldOut, independent: false, heldOut: true }), /independent/i);
});
