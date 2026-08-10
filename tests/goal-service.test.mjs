import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { GoalService } from '../src/goals/goal-service.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-goal-'));
  const file = path.join(root, 'studio.db');
  const store = new StudioStore(file);
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'Goal Project', workspaceRoot: root });
  return { root, file, store, project, service: new GoalService({ store }) };
}

test('GoalService persists durable goals, criteria, budget, facts, and revisions across restart', async (t) => {
  const f = await fixture(t);
  const goal = f.service.create({
    projectId: f.project.id,
    title: 'Reduce token usage',
    objective: 'Reduce average coding-task tokens by at least 35% without lowering verification pass rate.',
    successCriteria: [
      { id: 'tokens', metric: 'avg_total_tokens', operator: '<=', target: 65000 },
      { id: 'quality', metric: 'verification_pass_rate', operator: '>=', target: 0.95 },
    ],
    budget: { maxTotalTokens: 1_000_000, maxCostUsd: 20 },
    schedule: { kind: 'manual' },
    assumptions: [{ id: 'a1', statement: 'Repository ranking is the dominant token source.', status: 'active' }],
  });
  assert.equal(goal.status, 'active');
  assert.equal(goal.revision, 1);
  assert.equal(goal.successCriteria.length, 2);
  assert.equal(goal.budget.maxTotalTokens, 1_000_000);

  const mission = f.store.createMission({ projectId: f.project.id, objective: 'Measure baseline' });
  const attached = f.service.attachMission(goal.id, mission.id, { relation: 'primary' });
  assert.equal(attached.activeMissionId, mission.id);

  const fact = f.service.recordFact(goal.id, {
    claim: 'Tool schema payloads account for 41% of prompt tokens.',
    confidence: 0.92,
    impact: 'high',
    source: { kind: 'evaluation', id: 'eval_1' },
    receiptSha256: 'a'.repeat(64),
    invalidatesAssumptionIds: ['a1'],
  });
  assert.equal(fact.status, 'observed');
  assert.deepEqual(fact.invalidatesAssumptionIds, ['a1']);

  const revision = f.service.recordPlanRevision(goal.id, {
    summary: 'Progressively load tool schemas.',
    plan: { tasks: [{ id: 't1', title: 'Measure schemas' }] },
    reason: 'Initial plan',
  });
  assert.equal(revision.revision, 1);
  assert.equal(f.service.listPlanRevisions(goal.id).length, 1);

  const reopenedStore = new StudioStore(f.file);
  try {
    const reopened = new GoalService({ store: reopenedStore });
    assert.equal(reopened.get(goal.id).activeMissionId, mission.id);
    assert.equal(reopened.listFacts(goal.id)[0].claim, fact.claim);
    assert.equal(reopened.listPlanRevisions(goal.id)[0].summary, revision.summary);
  } finally {
    reopenedStore.close();
  }
});

test('GoalService validates immutable identity and emits goal events', async (t) => {
  const f = await fixture(t);
  await assert.rejects(async () => f.service.create({ projectId: f.project.id, title: '', objective: 'x' }), /title/i);
  const goal = f.service.create({ projectId: f.project.id, title: 'Ship', objective: 'Ship a verified release.' });
  const updated = f.service.update(goal.id, { status: 'paused', budget: { maxTotalTokens: 5000 } });
  assert.equal(updated.id, goal.id);
  assert.equal(updated.projectId, goal.projectId);
  assert.equal(updated.status, 'paused');
  assert.equal(updated.revision, 2);
  const events = f.store.listEvents({ afterSeq: 0, limit: 100 });
  assert.deepEqual(events.map((event) => event.type), ['goal.created', 'goal.updated']);
});
