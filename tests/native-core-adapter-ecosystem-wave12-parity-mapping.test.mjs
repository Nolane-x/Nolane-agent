import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async (file) => JSON.parse(await readFile(file, 'utf8'));

test('wave12 adapter ecosystem contracts are verified with direct tests and production wiring', async () => {
  const catalog = await read('requirements/nolane-native-core-contracts.json');
  for (const id of [
    'NATIVE-MEMORY-ADAPTER-FRAMEWORK-WAVE12',
    'NATIVE-SIGNED-PLUGIN-PACKAGE-WAVE12',
    'NATIVE-DURABLE-ADAPTER-SCHEDULER-WAVE12',
    'NATIVE-KANBAN-SYNC-WAVE12',
    'NATIVE-OBSERVABILITY-ADAPTER-FRAMEWORK-WAVE12',
    'NATIVE-OPERATIONS-UTILITY-COMPAT',
  ]) {
    const contract = catalog.contracts.find((entry) => entry.id === id);
    assert.equal(contract?.status, 'verified', id);
    assert.ok(contract.entrypoints.includes('src/native-core/adapter-ecosystem-wave12.mjs'), id);
    assert.ok(contract.tests.some((file) => file.includes('adapter-ecosystem-wave12')), id);
    assert.ok(contract.productionWiring.some((entry) => entry.path.includes('orchestration-service') && entry.contains === 'AdapterEcosystemRuntimeWave12'), id);
  }
});

test('wave12 verifies local adapter frameworks while real integrations remain external', async () => {
  const conformance = await read('requirements/nolane-native-core-conformance.json');
  const mappings = new Map(conformance.candidateMappings.map((entry) => [entry.sourcePath, entry]));
  const verified = {
    'plugins/memory/__init__.py': 'NATIVE-MEMORY-ADAPTER-FRAMEWORK-WAVE12',
    'plugins/memory/config_schema.py': 'NATIVE-MEMORY-ADAPTER-FRAMEWORK-WAVE12',
    'plugins/memory/query_rewrite.py': 'NATIVE-MEMORY-ADAPTER-FRAMEWORK-WAVE12',
    'plugins/plugin_utils.py': 'NATIVE-SIGNED-PLUGIN-PACKAGE-WAVE12',
    'plugins/cron_providers/chronos/verify.py': 'NATIVE-DURABLE-ADAPTER-SCHEDULER-WAVE12',
    'plugins/kanban/dashboard/plugin_api.py': 'NATIVE-KANBAN-SYNC-WAVE12',
    'plugins/observability/langfuse/plugin.yaml': 'NATIVE-OBSERVABILITY-ADAPTER-FRAMEWORK-WAVE12',
    'utils.py': 'NATIVE-OPERATIONS-UTILITY-COMPAT',
  };
  for (const [sourcePath, contractId] of Object.entries(verified)) assert.equal(mappings.get(sourcePath)?.contractId, contractId, sourcePath);
  for (const sourcePath of [
    'plugins/memory/honcho/client.py',
    'plugins/cron_providers/chronos/_nas_client.py',
    'plugins/observability/langfuse/__init__.py',
  ]) assert.equal(mappings.get(sourcePath)?.status, 'external_gate', sourcePath);
  assert.equal(conformance.summary.unmatchedCandidates, 0);
  assert.equal(conformance.summary.completeParityClaimAllowed, false);
});
