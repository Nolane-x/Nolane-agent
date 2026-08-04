import test from 'node:test';
import assert from 'node:assert/strict';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';

const H = (char) => char.repeat(64);
const examples = Array.from({ length: 12 }, (_, index) => [
  { state: { phase: 'discovery', hasCandidate: false, variant: index }, action: { type: 'search' } },
  { state: { phase: 'verification', patchReady: true, variant: index }, action: { type: 'test' } },
]).flat();

test('foundation trains, evaluates, promotes, infers, and rolls back bounded specialist artifacts', async () => {
  const service = new SmallModelFoundationService();
  assert.equal(service.status().trainedModel, false);

  const first = service.trainSpecialist({
    specialist: 'tool-router', examples, datasetReceiptSha256: H('a'),
    trainingConfig: { dimensions: 64, epochs: 60, learningRate: 0.15, seed: 'foundation-v1' },
  });
  assert.match(first.artifactSha256, /^[a-f0-9]{64}$/);
  assert.equal(service.status().trainedModel, true);
  assert.equal(service.status().trainedArtifacts, 1);

  const inference = service.inferSpecialist({ artifactSha256: first.artifactSha256, state: { phase: 'discovery', hasCandidate: false, variant: 99 }, topK: 2 });
  assert.equal(inference.action, 'search');
  assert.equal(inference.claims.generalCodingIntelligence, false);

  const evaluation = service.evaluateTrainedSpecialist({ artifactSha256: first.artifactSha256, examples, independent: true, heldOut: true, minAccuracy: 0.9 });
  assert.equal(evaluation.allowed, true);
  assert.throws(() => service.promoteTrainedSpecialist({ artifactSha256: first.artifactSha256, evaluation }), /approval/i);
  const promotion = service.promoteTrainedSpecialist({ artifactSha256: first.artifactSha256, evaluation, approvedBy: 'checkpoint-owner' });
  assert.equal(promotion.status, 'promoted');
  assert.equal(service.activeTrainedSpecialist('tool-router').artifactSha256, first.artifactSha256);

  const second = service.trainSpecialist({
    specialist: 'tool-router', examples, datasetReceiptSha256: H('b'),
    trainingConfig: { dimensions: 64, epochs: 60, learningRate: 0.15, seed: 'foundation-v2' },
  });
  const secondEvaluation = service.evaluateTrainedSpecialist({ artifactSha256: second.artifactSha256, examples, independent: true, heldOut: true, minAccuracy: 0.9 });
  service.promoteTrainedSpecialist({ artifactSha256: second.artifactSha256, evaluation: secondEvaluation, approvedBy: 'checkpoint-owner' });
  assert.equal(service.activeTrainedSpecialist('tool-router').artifactSha256, second.artifactSha256);
  const rolledBack = service.rollbackTrainedSpecialist({ specialist: 'tool-router', approvedBy: 'checkpoint-owner' });
  assert.equal(rolledBack.artifactSha256, first.artifactSha256);
  assert.equal(service.snapshot().artifactRegistry.rollbacks, 1);
});
