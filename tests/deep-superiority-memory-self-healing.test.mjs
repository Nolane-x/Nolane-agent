import test from 'node:test';
import assert from 'node:assert/strict';
import { VerificationMemoryCurator } from '../src/superiority/deep/verification-memory-curator.mjs';
import { SelfHealingRuntime } from '../src/superiority/deep/self-healing-runtime.mjs';

const H = (c) => c.repeat(64);

test('verification memory promotes only independently verified content and preserves tombstones', () => {
  const curator = new VerificationMemoryCurator({ clock: () => 300, limits: { minimumIndependentSuccesses: 2 } });
  curator.propose({ memoryId: 'm1', kind: 'skill', contentHash: H('a'), provenanceHash: H('b'), scope: 'repo', proposerKey: 'builder' });
  curator.recordOutcome('m1', { observed: true, verified: true, criticalFailure: false, effectHash: H('c'), verifierKey: 'reviewer-1' });
  assert.equal(curator.evaluate('m1').promotable, false);
  curator.recordOutcome('m1', { observed: true, verified: true, criticalFailure: false, effectHash: H('d'), verifierKey: 'reviewer-2' });
  assert.equal(curator.evaluate('m1').promotable, true);
  assert.throws(() => curator.promote('m1', { approvedByHuman: false, actor: 'agent', approvalReceiptSha256: H('e') }), /human approval/i);
  assert.equal(curator.promote('m1', { approvedByHuman: true, actor: 'owner', approvalReceiptSha256: H('e') }).status, 'active');
  assert.equal(curator.invalidate('m1', { sourceHash: H('f'), reason: 'source changed' }).status, 'stale');
  const tombstone = curator.tombstone('m1', { approvedByHuman: true, actor: 'owner', approvalReceiptSha256: H('1'), reason: 'obsolete' });
  assert.equal(tombstone.status, 'tombstoned');
  assert.equal(tombstone.contentHash, H('a'));
  assert.equal(JSON.stringify(tombstone).includes('contentText'), false);
});

test('self-healing runtime opens a circuit and executes bounded evidence-backed repairs', async () => {
  const calls = [];
  const runtime = new SelfHealingRuntime({ clock: () => 400 });
  runtime.registerComponent({ componentId: 'gateway', baselineHash: H('2'), policy: { maxRepairAttempts: 2, allowedRepairs: ['restart', 'isolate', 'rollback'], approvalRequiredRepairs: ['rollback'] } });
  const anomaly = runtime.observe({ componentId: 'gateway', anomalyId: 'anomaly-1', severity: 'critical', observed: true, evidenceHash: H('3'), symptoms: ['crash-loop'] });
  assert.equal(anomaly.circuitOpen, true);
  const plan = runtime.planRepair('gateway', { anomalyId: 'anomaly-1', preferredActions: ['rollback', 'restart'] });
  assert.equal(plan.action, 'rollback');
  assert.equal(plan.approvalRequired, true);
  await assert.rejects(() => runtime.executeRepair(plan.planId, { approvedByHuman: false, actor: 'agent', adapter: { async rollback() {} } }), /approval/i);
  const result = await runtime.executeRepair(plan.planId, {
    approvedByHuman: true, actor: 'owner',
    adapter: { async rollback(componentId) { calls.push(componentId); return { observed: true, success: true, effectHash: H('4') }; } },
  });
  assert.deepEqual(calls, ['gateway']);
  assert.equal(result.status, 'repaired');
  assert.equal(result.circuitOpen, false);
  assert.equal(result.claims.unboundedSelfModificationAllowed, false);
});
