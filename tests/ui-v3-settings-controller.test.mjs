import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsCatalog } from '../src/settings/settings-catalog.mjs';
import { createSettingsController } from '../ui-v3/views/settings/settings-controller.mjs';
import { renderSettingsView } from '../ui-v3/views/settings/settings-view.mjs';

test('settings controller loads catalog and effective values and filters research categories', async () => {
  const api = { get: async (path) => path.includes('catalog') ? { categories: [{ id:'general',title:'General',level:'standard',fields:[] }, { id:'research',title:'Research',level:'research',fields:[] }], experienceLevels:[{id:'standard'},{id:'research'}] } : { value: { experience: { level: 'standard' } }, provenance: {}, warnings: [] }, put: async () => ({}), post: async () => ({}) };
  const controller = createSettingsController({ api });
  await controller.load();
  assert.deepEqual(controller.snapshot().visibleCategories.map((x) => x.id), ['general']);
  controller.setExperience('research');
  assert.deepEqual(controller.snapshot().visibleCategories.map((x) => x.id), ['general','research']);
  const html = renderSettingsView(controller.snapshot());
  assert.match(html, /Search settings/);
  assert.match(html, /Standard/);
  assert.match(html, /Research/);
});

test('Vietnamese settings localize live provider and model action status', async () => {
  const api = {
    get: async (path) => {
      if (path.includes('catalog')) return { categories: [{ id: 'models', title: 'Models', level: 'standard', fields: [] }] };
      if (path.includes('effective')) return { value: { general: { language: 'vi' }, experience: { level: 'everyday' } }, provenance: {}, warnings: [] };
      if (path.includes('model-profiles')) return { models: [] };
      if (path.includes('provider-connections')) return [];
      return {};
    },
    put: async () => ({}),
    post: async (path) => path.includes('/discover') ? { status: 'compatibility', models: [] } : {},
  };
  const controller = createSettingsController({ api });
  await controller.load();
  await controller.discoverModels('opencode');
  const html = renderSettingsView(controller.snapshot());
  assert.match(html, /Đã khám phá model cho opencode/);
  assert.doesNotMatch(html, /Model discovery completed for opencode/);
});

test('English settings render every language card in the active interface locale', () => {
  const catalog = createSettingsCatalog();
  const html = renderSettingsView({
    status: 'ready',
    draft: { general: { language: 'en' }, experience: { level: 'everyday' } },
    visibleCategories: catalog.categories.filter((category) => category.id === 'general'),
    experience: 'everyday',
    layer: 'user',
    provenance: {},
    models: { models: [] },
    providers: [],
  });

  assert.match(html, />Vietnamese</);
  assert.match(html, /Vietnamese interface/);
  assert.doesNotMatch(html, /Tiếng Việt|Giao diện tiếng Việt/);
});

test('Vietnamese settings localize provider account login status and device receipt', async () => {
  const api = {
    get: async (path) => {
      if (path.includes('catalog')) return { categories: [{ id: 'models', title: 'Models', level: 'standard', fields: [] }] };
      if (path.includes('effective')) return { value: { general: { language: 'vi' }, experience: { level: 'everyday' } }, provenance: {} };
      if (path.includes('provider-connections')) return [{ id: 'codex-app-server', kind: 'codex-app-server', label: 'Codex App Server', loginModes: ['chatgptDeviceCode'], authenticated: false }];
      return { models: [] };
    },
    put: async () => ({}),
    post: async () => ({ verificationUrl: 'https://auth.example.test/device', deviceCode: 'ABCD-EFGH' }),
  };
  const controller = createSettingsController({ api });
  await controller.load();
  await controller.startProviderLogin('codex-app-server', 'chatgptDeviceCode');
  const html = renderSettingsView(controller.snapshot());
  assert.match(html, /Tiếp tục đăng nhập codex-app-server trong trình duyệt/);
  assert.match(html, /Mã thiết bị/);
  assert.match(html, /ABCD-EFGH/);
  assert.doesNotMatch(html, /Continue sign-in for codex-app-server/);
});
