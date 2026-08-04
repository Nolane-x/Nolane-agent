import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionGroups, createSessionSidebarModel } from '../ui-v3/shell/session-sidebar.mjs';

test('session groups prioritize Needs You, Running, Ready to Review, then Recent', () => {
  const groups = buildSessionGroups([
    { id: 'done', title: 'Done', status: 'completed', updatedAt: 1 },
    { id: 'run', title: 'Run', status: 'running', updatedAt: 4 },
    { id: 'review', title: 'Review', status: 'review', updatedAt: 3 },
    { id: 'input', title: 'Input', status: 'needs_input', updatedAt: 2 },
    { id: 'archived', title: 'Archived', status: 'completed', archived: true, updatedAt: 5 },
  ], [{ missionId: 'approval', title: 'Approve migration', createdAt: 6 }]);
  assert.deepEqual(groups.needsYou.map((item) => item.id), ['approval', 'input']);
  assert.deepEqual(groups.running.map((item) => item.id), ['run']);
  assert.deepEqual(groups.review.map((item) => item.id), ['review']);
  assert.deepEqual(groups.recent.map((item) => item.id), ['done']);
});

test('sidebar patches keyed rows and virtualizes recent sessions after 100 items', () => {
  const model = createSessionSidebarModel();
  model.update({ runs: Array.from({ length: 150 }, (_, index) => ({ id: `m-${index}`, title: `Mission ${index}`, status: 'completed', updatedAt: index })), approvals: [] });
  const first = model.snapshot({ recentOffset: 0, recentLimit: 20 });
  assert.equal(first.groups.recent.length, 20);
  assert.equal(first.totalRecent, 150);
  const rowIdentity = first.rowKeys.get('m-149');
  model.patch('m-149', { title: 'Updated mission' });
  const next = model.snapshot({ recentOffset: 0, recentLimit: 20 });
  assert.equal(next.rowKeys.get('m-149'), rowIdentity);
  assert.equal(next.groups.recent[0].title, 'Updated mission');
});

test('session sidebar excludes archived missions and rejects patching unknown rows', () => {
  const model = createSessionSidebarModel();
  model.update({ runs: [
    { id: 'visible', title: 'Visible', status: 'running', updatedAt: 2 },
    { id: 'archived', title: 'Archived', status: 'completed', archived: true, updatedAt: 3 },
  ], approvals: [] });
  const snapshot = model.snapshot();
  assert.equal(Object.values(snapshot.groups).flat().some((item) => item.id === 'archived'), false);
  assert.equal(model.patch('missing', { title: 'Nope' }), false);
});
