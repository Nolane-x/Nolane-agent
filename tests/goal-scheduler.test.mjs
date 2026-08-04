import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { GoalService } from '../src/goals/goal-service.mjs';
import { GoalScheduler } from '../src/goals/goal-scheduler.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-scheduler-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const goals = new GoalService({ store });
  return { root, store, project, goals };
}

test('GoalScheduler runs due interval goals once, persists state, and prevents overlap', async (t) => {
  const f = await fixture(t);
  const goal = f.goals.create({ projectId: f.project.id, title: 'Nightly', objective: 'Run tests.', schedule: { kind: 'interval', everyMs: 60_000 } });
  let now = 1_000_000;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  const scheduler = new GoalScheduler({ store: f.store, goalService: f.goals, clock: () => now, runGoal: async () => { calls += 1; if (calls === 1) await gate; return { runId: `run_${calls}` }; } });

  const first = scheduler.tick();
  await new Promise((resolve) => setImmediate(resolve));
  const overlapping = await scheduler.tick();
  assert.equal(overlapping.skipped.some((item) => item.reason === 'already-running'), true);
  assert.equal(calls, 1);
  release();
  await first;
  await scheduler.tick();
  assert.equal(calls, 1);
  now += 60_000;
  await scheduler.tick();
  assert.equal(calls, 2);
  assert.equal(f.store.getGoalScheduleState(goal.id).lastRunId, 'run_2');
});

test('GoalScheduler triggers repository-change goals only when the fingerprint changes', async (t) => {
  const f = await fixture(t);
  const goal = f.goals.create({ projectId: f.project.id, title: 'Repo watch', objective: 'Review changes.', schedule: { kind: 'repository-change', debounceMs: 5_000 } });
  let fingerprint = 'a'; let calls = 0; let now = 2_000_000;
  const scheduler = new GoalScheduler({ store: f.store, goalService: f.goals, clock: () => now, repositoryFingerprint: async () => fingerprint, runGoal: async () => ({ runId: `run_${++calls}` }) });
  await scheduler.tick();
  assert.equal(calls, 0);
  fingerprint = 'b'; now += 4_000;
  await scheduler.tick();
  assert.equal(calls, 0);
  now += 6_000;
  await scheduler.tick();
  assert.equal(calls, 1);
  await scheduler.tick();
  assert.equal(calls, 1);
  assert.equal(f.store.getGoalScheduleState(goal.id).lastRepoFingerprint, 'b');
});
