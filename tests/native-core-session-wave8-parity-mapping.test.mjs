import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const VERIFIED = [
  'NATIVE-CONVERSATION-CORRECTION',
  'NATIVE-SESSION-CONTEXT-DRIFT',
  'NATIVE-SESSION-PERFORMANCE-SCENARIOS',
  'NATIVE-SESSION-PRODUCT-LIFECYCLE',
  'NATIVE-SESSION-STREAM-COORDINATION',
  'NATIVE-SESSION-TERMINAL-BINDING',
  'NATIVE-SESSION-VIRTUAL-LIST',
  'NATIVE-SESSION-WINDOW-LEASE',
];

test('wave8 session contracts have direct tests and production wiring', async () => {
  const catalog = JSON.parse(await readFile('requirements/nolane-native-core-contracts.json', 'utf8'));
  const byId = new Map(catalog.contracts.map((entry) => [entry.id, entry]));
  for (const id of VERIFIED) {
    const contract = byId.get(id);
    assert.ok(contract, `missing ${id}`);
    assert.equal(contract.status, 'verified', id);
    assert.ok(contract.entrypoints.some((p) => p.includes('session-product-runtime-wave8')), id);
    assert.ok(contract.tests.some((p) => p.includes('session-wave8')), id);
    assert.ok(contract.productionWiring.some((p) => p.path.includes('orchestration-service') && p.contains === 'SessionProductRuntimeWave8'), id);
  }
});

test('wave8 exact session paths are locally verified and claims remain gated', async () => {
  const conformance = JSON.parse(await readFile('requirements/nolane-native-core-conformance.json', 'utf8'));
  const mapping = new Map(conformance.candidateMappings.map((entry) => [entry.sourcePath, entry]));
  const paths = [
    'apps/desktop/e2e/large-session-resume.spec.ts',
    'apps/desktop/e2e/hidden-history-messages.spec.ts',
    'apps/desktop/e2e/session-compression-and-queue-stop.spec.ts',
    'apps/desktop/electron/session-windows.ts',
    'apps/desktop/src/app/chat/sidebar/virtual-session-list.tsx',
    'apps/desktop/src/app/right-sidebar/terminal/use-terminal-session.ts',
    'apps/desktop/src/app/session/hooks/session-context-drift.ts',
    'apps/desktop/e2e/correction-session-switch.spec.ts',
  ];
  for (const sourcePath of paths) assert.equal(mapping.get(sourcePath)?.status, 'verified', sourcePath);
  assert.equal(conformance.summary.completeParityClaimAllowed, false);
});
