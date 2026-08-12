import test from 'node:test';
import assert from 'node:assert/strict';

import { renderExperienceSwitcher } from '../ui-v3/components/experience-switcher/experience-switcher.mjs';
import { createExperienceTransitionController } from '../ui-v3/core/experience-transition-controller.mjs';
import { createViewStateBridge } from '../ui-v3/core/view-state-bridge.mjs';

function fakeRoot() {
  const objective = { id: 'objective', name: '', dataset: {}, type: 'textarea', disabled: false, value: 'keep this draft', checked: undefined, selectionStart: 2, selectionEnd: 5 };
  const workspace = { scrollTop: 140 };
  const sidebar = { scrollTop: 33 };
  const settingsContent = { dataset: { scrollKey: 'settings-content' }, scrollTop: 4200, scrollLeft: 3 };
  const summary = { dataset: { open: 'true' } };
  return {
    activeElement: objective,
    querySelectorAll(selector) {
      if (selector === 'input, textarea, select') return [objective];
      if (selector === '[data-scroll-key]') return [settingsContent];
      return [];
    },
    querySelector(selector) {
      if (selector === '#workspace') return workspace;
      if (selector === '#session-groups') return sidebar;
      if (selector === '#output-summary-root') return summary;
      if (selector === '[data-scroll-key="settings-content"]') return settingsContent;
      return null;
    }
  };
}

test('experience switcher renders one direct option for every progressive level', () => {
  const html = renderExperienceSwitcher({ current: 'workspace', language: 'en' });
  for (const level of ['everyday', 'workspace', 'studio', 'expert']) assert.match(html, new RegExp(`data-experience-option="${level}"`));
  assert.match(html, /role="listbox"/);
  assert.match(html, /aria-selected="true" data-experience-option="workspace"/);
  assert.match(html, /Does not change agent permissions/);
});

test('experience popup uses a dedicated opaque stacking surface', async () => {
  const css = await (await import('node:fs/promises')).readFile('ui-v3/styles/components/experience-switcher.css', 'utf8');
  assert.match(css, /\.experience-switcher__menu[^\{]*\{[^}]*isolation:isolate/);
  assert.match(css, /\.experience-switcher__menu[^\{]*\{[^}]*background:var\(--surface-overlay\)/);
  assert.match(css, /\.app-topbar[^\{]*\{[^}]*position:relative/);
});

test('experience popup supporting text uses the accessible secondary text token', async () => {
  const css = await (await import('node:fs/promises')).readFile('ui-v3/styles/components/experience-switcher.css', 'utf8');
  assert.match(css, /\.experience-switcher__menu>header small\{[^}]*color:var\(--text-secondary\)/);
  assert.match(css, /\.experience-switcher__options small\{[^}]*color:var\(--text-secondary\)/);
  assert.match(css, /\.experience-switcher__menu>footer\{[^}]*color:var\(--text-secondary\)/);
});

test('view-state bridge preserves draft metadata and maps routes to representable destinations', () => {
  const bridge = createViewStateBridge();
  const root = fakeRoot();
  bridge.capture(root, { experience: 'expert', path: '/control-plane/runtime' });
  const snapshot = bridge.snapshot();
  assert.equal(snapshot.states.expert.controls[0].value, 'keep this draft');
  assert.equal(snapshot.states.expert.workspaceScrollTop, 140);
  assert.deepEqual(snapshot.states.expert.scrollRegions, [{ key: 'settings-content', top: 4200, left: 3 }]);
  const settingsContent = root.querySelector('[data-scroll-key="settings-content"]');
  settingsContent.scrollTop = 0;
  settingsContent.scrollLeft = 0;
  bridge.restore(root, { experience: 'expert' });
  assert.equal(settingsContent.scrollTop, 4200);
  assert.equal(settingsContent.scrollLeft, 3);
  assert.equal(bridge.resolveDestination({ currentPath: '/control-plane/runtime', targetExperience: 'everyday' }), '/');
  assert.equal(bridge.resolveDestination({ currentPath: '/control-plane/runtime', targetExperience: 'workspace' }), '/missions');
  assert.equal(bridge.resolveDestination({ currentPath: '/control-plane/runtime', targetExperience: 'studio' }), '/workroom');
});

test('transition persists through Personalization API before reporting success', async () => {
  const calls = [];
  const bridge = createViewStateBridge();
  const api = { patch: async (path, body) => { calls.push({ path, body }); return { profile: { preferences: { experience: { level: 'expert' } } } }; } };
  const controller = createExperienceTransitionController({ api, viewStateBridge: bridge, documentRoot: fakeRoot });
  const result = await controller.transition({ fromExperience: 'everyday', toExperience: 'expert', currentPath: '/' });
  assert.equal(result.ok, true);
  assert.equal(result.experience, 'expert');
  assert.equal(calls[0].path, '/api/personalization/preferences');
  assert.deepEqual(calls[0].body.patch, { experience: { level: 'expert' } });
  assert.equal(calls[0].body.source, 'experience-switcher');
});

test('transition reports persistence failure and keeps the previous experience', async () => {
  const bridge = createViewStateBridge();
  const api = { patch: async () => { throw Object.assign(new Error('disk full'), { status: 507 }); } };
  const controller = createExperienceTransitionController({ api, viewStateBridge: bridge, documentRoot: fakeRoot });
  const result = await controller.transition({ fromExperience: 'workspace', toExperience: 'expert', currentPath: '/missions?id=m1' });
  assert.equal(result.ok, false);
  assert.equal(result.experience, 'workspace');
  assert.equal(result.path, '/missions?id=m1');
  assert.match(result.error, /disk full/);
});
