import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async (file) => JSON.parse(await readFile(file, 'utf8'));

const CONTRACTS = [
  'NATIVE-BOOTSTRAP-CONNECTION-CONFIG', 'NATIVE-DESKTOP-SETTINGS-SURFACE', 'NATIVE-ENTITLEMENT-CONFIG',
  'NATIVE-MODEL-PROFILE-SURFACE', 'NATIVE-PLUGIN-SURFACE-PROJECTION', 'NATIVE-PROFILE-MODEL-CONFIG',
  'NATIVE-SHARED-PRODUCT-MODEL', 'NATIVE-TUI-PRODUCT-SURFACE', 'NATIVE-TUI-STATE-STORES',
  'NATIVE-UPDATE-LIFECYCLE', 'NATIVE-WEB-DASHBOARD-SURFACE',
];

test('wave15 product and configuration contracts are verified with direct tests and production wiring', async () => {
  const catalog = await read('requirements/nolane-native-core-contracts.json');
  for (const id of CONTRACTS) {
    const contract = catalog.contracts.find((entry) => entry.id === id);
    assert.equal(contract?.status, 'verified', id);
    assert.ok(contract.entrypoints.includes('src/native-core/product-configuration-runtime-wave15.mjs'), id);
    assert.ok(contract.tests.some((file) => file.includes('product-config-wave15')), id);
    assert.ok(contract.productionWiring.some((entry) => entry.path.includes('orchestration-service') && entry.contains === 'ProductConfigurationRuntimeWave15'), id);
  }
});

test('wave15 closes residual product/config mappings but leaves Windows, accessibility and installer certification external', async () => {
  const conformance = await read('requirements/nolane-native-core-conformance.json');
  const mappings = new Map(conformance.candidateMappings.map((entry) => [entry.sourcePath, entry]));
  const expected = {
    'apps/shared/src/index.ts': 'NATIVE-SHARED-PRODUCT-MODEL',
    'ui-tui/src/app/turnStore.ts': 'NATIVE-TUI-STATE-STORES',
    'ui-tui/src/app.tsx': 'NATIVE-TUI-PRODUCT-SURFACE',
    'web/src/App.tsx': 'NATIVE-WEB-DASHBOARD-SURFACE',
    'apps/desktop/electron/bootstrap-runner.ts': 'NATIVE-BOOTSTRAP-CONNECTION-CONFIG',
    'apps/desktop/electron/update-relaunch.ts': 'NATIVE-UPDATE-LIFECYCLE',
    'web/src/components/ModelPickerDialog.tsx': 'NATIVE-MODEL-PROFILE-SURFACE',
    'web/src/pages/PluginsPage.tsx': 'NATIVE-PLUGIN-SURFACE-PROJECTION',
  };
  for (const [sourcePath, contractId] of Object.entries(expected)) assert.equal(mappings.get(sourcePath)?.contractId, contractId, sourcePath);
  for (const sourcePath of ['apps/bootstrap-installer/src-tauri/src/main.rs', 'apps/desktop/electron/windows-nolane_native-path.ts', 'nolane_native_cli/dashboard_register.py']) assert.equal(mappings.get(sourcePath)?.status, 'external_gate', sourcePath);
  assert.equal(conformance.summary.unmatchedCandidates, 0);
  assert.equal(conformance.summary.completeParityClaimAllowed, false);
});
