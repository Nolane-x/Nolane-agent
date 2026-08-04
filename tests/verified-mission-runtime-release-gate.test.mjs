import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { measureVerifiedMissionRuntime } from '../scripts/measure-verified-mission-runtime.mjs';
import { verifyVerifiedMissionRuntime } from '../src/release/verified-mission-runtime-verifier.mjs';

const PROMOTED_IDS = Object.freeze(['29.3','29.8','29.13','29.14','29.16','34.9','34.11','34.12','34.13','34.14','40.4','40.12','40.18']);
async function exists(relative) { try { await access(path.resolve(relative)); return true; } catch { return false; } }
function statusById(audit) { return new Map(audit.sections.flatMap((section) => section.items).map((item) => [item.id, item.status])); }

test('3.2 measurement deterministically proves verified mission runtime boundaries', async () => {
  const first = await measureVerifiedMissionRuntime({ rootDirectory: process.cwd(), version: '3.2.0' });
  const second = await measureVerifiedMissionRuntime({ rootDirectory: process.cwd(), version: '3.2.0' });
  assert.equal(first.receiptSha256, second.receiptSha256);
  assert.deepEqual(first.promotedRequirementIds, PROMOTED_IDS);
  assert.deepEqual(first.outcomes.scopeScores, { task: 3, milestone: 3, mission: 3 });
  assert.equal(first.outcomes.contextTokensActuallyUseful, 120);
  assert.equal(first.outcomes.costBoundToDecision, true);
  assert.equal(first.objective.correctnessFirst, true);
  assert.equal(first.objective.rewardHackingBlocked, true);
  assert.equal(first.effects.falseSuccessDetected, true);
  assert.equal(first.effects.commitAllowed, false);
  assert.deepEqual(first.confidence.lanes, ['execution','hypothesis','patch','plan','requirement','retrieval','verification']);
  assert.equal(first.confidence.weakestLaneControlsBase, true);
  assert.equal(first.confidence.correlatedEvidenceDeduplicated, true);
  assert.equal(first.stateMachine.observationRequiredBeforeCommit, true);
  assert.equal(first.progress.churnOnlyDetected, true);
  assert.equal(first.resources.taskRssMbSeconds, 150);
  assert.equal(first.resources.missionRssMbSeconds, 150);
  assert.equal(first.logs.rawRecordsStoredInMemory, false);
  assert.equal(first.logs.redactionVerified, true);
  assert.equal(first.logs.restartRecoveryVerified, true);
  assert.equal(first.processes.realTreeCleanupVerified, process.platform === 'linux');
  assert.equal(first.processes.unregisteredProcessKillAllowed, false);
  assert.equal(first.boundaries.externalGateCountChanged, false);
  assert.equal(first.boundaries.comparativeSuperiorityClaimed, false);
  assert.match(first.receiptSha256, /^[a-f0-9]{64}$/);
});

test('3.2 release gate requires source tests measurement audit transitions and non-claims', async (t) => {
  for (const relative of [
    'scripts/measure-verified-mission-runtime.mjs',
    'src/release/verified-mission-runtime-verifier.mjs',
    'scripts/verify-verified-mission-runtime.mjs',
    'docs/verified-mission-runtime-measurement-3.2.0.json',
    'docs/feature-audit-3.2.0.json',
    'docs/LIMITATIONS-3.2.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-320-verified-mission-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyVerifiedMissionRuntime({ rootDirectory: process.cwd(), version: '3.2.0', outputFile: path.join(output, 'report.json') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.auditCounts, { verified_source_test: 985, partial: 102, external_gate: 63, not_implemented: 0 });
  assert.deepEqual(report.promotedRequirementIds, PROMOTED_IDS);
  assert.equal(report.boundaries.externalGateCountChanged, false);
  assert.equal(report.boundaries.unverifiedOutcomeCreatesValue, false);
  assert.equal(report.boundaries.unregisteredProcessKillAllowed, false);
  assert.equal(report.boundaries.comparativeSuperiorityClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});

test('3.2 audit promotes exactly thirteen P0 partial requirements', async () => {
  const previous = JSON.parse(await readFile('docs/feature-audit-3.1.0.json', 'utf8'));
  const current = JSON.parse(await readFile('docs/feature-audit-3.2.0.json', 'utf8'));
  assert.deepEqual(current.summary, { verified_source_test: 985, partial: 102, external_gate: 63, not_implemented: 0 });
  const before = statusById(previous);
  const after = statusById(current);
  const changed = [...after].filter(([id, status]) => before.get(id) !== status).map(([id]) => id).sort();
  assert.deepEqual(changed, [...PROMOTED_IDS].sort());
  for (const id of PROMOTED_IDS) {
    assert.equal(before.get(id), 'partial');
    assert.equal(after.get(id), 'verified_source_test');
  }
});

test('full matrix includes verified mission runtime as a required architecture gate', async () => {
  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'verified-mission-runtime'/);
  assert.match(matrix, /scripts\/verify-verified-mission-runtime\.mjs/);
});

test('later releases retain the 3.2 verified mission guarantees while allowing separately certified audit promotions', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-330-verified-mission-retention-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyVerifiedMissionRuntime({ rootDirectory: process.cwd(), version: '3.3.0', outputFile: path.join(output, 'report.json') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.auditCounts, { verified_source_test: 996, partial: 91, external_gate: 63, not_implemented: 0 });
  assert.deepEqual(report.promotedRequirementIds, PROMOTED_IDS);
  assert.equal(report.boundaries.externalGateCountChanged, false);
});
