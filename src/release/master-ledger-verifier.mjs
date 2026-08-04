import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateMasterLedger } from '../requirements/master-ledger.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export async function verifyMasterAcceptanceLedger({ rootDirectory = process.cwd(), ledgerPath = 'requirements/master-acceptance-ledger.json' } = {}) {
  const root = path.resolve(rootDirectory);
  const ledger = JSON.parse(await readFile(path.resolve(root, ledgerPath), 'utf8'));
  validateMasterLedger(ledger);
  if (ledger.evidencePolicy?.requireFreshHashes !== true) throw new Error('Master ledger fresh-hash policy is disabled');
  let checkedEvidence = 0;
  for (const requirement of ledger.requirements) {
    for (const [relativePath, expected] of Object.entries(requirement.acceptance?.evidenceHashes ?? {})) {
      const absolute = path.resolve(root, relativePath);
      const relative = path.relative(root, absolute);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Master ledger evidence escapes root: ${relativePath}`);
      const actual = sha256(await readFile(absolute));
      if (actual !== expected) throw new Error(`Master ledger evidence is stale: ${relativePath}`);
      checkedEvidence += 1;
    }
  }
  const counts = ledger.summary.statusCounts;
  const completeClaimAllowed = counts.external_gate === 0 && counts.implemented_not_wired === 0 && counts.not_implemented === 0 && counts.unmapped === 0;
  return Object.freeze({
    schema: 'nolane.release.master-ledger-verification.v1',
    status: 'pass',
    canonicalItems: ledger.summary.canonicalItems,
    statusCounts: Object.freeze({ ...counts }),
    checkedEvidence,
    freshEvidence: true,
    completeClaimAllowed,
    receiptSha256: ledger.receiptSha256,
  });
}
