import assert from 'node:assert/strict';
import test from 'node:test';

import { createActivityController, renderActivityView } from '../ui-v3/views/activity/activity-view.mjs';

test('progressive activity surface renders the normalized Execution Story for the selected mission', async () => {
  const calls = [];
  const api = { async get(path) {
    calls.push(path);
    if (path.startsWith('/api/events')) return [];
    if (path === '/api/missions') return [{ id: 'm1', objective: 'Build story', status: 'running' }];
    if (path.startsWith('/api/tasks')) return [{ id: 't1', missionId: 'm1', title: 'Build', status: 'running' }];
    if (path.startsWith('/api/sovereign-kernel')) return {};
    if (path.startsWith('/api/execution-story')) return {
      schema: 'nolane.execution-story.v1', receiptSha256: 'a'.repeat(64),
      summary: { currentPhase: 'test', state: 'running', events: 7, filesRead: 4, filesChanged: 2, commands: 1, tests: 3, approvals: 0 },
      phases: [{ id: 'p1', state: 'completed', title: 'Context prepared · 4 events', summary: 'Repository context selected.', eventCount: 4, metrics: { files: 4, tests: 0 }, receiptSha256: 'b'.repeat(64) }],
    };
    return {};
  } };
  const controller = createActivityController({ api, language: 'en', selectedMissionId: 'm1', experience: 'studio' });
  await controller.load();
  const html = renderActivityView(controller.snapshot());
  assert.equal(calls.some((path) => path.includes('/api/execution-story?missionId=m1&level=studio')), true);
  assert.match(html, /Execution Story/);
  assert.match(html, /What Nolane did/);
  assert.match(html, /4<\/strong><small>files read/);
  assert.match(html, /Context prepared/);
  assert.match(html, new RegExp('a'.repeat(64)));
});
