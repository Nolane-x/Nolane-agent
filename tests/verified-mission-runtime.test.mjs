import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { VerifiedMissionRuntime } from '../src/runtime/verified-mission-runtime.mjs';

const sha = (c) => c.repeat(64);

function fixture(t) {
  const logRootDir = mkdtempSync(join(tmpdir(), 'forge-vmr-'));
  t.after(() => rmSync(logRootDir, { recursive: true, force: true }));
  const driver = {
    async sampleTree(rootPid) { return { pids: [rootPid], rootIdentity: { pid: rootPid, startTimeTicks: 1 }, cpuTimeMs: 0, rssBytes: 0, processCount: 1 }; },
    async killTree(rootPid, { signal }) { return { terminated: [rootPid], signal }; },
    async isTreeAlive() { return false; },
  };
  return new VerifiedMissionRuntime({ logRootDir, processDriver: driver, clock: () => 100 });
}

test('shares mission identities across outcomes decisions progress resources and logs', (t) => {
  const runtime = fixture(t);
  runtime.registerMission({ missionId: 'm1' });
  runtime.registerMilestone({ missionId: 'm1', milestoneId: 'ms1' });
  runtime.registerTask({ missionId: 'm1', milestoneId: 'ms1', taskId: 't1', criteria: [{ criterionId: 'c1', weight: 2 }] });
  runtime.registerDecision({ missionId: 'm1', milestoneId: 'ms1', taskId: 't1', decisionId: 'd1' });
  runtime.createDecisionState({ decisionId: 'd1', missionId: 'm1', taskId: 't1', specificationReceiptSha256: sha('a') });
  runtime.recordVerification({ decisionId: 'd1', verificationId: 'v1', status: 'pass', receiptSha256: sha('b'), verifiedCriterionIds: ['c1'], independentEvidenceReceiptSha256: sha('c') });
  runtime.observeProgress({ scope: 'mission:m1', observationId: 'o1', actionFingerprint: 'verify-c1', verificationReceiptSha256: sha('b'), verifiedCriteriaScore: 2, testsPassed: 1, testsFailed: 0, semanticDiffHash: sha('d'), semanticDiffUnits: 1, informationGain: 0.5 });
  runtime.registerResource({ resourceId: 'r1', decisionId: 'd1', taskId: 't1', milestoneId: 'ms1', missionId: 'm1', registrationReceiptSha256: sha('e') });
  runtime.sampleResource({ resourceId: 'r1', sampleId: 's1', atMs: 0, rssMb: 100, sourceReceiptSha256: sha('f') });
  runtime.finalizeResource({ resourceId: 'r1', sampleId: 's2', atMs: 1_000, rssMb: 100, sourceReceiptSha256: sha('1') });
  runtime.appendLog('m1', { event: 'verified', token: 'SECRET' });
  const snapshot = runtime.snapshot();
  assert.equal(snapshot.outcomes.missionScores[0].verifiedCriteriaScore, 2);
  assert.equal(snapshot.resources.rssMbSeconds, 100);
  assert.equal(snapshot.logs.streams[0].recordCount, 1);
  assert.equal(snapshot.progress[0].scope, 'mission:m1');
  assert.equal(JSON.stringify(snapshot).includes('SECRET'), false);
});

test('closes outcome and disk resources and keeps cleanup available before close', async (t) => {
  const runtime = fixture(t);
  const reaped = await runtime.reapMission({ missionId: 'm1', rootPid: 10, registeredPids: [10], rootIdentity: { pid: 10, startTimeTicks: 1 }, identityReceiptSha256: sha('a') });
  assert.equal(reaped.status, 'graceful');
  const closed = runtime.close();
  assert.equal(closed.closed, true);
  assert.throws(() => runtime.appendLog('m1', { event: 'late' }), /closed/i);
  assert.throws(() => runtime.registerMission({ missionId: 'late' }), /closed/i);
});
