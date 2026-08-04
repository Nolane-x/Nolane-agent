import test from 'node:test';
import assert from 'node:assert/strict';
import { PlasticityPlane } from '../src/small-model/plasticity-plane.mjs';

test('PlasticityPlane reinforces non-parametric memory without changing the stable core', () => {
  const plane = new PlasticityPlane();
  const first = plane.reinforceMemory({ id: 'mem-1', reward: 1, verified: true, provenance: ['episode-1'] });
  const second = plane.reinforceMemory({ id: 'mem-1', reward: 0, verified: true, provenance: ['episode-2'] });
  assert.equal(first.qValue, 0.5);
  assert.equal(second.qValue, 0.25);
  assert.equal(plane.snapshot().stableCoreFrozen, true);
  assert.throws(() => plane.updateStableCore({ delta: [1] }), /frozen/i);
});

test('PlasticityPlane bounds adapter updates by norm, KL and regression budgets and keeps them in shadow', () => {
  const plane = new PlasticityPlane({ maxNormDelta: 0.2, maxKlDivergence: 0.1, maxRegressionDelta: 0.02 });
  assert.throws(() => plane.proposeAdapterUpdate({ adapterId: 'a', version: '1', normDelta: 0.3, klDivergence: 0.01, regressionDelta: 0 }), /norm budget/i);
  assert.throws(() => plane.proposeAdapterUpdate({ adapterId: 'a', version: '1', normDelta: 0.1, klDivergence: 0.2, regressionDelta: 0 }), /KL budget/i);
  assert.throws(() => plane.proposeAdapterUpdate({ adapterId: 'a', version: '1', normDelta: 0.1, klDivergence: 0.01, regressionDelta: 0.1 }), /regression budget/i);
  const candidate = plane.proposeAdapterUpdate({ adapterId: 'a', version: '1', normDelta: 0.1, klDivergence: 0.01, regressionDelta: 0.01, sourceEpisodes: ['e1'] });
  assert.equal(candidate.status, 'shadow');
  assert.equal(plane.snapshot().promotedAdapters, 0);
});

test('PlasticityPlane consolidates repeated verified experiences from fast to slow memory', () => {
  const plane = new PlasticityPlane({ consolidationThreshold: 3 });
  plane.recordExperience({ key: 'failure:timeout', verified: true, surprise: 0.8, forgettingRisk: 0.3 });
  plane.recordExperience({ key: 'failure:timeout', verified: true, surprise: 0.5, forgettingRisk: 0.7 });
  plane.recordExperience({ key: 'failure:timeout', verified: true, surprise: 0.9, forgettingRisk: 0.4 });
  const consolidated = plane.consolidate();
  assert.equal(consolidated.promoted.length, 1);
  assert.equal(consolidated.promoted[0].key, 'failure:timeout');
  assert.equal(plane.snapshot().slowMemories, 1);
});

test('PlasticityPlane orders replay by surprise and forgetting risk', () => {
  const plane = new PlasticityPlane();
  plane.recordExperience({ key: 'a', verified: true, surprise: 0.2, forgettingRisk: 0.2 });
  plane.recordExperience({ key: 'b', verified: true, surprise: 0.9, forgettingRisk: 0.8 });
  plane.recordExperience({ key: 'c', verified: true, surprise: 0.6, forgettingRisk: 0.4 });
  assert.deepEqual(plane.replayQueue({ limit: 2 }).map((x) => x.key), ['b', 'c']);
});

test('PlasticityPlane gates forward/backward transfer and rolls back negative transfer', () => {
  const plane = new PlasticityPlane({ minForwardTransfer: 0, minBackwardTransfer: -0.01 });
  plane.proposeAdapterUpdate({ adapterId: 'a', version: '1', normDelta: 0.1, klDivergence: 0.01, regressionDelta: 0, sourceEpisodes: ['e1'] });
  plane.promoteAdapter({ adapterId: 'a', version: '1', transfer: { forward: 0.1, backward: 0 } });
  plane.proposeAdapterUpdate({ adapterId: 'a', version: '2', normDelta: 0.1, klDivergence: 0.01, regressionDelta: 0, sourceEpisodes: ['e2'] });
  assert.throws(() => plane.promoteAdapter({ adapterId: 'a', version: '2', transfer: { forward: 0.2, backward: -0.2 } }), /transfer gate/i);
  assert.equal(plane.activeAdapter('a').version, '1');
  assert.equal(plane.snapshot().rollbacks, 1);
});

test('PlasticityPlane exposes memory and adapter lineage without parameter values', () => {
  const plane = new PlasticityPlane();
  plane.reinforceMemory({ id: 'm', reward: 1, verified: true, provenance: ['e1'] });
  plane.proposeAdapterUpdate({ adapterId: 'a', version: '1', normDelta: 0.1, klDivergence: 0.01, regressionDelta: 0, sourceEpisodes: ['e1'] });
  const lineage = plane.lineage();
  assert.deepEqual(lineage.memories[0].provenance, ['e1']);
  assert.equal('parameters' in lineage.adapters[0], false);
  assert.match(lineage.receiptSha256, /^[a-f0-9]{64}$/);
});
