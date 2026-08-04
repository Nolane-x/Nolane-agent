import assert from 'node:assert/strict';
import test from 'node:test';
import { MissionSteeringService } from '../src/experience/mission-steering-service.mjs';
const hash = (c) => c.repeat(64);

test('mission steering requires action-specific capabilities and versions commands', () => {
  const steering = new MissionSteeringService();
  assert.throws(() => steering.issue({ missionId: 'm1', action: 'revoke', actor: 'operator', capabilities: ['mission.pause'], expectedRevision: 0, reason: 'stop bad worker', evidenceReceiptSha256: hash('a') }), /capability/i);
  const pause = steering.issue({ missionId: 'm1', action: 'pause', actor: 'operator', capabilities: ['mission.pause'], expectedRevision: 0, reason: 'inspect evidence', evidenceReceiptSha256: hash('b') });
  assert.equal(pause.revision, 1);
  const redirect = steering.issue({ missionId: 'm1', action: 'redirect', actor: 'operator', capabilities: ['mission.redirect'], expectedRevision: 1, reason: 'focus auth tests', target: 'auth verification', evidenceReceiptSha256: hash('c') });
  assert.equal(redirect.revision, 2);
  assert.throws(() => steering.issue({ missionId: 'm1', action: 'resume', actor: 'operator', capabilities: ['mission.resume'], expectedRevision: 1, reason: 'stale', evidenceReceiptSha256: hash('d') }), /revision/i);
});
