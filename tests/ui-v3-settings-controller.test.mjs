import test from 'node:test';
import assert from 'node:assert/strict';
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
