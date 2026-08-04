import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const REQUIRED = [
  'NATIVE-AGENT-BEHAVIOR-RUNTIME',
  'NATIVE-SESSION-LIFECYCLE-RUNTIME',
  'NATIVE-TOOL-GOVERNANCE-RUNTIME',
  'NATIVE-PROFILE-CONFIGURATION-RUNTIME',
  'NATIVE-OAUTH-SECURITY-RUNTIME',
];

test('wave4 contracts are verified with direct negative tests and production wiring', async () => {
  const catalog = JSON.parse(await readFile('requirements/nolane-native-core-contracts.json', 'utf8'));
  const byId = new Map(catalog.contracts.map((entry) => [entry.id, entry]));
  for (const id of REQUIRED) {
    const contract = byId.get(id);
    assert.ok(contract, `missing ${id}`);
    assert.equal(contract.status, 'verified');
    assert.ok(contract.entrypoints.length > 0);
    assert.ok(contract.tests.some((path) => path.includes('wave4')));
    assert.ok(contract.negativeTests.some((path) => path.includes('wave4')));
    assert.ok(contract.productionWiring.length > 0);
  }
});

test('wave4 maps only exact locally implemented residual behavior and keeps real integrations external', async () => {
  const conformance = JSON.parse(await readFile('requirements/nolane-native-core-conformance.json', 'utf8'));
  const mapping = new Map(conformance.candidateMappings.map((entry) => [entry.sourcePath, entry]));
  const expected = new Map([
    ['agent/think_scrubber.py', 'NATIVE-AGENT-BEHAVIOR-RUNTIME'],
    ['agent/background_review.py', 'NATIVE-AGENT-BEHAVIOR-RUNTIME'],
    ['nolane_native_cli/session_export.py', 'NATIVE-SESSION-LIFECYCLE-RUNTIME'],
    ['ui-tui/src/hooks/useInputHistory.ts', 'NATIVE-SESSION-LIFECYCLE-RUNTIME'],
    ['tools/schema_sanitizer.py', 'NATIVE-TOOL-GOVERNANCE-RUNTIME'],
    ['tools/url_safety.py', 'NATIVE-TOOL-GOVERNANCE-RUNTIME'],
    ['nolane_native_cli/subcommands/profile.py', 'NATIVE-PROFILE-CONFIGURATION-RUNTIME'],
    ['apps/desktop/src/store/profile.ts', 'NATIVE-PROFILE-CONFIGURATION-RUNTIME'],
    ['apps/desktop/electron/native-oauth.ts', 'NATIVE-OAUTH-SECURITY-RUNTIME'],
    ['web/src/lib/mcp-dashboard-oauth.ts', 'NATIVE-OAUTH-SECURITY-RUNTIME'],
  ]);
  for (const [sourcePath, contractId] of expected) {
    assert.equal(mapping.get(sourcePath)?.contractId, contractId, sourcePath);
    assert.equal(mapping.get(sourcePath)?.status, 'verified', sourcePath);
  }
  assert.equal(mapping.get('plugins/model-providers/stepfun/__init__.py')?.status, 'external_gate');
  assert.equal(mapping.get('apps/desktop/src/app/settings/billing/api.ts')?.contractId, 'NATIVE-ENTITLEMENT-CONFIG');
  assert.equal(mapping.get('apps/desktop/src/app/settings/billing/api.ts')?.status, 'verified');
  assert.equal(conformance.summary.completeParityClaimAllowed, false);
  assert.ok(conformance.summary.externalContracts > 0);
});
