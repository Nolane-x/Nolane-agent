import assert from 'node:assert/strict';
import test from 'node:test';
import { DecisionStateMachine } from '../src/cognition/decision-state-machine.mjs';
const sha = (c) => c.repeat(64);

test('requires the full specified to committed evidence sequence', () => {
  const flow = new DecisionStateMachine({ clock: (() => { let n = 0; return () => ++n; })() });
  flow.create({ decisionId: 'd1', missionId: 'm1', taskId: 't1', specificationReceiptSha256: sha('a') });
  const steps = [
    ['proposed', 'proposal', 'b'], ['verified', 'verification', 'c'], ['authorized', 'authorization', 'd'],
    ['executed', 'execution', 'e'], ['observed', 'effect', 'f'], ['committed', 'commit', '1'],
  ];
  for (const [to, kind, c] of steps) assert.equal(flow.transition('d1', { to, receiptKind: kind, receiptSha256: sha(c) }).state, to);
  const snapshot = flow.snapshot('d1');
  assert.equal(snapshot.state, 'committed');
  assert.equal(snapshot.history.length, 7);
  assert.throws(() => flow.transition('d1', { to: 'rolled_back', receiptKind: 'rollback', receiptSha256: sha('2') }), /terminal/i);
});

test('rejects skipped states wrong receipt kinds duplicate execution and commit before observation', () => {
  const flow = new DecisionStateMachine();
  flow.create({ decisionId: 'd1', missionId: 'm1', taskId: 't1', specificationReceiptSha256: sha('a') });
  assert.throws(() => flow.transition('d1', { to: 'verified', receiptKind: 'verification', receiptSha256: sha('b') }), /invalid transition/i);
  assert.throws(() => flow.transition('d1', { to: 'proposed', receiptKind: 'verification', receiptSha256: sha('b') }), /requires proposal/i);
  flow.transition('d1', { to: 'proposed', receiptKind: 'proposal', receiptSha256: sha('b') });
  flow.transition('d1', { to: 'verified', receiptKind: 'verification', receiptSha256: sha('c') });
  flow.transition('d1', { to: 'authorized', receiptKind: 'authorization', receiptSha256: sha('d') });
  flow.transition('d1', { to: 'executed', receiptKind: 'execution', receiptSha256: sha('e') });
  assert.throws(() => flow.transition('d1', { to: 'executed', receiptKind: 'execution', receiptSha256: sha('e') }), /invalid transition/i);
  assert.throws(() => flow.transition('d1', { to: 'committed', receiptKind: 'commit', receiptSha256: sha('f') }), /invalid transition/i);
  assert.equal(flow.transition('d1', { to: 'rolled_back', receiptKind: 'rollback', receiptSha256: sha('f') }).state, 'rolled_back');
});

test('supports explicit rejection or abort without fabricating execution', () => {
  const flow = new DecisionStateMachine();
  flow.create({ decisionId: 'd1', missionId: 'm1', taskId: 't1', specificationReceiptSha256: sha('a') });
  assert.equal(flow.transition('d1', { to: 'rejected', receiptKind: 'rejection', receiptSha256: sha('b') }).state, 'rejected');
  flow.create({ decisionId: 'd2', missionId: 'm1', taskId: 't1', specificationReceiptSha256: sha('c') });
  assert.equal(flow.transition('d2', { to: 'aborted', receiptKind: 'abort', receiptSha256: sha('d') }).state, 'aborted');
});
