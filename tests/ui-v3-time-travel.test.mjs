import assert from 'node:assert/strict';
import test from 'node:test';

import { createActivityController, renderActivityView } from '../ui-v3/views/activity/activity-view.mjs';

test('Studio activity surface exposes checkpoint timeline, compare, branch, replay, and file restore actions', async () => {
  const calls = [];
  const checkpoint = { id: 'c1', label: 'Before refactor', createdAt: '2026-08-04T00:00:00.000Z', git: { dirty: true }, completeWorkingTreeCapture: true, receiptSha256: 'a'.repeat(64) };
  const api = {
    async get(path) {
      calls.push(['get', path]);
      if (path.startsWith('/api/events')) return [];
      if (path === '/api/missions') return [{ id: 'm1', objective: 'Build', status: 'running' }];
      if (path.startsWith('/api/tasks')) return [];
      if (path.startsWith('/api/sovereign-kernel')) return {};
      if (path.startsWith('/api/execution-story')) return null;
      if (path.startsWith('/api/time-travel/checkpoints?')) return { schema: 'nolane.time-travel-checkpoint-list.v1', checkpoints: [checkpoint] };
      if (path.endsWith('/compare')) return { schema: 'nolane.time-travel-comparison.v1', checkpointId: 'c1', summary: { changed: 1 }, changes: [{ path: 'src/app.mjs', status: 'modified' }], receiptSha256: 'b'.repeat(64) };
      return {};
    },
    async post(path, body) {
      calls.push(['post', path, body]);
      if (path.endsWith('/branch')) return { worktree: { branch: 'forge/time-travel' } };
      if (path.endsWith('/replay')) return { mission: { id: 'm2' } };
      if (path.endsWith('/restore-file')) return { state: 'restored' };
      return checkpoint;
    },
  };
  const controller = createActivityController({ api, language: 'en', selectedMissionId: 'm1', experience: 'studio' });
  await controller.load();
  let html = renderActivityView(controller.snapshot());
  assert.match(html, /Time Travel/);
  assert.match(html, /Before refactor/);
  assert.match(html, /src\/app\.mjs/);
  assert.match(html, /Restore file/);
  await controller.createBranch('c1');
  await controller.replayMission('c1');
  await controller.restoreFile('c1', 'src/app.mjs', { confirmOverwrite: true });
  html = renderActivityView(controller.snapshot());
  assert.equal(calls.some((item) => item[0] === 'post' && item[1].endsWith('/branch')), true);
  assert.equal(calls.some((item) => item[0] === 'post' && item[1].endsWith('/replay')), true);
  assert.equal(calls.some((item) => item[0] === 'post' && item[1].endsWith('/restore-file') && item[2].confirmOverwrite === true), true);
  assert.match(html, /Difference from current/);
});

test('Workspace view keeps Time Travel read-oriented and hides destructive file restore control', async () => {
  const api = {
    get: async (path) => path === '/api/missions' ? [{ id: 'm1', objective: 'Build', status: 'running' }] : path.startsWith('/api/time-travel/checkpoints?') ? { checkpoints: [{ id: 'c1', label: 'Safe point', createdAt: 'now', git: { dirty: false }, receiptSha256: 'a'.repeat(64) }] } : path.endsWith('/compare') ? { checkpointId: 'c1', summary: { changed: 1 }, changes: [{ path: 'a.txt', status: 'modified' }] } : [],
    post: async () => ({}),
  };
  const controller = createActivityController({ api, selectedMissionId: 'm1', experience: 'workspace' });
  await controller.load();
  const html = renderActivityView(controller.snapshot());
  assert.match(html, /Compare current/);
  assert.doesNotMatch(html, /Restore file/);
  assert.doesNotMatch(html, /Create branch/);
});
