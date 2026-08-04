import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudQueue } from '../src/cloud/cloud-queue.mjs';
import { AutoscalingController } from '../src/cloud/autoscaling-controller.mjs';
import { EnterpriseService } from '../src/enterprise/enterprise-service.mjs';

test('cloud recovery contract fences leases retries jobs and bounds autoscaling', () => {
  const queue = new CloudQueue({ clock: () => 1_000, maxAttempts: 2 });
  queue.enqueue({ id: 'job', organizationId: 'org', workspaceId: 'ws', priority: 1, payload: { task: 'test' } });
  const first = queue.lease({ organizationId: 'org', workerId: 'w1', leaseMs: 100 });
  queue.fail({ jobId: 'job', workerId: 'w1', fencingToken: first.fencingToken, retryable: true });
  const second = queue.lease({ organizationId: 'org', workerId: 'w2', leaseMs: 100 });
  assert.ok(second.fencingToken > first.fencingToken);
  assert.equal(queue.fail({ jobId: 'job', workerId: 'w2', fencingToken: second.fencingToken, retryable: true }).state, 'dead-letter');
  assert.equal(new AutoscalingController({ clock: () => 1_000 }).decide({ activeWorkers: 1, queueDepth: 20 }, { minWorkers: 1, maxWorkers: 4, targetJobsPerWorker: 2 }).desiredWorkers, 4);
});

test('cloud recovery contract rejects stale fencing and cross-tenant authorization by default', () => {
  const queue = new CloudQueue({ clock: () => 1_000, maxAttempts: 2 });
  queue.enqueue({ id: 'job', organizationId: 'org', workspaceId: 'ws', priority: 1, payload: {} });
  queue.lease({ organizationId: 'org', workerId: 'w1', leaseMs: 100 });
  assert.throws(() => queue.complete({ jobId: 'job', workerId: 'w1', fencingToken: 0 }), /fencing/i);
  const enterprise = new EnterpriseService();
  enterprise.createOrganization({ id: 'a', name: 'A' }); enterprise.createOrganization({ id: 'b', name: 'B' });
  enterprise.upsertMember({ organizationId: 'a', principalId: 'alice', roles: ['developer'] });
  enterprise.bindPolicy({ id: 'allow', organizationId: 'a', effect: 'allow', roles: ['developer'], actions: ['code.*'], resources: ['repo:*'] });
  assert.equal(enterprise.authorize({ organizationId: 'b', principalId: 'alice', action: 'code.read', resource: 'repo:x' }).code, 'default-deny');
});
