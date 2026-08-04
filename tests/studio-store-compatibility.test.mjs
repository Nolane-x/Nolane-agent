import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StudioStore } from '../src/storage/studio-store.mjs';

async function storeFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  return store;
}

test('studio store compatibility persists mission task and run checkpoint identity', async (t) => {
  const store = await storeFixture(t);
  const project = store.createProject({ name: 'P', workspaceRoot: '/tmp/p' });
  const mission = store.createMission({ projectId: project.id, objective: 'Build', metadata: { branch: 'main', baseCommit: 'abc' } });
  const task = store.createTask({ projectId: project.id, missionId: mission.id, title: 'T', objective: 'Do it' });
  const run = store.createRun({ taskId: task.id, providerId: 'local', state: 'running', checkpoint: { sessionId: 's1', workspaceId: 'w1', currentStep: 2, attempt: 1, model: 'small', tokensUsed: 42 } });
  assert.equal(store.getRun(run.id).checkpoint.sessionId, 's1');
  assert.equal(store.getRun(run.id).checkpoint.tokensUsed, 42);
});

test('studio store compatibility rejects missing foreign keys and removes secret metadata', async (t) => {
  const store = await storeFixture(t);
  assert.throws(() => store.createMission({ projectId: 'missing', objective: 'No' }), /foreign key|constraint|unknown project/i);
  const project = store.createProject({ name: 'P', workspaceRoot: '/tmp/p', metadata: { apiKey: 'secret', visible: 'ok' } });
  assert.equal(project.metadata.visible, 'ok');
  assert.equal('apiKey' in project.metadata, false);
});
