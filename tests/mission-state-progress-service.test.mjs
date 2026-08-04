import assert from 'node:assert/strict';
import test from 'node:test';

import { MissionStateProgressService } from '../src/operations/mission-state-progress-service.mjs';

function fixture() {
  const project = { id: 'p1', name: 'Forge', workspaceRoot: '/secret/workspace', metadata: { repositoryRemote: 'https://example.test/forge.git' } };
  const mission = { id: 'm1', projectId: 'p1', objective: 'Fix login', status: 'running', metadata: { costLimitUsd: 2, hypotheses: ['Session cookie is stale'], summary: 'private prompt must not appear' } };
  const tasks = [
    { id: 't1', missionId: 'm1', projectId: 'p1', title: 'Implement', objective: 'Fix login', status: 'done', role: 'builder', metadata: { taskContract: { successCriteria: ['login test passes'], outputs: [{ path: 'src/auth.mjs' }] }, candidateUsage: { promptTokens: 100, completionTokens: 50, costUsd: 0.7 } } },
    { id: 't2', missionId: 'm1', projectId: 'p1', title: 'Review', objective: 'Review login fix', status: 'running', role: 'reviewer', metadata: { candidateUsage: { promptTokens: 20, completionTokens: 10, costUsd: 0.2 } } },
  ];
  const evidence = [
    { id: 'e1', taskId: 't1', kind: 'verification-command', status: 'pass', payload: { command: 'npm test -- auth', summary: 'auth tests passed', total: 4, passed: 4, failed: 0 }, receiptSha256: 'a'.repeat(64), createdAt: '2026-07-29T09:00:00.000Z' },
    { id: 'e2', taskId: 't2', kind: 'verification-command', status: 'fail', payload: { command: 'npm test -- review', summary: 'one review test failed', total: 2, passed: 1, failed: 1 }, receiptSha256: 'b'.repeat(64), createdAt: '2026-07-29T09:01:00.000Z' },
  ];
  const events = [
    { seq: 1, type: 'plan.discovery.recorded', refs: { projectId: 'p1', missionId: 'm1' }, payload: { hypothesis: 'Session cookie is stale' } },
    { seq: 2, type: 'task.completed', refs: { projectId: 'p1', missionId: 'm1', taskId: 't1' }, payload: { receiptSha256: 'c'.repeat(64) } },
    { seq: 3, type: 'task.completed', refs: { projectId: 'p1', missionId: 'm1', taskId: 't1' }, payload: { receiptSha256: 'c'.repeat(64) } },
    { seq: 4, type: 'tool.called', refs: { projectId: 'p1', missionId: 'm1' }, payload: { tool: 'fs.read' } },
  ];
  const store = {
    getProject: (id) => id === 'p1' ? project : null,
    getMission: (id) => id === 'm1' ? mission : null,
    listTasks: ({ missionId }) => missionId === 'm1' ? tasks : [],
    listRuns: () => [],
    listEvidence: ({ taskId }) => evidence.filter((item) => item.taskId === taskId),
    listInterrupts: () => [{ id: 'i1', taskId: 't2', kind: 'approval', status: 'pending', createdAt: '2026-07-29T09:02:00.000Z' }],
    listEvents: () => events,
  };
  const environmentControl = { list: () => [{ id: 'env1', projectId: 'p1', status: 'healthy', pid: 4321, environment: { command: 'npm', env: { SECRET: 'nope' } } }] };
  const capabilityLedger = { listGrants: () => [{ id: 'g1', capabilityId: 'git.commit', effect: 'allow', mode: 'session', revokedAt: null, reason: 'approved', receiptSha256: 'd'.repeat(64) }] };
  return { store, environmentControl, capabilityLedger };
}

test('service projects complete public mission state from durable evidence and counts real progress only once', async () => {
  const f = fixture();
  const service = new MissionStateProgressService({ ...f, clock: () => Date.parse('2026-07-29T09:05:00.000Z') });
  const state = await service.snapshot({ projectId: 'p1', missionId: 'm1', principalId: 'user-1' });
  assert.equal(state.userId, 'user-1');
  assert.match(state.repositoryId, /^repo_[a-f0-9]{24}$/);
  assert.deepEqual(state.completionCriteria, ['login test passes']);
  assert.deepEqual(state.hypotheses, ['Session cookie is stale']);
  assert.deepEqual(state.tests, { run: 6, passed: 5, failed: 1, status: 'fail', commands: ['npm test -- auth', 'npm test -- review'] });
  assert.equal(state.usage.costUsd, 0.9);
  assert.equal(state.cost.limitUsd, 2);
  assert.equal(state.cost.remainingUsd, 1.1);
  assert.equal(state.sandbox[0].status, 'healthy');
  assert.equal(state.approvals.pending, 1);
  assert.equal(state.subagents.find((item) => item.role === 'reviewer').running, 1);
  assert.equal(state.progress.milestones, 2); // one task transition + one passing receipt; duplicate event ignored
  assert.equal(state.progress.status, 'progressing');
  assert.match(state.receiptSha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(state), /secret\/workspace|SECRET|private prompt/i);
});

test('service enforces mission cost limits and detects activity without progress', async () => {
  const f = fixture();
  f.store.listEvents = () => Array.from({ length: 10 }, (_, index) => ({ seq: index + 1, type: 'tool.called', refs: { projectId: 'p1', missionId: 'm1' }, payload: { tool: 'fs.read', fingerprint: 'same' } }));
  const service = new MissionStateProgressService({ ...f, stallActivityThreshold: 5 });
  const state = await service.snapshot({ projectId: 'p1', missionId: 'm1', principalId: 'user-1' });
  assert.equal(state.progress.milestones, 1); // passing verification remains a real milestone
  assert.equal(state.progress.status, 'stalled');
  assert.throws(() => service.assertWithinCostLimit({ projectId: 'p1', missionId: 'm1', principalId: 'user-1', projectedCostUsd: 1.2 }), /cost limit/i);
  const allowed = service.assertWithinCostLimit({ projectId: 'p1', missionId: 'm1', principalId: 'user-1', projectedCostUsd: 0.5 });
  assert.equal(allowed.allowed, true);
  assert.match(allowed.receiptSha256, /^[a-f0-9]{64}$/);
});
