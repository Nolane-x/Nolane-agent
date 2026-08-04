import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AgentModeService } from '../src/agents/agent-mode-service.mjs';
import { ActivityProjection } from '../src/orchestration/activity-projection.mjs';
import { RunCoordinator } from '../src/orchestration/run-coordinator.mjs';
import { AutonomyGuardedBroker } from '../src/security/autonomy-guarded-broker.mjs';
import { AutonomyPolicy } from '../src/security/autonomy-policy.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-agent-mode-runtime-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'Modes', workspaceRoot: root });
  return { root, store, project };
}

test('RunCoordinator resolves mode policy and propagates it to planned tasks', async (t) => {
  const { store, project } = await fixture(t);
  let plannedTask;
  const missionRunner = {
    async plan({ missionId, projectId, objective, planner }) {
      const plan = await planner({ projectId, objective });
      plannedTask = plan.tasks[0];
      store.createTask({ projectId, missionId, title: plannedTask.title, objective: plannedTask.objective, role: plannedTask.role, status: 'ready', metadata: plannedTask.metadata });
      return store.updateMission(missionId, { status: 'running' });
    },
    pause(id) { return store.updateMission(id, { status: 'paused' }); },
    stop(id) { return store.updateMission(id, { status: 'stopped' }); },
    resume(id) { return store.updateMission(id, { status: 'running' }); },
  };
  const coordinator = new RunCoordinator({
    store,
    missionRunner,
    plannerService: { async plan() { return { summary: 'Inspect', tasks: [{ id: 'inspect', title: 'Inspect', objective: 'Inspect code', role: 'scout', dependencies: [], allowedPaths: ['**'], deniedPaths: [] }] }; } },
    autopilot: { async run({ missionId }) { store.updateMission(missionId, { status: 'completed' }); return { completedTasks: 1 }; } },
    activityProjection: new ActivityProjection({ store }),
    agentModes: new AgentModeService(),
    providerInventory: () => [{ id: 'local', local: true, available: true, healthy: true }],
  });
  t.after(() => coordinator.close());
  const created = coordinator.createRun({ projectId: project.id, objective: 'Explain the architecture with citations', modeId: 'explain' });
  assert.equal(created.mission.metadata.modeId, 'explain');
  assert.equal(created.mission.metadata.modePolicy.readOnly, true);
  assert.equal(created.mission.metadata.autonomyProfile, 'guided');
  await coordinator.whenSettled(created.mission.id);
  assert.equal(plannedTask.metadata.modeId, 'explain');
  assert.equal(plannedTask.metadata.modePolicy.writesAllowed, false);
  assert.match(plannedTask.metadata.modeReceiptSha256, /^[a-f0-9]{64}$/);
});

test('offline mode resolves auto provider to an available local provider', async (t) => {
  const { store, project } = await fixture(t);
  const coordinator = new RunCoordinator({
    store,
    missionRunner: { async plan({ missionId }) { return store.updateMission(missionId, { status: 'stopped' }); }, pause() {}, stop() {}, resume() {} },
    plannerService: { async plan() { return { tasks: [] }; } },
    autopilot: { async run() { return {}; } },
    activityProjection: new ActivityProjection({ store }),
    agentModes: new AgentModeService(),
    providerInventory: () => [{ id: 'remote', local: false, available: true }, { id: 'ollama-local', local: true, available: true, healthy: true }],
  });
  t.after(() => coordinator.close());
  const created = coordinator.createRun({ projectId: project.id, objective: 'Fix tests without internet', modeId: 'offline', providerId: 'auto' });
  assert.equal(created.mission.metadata.providerId, 'ollama-local');
  assert.equal(created.mission.metadata.modePolicy.localOnly, true);
  assert.equal(created.mission.metadata.modePolicy.networkPolicy.mode, 'deny');
});

test('AutonomyGuardedBroker blocks writes for read-only mode and records mode refs for allowed reads', async () => {
  const calls = [];
  const task = { projectId: 'p1', metadata: { modeId: 'read-only', modePolicy: new AgentModeService().resolve({ modeId: 'read-only' }).policy, worktree: { path: '/tmp/worktree' } } };
  const guarded = new AutonomyGuardedBroker({
    broker: { async execute(request, context) { calls.push({ request, context }); return { output: { ok: true }, receipt: { receiptSha256: 'a'.repeat(64) } }; } },
    policy: new AutonomyPolicy(),
    store: { getAutonomyGrant: () => ({ profile: 'guided', scope: { network: 'deny' } }) },
    task,
  });
  await guarded.execute({ tool: 'fs.read', input: { path: 'src/app.mjs' } });
  assert.equal(calls[0].context.refs.modeId, 'read-only');
  await assert.rejects(() => guarded.execute({ tool: 'fs.patch', input: { path: 'src/app.mjs', patch: 'x' } }), (error) => error.code === 'AGENT_MODE_ACTION_DENIED');
  assert.equal(calls.length, 1);
});

test('offline mode blocks dependency installs that would use network', async () => {
  const task = { projectId: 'p1', metadata: { modeId: 'offline', modePolicy: new AgentModeService().resolve({ modeId: 'offline' }).policy, worktree: { path: '/tmp/worktree' } } };
  const guarded = new AutonomyGuardedBroker({
    broker: { async execute() { throw new Error('must not execute'); } },
    policy: new AutonomyPolicy(),
    store: { getAutonomyGrant: () => ({ profile: 'workspace-autopilot', scope: { network: 'allow' } }) },
    task,
  });
  await assert.rejects(() => guarded.execute({ tool: 'process.run', input: { command: 'npm', args: ['install', 'left-pad'] } }), (error) => error.code === 'AGENT_MODE_ACTION_DENIED' && /network/i.test(error.message));
});
