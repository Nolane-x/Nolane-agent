import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionGroups, createSessionSidebarModel, renderSessionSidebar, sessionStatusMeta } from '../ui-v3/shell/session-sidebar.mjs';

test('session groups prioritize Needs You, Running, Ready to Review, then Recent', () => {
  const groups = buildSessionGroups([
    { id: 'done', title: 'Done', status: 'completed', updatedAt: 1 },
    { id: 'run', title: 'Run', status: 'running', updatedAt: 4 },
    { id: 'review', title: 'Review', status: 'review', updatedAt: 3 },
    { id: 'input', title: 'Input', status: 'needs_input', updatedAt: 2 },
    { id: 'blocked', title: 'Blocked', status: 'blocked', updatedAt: 7 },
    { id: 'archived', title: 'Archived', status: 'completed', archived: true, updatedAt: 5 },
  ], [{ missionId: 'approval', title: 'Approve migration', createdAt: 6 }]);
  assert.deepEqual(groups.needsYou.map((item) => item.id), ['blocked', 'approval', 'input']);
  assert.deepEqual(groups.running.map((item) => item.id), ['run']);
  assert.deepEqual(groups.review.map((item) => item.id), ['review']);
  assert.deepEqual(groups.recent.map((item) => item.id), ['done']);
});

test('duplicate approval and mission rows collapse to one attention-bearing mission', () => {
  const groups = buildSessionGroups(
    [{ id: 'same', title: 'Mission copy', status: 'running', updatedAt: 2 }],
    [{ missionId: 'same', title: 'Approval copy', createdAt: 3 }],
  );
  assert.equal(Object.values(groups).flat().filter((item) => item.id === 'same').length, 1);
  assert.equal(groups.needsYou[0].status, 'awaiting_approval');
});

test('sidebar patches keyed rows and virtualizes recent sessions after 100 items', () => {
  const model = createSessionSidebarModel();
  model.update({ runs: Array.from({ length: 150 }, (_, index) => ({ id: `m-${index}`, title: `Mission ${index}`, status: 'completed', updatedAt: index })), approvals: [] });
  const first = model.snapshot({ recentOffset: 0, recentLimit: 20 });
  assert.equal(first.groups.recent.length, 20);
  assert.equal(first.totalRecent, 150);
  assert.equal(first.counts.recent, 150);
  const rowIdentity = first.rowKeys.get('m-149');
  model.patch('m-149', { title: 'Updated mission' });
  const next = model.snapshot({ recentOffset: 0, recentLimit: 20 });
  assert.equal(next.rowKeys.get('m-149'), rowIdentity);
  assert.equal(next.groups.recent[0].title, 'Updated mission');
});

test('session search filters approvals and missions using the same query semantics', () => {
  const model = createSessionSidebarModel();
  model.update({
    runs: [{ id: 'alpha', title: 'Alpha mission', status: 'running' }, { id: 'beta', title: 'Beta mission', status: 'completed' }],
    approvals: [{ missionId: 'gamma', title: 'Gamma approval' }],
  });
  const alpha = model.snapshot({ query: 'alpha' });
  assert.deepEqual(Object.values(alpha.groups).flat().map((item) => item.id), ['alpha']);
  const gamma = model.snapshot({ query: 'gamma' });
  assert.deepEqual(Object.values(gamma.groups).flat().map((item) => item.id), ['gamma']);
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

test('status copy is localized and exposes non-color semantic kinds', () => {
  assert.deepEqual(sessionStatusMeta('permission_required', 'en'), { status: 'permission_required', label: 'Permission', kind: 'attention' });
  assert.deepEqual(sessionStatusMeta('testing', 'vi'), { status: 'testing', label: 'Đang kiểm thử', kind: 'running' });
  assert.equal(sessionStatusMeta('completed', 'en').kind, 'success');
});

test('rendered session rows expose context, counts, active mission and semantic status without raw machine copy', () => {
  const model = createSessionSidebarModel();
  model.update({
    runs: [
      { id: 'm-run', title: 'Refine evidence spine', status: 'testing', projectId: 'p-1', updatedAt: 4 },
      { id: 'm-done', title: 'Old mission', status: 'completed', projectId: 'p-1', updatedAt: 2 },
    ],
    approvals: [{ missionId: 'm-approve', title: 'Approve browser capability', projectId: 'p-1', createdAt: 5 }],
  });
  const html = renderSessionSidebar(model.snapshot(), {
    projects: [{ id: 'p-1', name: 'Nolane Agent' }],
    selectedProjectId: 'p-1',
    activeMissionId: 'm-run',
    language: 'en',
  });
  assert.match(html, /data-session-section="needs-you"/);
  assert.match(html, /session-sidebar__section-count[^>]*>1</);
  assert.match(html, /data-mission-id="m-run"[^>]*data-state="testing"[^>]*data-state-kind="running"[^>]*aria-current="page"/);
  assert.match(html, /Refine evidence spine/);
  assert.match(html, /Nolane Agent/);
  assert.match(html, />Testing</);
  assert.doesNotMatch(html, />testing</);
  assert.match(html, /Approve browser capability/);
});
