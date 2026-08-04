import test from 'node:test';
import assert from 'node:assert/strict';
import { CounterfactualSimulator } from '../src/world-model/counterfactual-simulator.mjs';

const sha = (c) => c.repeat(64);

function adapter() {
  let calls = 0;
  return {
    get calls() { return calls; },
    async rollout({ candidate }) {
      calls += 1;
      const table = {
        'no-change': { reliability: 0.92, effects: { criteria: 0, regressions: 0, changedSymbols: 0 }, blastRadius: 0, rollbackFeasibility: 1 },
        'partial-fix': { reliability: 0.88, effects: { criteria: 2, regressions: 0, changedSymbols: 1 }, blastRadius: 0.2, rollbackFeasibility: 0.95 },
        'reuse-abstraction': { reliability: 0.55, effects: { criteria: 2, regressions: 1, changedSymbols: 5 }, blastRadius: 0.8, rollbackFeasibility: 0.5 },
      };
      return { ...table[candidate.id], provenance: [{ sourceHash: sha(candidate.id === 'no-change' ? '1' : candidate.id === 'partial-fix' ? '2' : '3'), kind: 'fixture-model' }] };
    },
  };
}

test('counterfactual simulator preserves alternatives, prunes unreliable states, caches by environment, and never commits', async () => {
  const model = adapter();
  const simulator = new CounterfactualSimulator({ minimumReliability: 0.6, maximumCandidates: 4 });
  const input = {
    state: { stateHash: sha('1'), environmentDigest: sha('2'), repositoryDigest: sha('3') },
    model: { id: 'repo-model', version: '1', reliability: 0.9, adapter: model },
    horizon: 3,
    candidates: [
      { id: 'no-change', kind: 'no-change', assumptions: ['baseline-stable'] },
      { id: 'partial-fix', kind: 'partial-change', assumptions: ['single-owner'] },
      { id: 'reuse-abstraction', kind: 'reuse-abstraction', assumptions: ['shared-api-compatible'] },
    ],
  };
  const first = await simulator.simulate(input);
  assert.equal(first.phase, 'imagine');
  assert.equal(first.rollouts.length, 2);
  assert.equal(first.pruned.length, 1);
  assert.equal(first.selectedCandidateId, 'partial-fix');
  assert.equal(first.claims.fileCommitAllowed, false);
  assert.equal(first.claims.durableMemoryWriteAllowed, false);
  assert.ok(first.decisionDelta.criteriaGain > 0);
  const second = await simulator.simulate(input);
  assert.equal(second.cacheHit, true);
  assert.equal(model.calls, 3);
  const third = await simulator.simulate({ ...input, state: { ...input.state, environmentDigest: sha('9') } });
  assert.equal(third.cacheHit, false);
  assert.equal(model.calls, 6);
  const validated = simulator.validate(first.receiptSha256, { observed: { criteria: 2, regressions: 0 }, receiptSha256: sha('a') });
  assert.equal(validated.phase, 'verify');
  assert.ok(validated.calibrationError >= 0);
});
