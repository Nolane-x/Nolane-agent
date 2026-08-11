import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProjectsController, renderProjectsView } from '../ui-v3/views/projects/project-view.mjs';

test('project registry switches between the project grid and real project activity', async () => {
  const api = {
    async get(path) {
      if (path === '/api/projects') return [{ id: 'p1', name: 'Nolane', path: 'C:/work/nolane', trust: 'trusted' }];
      if (path === '/api/missions') return [{ id: 'm1', projectId: 'p1', title: 'Repair Workroom', status: 'running' }];
      throw new Error(`Unexpected path: ${path}`);
    },
  };
  const controller = createProjectsController({ api, language: 'en' });
  await controller.load();

  assert.equal(controller.snapshot().view, 'grid');
  const grid = renderProjectsView(controller.snapshot());
  assert.match(grid, /class="project-grid"/);
  assert.match(grid, /data-route="\/control-plane\/intelligence\/repository\?project=p1"/);

  controller.setView('activity');
  const activity = renderProjectsView(controller.snapshot());
  assert.equal(controller.snapshot().view, 'activity');
  assert.match(activity, /class="project-activity-list"/);
  assert.match(activity, /Repair Workroom/);
  assert.match(activity, /data-project-view="activity" aria-pressed="true"/);

  const app = await readFile(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /closest\('\[data-project-view\]'\)[\s\S]{0,140}controller\.setView\(mode\.dataset\.projectView\)/);
});
