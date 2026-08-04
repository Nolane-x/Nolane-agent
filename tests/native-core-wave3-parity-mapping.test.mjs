import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const REQUIRED = [
  'NATIVE-DELEGATION-CONTEXT-RUNTIME',
  'NATIVE-PROVIDER-PROTOCOL-RUNTIME',
  'NATIVE-REPOSITORY-INTELLIGENCE-RUNTIME',
  'NATIVE-BROWSER-REGISTRY-RUNTIME',
  'NATIVE-ACP-STREAMING-RUNTIME',
  'NATIVE-GATEWAY-ADAPTER-RUNTIME',
  'NATIVE-COMMAND-SURFACE-RUNTIME',
  'NATIVE-USAGE-OBSERVABILITY-RUNTIME',
];

test('wave3 runtime contracts are verified with direct tests and production wiring', async () => {
  const catalog = JSON.parse(await readFile('requirements/nolane-native-core-contracts.json', 'utf8'));
  const byId = new Map(catalog.contracts.map((entry) => [entry.id, entry]));
  for (const id of REQUIRED) {
    const contract = byId.get(id);
    assert.ok(contract, `missing ${id}`);
    assert.equal(contract.status, 'verified');
    assert.ok(contract.entrypoints.length > 0);
    assert.ok(contract.tests.length > 0);
    assert.ok(contract.productionWiring.length > 0);
  }
});

test('wave3 maps exact residual behavior paths without unlocking complete parity', async () => {
  const conformance = JSON.parse(await readFile('requirements/nolane-native-core-conformance.json', 'utf8'));
  const mapping = new Map(conformance.candidateMappings.map((entry) => [entry.sourcePath, entry]));
  const expected = new Map([
    ['agent/delegation_context.py', 'NATIVE-DELEGATION-CONTEXT-RUNTIME'],
    ['agent/chat_completion_helpers.py', 'NATIVE-PROVIDER-PROTOCOL-RUNTIME'],
    ['tools/environments/file_sync.py', 'NATIVE-REPOSITORY-INTELLIGENCE-RUNTIME'],
    ['agent/web_search_registry.py', 'NATIVE-BROWSER-REGISTRY-RUNTIME'],
    ['agent/copilot_acp_client.py', 'NATIVE-ACP-STREAMING-RUNTIME'],
    ['gateway/relay/transport.py', 'NATIVE-GATEWAY-ADAPTER-RUNTIME'],
    ['ui-tui/src/app/slash/registry.ts', 'NATIVE-COMMAND-SURFACE-RUNTIME'],
    ['agent/usage_pricing.py', 'NATIVE-USAGE-OBSERVABILITY-RUNTIME'],
  ]);
  for (const [sourcePath, contractId] of expected) {
    assert.equal(mapping.get(sourcePath)?.contractId, contractId, sourcePath);
    assert.equal(mapping.get(sourcePath)?.status, 'verified', sourcePath);
  }
  assert.equal(conformance.summary.completeParityClaimAllowed, false);
  assert.ok(conformance.summary.externalContracts > 0);
  const emptyResiduals = conformance.evidence.filter((entry) =>
    entry.id.startsWith('NATIVE-RESIDUAL-') && entry.candidateFiles === 0);
  assert.deepEqual(emptyResiduals, [], 'zero-candidate residual contracts must not inflate external parity counts');
});
