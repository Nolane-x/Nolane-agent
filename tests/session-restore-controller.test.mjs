import test from 'node:test';
import assert from 'node:assert/strict';

import { createSessionRestoreController } from '../ui-v3/core/session-restore-controller.mjs';

test('session restore controller hydrates state, flushes pending route and draft, and clears submitted drafts', async () => {
  const calls = [];
  const api = {
    get: async (path) => path.includes('/draft') ? { draft: { objective: 'restored', intent: 'plan' } } : { activeRoute: '/missions', experienceLevel: 'workspace' },
    patch: async (path, body) => { calls.push(['patch', path, body]); return { ...body, schema: 'nolane.session-restore.v1' }; },
    put: async (path, body) => { calls.push(['put', path, body]); return { ...body.draft, scope: body.scope }; },
    delete: async (path) => { calls.push(['delete', path]); return { deleted: true }; }
  };
  const controller = createSessionRestoreController({ api, debounceMs: 10_000 });
  await controller.load();
  assert.equal(controller.snapshot().restore.activeRoute, '/missions');
  assert.equal(controller.snapshot().drafts.home.objective, 'restored');

  controller.scheduleRestore({ activeRoute: '/projects', experienceLevel: 'workspace' });
  controller.scheduleDraft('home', { objective: 'pending', intent: 'ask', modelChoice: 'auto' });
  await controller.flush();
  assert.equal(calls.filter(([kind]) => kind === 'patch').length, 1);
  assert.equal(calls.filter(([kind]) => kind === 'put').length, 1);
  await controller.clearDraft('home');
  assert.equal(controller.snapshot().drafts.home, null);
  assert.match(calls.at(-1)[1], /scope=home/);
  controller.destroy();
});
