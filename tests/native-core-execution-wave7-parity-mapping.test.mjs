import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const VERIFIED = [
  'NATIVE-SHELL-HOOK-POLICY',
  'NATIVE-LAZY-DEPENDENCY-RESOLUTION',
  'NATIVE-DAEMON-POOL-LIFECYCLE',
  'NATIVE-TOOL-DISPATCH-PIPELINE',
  'NATIVE-EXECUTION-ENVIRONMENT-BACKENDS',
];

test('wave7 execution contracts are verified by direct tests and production wiring', async () => {
  const catalog = JSON.parse(await readFile('requirements/nolane-native-core-contracts.json', 'utf8'));
  const byId = new Map(catalog.contracts.map((entry) => [entry.id, entry]));
  for (const id of VERIFIED) {
    const contract = byId.get(id);
    assert.ok(contract, `missing ${id}`);
    assert.equal(contract.status, 'verified', id);
    assert.ok(contract.entrypoints.some((p) => p.includes('execution')), id);
    assert.ok(contract.tests.some((p) => p.includes('execution-wave7')), id);
    assert.ok(contract.productionWiring.some((p) => p.path.includes('orchestration-service') && p.contains === 'ExecutionRuntimeWave7'), id);
  }
});

test('wave7 maps local execution behavior while real remote infrastructure remains external', async () => {
  const conformance = JSON.parse(await readFile('requirements/nolane-native-core-conformance.json', 'utf8'));
  const mapping = new Map(conformance.candidateMappings.map((entry) => [entry.sourcePath, entry]));
  const expected = new Map([
    ['agent/shell_hooks.py', 'NATIVE-SHELL-HOOK-POLICY'],
    ['tools/lazy_deps.py', 'NATIVE-LAZY-DEPENDENCY-RESOLUTION'],
    ['tools/daemon_pool.py', 'NATIVE-DAEMON-POOL-LIFECYCLE'],
    ['agent/tool_executor.py', 'NATIVE-TOOL-DISPATCH-PIPELINE'],
    ['tools/environments/local.py', 'NATIVE-EXECUTION-ENVIRONMENT-BACKENDS'],
    ['tools/environments/docker.py', 'NATIVE-EXECUTION-ENVIRONMENT-BACKENDS'],
  ]);
  for (const [sourcePath, contractId] of expected) {
    assert.equal(mapping.get(sourcePath)?.contractId, contractId, sourcePath);
    assert.equal(mapping.get(sourcePath)?.status, 'verified', sourcePath);
  }
  const catalog = JSON.parse(await readFile('requirements/nolane-native-core-contracts.json', 'utf8'));
  assert.equal(catalog.contracts.find((entry) => entry.id === 'NATIVE-REMOTE-EXECUTION-CERTIFICATION')?.status, 'external_gate');
  assert.equal(mapping.get('tools/discord_tool.py')?.status, 'external_gate');
  assert.equal(conformance.summary.completeParityClaimAllowed, false);
});
