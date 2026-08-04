import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyAdaptiveWorkFabric } from '../src/release/adaptive-work-fabric-verifier.mjs';

test('adaptive work fabric gate proves attributed admission, shared indexing, mutable swarm reconciliation, measurement, and explicit non-claims', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-217-work-fabric-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyAdaptiveWorkFabric({ rootDirectory: path.resolve('.'), version: '2.18.0', outputFile: path.join(output, 'receipt.json') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.auditCounts, { verified_source_test: 734, partial: 0, external_gate: 56, not_implemented: 0 });
  assert.equal(report.boundaries.persistentOneShotCliHostClaimed, false);
  assert.equal(report.boundaries.semanticMergeCorrectnessClaimed, false);
  assert.equal(report.boundaries.osProcessTreeContainmentCertified, false);
  assert.ok(report.measurement.provider.peakActive <= report.measurement.provider.limit);
  assert.equal(report.measurement.repository.runnerCalls, 1);
  assert.ok(report.measurement.repository.coalescedRequests >= 1);
  assert.ok(report.measurement.repository.staleCancelled >= 1);
  assert.ok(report.measurement.swarm.added >= 1);
  assert.ok(report.measurement.swarm.revised >= 1);
  assert.ok(report.measurement.swarm.revoked >= 1);
  assert.ok(report.metrics.appStaticImports <= 160);
  assert.ok(report.metrics.appConstructors <= 180);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
