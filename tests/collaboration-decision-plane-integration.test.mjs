import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { DecisionPlane } from '../src/decision/decision-plane.mjs';
const hash = (c) => c.repeat(64);

test('decision plane exposes collaboration capabilities without loading fast path', async () => {
  const plane = new DecisionPlane();
  assert.equal(plane.snapshot().lifecycle.collaborationExperienceLoaded, false);
  const topology = plane.selectCollaborationTopology({ risk: 'critical', securitySensitive: true, availableAgentSlots: 2 });
  assert.equal(topology.topology, 'executor-reviewer');
  assert.equal(plane.snapshot().lifecycle.collaborationExperienceLoaded, true);
  assert.equal(plane.collaborationExperienceSnapshot().lifecycle.blackboardLoaded, false);
  plane.close();
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /CollaborationExperiencePlane/);
});

test('decision plane supports review and steering through the shared plane', () => {
  const plane = new DecisionPlane();
  plane.addReviewItem({ itemId: 'r1', kind: 'file', target: 'auth.mjs', risk: 'high', receiptSha256: hash('b') });
  assert.equal(plane.reviewQueueSnapshot().items[0].itemId, 'r1');
  const command = plane.issueMissionSteering({ missionId: 'm1', action: 'pause', actor: 'operator', capabilities: ['mission.pause'], expectedRevision: 0, reason: 'review', evidenceReceiptSha256: hash('c') });
  assert.equal(command.state, 'paused');
});
