import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { GoalService } from '../src/goals/goal-service.mjs';
import { AdaptiveReplanner } from '../src/goals/adaptive-replanner.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-replan-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const goals = new GoalService({ store });
  const goal = goals.create({ projectId: project.id, title: 'Optimize', objective: 'Reduce token usage.', assumptions: [{ id: 'a1', statement: 'Indexing is the bottleneck.' }] });
  const mission = store.createMission({ projectId: project.id, objective: 'Optimize agent' });
  goals.attachMission(goal.id, mission.id, { relation: 'primary' });
  const completed = store.createTask({ projectId: project.id, missionId: mission.id, title: 'Baseline', objective: 'Measure baseline', status: 'done', role: 'scout', allowedPaths: ['**'] });
  const todo = store.createTask({ projectId: project.id, missionId: mission.id, title: 'Improve index', objective: 'Optimize indexing', status: 'todo', role: 'builder', allowedPaths: ['src/repository/**'] });
  return { store, project, goals, goal, mission, completed, todo, replanner: new AdaptiveReplanner({ store, goalService: goals }) };
}

test('AdaptiveReplanner records high-impact discoveries and proposes a plan patch', async (t) => {
  const f = await fixture(t);
  const result = f.replanner.observe({
    goalId: f.goal.id,
    finding: { claim: 'Tool schemas dominate prompt tokens.', confidence: 0.94, impact: 'high', source: { kind: 'eval', id: 'e1' }, receiptSha256: 'b'.repeat(64), invalidatesAssumptionIds: ['a1'] },
    proposedPatch: { updateTasks: [{ taskId: f.todo.id, objective: 'Progressively expose tool schemas.' }], addTasks: [{ key: 'measure-schema', title: 'Measure schema payloads', objective: 'Measure per-tool schema tokens', role: 'scout', allowedPaths: ['**'] }] },
    reason: 'A measured finding invalidated the indexing assumption.',
    idempotencyKey: 'finding-e1',
  });
  assert.equal(result.fact.impact, 'high');
  assert.equal(result.patch.status, 'proposed');
  assert.equal(result.patch.baseRevision, 1);
  assert.equal(f.store.listGoalPlanPatches(f.goal.id).length, 1);
});

test('AdaptiveReplanner applies patches without rewriting completed or running work and is idempotent', async (t) => {
  const f = await fixture(t);
  const patch = f.replanner.propose({
    goalId: f.goal.id,
    reason: 'New evidence changes the implementation path.',
    idempotencyKey: 'patch-1',
    patch: {
      updateTasks: [
        { taskId: f.todo.id, title: 'Load schemas lazily', objective: 'Expose schemas only after tool selection.' },
        { taskId: f.completed.id, title: 'Rewrite history' },
      ],
      cancelTaskIds: [f.completed.id],
      addTasks: [{ key: 'schema-cache', title: 'Cache schemas', objective: 'Cache tool schemas by content hash.', role: 'builder', dependencies: [f.todo.id], allowedPaths: ['src/agent/**'] }],
    },
  });
  assert.throws(() => f.replanner.apply(patch.id), /completed|immutable/i);

  const safe = f.replanner.propose({
    goalId: f.goal.id,
    reason: 'Apply a safe patch.',
    idempotencyKey: 'patch-2',
    patch: {
      updateTasks: [{ taskId: f.todo.id, title: 'Load schemas lazily', objective: 'Expose schemas only after selection.' }],
      addTasks: [{ key: 'schema-cache', title: 'Cache schemas', objective: 'Cache schemas by content hash.', role: 'builder', dependencies: [f.todo.id], allowedPaths: ['src/agent/**'] }],
    },
  });
  const applied = f.replanner.apply(safe.id);
  assert.equal(applied.patch.status, 'applied');
  assert.equal(f.store.getTask(f.todo.id).title, 'Load schemas lazily');
  assert.equal(f.store.listTasks({ missionId: f.mission.id }).length, 3);
  assert.equal(f.goals.get(f.goal.id).revision, 2);
  const again = f.replanner.apply(safe.id);
  assert.equal(again.patch.status, 'applied');
  assert.equal(f.store.listTasks({ missionId: f.mission.id }).length, 3);
});
