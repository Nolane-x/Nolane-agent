import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyAdaptiveHarnessLab } from '../src/release/adaptive-harness-lab-verifier.mjs';

test('adaptive harness lab gate proves distinct profiles, privacy bounds, replay rejection, promotion, rollback, and explicit non-claims', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-218-harness-lab-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyAdaptiveHarnessLab({ rootDirectory: path.resolve('.'), version: '2.18.0', outputFile: path.join(output, 'receipt.json') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.auditCounts, { verified_source_test: 734, partial: 0, external_gate: 56, not_implemented: 0 });
  assert.ok(report.measurement.distinctProfiles >= 3);
  assert.equal(report.measurement.rejectedCandidates, 1);
  assert.equal(report.measurement.promotions, 1);
  assert.equal(report.measurement.rollbacks, 1);
  assert.equal(report.measurement.rawPromptStored, false);
  assert.equal(report.measurement.modelOutputStored, false);
  assert.equal(report.boundaries.autonomousOnlineMutationClaimed, false);
  assert.equal(report.boundaries.productionFeedbackPromotionClaimed, false);
  assert.equal(report.boundaries.processTreeAccountingCertified, false);
  assert.equal(report.boundaries.browserJourneyVerificationCertified, false);
  assert.ok(report.metrics.appStaticImports <= 165);
  assert.ok(report.metrics.appConstructors <= 185);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
