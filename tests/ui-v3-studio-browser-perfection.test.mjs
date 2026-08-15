import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorkroomModel, renderWorkroomView } from '../ui-v3/views/workroom/workroom-view.mjs';
import { createBrowserWorkspaceController, renderBrowserWorkspace } from '../ui-v3/views/browser/browser-view.mjs';

test('Studio compact layout exposes explicit Files Editor Agent pane switching instead of deleting side panes', async () => {
  const model = createWorkroomModel({ projectId: 'p1', missionId: 'm1' });
  assert.equal(model.snapshot().compactPane, 'editor');
  model.setCompactPane('files');
  assert.equal(model.snapshot().compactPane, 'files');
  const html = renderWorkroomView(model.snapshot());
  for (const pane of ['files', 'editor', 'agent']) {
    assert.match(html, new RegExp(`data-workroom-pane="${pane}"`));
    assert.match(html, new RegExp(`data-panel="${pane}"[^>]*data-compact-active="${pane === 'files'}"`));
  }
  assert.throws(() => model.setCompactPane('unknown'), /compact pane/i);

  const css = await readFile(new URL('../ui-v3/styles/pages/workroom.css', import.meta.url), 'utf8');
  assert.match(css, /@media\(max-width:720px\)[\s\S]*data-compact-active="false"[\s\S]*display:none/);
  assert.match(css, /workroom-grid>\[data-panel\]\[data-compact-active="true"\]\{display:grid\}/);
});

test('Studio route caches by path and wires compact pane controls to the existing model', async () => {
  const app = await readFile(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /id: 'workroom'[\s\S]{0,120}cache: 'path'/);
  assert.match(app, /closest\?\.\('\[data-workroom-pane\]'\)/);
  assert.match(app, /model\.setCompactPane\(pane\.dataset\.workroomPane\)/);
});

test('Browser keeps explicit origin session and permission trust boundary visible around external content', async () => {
  const fixtures = {
    '/api/browser/runtime': { available: true, ready: true, version: '1.2.3', state: 'ready' },
    '/api/browser/detect': { available: true, version: '1.2.3', driver: 'playwright-cli' },
    '/api/browser/status?projectId=p1': { available: true, sessions: [{ name: 'tab-1', url: 'https://example.test/private?token=secret', title: 'Example' }] },
    '/api/browser/tabs': { tabs: [{ id: 'tab-1', url: 'https://example.test/private?token=secret', title: 'Example' }] },
    '/api/permissions/browser?goalId=m1': { allowedActions: ['snapshot'], denied: ['goto', 'fill'] },
  };
  const api = {
    async get(path) { return structuredClone(fixtures[path] ?? {}); },
    async post(path) { return structuredClone(fixtures[path] ?? {}); },
  };
  const controller = createBrowserWorkspaceController({ api, projectId: 'p1', projectName: 'Nolane', missionId: 'm1' });
  await controller.load();
  const html = renderBrowserWorkspace(controller.snapshot());
  assert.match(html, /data-browser-trust-boundary/);
  assert.match(html, />Origin<\/dt>[\s\S]*https:\/\/example\.test/);
  assert.match(html, />Session<\/dt>[\s\S]*Active/);
  assert.match(html, /Permission boundary/);
  assert.match(html, /data-browser-external-content="bounded"/);
  assert.match(html, /External page content/);
  assert.doesNotMatch(html, /token=secret|>secret</);
});
