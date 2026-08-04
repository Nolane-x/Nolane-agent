import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';

import { verifyLocalOperationsHumanControl } from '../src/release/local-operations-human-control-verifier.mjs';

const VERIFIED_ITEMS = ['4.22', '4.24', '4.25', '4.32', '4.43', '4.44', '5.32', '5.33', '14.18', '20.9'];

test('Local Operations and Human Control release gate verifies bounded viewers, controls, cache, audit, limitations, and matrix inclusion', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-local-operations-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyLocalOperationsHumanControl({ rootDirectory: path.resolve('.'), version: '2.13.0', outputFile: path.join(output, 'receipt.json') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.verifiedItems, VERIFIED_ITEMS);
  assert.equal(report.limitations.providerInvoiceClaimed, false);
  assert.equal(report.limitations.callGraphAlwaysAvailableClaimed, false);
  assert.equal(report.limitations.retentionDisablesEnforcementClaimed, false);
  assert.equal(report.limitations.secretCacheClaimed, false);
  assert.equal(report.limitations.editedCommandKeepsApprovalClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
