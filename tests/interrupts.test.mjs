import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { InterruptManager } from '../src/orchestration/interrupts.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-interrupt-'));
  const file = path.join(root, 'studio.db');
  const store = new StudioStore(file);
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const mission = store.createMission({ projectId: project.id, objective: 'Do work', status: 'running' });
  const task = store.createTask({ projectId: project.id, missionId: mission.id, title: 'T', objective: 'Need a decision', status: 'running' });
  return { root, file, store, project, mission, task };
}

test('InterruptManager persists a one-time resume token and survives database reopen', async (t) => {
  const f = await fixture();
  let reopened = null;
  t.after(async () => {
    reopened?.close();
    f.store.close();
    await rm(f.root, { recursive: true, force: true });
  });
  const manager = new InterruptManager({ store: f.store });
  const created = manager.create({ missionId: f.mission.id, taskId: f.task.id, kind: 'approval', prompt: { question: 'Apply patch?' }, idempotencyKey: 'pause-1' });
  assert.match(created.resumeToken, /^[A-Za-z0-9_-]{32,}$/);
  assert.equal(created.status, 'pending');
  f.store.close();

  reopened = new StudioStore(f.file);
  const restored = new InterruptManager({ store: reopened }).get(created.id);
  assert.equal(restored.prompt.question, 'Apply patch?');
  assert.equal(restored.status, 'pending');
  assert.equal(Object.hasOwn(restored, 'resumeTokenSha256'), false, 'token hashes are not exposed');
});

test('InterruptManager makes resume idempotent by key but rejects token reuse under a new key', async (t) => {
  const f = await fixture();
  t.after(async () => { f.store.close(); await rm(f.root, { recursive: true, force: true }); });
  const manager = new InterruptManager({ store: f.store });
  const created = manager.create({ missionId: f.mission.id, taskId: f.task.id, prompt: { question: 'Choose' }, idempotencyKey: 'pause-2' });
  const first = manager.resume({ interruptId: created.id, resumeToken: created.resumeToken, response: { choice: 'safe' }, idempotencyKey: 'resume-1' });
  assert.equal(first.status, 'resumed');
  assert.deepEqual(first.response, { choice: 'safe' });
  const duplicate = manager.resume({ interruptId: created.id, resumeToken: created.resumeToken, response: { choice: 'unsafe' }, idempotencyKey: 'resume-1' });
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.response, { choice: 'safe' });
  assert.throws(() => manager.resume({ interruptId: created.id, resumeToken: created.resumeToken, response: {}, idempotencyKey: 'resume-2' }), /already resumed/i);
});

test('InterruptManager expires pending interrupts and deduplicates creation side effects', async (t) => {
  const f = await fixture();
  t.after(async () => { f.store.close(); await rm(f.root, { recursive: true, force: true }); });
  let time = Date.parse('2026-07-28T00:00:00Z');
  const manager = new InterruptManager({ store: f.store, clock: () => time });
  const created = manager.create({ missionId: f.mission.id, taskId: f.task.id, prompt: { question: 'Soon?' }, expiresInMs: 100, idempotencyKey: 'pause-3' });
  const duplicate = manager.create({ missionId: f.mission.id, taskId: f.task.id, prompt: { question: 'Different must not duplicate side effect' }, expiresInMs: 100, idempotencyKey: 'pause-3' });
  assert.equal(duplicate.id, created.id);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.resumeToken, null);

  time += 101;
  assert.throws(() => manager.resume({ interruptId: created.id, resumeToken: created.resumeToken, response: {}, idempotencyKey: 'late' }), /expired/i);
  assert.equal(manager.get(created.id).status, 'expired');
});

test('StudioStore close is idempotent for layered test and shutdown cleanup', async (t) => {
  const f = await fixture();
  t.after(async () => { f.store.close(); await rm(f.root, { recursive: true, force: true }); });
  f.store.close();
  assert.doesNotThrow(() => f.store.close());
});
