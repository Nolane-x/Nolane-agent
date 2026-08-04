import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { DecisionPlane } from '../src/decision/decision-plane.mjs';
import { MemorySkillResourcePlane } from '../src/runtime/memory-skill-resource-plane.mjs';
import { ResourceAdmissionController } from '../src/runtime/resource-admission-controller.mjs';
import { ResourceLifecycleCoordinator } from '../src/runtime/resource-lifecycle-coordinator.mjs';

const hash = (value) => canonicalSha256(value);
const currentMetrics = { availableRamMb: 8_000, diskFreeMb: 50_000, errorRate: 0, activeAgents: 1, pendingIrreversibleActions: 0, unverifiedMemory: 0, policyDrift: 0 };

async function artifactRoot(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-memory-skill-resource-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('DecisionPlane keeps MemorySkillResourcePlane lazy and loads only requested capabilities', async (t) => {
  const root = await artifactRoot(t);
  const plane = new DecisionPlane({ memorySkillResource: { artifacts: { root } } });
  assert.equal(plane.snapshot().lifecycle.memorySkillResourceLoaded, false);

  const policy = plane.decideMemoryPolicy({ operation: 'RETRIEVE', evidenceReceiptSha256: hash({ evidence: 1 }) });
  assert.equal(policy.allowed, true);
  let snapshot = plane.memorySkillResourceSnapshot();
  assert.equal(snapshot.lifecycle.policyLoaded, true);
  assert.equal(snapshot.lifecycle.replayLoaded, false);
  assert.equal(snapshot.lifecycle.skillsLoaded, false);
  assert.equal(snapshot.lifecycle.admissionLoaded, false);

  const modelTime = plane.observeModelTime({ policyDrift: 0.5 });
  const replay = plane.scheduleMemoryReplay({ modelTime: modelTime.modelTime, episodes: [{ episodeId: 'ep-1', predictionError: 0.9 }] });
  assert.equal(replay.queue[0].episodeId, 'ep-1');
  snapshot = plane.memorySkillResourceSnapshot();
  assert.equal(snapshot.lifecycle.replayLoaded, true);

  const skill = plane.compileCompositionalSkill({
    name: 'repair renamed API',
    episodes: [{ episodeId: 'ep-1', repositoryId: 'repo-a', verified: true, verificationReceiptSha256: hash({ verified: 1 }) }],
    preconditions: [{ key: 'apiRenamed', type: 'boolean', equals: true }],
    parameters: [{ name: 'symbol', type: 'string' }],
    effects: [{ target: 'callers', operation: 'update', valueType: 'source' }],
    invariants: ['public API remains compatible'], verifier: { kind: 'test', commandId: 'test:impact' },
    failureSignatures: ['symbol still unresolved'], costEstimate: { tokens: 100, timeSeconds: 5, rssMbSeconds: 20 },
    rollback: { kind: 'git-checkpoint' }, decomposition: ['find references', 'patch callers', 'run impacted tests'],
  });
  assert.equal(skill.state, 'draft');
  assert.equal(plane.memorySkillResourceSnapshot().lifecycle.skillsLoaded, true);

  const admission = plane.admitResource({ kind: 'test', resourceId: 'test-1', missionId: 'm1', taskId: 't1', owner: 'executor', expectedVerifiedUtility: 0.9, rssBudgetMb: 100, timeCostSeconds: 5, reversible: true }, currentMetrics);
  assert.equal(admission.allowed, true);
  assert.equal(plane.memorySkillResourceSnapshot().lifecycle.admissionLoaded, true);
  assert.equal(plane.snapshot().lifecycle.memorySkillResourceLoaded, true);
  assert.doesNotMatch(JSON.stringify(plane.snapshot()), /repair renamed API|find references/);

  plane.close();
});

test('MemorySkillResourcePlane stores bounded artifacts without exposing raw bytes', async (t) => {
  const root = await artifactRoot(t);
  const plane = new MemorySkillResourcePlane({ artifacts: { root, maxPreviewBytes: 8 } });
  const stored = await plane.putArtifact({ kind: 'tool-output', data: 'private-ish raw output body', refs: { missionId: 'm1' }, summary: 'bounded tool output' });
  assert.equal(stored.projection.preview, 'private-');
  const snapshot = plane.snapshot();
  assert.equal(snapshot.lifecycle.artifactsLoaded, true);
  assert.doesNotMatch(JSON.stringify(snapshot), /raw output body/);
  await plane.deleteArtifact(stored.sha256, { actor: 'user', reason: 'privacy request' });
  await assert.rejects(() => plane.getArtifact(stored.sha256), /not found/i);
});

test('ResourceLifecycleCoordinator terminates only a matching mission-owned process lease', async () => {
  const admission = new ResourceAdmissionController();
  const decision = admission.admit({ kind: 'provider', resourceId: 'provider-1', missionId: 'mission-1', taskId: 'task-1', owner: 'executor-1', processRoot: 4242, expectedVerifiedUtility: 0.9, rssBudgetMb: 100, timeCostSeconds: 10, reversible: true }, currentMetrics);
  const terminated = [];
  const processDriver = { async terminateTree(pid) { terminated.push(pid); return { terminated: [pid], signal: 'SIGTERM' }; } };
  const processLedger = { snapshot: ({ missionId } = {}) => ({ entries: missionId === 'mission-1' ? [{ rootPid: 4242, missionId: 'mission-1', state: 'running' }] : [] }) };
  const coordinator = new ResourceLifecycleCoordinator({ admissionController: admission, processLedger, processDriver, clock: () => 100 });
  const result = await coordinator.stopMission({ missionId: 'mission-1', leaseIds: [decision.lease.leaseId], reason: 'mission stopped' });
  assert.deepEqual(terminated, [4242]);
  assert.equal(result.terminated.length, 1);
  assert.equal(result.skipped.length, 0);
  assert.equal(admission.snapshot().active.length, 0);
});

test('ResourceLifecycleCoordinator refuses PID identity mismatch and leaves the process untouched', async () => {
  const admission = new ResourceAdmissionController();
  const decision = admission.admit({ kind: 'provider', resourceId: 'provider-2', missionId: 'mission-2', taskId: 'task-2', owner: 'executor-2', processRoot: 5252, expectedVerifiedUtility: 0.9, rssBudgetMb: 100, timeCostSeconds: 10, reversible: true }, currentMetrics);
  const terminated = [];
  const processDriver = { async terminateTree(pid) { terminated.push(pid); } };
  const processLedger = { snapshot: () => ({ entries: [{ rootPid: 9999, missionId: 'mission-2', state: 'running' }] }) };
  const coordinator = new ResourceLifecycleCoordinator({ admissionController: admission, processLedger, processDriver, clock: () => 100 });
  const result = await coordinator.stopMission({ missionId: 'mission-2', leaseIds: [decision.lease.leaseId], reason: 'mission stopped' });
  assert.deepEqual(terminated, []);
  assert.equal(result.terminated.length, 0);
  assert.equal(result.skipped[0].reason, 'process-identity-mismatch');
  assert.equal(admission.snapshot().active.length, 1);
});
