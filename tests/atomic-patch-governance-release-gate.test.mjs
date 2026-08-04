import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { verifyAtomicPatchGovernance } from '../src/release/atomic-patch-governance-verifier.mjs';

test('atomic patch governance release gate verifies source, audit, boundaries, and receipt', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-atomic-patch-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyAtomicPatchGovernance({ rootDirectory: path.resolve('.'), version: '2.10.0', outputFile: path.join(output, 'receipt.json') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.verifiedItems, ['16.14', '16.22', '16.23', '16.26', '16.27', '16.29', '16.30', '17.13', '17.18', '17.20']);
  assert.equal(report.limitations.multiFileFilesystemAtomicityClaimed, false);
  assert.equal(report.limitations.generatedOverrideClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
