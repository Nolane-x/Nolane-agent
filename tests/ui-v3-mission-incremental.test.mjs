import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionViewModel, buildMissionProgress } from '../ui-v3/views/mission/mission-view.mjs';

test('heartbeat and header patches do not replace keyed message or activity identities', () => {
  const model = createMissionViewModel({ missionId: 'm1' });
  model.update({ messageEvents: [{ id: 'msg-1', role: 'assistant', text: 'Reading repository' }], activityEvents: [{ id: 'a1', type: 'read', summary: 'Read 12 files' }] });
  const first = model.snapshot();
  const messageKey = first.messageKeys.get('msg-1');
  const activityKey = first.activityKeys.get('a1');
  model.update({ headerPatch: { heartbeatAt: 10, status: 'running' } });
  const second = model.snapshot();
  assert.equal(second.messageKeys.get('msg-1'), messageKey);
  assert.equal(second.activityKeys.get('a1'), activityKey);
  assert.equal(second.header.heartbeatAt, 10);
});

test('activity upserts, grouping and manual follow mode preserve scroll intent', () => {
  const model = createMissionViewModel({ missionId: 'm1' });
  model.update({ activityEvents: [{ id: 'a1', type: 'tool', groupId: 'g1', summary: 'Read file' }, { id: 'a2', type: 'tool', groupId: 'g1', summary: 'Read test' }] });
  model.setFollowMode('manual');
  model.update({ activityEvents: [{ id: 'a1', type: 'tool', groupId: 'g1', summary: 'Read file ✓' }] });
  const snapshot = model.snapshot();
  assert.equal(snapshot.followMode, 'manual');
  assert.equal(snapshot.activities.length, 2);
  assert.equal(snapshot.activities[0].summary, 'Read file ✓');
  assert.equal(snapshot.activityGroups.get('g1').length, 2);
});

test('5,000 activities are windowed without dropping total count', () => {
  const model = createMissionViewModel({ missionId: 'm1' });
  model.update({ activityEvents: Array.from({ length: 5000 }, (_, index) => ({ id: `a-${index}`, type: 'trace', summary: `Event ${index}` })) });
  const snapshot = model.snapshot({ activityOffset: 4980, activityLimit: 20 });
  assert.equal(snapshot.totalActivities, 5000);
  assert.equal(snapshot.activities.length, 20);
  assert.equal(snapshot.activities[0].id, 'a-4980');
});

test('progress uses counts only when total work is measurable and otherwise reports a phase', () => {
  assert.deepEqual(buildMissionProgress({ completed: 5, total: 8, phase: 'building' }), { kind: 'measured', completed: 5, total: 8, ratio: 0.625 });
  assert.deepEqual(buildMissionProgress({ phase: 'verifying' }), { kind: 'phase', phase: 'verifying' });
});
