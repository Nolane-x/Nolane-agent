import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';

test('ProjectStore persists the ForgeOS project contract atomically', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-store-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new ProjectStore(dir);
  const created = await store.create({ name: 'Alpha', domain: 'saas', assurance: 'A2' });
  assert.equal(created.stage, 'intent');
  assert.equal(created.domain, 'saas');
  assert.equal(created.assurance, 'A2');
  for (const field of ['artifacts','decisions','evidence','gates','findings','risks','routes','history']) assert.ok(Array.isArray(created[field]));
  await store.update(created.id, (project) => ({ ...project, name: 'Beta' }));
  assert.equal((await store.read(created.id)).name, 'Beta');
  assert.equal((await store.list()).length, 1);
  const bundle = await store.exportBundle(created.id);
  assert.equal(bundle.mimeType, 'application/vnd.forgeos.project+json');
  assert.match(bundle.sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(bundle.content).id, created.id);
});

test('ProjectStore rejects traversal and unsafe metadata', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-store-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new ProjectStore(dir);
  await assert.rejects(() => store.read('../passwd'), /project id/i);
  const unsafe = JSON.parse('{"__proto__":{"admin":true}}');
  await assert.rejects(() => store.create({ metadata: unsafe }), /dangerous key/i);
});
