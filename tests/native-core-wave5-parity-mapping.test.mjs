import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const REQUIRED = [
  'NATIVE-KANBAN-SYNC-WAVE12',
  'NATIVE-LOCAL-OBSERVABILITY-RUNTIME',
  'NATIVE-SKILL-BUNDLE-RUNTIME',
  'NATIVE-DASHBOARD-AUTH-RUNTIME',
  'NATIVE-SESSION-SEARCH-RUNTIME',
  'NATIVE-DURABLE-ADAPTER-SCHEDULER-WAVE12',
  'NATIVE-JSON-FAST-PATH-RUNTIME',
];

test('wave5 contracts are verified with direct tests and production wiring', async () => {
  const catalog = JSON.parse(await readFile('requirements/nolane-native-core-contracts.json', 'utf8'));
  const byId = new Map(catalog.contracts.map((entry) => [entry.id, entry]));
  for (const id of REQUIRED) {
    const contract = byId.get(id);
    assert.ok(contract, `missing ${id}`);
    assert.equal(contract.status, 'verified');
    assert.ok(contract.entrypoints.length > 0);
    const expectedWave = id.endsWith('WAVE12') ? 'wave12' : 'wave5';
    assert.ok(contract.tests.some((p) => p.includes(expectedWave)), `${id} missing ${expectedWave} test`);
    assert.ok(contract.productionWiring.length > 0);
  }
});

test('wave5 maps only locally implemented behavior and leaves real adapters external', async () => {
  const conformance = JSON.parse(await readFile('requirements/nolane-native-core-conformance.json', 'utf8'));
  const mapping = new Map(conformance.candidateMappings.map((entry) => [entry.sourcePath, entry]));
  const expected = new Map([
    ['plugins/kanban/dashboard/plugin_api.py', 'NATIVE-KANBAN-SYNC-WAVE12'],
    ['plugins/disk-cleanup/disk_cleanup.py', 'NATIVE-LOCAL-OBSERVABILITY-RUNTIME'],
    ['agent/skill_bundles.py', 'NATIVE-SKILL-BUNDLE-RUNTIME'],
    ['plugins/dashboard_auth/basic/__init__.py', 'NATIVE-DASHBOARD-AUTH-RUNTIME'],
    ['tools/session_search_tool.py', 'NATIVE-SESSION-SEARCH-RUNTIME'],
    ['plugins/cron_providers/chronos/verify.py', 'NATIVE-DURABLE-ADAPTER-SCHEDULER-WAVE12'],
    ['agent/jiter_preload.py', 'NATIVE-JSON-FAST-PATH-RUNTIME'],
  ]);
  for (const [sourcePath, contractId] of expected) {
    assert.equal(mapping.get(sourcePath)?.contractId, contractId, sourcePath);
    assert.equal(mapping.get(sourcePath)?.status, 'verified', sourcePath);
  }
  assert.equal(mapping.get('plugins/cron_providers/chronos/_nas_client.py')?.status, 'external_gate');
  assert.equal(mapping.get('plugins/observability/langfuse/__init__.py')?.status, 'external_gate');
  assert.equal(mapping.get('plugins/dashboard_auth/nous/__init__.py')?.status, 'external_gate');
  assert.equal(conformance.summary.completeParityClaimAllowed, false);
});
