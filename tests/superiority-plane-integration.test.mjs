import test from 'node:test';
import assert from 'node:assert/strict';
import { DecisionPlane } from '../src/decision/decision-plane.mjs';
import { MissionResourceFabric } from '../src/runtime/mission-resource-fabric.mjs';

const H = (c) => c.repeat(64);

function proofInput() {
  return {
    missionId: 'm1', goal: 'Verified change',
    criteria: [{ claimId: 'c1', claim: 'Change works', proposerKey: 'builder', positiveEvidenceKinds: ['test'], falsificationProbeIds: ['mutation'], minIndependentVerifiers: 1 }],
  };
}

test('DecisionPlane lazily composes the beyond-NolaneNative superiority plane without storing private reasoning', () => {
  const plane = new DecisionPlane({ clock: () => 1000, superiority: { modelGovernor: { limits: { minimumPromotionSamples: 2 } } } });
  assert.equal(plane.snapshot().lifecycle.superiorityLoaded, false);
  const proof = plane.compileProofMission(proofInput());
  assert.match(proof.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(plane.snapshot().lifecycle.superiorityLoaded, true);

  plane.registerCausalTwinNode({ nodeId: 'file:a', kind: 'file', locator: 'a.mjs' });
  plane.registerCausalTwinNode({ nodeId: 'test:a', kind: 'test', locator: 'a.test.mjs' });
  plane.linkCausalTwin({ from: 'file:a', to: 'test:a', relation: 'verified-by', confidence: 0.9, sourceHash: H('a') });
  const impact = plane.predictCausalImpact({ changedNodeIds: ['file:a'] });
  assert.deepEqual(impact.requiredTestNodeIds, ['test:a']);

  const snapshot = plane.superioritySnapshot();
  assert.equal(snapshot.claims.proofCarryingMissionControl, true);
  assert.equal(snapshot.claims.comparativeSuperiorityClaimAllowed, false);
  assert.equal(JSON.stringify(snapshot).includes('chainOfThought'), false);
  assert.equal(JSON.stringify(snapshot).includes('\"rawPrompt\":'), false);
  const closed = plane.close();
  assert.equal(closed.lifecycle.closed, true);
  assert.equal(closed.superiority.lifecycle.closed, true);
});

test('MissionResourceFabric projects superiority state through the production decision fabric', async () => {
  const governor = { snapshot: () => ({ state: 'normal' }) };
  const canary = { snapshot: () => ({ status: 'stable' }) };
  const fabric = new MissionResourceFabric({ governor, canary, projectRootResolver: () => process.cwd(), processDriver: { async sampleTree() { return { cpuTimeMs: 0, rssBytes: 0, processCount: 0, pids: [] }; } } });
  const plan = fabric.compileProofMission(proofInput());
  assert.equal(plan.authorization.deployAllowed, false);
  const view = fabric.publicView();
  assert.equal(view.superiority.schema, 'nolane.superiority.plane.v1');
  assert.equal(view.decision.lifecycle.superiorityLoaded, true);
  assert.equal(view.claims.comparativeSuperiorityClaimAllowed, false);
  await fabric.close();
});
