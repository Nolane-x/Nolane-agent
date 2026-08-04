import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { MissionRunner } from '../src/orchestration/mission-runner.mjs';

async function fixture(t, { agentError = null } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-mission-contract-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'Project', workspaceRoot: root });
  const scheduler = { claim({ missionId, workerId }) { const task = store.listTasks({ missionId }).find((item) => item.status === 'ready'); if (!task) return null; const leased = store.updateTask(task.id, { status: 'running', leaseOwner: workerId, fencingToken: 1 }); return { task: leased, fencingToken: 1 }; } };
  const agentLoop = { async run(task) { if (agentError) throw agentError; return { runId: `run-${task.id}`, providerId: 'local', output: 'candidate', receipts: [{ receiptSha256: 'b'.repeat(64), status: 'pass' }] }; } };
  const runner = new MissionRunner({ store, scheduler, agentLoop, forge: {} });
  return { store, project, runner };
}

test('mission runner creates reviewer-gated tasks and records candidate review state', async (t) => {
  const f = await fixture(t);
  const mission = await f.runner.plan({ projectId: f.project.id, objective: 'Build safely', planner: async () => ({ summary: 'plan', tasks: [
    { id: 'build', title: 'Build', objective: 'Implement feature', role: 'builder', dependencies: [], allowedPaths: ['src/**'], deniedPaths: [] },
    { id: 'review', title: 'Review', objective: 'Verify feature', role: 'reviewer', dependencies: ['build'], allowedPaths: ['src/**'], deniedPaths: [] },
  ] }) });
  assert.equal(mission.tasks.length, 2);
  const result = await f.runner.runNext({ missionId: mission.id, workerId: 'worker-1', providerId: 'local' });
  assert.equal(result.task.status, 'review');
  assert.match(result.task.metadata.handoff.handoffSha256, /^[a-f0-9]{64}$/);
  assert.ok(f.store.listEvents().some((event) => event.type === 'mission.task.awaiting-verification'));
});

test('mission runner rejects unsafe plans and marks failed work without false completion', async (t) => {
  const f = await fixture(t, { agentError: new Error('verification failed') });
  await assert.rejects(() => f.runner.plan({ projectId: f.project.id, objective: 'Build', planner: async () => ({ tasks: [{ id: 'build', title: 'Build', objective: 'Implement', role: 'builder', dependencies: [], allowedPaths: ['src/**'], deniedPaths: [] }] }) }), /independent reviewer/i);
  const mission = await f.runner.plan({ projectId: f.project.id, objective: 'Inspect', planner: async () => ({ tasks: [{ id: 'scout', title: 'Scout', objective: 'Inspect safely', role: 'scout', dependencies: [], allowedPaths: ['src/**'], deniedPaths: [] }] }) });
  await assert.rejects(() => f.runner.runNext({ missionId: mission.id, workerId: 'worker-1', providerId: 'local' }), /verification failed/i);
  assert.equal(f.store.listTasks({ missionId: mission.id })[0].status, 'failed');
  assert.ok(f.store.listEvents().some((event) => event.type === 'mission.task.failed'));
});
