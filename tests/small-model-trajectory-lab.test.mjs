import test from 'node:test';
import assert from 'node:assert/strict';
import { TrajectoryLab } from '../src/small-model/trajectory-lab.mjs';

const episode = (overrides = {}) => ({
  id: 'ep-1', kind: 'tool-policy',
  state: { taskType: 'bug-fix', evidenceIds: ['e-1'], criteriaOpen: ['c-1'] },
  action: { type: 'run-test', parameters: { test: 'focused' } },
  expectedEffect: { criterionDelta: 1 }, actualEffect: { criterionDelta: 1, changed: true },
  verifier: { valid: true, rewardHacking: false }, cost: { tokens: 20, rssMbSeconds: 4 },
  ...overrides,
});

test('TrajectoryLab stores typed public state/action/effect and produces immutable receipts', () => {
  const lab = new TrajectoryLab();
  const stored = lab.record(episode());
  assert.equal(stored.kind, 'tool-policy');
  assert.match(stored.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(lab.snapshot().episodes, 1);
  assert.throws(() => { stored.state.taskType = 'tamper'; }, TypeError);
});

test('TrajectoryLab rejects hidden reasoning, no-effect loops and reward hacking', () => {
  const lab = new TrajectoryLab();
  assert.throws(() => lab.record(episode({ chainOfThought: 'secret' })), /hidden reasoning/i);
  assert.throws(() => lab.record(episode({ actualEffect: { changed: false }, action: { type: 'repeat', parameters: {} } })), /no verified effect/i);
  assert.throws(() => lab.record(episode({ verifier: { valid: true, rewardHacking: true } })), /reward hacking/i);
});

test('TrajectoryLab separates curricula and rolls back policy promotion', () => {
  const lab = new TrajectoryLab();
  lab.record(episode());
  lab.record(episode({ id: 'ep-2', kind: 'verification', action: { type: 'verify', parameters: {} } }));
  assert.equal(lab.list({ kind: 'verification' }).length, 1);
  const v1 = lab.promotePolicy({ id: 'router', version: '1', episodeIds: ['ep-1'] });
  const v2 = lab.promotePolicy({ id: 'router', version: '2', episodeIds: ['ep-1', 'ep-2'] });
  assert.notEqual(v1.policySha256, v2.policySha256);
  assert.equal(lab.rollbackPolicy('router').version, '1');
});
