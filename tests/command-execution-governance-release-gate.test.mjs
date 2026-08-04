import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { verifyCommandExecutionGovernance } from '../src/release/command-execution-governance-verifier.mjs';

const expected = [
  '18.10', '18.18', '18.19', '18.20', '18.21', '18.22', '18.23', '18.28',
  '19.6', '19.11', '19.12', '19.14', '19.15', '19.16', '19.17', '19.18',
  '23.48', '24.15', '24.16', '25.1',
];

test('command execution governance release gate verifies source, direct tests, audit movement, and honest boundaries', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-command-execution-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyCommandExecutionGovernance({ rootDirectory: path.resolve('.'), version: '2.11.0', outputFile: path.join(output, 'receipt.json') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.verifiedItems, expected);
  assert.equal(report.limitations.windowsProductionCertified, false);
  assert.equal(report.limitations.freeFormShellExecutionClaimed, false);
  assert.equal(report.limitations.criticalApprovalBundlingClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
