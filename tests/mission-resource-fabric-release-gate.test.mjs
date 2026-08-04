import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function exists(relative) {
  try { await access(path.resolve(relative)); return true; }
  catch { return false; }
}

test('mission resource fabric gate proves resource attribution, honest session reuse, incremental intelligence, canaries, journey evidence, hosted lifecycle, lean UI, and explicit boundaries', async (t) => {
  assert.equal(await exists('src/release/mission-resource-fabric-verifier.mjs'), true, 'mission resource fabric verifier source is missing');
  assert.equal(await exists('scripts/verify-mission-resource-fabric.mjs'), true, 'mission resource fabric verifier entrypoint is missing');
  assert.equal(await exists('scripts/measure-mission-resource-fabric.mjs'), true, 'mission resource fabric measurement script is missing');
  assert.equal(await exists('docs/mission-resource-fabric-measurement-2.19.0.json'), true, 'mission resource fabric measurement is missing');
  assert.equal(await exists('docs/LIMITATIONS-2.19.0.md'), true, '2.19 limitations are missing');

  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'mission-resource-fabric'/);

  const { verifyMissionResourceFabric } = await import('../src/release/mission-resource-fabric-verifier.mjs');
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-219-resource-fabric-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyMissionResourceFabric({ rootDirectory: path.resolve('.'), version: '2.19.0', outputFile: path.join(output, 'receipt.json') });

  assert.equal(report.status, 'pass');
  assert.deepEqual(report.auditCounts, { verified_source_test: 734, partial: 0, external_gate: 56, not_implemented: 0 });
  assert.equal(report.measurement.processAttribution.missionId, 'measurement-mission');
  assert.ok(report.measurement.processAttribution.peakRssBytes > 0);
  assert.equal(report.measurement.sessionReuse.openCount, 1);
  assert.equal(report.measurement.sessionReuse.reusedSecondCall, true);
  assert.equal(report.measurement.sessionReuse.oneShotClaimedPersistent, false);
  assert.equal(report.measurement.sessionReuse.pressureEvicted, 1);
  assert.equal(report.measurement.intelligence.duplicateCoalesced, true);
  assert.equal(report.measurement.intelligence.staleGenerationSuperseded, true);
  assert.equal(report.measurement.canary.regressionDisabled, true);
  assert.equal(report.measurement.journey.visualCorrectnessClaimed, false);
  assert.equal(report.measurement.hosted.externalGateWithoutAdapter, true);
  assert.equal(report.measurement.hosted.humanMergeRequired, true);
  assert.equal(report.measurement.ui.primaryShells, 3);
  assert.equal(report.measurement.testRunner.forceExitEnabled, true);
  assert.equal(report.boundaries.allOperatingSystemsCertified, false);
  assert.equal(report.boundaries.persistentSessionsClaimedForOneShotCli, false);
  assert.equal(report.boundaries.visualCorrectnessClaimed, false);
  assert.equal(report.boundaries.automaticHostedMergeClaimed, false);
  assert.ok(report.metrics.appStaticImports <= 160);
  assert.ok(report.metrics.appConstructors <= 180);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
