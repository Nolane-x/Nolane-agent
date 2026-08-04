import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const VERIFIED = ['NATIVE-ACP-PROXY-TRANSPORT','NATIVE-ANTHROPIC-ACP-TRANSPORT','NATIVE-BEDROCK-ACP-TRANSPORT','NATIVE-CODEX-APP-SERVER-TRANSPORT','NATIVE-MCP-TOOLS-SERVER-TRANSPORT'];

test('wave9 residual provider and ACP transports are locally verified', async () => {
  const catalog = JSON.parse(await readFile('requirements/nolane-native-core-contracts.json', 'utf8'));
  const byId = new Map(catalog.contracts.map((entry) => [entry.id, entry]));
  for (const id of VERIFIED) {
    const contract = byId.get(id);
    assert.equal(contract?.status, 'verified', id);
    assert.ok(contract.entrypoints.some((p) => p.includes('provider-transport-runtime-wave9')), id);
    assert.ok(contract.tests.some((p) => p.includes('provider-wave9')), id);
    assert.ok(contract.productionWiring.some((p) => p.path.includes('orchestration-service') && p.contains === 'ProviderTransportRuntimeWave9'), id);
  }
});

test('wave9 exact transport paths are verified while provider-real certification remains external', async () => {
  const conformance = JSON.parse(await readFile('requirements/nolane-native-core-conformance.json', 'utf8'));
  const mapping = new Map(conformance.candidateMappings.map((entry) => [entry.sourcePath, entry]));
  for (const sourcePath of ['agent/proxy_sources/iron_proxy.py','agent/transports/anthropic.py','agent/transports/bedrock.py','agent/transports/codex_app_server.py','agent/transports/nolane_native_tools_mcp_server.py']) assert.equal(mapping.get(sourcePath)?.status, 'verified', sourcePath);
  const catalog = JSON.parse(await readFile('requirements/nolane-native-core-contracts.json', 'utf8'));
  assert.equal(catalog.contracts.find((entry) => entry.id === 'NATIVE-PROVIDER-REAL-CERTIFICATION')?.status, 'external_gate');
  assert.equal(conformance.summary.completeParityClaimAllowed, false);
});
