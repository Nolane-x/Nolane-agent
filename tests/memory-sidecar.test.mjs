import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ProjectMemorySidecar } from '../src/memory/project-memory-sidecar.mjs';
import { MemoryService } from '../src/memory/memory-service.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-memory-sidecar-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const service = new MemoryService({ store, memoryRoot: path.join(root, '.forge', 'memory') });
  return { root, store, project, sidecar: new ProjectMemorySidecar({ store, memoryService: service, clock: () => 1_000 }) };
}

test('ProjectMemorySidecar stores project-scoped citations and requires user approval before context use', async (t) => {
  const f = await fixture(t);
  const source = path.join(f.root, 'package.json');
  const content = '{"scripts":{"test":"node --test"}}';
  await writeFile(source, content);
  const candidate = await f.sidecar.propose({
    projectId: f.project.id,
    title: 'Test command',
    content: 'The project test command is node --test.',
    kind: 'procedural',
    citations: [{ path: 'package.json', startLine: 1, endLine: 1, sha256: sha(content), commit: 'abc123' }],
    ttlMs: 60_000,
    sourceTaskId: 'task-1',
  });
  assert.equal(candidate.status, 'candidate');
  assert.deepEqual(await f.sidecar.context(f.project.id, 'test command'), []);

  const active = await f.sidecar.approve(candidate.id, { actor: 'user:alice', evidenceReceiptSha256: 'a'.repeat(64) });
  assert.equal(active.status, 'active');
  const context = await f.sidecar.context(f.project.id, 'test command');
  assert.equal(context.length, 1);
  assert.equal(context[0].metadata.citations[0].path, 'package.json');
  assert.equal(context[0].metadata.expiresAt, 61_000);
});

test('ProjectMemorySidecar marks active memories stale when citations change or TTL expires', async (t) => {
  let time = 1_000;
  const f = await fixture(t);
  f.sidecar.clock = () => time;
  const file = path.join(f.root, 'build.txt');
  await writeFile(file, 'npm run build\n');
  const proposed = await f.sidecar.propose({ projectId: f.project.id, title: 'Build', content: 'Use npm run build.', citations: [{ path: 'build.txt', startLine: 1, endLine: 1, sha256: sha('npm run build\n') }], ttlMs: 500 });
  await f.sidecar.approve(proposed.id, { actor: 'user', evidenceReceiptSha256: 'b'.repeat(64) });
  assert.equal((await f.sidecar.verifyFreshness(proposed.id)).fresh, true);
  await writeFile(file, 'pnpm build\n');
  const changed = await f.sidecar.verifyFreshness(proposed.id);
  assert.equal(changed.fresh, false);
  assert.equal(changed.memory.status, 'stale');

  const second = await f.sidecar.propose({ projectId: f.project.id, title: 'Short TTL', content: 'Temporary fact.', citations: [], ttlMs: 100 });
  await f.sidecar.approve(second.id, { actor: 'user', evidenceReceiptSha256: 'c'.repeat(64) });
  time = 1_101;
  assert.equal((await f.sidecar.verifyFreshness(second.id)).reason, 'expired');
});

test('ProjectMemorySidecar lets users edit, revoke, and permanently purge memory without cross-project leakage', async (t) => {
  const f = await fixture(t);
  const other = f.store.createProject({ name: 'Other', workspaceRoot: path.join(f.root, 'other') });
  const item = await f.sidecar.propose({ projectId: f.project.id, title: 'Old rule', content: 'Use npm.', citations: [] });
  const edited = await f.sidecar.edit(item.id, { actor: 'user:alice', title: 'New rule', content: 'Use pnpm.' });
  assert.equal(edited.status, 'candidate');
  assert.match(await readFile(edited.filePath, 'utf8'), /Use pnpm/);
  assert.deepEqual(await f.sidecar.context(other.id, 'pnpm'), []);
  const revoked = await f.sidecar.revoke(item.id, { actor: 'user:alice' });
  assert.equal(revoked.status, 'revoked');
  await f.sidecar.purge(item.id, { actor: 'user:alice' });
  assert.equal(f.sidecar.get(item.id), null);
});
