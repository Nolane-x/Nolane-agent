import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async (file) => JSON.parse(await readFile(file, 'utf8'));

test('wave13 trust contracts are verified with direct tests and production wiring', async () => {
  const catalog = await read('requirements/nolane-native-core-contracts.json');
  for (const id of ['NATIVE-SECRET-PROVIDER-FRAMEWORK-WAVE13', 'NATIVE-DASHBOARD-AUTH-TRUST-WAVE13', 'NATIVE-GATEWAY-PAIRING-SECURITY', 'NATIVE-REAUTHENTICATION-FLOW']) {
    const contract = catalog.contracts.find((entry) => entry.id === id);
    assert.equal(contract?.status, 'verified', id);
    assert.ok(contract.entrypoints.includes('src/native-core/trust-core-wave13.mjs'), id);
    assert.ok(contract.tests.some((file) => file.includes('trust-wave13')), id);
    assert.ok(contract.productionWiring.some((entry) => entry.path.includes('orchestration-service') && entry.contains === 'TrustCoreRuntimeWave13'), id);
  }
});

test('wave13 verifies trust logic while real secret and identity providers stay external', async () => {
  const conformance = await read('requirements/nolane-native-core-conformance.json');
  const mappings = new Map(conformance.candidateMappings.map((entry) => [entry.sourcePath, entry]));
  for (const sourcePath of ['agent/secret_sources/base.py', 'agent/secret_sources/registry.py', 'agent/secret_sources/command.py']) assert.equal(mappings.get(sourcePath)?.contractId, 'NATIVE-SECRET-PROVIDER-FRAMEWORK-WAVE13', sourcePath);
  for (const sourcePath of ['nolane_native_cli/dashboard_auth/middleware.py', 'nolane_native_cli/dashboard_auth/token_auth.py', 'nolane_native_cli/dashboard_auth/ws_tickets.py']) assert.equal(mappings.get(sourcePath)?.contractId, 'NATIVE-DASHBOARD-AUTH-TRUST-WAVE13', sourcePath);
  assert.equal(mappings.get('gateway/pairing.py')?.contractId, 'NATIVE-GATEWAY-PAIRING-SECURITY');
  assert.equal(mappings.get('apps/desktop/src/components/boot-failure-reauth.ts')?.contractId, 'NATIVE-REAUTHENTICATION-FLOW');
  for (const sourcePath of ['agent/secret_sources/onepassword.py', 'agent/secret_sources/bitwarden.py', 'nolane_native_cli/dingtalk_auth.py']) assert.equal(mappings.get(sourcePath)?.status, 'external_gate', sourcePath);
  assert.equal(conformance.summary.completeParityClaimAllowed, false);
});
