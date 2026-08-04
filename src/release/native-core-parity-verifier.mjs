import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyCoreContracts } from '../native-core/core-conformance-verifier.mjs';

export async function verifyNativeCoreParity({ rootDirectory = process.cwd() } = {}) {
  const root = path.resolve(rootDirectory);
  const [catalog, inventory, persisted] = await Promise.all([
    readFile(path.join(root, 'requirements/nolane-native-core-contracts.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'requirements/nolane-native-core-inventory.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'requirements/nolane-native-core-conformance.json'), 'utf8').then(JSON.parse),
  ]);
  const reproduced = await verifyCoreContracts({ rootDirectory: root, catalog, nolane_nativeInventory: inventory });
  if (reproduced.receiptSha256 !== persisted.receiptSha256) throw new Error('Native core conformance receipt is stale');
  for (const status of ['verified', 'external_gate', 'implemented_not_wired', 'not_implemented']) {
    if (reproduced.candidateStatusCounts[status] !== persisted.candidateStatusCounts?.[status]) throw new Error(`Native core candidate status count changed: ${status}`);
  }
  return Object.freeze({
    schema: 'nolane.release.native-core-parity-verification.v1',
    status: 'pass',
    contracts: reproduced.summary.contracts,
    candidateContracts: reproduced.summary.candidateContracts,
    candidateStatusCounts: Object.freeze({ ...reproduced.candidateStatusCounts }),
    unmatchedCandidates: reproduced.summary.unmatchedCandidates,
    completeParityClaimAllowed: reproduced.summary.completeParityClaimAllowed === true,
    superiorityClaimAllowed: false,
    conformanceReceiptSha256: reproduced.receiptSha256,
  });
}
