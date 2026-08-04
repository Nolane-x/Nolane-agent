import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateNolaneNativeCoreInventory } from '../native-core/nolane-native-domain-classifier.mjs';

export async function verifyNolaneNativeCoreInventory({ rootDirectory = process.cwd(), inventoryPath = 'requirements/nolane-native-core-inventory.json' } = {}) {
  const inventory = JSON.parse(await readFile(path.resolve(rootDirectory, inventoryPath), 'utf8'));
  const validated = validateNolaneNativeCoreInventory(inventory);
  if (inventory.summary.entries !== inventory.sourceSnapshot.fileCount) throw new Error('NolaneNative inventory file count mismatch');
  if (inventory.summary.coreEntries + inventory.summary.excludedEntries !== inventory.summary.entries) throw new Error('NolaneNative inventory classification count mismatch');
  if (inventory.contracts.length !== inventory.summary.contractCandidates) throw new Error('NolaneNative inventory candidate count mismatch');
  return Object.freeze({
    schema: 'nolane.release.nolane_native-core-inventory-verification.v1',
    status: 'pass',
    entries: inventory.summary.entries,
    coreEntries: inventory.summary.coreEntries,
    excludedEntries: inventory.summary.excludedEntries,
    contractCandidates: inventory.summary.contractCandidates,
    unmappedCorePaths: inventory.summary.unmappedCorePaths,
    fileExistenceIsProof: false,
    completeParityClaimAllowed: false,
    receiptSha256: validated.receiptSha256,
  });
}
