import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';

import { verifyPlanningEvidenceGovernance } from '../src/release/planning-evidence-governance-verifier.mjs';

const VERIFIED_ITEMS = ['5.23', '7.5', '7.9', '7.18', '7.19', '9.8', '9.9', '9.10', '9.11', '9.16', '9.17', '9.19', '15.10', '15.11', '15.19', '15.23'];

test('Planning evidence governance release gate verifies source audit limitations and matrix inclusion', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-planning-evidence-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyPlanningEvidenceGovernance({ rootDirectory: path.resolve('.'), version: '2.12.0', outputFile: path.join(output, 'receipt.json') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.verifiedItems, VERIFIED_ITEMS);
  assert.equal(report.limitations.perfectScopeEstimationClaimed, false);
  assert.equal(report.limitations.automaticSubagentExecutionClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
