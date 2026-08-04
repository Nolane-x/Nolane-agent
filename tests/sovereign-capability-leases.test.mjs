import test from 'node:test';
import assert from 'node:assert/strict';
import { SovereignReviewerBoundary } from '../src/kernel/reviewer-boundary.mjs';
import { CapabilityLeaseAuthority } from '../src/kernel/capability-lease-authority.mjs';

test('capability leases use independent review, narrow scopes and one-shot consumption', async () => {
  let now = Date.parse('2026-08-03T00:00:00Z');
  const reviewer = new SovereignReviewerBoundary({ clock: () => now, autoApproveThrough: 'low' });
  const authority = new CapabilityLeaseAuthority({ reviewer, clock: () => now });
  const low = await authority.request({ threadId: 't', projectId: 'p', actorId: 'agent', capability: 'filesystem.read', resource: 'src/**', scope: 'once', risk: 'low', reason: 'inspect source', constraints: { maxUses: 1 } });
  assert.equal(low.lease.state, 'granted');
  assert.equal(low.review.decision, 'approved');
  const allowed = authority.authorize({ leaseId: low.lease.id, threadId: 't', projectId: 'p', actorId: 'agent', capability: 'filesystem.read', resource: 'src/**' });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.exhausted, true);
  assert.equal(authority.get(low.lease.id).state, 'consumed');
  const high = await authority.request({ threadId: 't', projectId: 'p', actorId: 'agent', capability: 'credential.read', resource: 'vault:key', scope: 'project', risk: 'high', reason: 'needs secret' });
  assert.equal(high.lease.state, 'pending');
  assert.equal(high.review.decision, 'human-review-required');
  const decided = authority.decide(high.lease.id, { decision: 'denied', reviewerId: 'operator', reason: 'not required' });
  assert.equal(decided.state, 'denied');
  now += 1_000_000;
  const expiring = await authority.request({ threadId: 't', projectId: 'p', actorId: 'agent', capability: 'filesystem.read', resource: 'docs/**', scope: 'thread', risk: 'low', reason: 'read docs', ttlMs: 1_000 });
  now += 2_000;
  assert.equal(authority.get(expiring.lease.id).state, 'expired');
});
