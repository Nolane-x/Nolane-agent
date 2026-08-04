import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPERIENCE_LEVELS } from '../ui-v3/core/experience-policy.mjs';
import { GLOBAL_DESTINATIONS } from '../ui-v3/shell/global-rail.mjs';
import { CONTROL_PLANE_ROUTES } from '../ui-v3/control-plane/route-registry.mjs';
import { createSettingsCatalog } from '../src/settings/settings-catalog.mjs';
import { BACKEND_ATLAS } from '../ui-v3/generated/backend-atlas.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('progressive experience retains all four product layers', () => {
  assert.deepEqual(EXPERIENCE_LEVELS.map((level) => level.id), ['everyday', 'workspace', 'studio', 'expert']);
});

test('legacy global navigation contract remains available', () => {
  assert.deepEqual(GLOBAL_DESTINATIONS.map((item) => item.id), ['home', 'missions', 'projects', 'review', 'workroom', 'control-plane', 'search', 'settings']);
  for (const item of GLOBAL_DESTINATIONS) assert.ok(item.path.startsWith('/'));
});

test('settings breadth and legacy migration contract are retained', () => {
  const catalog = createSettingsCatalog();
  const fieldCount = catalog.categories.reduce((total, category) => total + category.fields.length, 0);
  assert.equal(catalog.categories.length, 18);
  assert.ok(fieldCount >= 84);
  assert.deepEqual(catalog.experienceLevels.map((level) => level.id), ['standard', 'research']);
  assert.deepEqual(catalog.progressiveExperienceLevels.map((level) => level.id), ['everyday', 'workspace', 'studio', 'expert']);
});

test('backend atlas and expert control surfaces remain discoverable', () => {
  assert.ok(BACKEND_ATLAS.total >= 398);
  assert.ok(BACKEND_ATLAS.domains.length >= 90);
  assert.equal(typeof CONTROL_PLANE_ROUTES.capabilities, 'function');
  assert.equal(Object.keys(CONTROL_PLANE_ROUTES).length, 13);
});

test('stable production entry and recovery UI remain physically present', () => {
  assert.ok(fs.existsSync(path.join(root, 'ui-dist', 'index.html')));
  assert.ok(fs.existsSync(path.join(root, 'ui')));
  assert.ok(fs.existsSync(path.join(root, 'ui', 'index.html')) || fs.existsSync(path.join(root, 'ui', 'app.mjs')) || fs.readdirSync(path.join(root, 'ui')).length > 0);
});
