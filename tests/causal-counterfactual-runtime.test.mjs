import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { CausalInterventionLab } from '../src/cognition/causal-intervention-lab.mjs';
import { CounterfactualChangeRuntime } from '../src/world-model/counterfactual-change-runtime.mjs';

const sha = (value) => canonicalSha256(value);
const citation = (kind) => ({ kind, sourceHash: sha(kind) });

test('causal intervention changes exactly one variable and holds declared constants fixed', async () => {
  const lab = new CausalInterventionLab();
  const result = await lab.run({
    interventionId: 'timeout-only',
    baselineState: { timeoutMs: 1000, retryCount: 2, payload: 'same' },
    intervention: { variable: 'timeoutMs', value: 2000 },
    heldConstantVariables: ['retryCount', 'payload'],
    execute: async (state) => ({ observedState: state, outcome: { failures: state.timeoutMs === 2000 ? 0 : 1 }, receiptSha256: sha(state) }),
  });
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.changedVariables, ['timeoutMs']);
  assert.deepEqual(result.heldConstantsVerified, ['payload', 'retryCount']);
  assert.equal(result.claims.productionStateMutated, false);

  await assert.rejects(() => lab.run({
    interventionId: 'bad', baselineState: { a: 1, b: 2 }, intervention: { variable: 'a', value: 3 }, heldConstantVariables: ['b'],
    execute: async () => ({ observedState: { a: 3, b: 9 }, outcome: {}, receiptSha256: sha('bad') }),
  }), /held constant changed/);
});

test('counterfactual runtime simulates API dependency state test and user-visible effects', () => {
  const runtime = new CounterfactualChangeRuntime();
  const imagined = runtime.imagine({
    changeId: 'change-1', baselineCandidateId: 'no-change',
    candidates: [
      { candidateId: 'no-change', reliability: 0.9, effects: { api: 0, dependency: 0, state: 0, test: 0, userVisible: 0 }, utility: 0, citations: [citation('baseline')] },
      { candidateId: 'patch-a', reliability: 0.85, effects: { api: -1, dependency: 0, state: 2, test: 3, userVisible: 2 }, utility: 6, citations: [citation('api'), citation('test')] },
      { candidateId: 'patch-b', reliability: 0.8, effects: { api: 0, dependency: -2, state: 1, test: 1, userVisible: 1 }, utility: 1, citations: [citation('dependency')] },
    ],
  });
  assert.equal(imagined.phase, 'imagine');
  assert.equal(imagined.selectedCandidateId, 'patch-a');
  assert.deepEqual(Object.keys(imagined.effectDimensions).sort(), ['api','dependency','state','test','userVisible'].sort());
  assert.equal(imagined.claims.observedEvidence, false);
});

test('verify and execute are strict phases and execute requires observed receipt', async () => {
  const runtime = new CounterfactualChangeRuntime();
  const imagined = runtime.imagine({
    changeId: 'change-2', baselineCandidateId: 'no-change',
    candidates: [
      { candidateId: 'no-change', reliability: 1, effects: { api: 0, dependency: 0, state: 0, test: 0, userVisible: 0 }, utility: 0, citations: [citation('baseline')] },
      { candidateId: 'patch', reliability: 0.9, effects: { api: 0, dependency: 0, state: 1, test: 2, userVisible: 1 }, utility: 4, citations: [citation('patch')] },
    ],
  });
  await assert.rejects(() => runtime.execute(imagined.receiptSha256, { executionReceiptSha256: sha('execute'), apply: async () => ({ status: 'pass' }) }), /verified counterfactual receipt/);
  const verified = runtime.verify(imagined.receiptSha256, { observedReceiptSha256: sha('probe'), observedEffects: { api: 0, dependency: 0, state: 1, test: 2, userVisible: 1 }, status: 'pass' });
  assert.equal(verified.phase, 'verify');
  let applied = false;
  const executed = await runtime.execute(verified.receiptSha256, { executionReceiptSha256: sha('execute'), apply: async ({ candidateId }) => { applied = true; return { status: 'pass', candidateId, receiptSha256: sha('applied') }; } });
  assert.equal(applied, true);
  assert.equal(executed.phase, 'execute');
  assert.equal(executed.status, 'pass');
});

test('verified outcome records whether simulation improved or worsened the decision', async () => {
  const runtime = new CounterfactualChangeRuntime();
  const imagined = runtime.imagine({ changeId: 'change-3', baselineCandidateId: 'no-change', candidates: [
    { candidateId: 'no-change', reliability: 1, effects: { api: 0, dependency: 0, state: 0, test: 0, userVisible: 0 }, utility: 1, citations: [citation('baseline')] },
    { candidateId: 'patch', reliability: 0.9, effects: { api: 0, dependency: 0, state: 1, test: 2, userVisible: 2 }, utility: 5, citations: [citation('patch')] },
  ] });
  const verified = runtime.verify(imagined.receiptSha256, { observedReceiptSha256: sha('probe-3'), observedEffects: { api: 0, dependency: 0, state: 1, test: 2, userVisible: 2 }, status: 'pass' });
  const executed = await runtime.execute(verified.receiptSha256, { executionReceiptSha256: sha('execute-3'), apply: async ({ candidateId }) => ({ status: 'pass', candidateId, receiptSha256: sha('applied-3') }) });
  const improved = runtime.recordOutcome(executed.receiptSha256, { observedUtility: 7, baselineObservedUtility: 2, observedReceiptSha256: sha('outcome-3') });
  assert.equal(improved.decisionImpact, 'improved');
  assert.equal(improved.observedUtilityDelta, 5);
  const worsened = runtime.recordOutcome(executed.receiptSha256, { observedUtility: -1, baselineObservedUtility: 2, observedReceiptSha256: sha('outcome-4') });
  assert.equal(worsened.decisionImpact, 'worsened');
});
