import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { GoalService } from '../src/goals/goal-service.mjs';
import { GoalRunService } from '../src/goals/goal-run-service.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-goal-run-'));
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const calls = [];
  const runCoordinator = {
    createRun(input) {
      calls.push(input);
      const mission = store.createMission({ projectId: input.projectId, objective: input.objective, status: 'planning', metadata: { providerId: input.providerId } });
      return { mission, project, messages: [], activities: {} };
    },
  };
  const goals = new GoalService({ store });
  return { store, project, calls, goals, service: new GoalRunService({ store, goalService: goals, runCoordinator }) };
}

test('GoalRunService creates durable goal, launches mission, and binds goal capabilities before planner runs', async (t) => {
  const f = await fixture(t);
  const result = f.service.createAndStart({ projectId: f.project.id, title: 'Research UI', objective: 'Research and improve UI.', providerId: 'auto', browserAllowedActions: ['open', 'snapshot', 'click'], autoApplyPlanPatches: true, schedule: { kind: 'manual' } });
  assert.equal(result.goal.activeMissionId, result.run.mission.id);
  const mission = f.store.getMission(result.run.mission.id);
  assert.equal(mission.metadata.goalId, result.goal.id);
  assert.deepEqual(mission.metadata.browserAllowedActions, ['open', 'snapshot', 'click']);
  assert.equal(mission.metadata.goalAutoApplyPlanPatches, true);
  assert.equal(f.calls[0].objective, 'Research and improve UI.');
});

test('GoalRunService starts existing active goals and rejects completed goals', async (t) => {
  const f = await fixture(t);
  const goal = f.goals.create({ projectId: f.project.id, title: 'Build', objective: 'Build.' });
  const started = f.service.start(goal.id, { browserAllowedActions: ['snapshot'] });
  assert.equal(started.goal.id, goal.id);
  f.goals.update(goal.id, { status: 'completed' });
  assert.throws(() => f.service.start(goal.id), /not active/i);
});


test('GoalRunService preserves persisted automatic replanning policy when scheduled goal restarts', async (t) => {
  const f = await fixture(t);
  const goal = f.goals.create({
    projectId: f.project.id,
    title: 'Scheduled research',
    objective: 'Research continuously.',
    metadata: { goalAutoApplyPlanPatches: false, browserAllowedActions: ['open', 'snapshot'] },
  });
  const started = f.service.start(goal.id);
  assert.equal(started.run.mission.metadata.goalAutoApplyPlanPatches, false);
  assert.deepEqual(started.run.mission.metadata.browserAllowedActions, ['open', 'snapshot']);
});
