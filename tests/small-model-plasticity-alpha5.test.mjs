import test from 'node:test';
import assert from 'node:assert/strict';
import { AdaptationPolicyLearner } from '../src/small-model/adaptation-policy-learner.mjs';
import { LatentMemoryRouter } from '../src/small-model/latent-memory-router.mjs';
import { PlasticityPlane } from '../src/small-model/plasticity-plane.mjs';

const SHA = 'a'.repeat(64);

test('AdaptationPolicyLearner learns only from verified outcomes and keeps policy changes in shadow', () => {
  const learner = new AdaptationPolicyLearner({ learningRate: 0.5, maxExploration: 0.2 });
  assert.throws(() => learner.recordOutcome({ contextKey: 'timeout', action: 'retry', reward: 1, verified: false }), /verified/i);
  learner.recordOutcome({ contextKey: 'timeout', action: 'retry', reward: 1, verified: true, receiptSha256: SHA });
  learner.recordOutcome({ contextKey: 'timeout', action: 'rollback', reward: 0, verified: true, receiptSha256: SHA });
  const decision = learner.select({ contextKey: 'timeout', allowedActions: ['retry', 'rollback'], exploration: 0 });
  assert.equal(decision.action, 'retry');
  assert.equal(decision.status, 'shadow');
  assert.equal(decision.hiddenChainOfThoughtStored, false);
  assert.throws(() => learner.select({ contextKey: 'new', allowedActions: ['a'], exploration: 0.5 }), /exploration budget/i);
});

test('AdaptationPolicyLearner evaluates held-out cases, promotes canary, and rolls back negative transfer', () => {
  const learner = new AdaptationPolicyLearner();
  learner.recordOutcome({ contextKey: 'c1', action: 'probe', reward: 1, verified: true, receiptSha256: SHA });
  learner.recordOutcome({ contextKey: 'c2', action: 'rollback', reward: 1, verified: true, receiptSha256: SHA });
  const evaluation = learner.evaluateHeldOut({
    independent: true, heldOut: true,
    cases: [
      { contextKey: 'c1', allowedActions: ['probe', 'guess'], optimalAction: 'probe', baselineAction: 'guess', safety: { probe: 0, guess: 0 } },
      { contextKey: 'c2', allowedActions: ['retry', 'rollback'], optimalAction: 'rollback', baselineAction: 'retry', safety: { rollback: 0, retry: 1 } },
    ],
  });
  assert.equal(evaluation.allowed, true);
  const promoted = learner.promoteCanary({ evaluationReceipt: evaluation, canaryFraction: 0.1 });
  assert.equal(promoted.status, 'canary');
  assert.throws(() => learner.recordCanaryOutcome({ version: promoted.version, verified: true, forwardTransfer: 0.1, backwardTransfer: -0.5, safetyViolations: 0 }), /negative transfer/i);
  assert.equal(learner.snapshot().rollbacks, 1);
});

test('AdaptationPolicyLearner abstains when no verified action evidence exists', () => {
  const learner = new AdaptationPolicyLearner();
  const decision = learner.select({ contextKey: 'unknown', allowedActions: ['a', 'b'], exploration: 0 });
  assert.equal(decision.status, 'abstain');
  assert.equal(decision.action, null);
});

test('LatentMemoryRouter routes by domain, dimensions and trust with bounded leases', () => {
  const router = new LatentMemoryRouter({ abstainUncertainty: 0.8 });
  router.registerExpert({ id: 'js-memory', version: '1', domains: ['javascript'], latentDimensions: 3, maxConcurrent: 1, trust: 0.8, provenanceReceiptSha256: SHA });
  router.registerExpert({ id: 'general-memory', version: '1', domains: ['*'], latentDimensions: 3, maxConcurrent: 2, trust: 0.5, provenanceReceiptSha256: SHA });
  const routed = router.route({ domain: 'javascript', latent: [0.1, 0.2, 0.3], uncertainty: 0.2 });
  assert.equal(routed.expertId, 'js-memory');
  const second = router.route({ domain: 'javascript', latent: [0.2, 0.2, 0.3], uncertainty: 0.2 });
  assert.equal(second.expertId, 'general-memory');
  router.release(routed.leaseId);
  assert.equal(router.route({ domain: 'javascript', latent: [0.3, 0.2, 0.3], uncertainty: 0.2 }).expertId, 'js-memory');
  assert.throws(() => router.route({ domain: 'javascript', latent: [0.1], uncertainty: 0.2 }), /dimensions/i);
});

test('LatentMemoryRouter abstains at high uncertainty and rolls back an expert on verified negative transfer', () => {
  const router = new LatentMemoryRouter({ minBackwardTransfer: -0.05, abstainUncertainty: 0.8 });
  router.registerExpert({ id: 'memory', version: '1', domains: ['*'], latentDimensions: 2, maxConcurrent: 1, trust: 0.8, provenanceReceiptSha256: SHA });
  router.registerExpert({ id: 'memory', version: '2', domains: ['*'], latentDimensions: 2, maxConcurrent: 1, trust: 0.9, provenanceReceiptSha256: SHA });
  assert.equal(router.route({ domain: 'python', latent: [0, 1], uncertainty: 0.9 }).status, 'abstain');
  assert.throws(() => router.recordOutcome({ id: 'memory', version: '2', success: false, verified: true, backwardTransfer: -0.2, receiptSha256: SHA }), /negative transfer/i);
  assert.equal(router.activeExpert('memory').version, '1');
  assert.equal(router.snapshot().rollbacks, 1);
});

test('PlasticityPlane attaches learning components and exposes lineage without parameter values', () => {
  const plane = new PlasticityPlane();
  const learner = new AdaptationPolicyLearner();
  const router = new LatentMemoryRouter();
  plane.attachAdaptationPolicy(learner);
  plane.attachLatentMemoryRouter(router);
  const snapshot = plane.learningSnapshot();
  assert.equal(snapshot.adaptationPolicy.schema, 'nolane.small-model.adaptation-policy-learner.v1');
  assert.equal(snapshot.latentMemoryRouter.schema, 'nolane.small-model.latent-memory-router.v1');
  assert.equal(JSON.stringify(snapshot).includes('parameters'), false);
  assert.match(snapshot.receiptSha256, /^[a-f0-9]{64}$/);
});
