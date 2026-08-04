import assert from 'node:assert/strict';
import test from 'node:test';
import { CollaborationExperiencePlane } from '../src/runtime/collaboration-experience-plane.mjs';
const hash = (c) => c.repeat(64);

test('collaboration experience plane remains lazy and loads only requested services', () => {
  const plane = new CollaborationExperiencePlane();
  const initial = plane.snapshot();
  assert.equal(initial.lifecycle.blackboardLoaded, false);
  assert.equal(initial.lifecycle.browserReplayLoaded, false);
  const lease = plane.heartbeatAgent({ agentId: 'a' });
  plane.writeBlackboard({ kind: 'fact', key: 'x', valueSummary: 'y', agentId: 'a', confidence: 1, provenance: { kind: 'test', receiptSha256: hash('a') }, fencingToken: lease.fencingToken });
  const loaded = plane.snapshot();
  assert.equal(loaded.lifecycle.blackboardLoaded, true);
  assert.equal(loaded.lifecycle.commitmentsLoaded, false);
  assert.equal(loaded.lifecycle.browserReplayLoaded, false);
  assert.equal(loaded.claims.rawPromptStored, false);
  assert.equal(plane.close().lifecycle.closed, true);
  assert.equal(plane.close().lifecycle.closed, true);
});
