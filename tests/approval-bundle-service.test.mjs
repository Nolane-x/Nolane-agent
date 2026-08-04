import test from 'node:test';
import assert from 'node:assert/strict';

import { ApprovalBundleService } from '../src/security/approval-bundle-service.mjs';

test('groups identical non-critical requests without widening scope or auto-approving', () => {
  let now = Date.parse('2026-07-30T00:00:00.000Z');
  const service = new ApprovalBundleService({ clock: () => now, windowMs: 60_000 });
  const first = service.record({ principalId: 'agent-1', projectId: 'p1', taskId: 't1', capability: 'shell.run', approvalMode: 'explicit', risk: 'high', resource: { command: 'git', arguments: ['status'] }, reason: 'Run bounded Git status.' });
  const second = service.record({ principalId: 'agent-1', projectId: 'p1', taskId: 't2', capability: 'shell.run', approvalMode: 'explicit', risk: 'high', resource: { command: 'git', arguments: ['status'] }, reason: 'Run bounded Git status.' });
  assert.equal(first.bundleId, second.bundleId);
  assert.equal(second.count, 2);
  assert.deepEqual(second.taskIds, ['t1', 't2']);
  assert.equal(second.decision, 'pending');
  assert.equal(second.scope.capability, 'shell.run');
  assert.deepEqual(second.scope.resource, { command: 'git', arguments: ['status'] });
  assert.match(second.receiptSha256, /^[a-f0-9]{64}$/);

  const changed = service.record({ principalId: 'agent-1', projectId: 'p1', taskId: 't3', capability: 'shell.run', approvalMode: 'explicit', risk: 'high', resource: { command: 'git', arguments: ['diff'] }, reason: 'Run bounded Git diff.' });
  assert.notEqual(changed.bundleId, second.bundleId);
  now += 61_000;
  const expired = service.record({ principalId: 'agent-1', projectId: 'p1', taskId: 't4', capability: 'shell.run', approvalMode: 'explicit', risk: 'high', resource: { command: 'git', arguments: ['status'] }, reason: 'Run bounded Git status.' });
  assert.notEqual(expired.bundleId, second.bundleId);
});

test('never bundles always-approved or critical capability requests', () => {
  const service = new ApprovalBundleService({ clock: () => 1_000 });
  const one = service.record({ principalId: 'agent-1', projectId: 'p1', taskId: 't1', capability: 'system.admin', approvalMode: 'always', risk: 'critical', resource: { command: 'sudo', arguments: ['reboot'] }, reason: 'Administrative command.' });
  const two = service.record({ principalId: 'agent-1', projectId: 'p1', taskId: 't2', capability: 'system.admin', approvalMode: 'always', risk: 'critical', resource: { command: 'sudo', arguments: ['reboot'] }, reason: 'Administrative command.' });
  assert.notEqual(one.bundleId, two.bundleId);
  assert.equal(one.bundled, false);
  assert.equal(two.count, 1);
});
