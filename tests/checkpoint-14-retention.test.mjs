import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { EXPERIENCE_LEVELS } from '../ui-v3/core/experience-policy.mjs';
import { GLOBAL_DESTINATIONS } from '../ui-v3/shell/global-rail.mjs';
import { CONTROL_PLANE_DOMAINS } from '../ui-v3/control-plane/control-plane-shell.mjs';
import { createSettingsCatalog } from '../src/settings/settings-catalog.mjs';
import { BACKEND_ATLAS } from '../ui-v3/generated/backend-atlas.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'requirements', 'checkpoint-14-retention-contract.json'), 'utf8'));
const require = createRequire(import.meta.url);
const installer = require('../electron-builder.config.cjs');

function settingsFieldCount() {
  return createSettingsCatalog().categories.reduce((total, category) => total + category.fields.length, 0);
}

test('Checkpoint 14 starts from the exact verified Checkpoint 13 baseline', () => {
  assert.equal(contract.baseline.commit, '72f35b57aa32299bb4369eb84759c489b03ce697');
  assert.equal(contract.baseline.sourceZipSha256, '23b6d7ea292bcb1e48e70f12cbb312283cd8638341bf46ecff338c2551ed490b');
  assert.equal(contract.baseline.checkpoint, 13);
});

test('retention counts remain exact at the Checkpoint 14 foundation boundary', () => {
  const catalog = createSettingsCatalog();
  assert.deepEqual(EXPERIENCE_LEVELS.map(({ id }) => id), contract.experienceLevels);
  assert.deepEqual(GLOBAL_DESTINATIONS.map(({ id }) => id), contract.globalDestinations);
  assert.equal(catalog.categories.length, contract.counts.settingsCategories);
  assert.equal(settingsFieldCount(), contract.counts.settingsFields);
  assert.equal(CONTROL_PLANE_DOMAINS.length, contract.counts.controlPlaneDomains);
  assert.ok(BACKEND_ATLAS.total >= contract.counts.backendRoutes);
  assert.ok(BACKEND_ATLAS.domains.length >= contract.counts.backendDomains);
});

test('required runtime, UI and compatibility paths remain present', () => {
  for (const relative of contract.requiredPaths) assert.ok(fs.existsSync(path.join(root, relative)), `missing retained path: ${relative}`);
});

test('Windows installer identity and data preservation contract remain stable', () => {
  assert.equal(installer.appId, contract.installer.appId);
  assert.equal(installer.nsis.guid, contract.installer.guid);
  assert.equal(installer.win.executableName, contract.installer.executableName);
  assert.equal(installer.artifactName, contract.installer.artifactName);
  assert.equal(installer.nsis.deleteAppDataOnUninstall, false);
});
