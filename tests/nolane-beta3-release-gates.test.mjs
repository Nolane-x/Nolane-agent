import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { defaultReleaseGates } from '../src/release/full-release-matrix.mjs';
import { verifyNolaneNativeCoreInventory } from '../src/release/nolane-native-core-inventory-verifier.mjs';
import { verifyMasterAcceptanceLedger } from '../src/release/master-ledger-verifier.mjs';
import { verifyNativeCoreParity } from '../src/release/native-core-parity-verifier.mjs';

const gateIds = [
  'native-core-inventory',
  'master-acceptance-ledger',
  'native-core-contract-catalog',
  'native-core-runtime-kernel',
  'native-core-context-provider',
  'native-core-tool-execution',
  'native-core-state-learning',
  'native-core-extension-automation',
  'native-core-gateway-api',
  'native-core-operations-security',
  'native-core-goal-evidence',
  'native-core-adapter-tck',
  'native-core-mixture-of-agents',
  'native-core-runtime-wave3',
  'native-core-surface-wave3',
  'native-core-wave3-production-wiring',
  'native-core-wave3-parity-mapping',
  'beta3-release-docs',
];

test('beta.3 matrix retains beta.3 native-core gates and adds four runtime-conversion gates plus current release docs', () => {
  const baseline = defaultReleaseGates({ rootDirectory: process.cwd(), version: '5.0.0-beta.1' });
  const beta2 = defaultReleaseGates({ rootDirectory: process.cwd(), version: '5.0.0-beta.2' });
  const beta3 = defaultReleaseGates({ rootDirectory: process.cwd(), version: '5.0.0-beta.3' });
  assert.equal(baseline.length, 104);
  assert.equal(beta2.length, 118);
  assert.equal(beta3.length, 122);
  const ids = new Set(beta3.map((gate) => gate.id));
  for (const id of gateIds) assert.ok(ids.has(id), id);
  for (const gate of beta2) {
    if (gate.id !== 'beta2-release-docs') assert.ok(ids.has(gate.id), `retained ${gate.id}`);
  }
  assert.equal(ids.has('beta2-release-docs'), false);
  assert.equal(ids.has('beta3-release-docs'), true);
});

test('inventory verifier proves complete classification but does not infer parity from files', async () => {
  const receipt = await verifyNolaneNativeCoreInventory({ rootDirectory: process.cwd() });
  assert.equal(receipt.status, 'pass');
  assert.equal(receipt.unmappedCorePaths, 0);
  assert.equal(receipt.fileExistenceIsProof, false);
  assert.equal(receipt.completeParityClaimAllowed, false);
  assert.match(receipt.receiptSha256, /^[a-f0-9]{64}$/);
});

test('master ledger verifier requires fresh evidence and keeps every unresolved state visible', async () => {
  const receipt = await verifyMasterAcceptanceLedger({ rootDirectory: process.cwd() });
  assert.equal(receipt.status, 'pass');
  assert.equal(receipt.freshEvidence, true);
  assert.ok(receipt.statusCounts.not_implemented > 0 || receipt.statusCounts.external_gate > 0);
  assert.equal(receipt.completeClaimAllowed, false);
});

test('native parity verifier reproduces conformance and locks complete/superiority claims while external certification remains', async () => {
  const receipt = await verifyNativeCoreParity({ rootDirectory: process.cwd() });
  assert.equal(receipt.status, 'pass');
  assert.equal(receipt.completeParityClaimAllowed, false);
  assert.equal(receipt.superiorityClaimAllowed, false);
  assert.equal(receipt.candidateStatusCounts.not_implemented, 0);
  assert.equal(receipt.unmatchedCandidates, 0);
  assert.ok(receipt.candidateStatusCounts.external_gate > 0);
  const persisted = JSON.parse(await readFile('requirements/nolane-native-core-conformance.json', 'utf8'));
  assert.equal(receipt.conformanceReceiptSha256, persisted.receiptSha256);
});
