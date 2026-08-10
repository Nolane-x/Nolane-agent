import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';
import { MemoryService } from '../src/memory/memory-service.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-memory-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  return { root, store, project, service: new MemoryService({ store, memoryRoot: path.join(root, 'memory') }) };
}

test('MemoryService writes human-readable observed memory and keeps it out of active context', async (t) => {
  const f = await fixture(t);
  const memory = await f.service.observe({ projectId: f.project.id, title: 'Router invariant', content: 'Provider fallback must preserve the original task lease.', kind: 'procedural', confidence: 0.8, sourceTaskId: 'task-1' });
  assert.equal(memory.status, 'observed');
  assert.match(await readFile(memory.filePath, 'utf8'), /Provider fallback/);
  assert.deepEqual(f.service.context(f.project.id, 'provider fallback'), []);
  assert.equal(f.service.search(f.project.id, 'provider fallback', { statuses: ['observed'] })[0].id, memory.id);
});

test('MemoryService requires evidence-backed lifecycle promotion before active retrieval', async (t) => {
  const f = await fixture(t);
  const observed = await f.service.observe({ projectId: f.project.id, title: 'Patch rule', content: 'Use expected hashes before applying unified patches.' });
  const candidate = await f.service.transition(observed.id, 'candidate', { actor: 'reviewer' });
  assert.equal(candidate.status, 'candidate');
  await assert.rejects(() => f.service.transition(candidate.id, 'approved', { actor: 'reviewer' }), /evidence/i);
  const approved = await f.service.transition(candidate.id, 'approved', { actor: 'reviewer', evidenceReceiptSha256: 'a'.repeat(64) });
  const active = await f.service.transition(approved.id, 'active', { actor: 'operator', evidenceReceiptSha256: 'a'.repeat(64) });
  assert.equal(active.status, 'active');
  const context = f.service.context(f.project.id, 'unified patch expected hash');
  assert.equal(context[0].id, `memory:${active.id}`);
  assert.match(context[0].text, /expected hashes/);
});

test('MemoryService rejects illegal promotion paths and can revoke active knowledge', async (t) => {
  const f = await fixture(t);
  const observed = await f.service.observe({ projectId: f.project.id, title: 'Temporary', content: 'Do not trust this yet.' });
  await assert.rejects(() => f.service.transition(observed.id, 'active', { actor: 'operator', evidenceReceiptSha256: 'b'.repeat(64) }), /transition/i);
  const candidate = await f.service.transition(observed.id, 'candidate', { actor: 'reviewer' });
  const approved = await f.service.transition(candidate.id, 'approved', { actor: 'reviewer', evidenceReceiptSha256: 'b'.repeat(64) });
  const active = await f.service.transition(approved.id, 'active', { actor: 'operator', evidenceReceiptSha256: 'b'.repeat(64) });
  const revoked = await f.service.transition(active.id, 'revoked', { actor: 'operator' });
  assert.equal(revoked.status, 'revoked');
  assert.deepEqual(f.service.context(f.project.id, 'temporary trust'), []);
});
