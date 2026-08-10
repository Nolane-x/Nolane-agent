import test from 'node:test';
import assert from 'node:assert/strict';

import { applyPreferences } from '../ui-v3/core/preference-runtime.mjs';
import { createRouter } from '../ui-v3/core/router.mjs';
import { createLanguageSyncController } from '../ui-v3/core/language-sync-controller.mjs';
import { renderAppShell } from '../ui-v3/shell/app-shell.mjs';

test('language sync preserves the current draft view while reloading other cached views', async () => {
  let effective = { language: 'en' };
  let html = '';
  let settingsLoads = 0;
  const root = { dataset: {}, style: { setProperty() {} } };
  const router = createRouter({ initialPath: '/' });
  router.register({
    id: 'home',
    pattern: '/',
    load: async () => {
      const captured = effective.language;
      return { render: () => `<p>${captured}</p>` };
    },
  });
  router.register({
    id: 'settings',
    pattern: '/settings',
    load: async () => {
      settingsLoads += 1;
      const captured = effective.language;
      return { render: () => `<p>settings-${captured}</p>` };
    },
  });
  const rerender = async (path) => {
    const state = await router.navigate(path);
    html = renderAppShell({ language: effective.language, content: state.view.render() });
  };

  await rerender('/');
  await rerender('/settings');
  const controller = createLanguageSyncController({
    preferenceDocument: () => ({ general: { language: effective.language } }),
    apply: (value) => (effective = applyPreferences(value, root, null)),
    rerender,
    reconcile: async () => effective,
    invalidate: (options) => router.invalidate(options),
  });

  await controller.preview('vi', '/settings');
  assert.match(html, /Cuộc trò chuyện mới/);
  assert.match(html, /<p>settings-en<\/p>/);
  assert.equal(settingsLoads, 1);

  await rerender('/');
  assert.match(html, /<p>vi<\/p>/);

  await controller.commit('/settings');
  assert.match(html, /<p>settings-vi<\/p>/);
  assert.equal(settingsLoads, 2);
});

test('language sync restores the active view state after a full route render', async () => {
  const calls = [];
  const state = { scrollTop: 4200, focusKey: 'general.language' };
  const controller = createLanguageSyncController({
    preferenceDocument: () => ({ general: { language: 'en' } }),
    apply: (value) => value,
    rerender: async () => calls.push('render'),
    reconcile: async () => ({ language: 'en' }),
    invalidate: () => calls.push('invalidate'),
    captureViewState: () => {
      calls.push('capture');
      return state;
    },
    restoreViewState: (snapshot) => {
      calls.push(['restore', snapshot]);
    },
  });

  await controller.preview('vi', '/settings');
  assert.deepEqual(calls, ['capture', 'invalidate', 'render', ['restore', state]]);
});
