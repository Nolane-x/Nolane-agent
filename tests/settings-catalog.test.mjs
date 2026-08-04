import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsCatalog, validateSettingsPatch, filterSettingsCatalog } from '../src/settings/settings-catalog.mjs';

test('settings catalog exposes complete categories and two experience levels without secret fields', () => {
  const catalog = createSettingsCatalog();
  const ids = catalog.categories.map((item) => item.id);
  for (const id of ['general','appearance','accessibility','notifications','shortcuts','personalization','permissions','terminal','git','browser','voice','memory','models','integrations','data','updates','diagnostics','research']) assert.ok(ids.includes(id), id);
  assert.deepEqual(catalog.experienceLevels.map((item) => item.id), ['standard', 'research']);
  assert.equal(JSON.stringify(catalog).match(/apiKey|password|secret/i), null);
  assert.ok(filterSettingsCatalog(catalog, { experience: 'standard' }).categories.every((item) => item.level !== 'research'));
  assert.ok(filterSettingsCatalog(catalog, { experience: 'research' }).categories.some((item) => item.id === 'research'));
});

test('settings patch validator rejects unknown values and returns path-aware errors', () => {
  const catalog = createSettingsCatalog();
  assert.deepEqual(validateSettingsPatch({ experience: { level: 'research' }, appearance: { theme: 'dark' } }, catalog), []);
  const errors = validateSettingsPatch({ experience: { level: 'wizard' }, appearance: { density: 'microscopic' }, unknown: true }, catalog);
  assert.ok(errors.some((item) => item.path === 'experience.level'));
  assert.ok(errors.some((item) => item.path === 'appearance.density'));
  assert.ok(errors.some((item) => item.path === 'unknown'));
});


test('settings catalog includes user-facing notification shortcut and personalization controls', () => {
  const catalog = createSettingsCatalog();
  const byId = new Map(catalog.categories.map((category) => [category.id, category]));
  assert.ok(byId.get('notifications').fields.some((field) => field.path === 'notifications.taskCompletion'));
  assert.ok(byId.get('shortcuts').fields.some((field) => field.path === 'shortcuts.keymap'));
  assert.ok(byId.get('personalization').fields.some((field) => field.path === 'personalization.explanationDepth'));
});
