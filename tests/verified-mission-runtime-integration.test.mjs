import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { DecisionPlane } from '../src/decision/decision-plane.mjs';
import { MissionResourceFabric } from '../src/runtime/mission-resource-fabric.mjs';

const governor = { snapshot: () => ({ state: 'normal' }) };
const canary = { snapshot: () => ({ schema: 'test.canary.v1', receiptSha256: 'a'.repeat(64) }) };
const driver = {
  async sampleTree(rootPid) { return { cpuTimeMs: 0, rssBytes: 0, processCount: 1, pids: [rootPid], rootIdentity: { pid: rootPid, startTimeTicks: 1 } }; },
  async killTree(rootPid, { signal }) { return { terminated: [rootPid], signal }; },
  async isTreeAlive() { return false; },
};

test('DecisionPlane keeps VerifiedMissionRuntime lazy on legacy fast paths', (t) => {
  const logRootDir = mkdtempSync(join(tmpdir(), 'forge-vmr-plane-'));
  t.after(() => rmSync(logRootDir, { recursive: true, force: true }));
  const plane = new DecisionPlane({ verifiedMission: { logRootDir, processDriver: driver } });
  assert.equal(plane.snapshot().lifecycle.verifiedMissionLoaded, false);
  plane.recordEfficiency({ taskId: 'legacy', providerId: 'p', taskKind: 'debug', criterionSnapshot: { totalCriteriaWeight: 1, verifiedCriteriaScore: 1, receiptSha256: 'a'.repeat(64) }, inputTokens: 1, outputTokens: 1, rssMbSeconds: 1, changedLines: 1, changedFiles: 1, semanticFootprint: 1, observedAtMs: 1 });
  assert.equal(plane.snapshot().lifecycle.verifiedMissionLoaded, false);
  plane.registerVerifiedMission({ missionId: 'm1' });
  assert.equal(plane.snapshot().lifecycle.verifiedMissionLoaded, true);
  assert.equal(plane.verifiedMissionSnapshot().outcomes.counts.missions, 1);
});

test('MissionResourceFabric delegates verified mission operations and closes the lazy runtime', async (t) => {
  const logRootDir = mkdtempSync(join(tmpdir(), 'forge-vmr-fabric-'));
  t.after(() => rmSync(logRootDir, { recursive: true, force: true }));
  const fabric = new MissionResourceFabric({ governor, canary, processDriver: driver, projectRootResolver: () => process.cwd(), verifiedMission: { logRootDir } });
  assert.equal(fabric.publicView().verifiedMission, null);
  fabric.registerVerifiedMission({ missionId: 'm1' });
  fabric.appendVerifiedMissionLog('m1', { event: 'start' });
  assert.equal(fabric.publicView().verifiedMission.outcomes.counts.missions, 1);
  const closed = await fabric.close();
  assert.equal(closed.verifiedMission.closed, true);
});
