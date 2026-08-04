import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { KanbanRuntime } from '../src/native-core/kanban-runtime.mjs';
import { LocalObservabilityRuntime } from '../src/native-core/local-observability-runtime.mjs';
import { SkillBundleRuntime } from '../src/native-core/skill-bundle-runtime.mjs';
import { DashboardAuthRuntime } from '../src/native-core/dashboard-auth-runtime.mjs';
import { SessionSearchRuntime } from '../src/native-core/session-search-runtime.mjs';
import { CronProviderRuntime } from '../src/native-core/cron-provider-runtime.mjs';
import { JsonFastPathRuntime } from '../src/native-core/json-fast-path-runtime.mjs';

const temporary = async () => fs.mkdtemp(path.join(os.tmpdir(), 'nolane-wave5-'));

test('Kanban runtime persists versioned cards, rejects stale writes and records deterministic transitions', async () => {
  const root = await temporary();
  const board = new KanbanRuntime({ file: path.join(root, 'board.json'), clock: () => 10 });
  await board.open();
  const created = await board.createCard({ id: 'c1', title: 'Ship', lane: 'todo', assignee: 'agent-a' });
  assert.equal(created.version, 1);
  const moved = await board.moveCard('c1', { lane: 'review', expectedVersion: 1 });
  assert.equal(moved.version, 2);
  await assert.rejects(() => board.moveCard('c1', { lane: 'done', expectedVersion: 1 }), /version conflict/);
  const reopened = new KanbanRuntime({ file: path.join(root, 'board.json'), clock: () => 20 });
  await reopened.open();
  assert.equal(reopened.getCard('c1').lane, 'review');
  assert.match(reopened.snapshot().headSha256, /^[a-f0-9]{64}$/);
});

test('observability runtime redacts secrets, applies backpressure, rotates JSONL and cleans old segments', async () => {
  const root = await temporary();
  const runtime = new LocalObservabilityRuntime({ directory: root, maxSegmentBytes: 240, maxQueue: 2, clock: () => 100 });
  await runtime.open();
  await runtime.record({ type: 'provider', apiKey: 'secret', message: 'first' });
  await runtime.record({ type: 'provider', token: 'hidden', message: 'second' });
  await runtime.record({ type: 'provider', message: 'third' });
  const snapshot = runtime.snapshot();
  assert.ok(snapshot.segments >= 2);
  const exported = await runtime.export();
  assert.equal(JSON.stringify(exported).includes('secret'), false);
  assert.equal(JSON.stringify(exported).includes('hidden'), false);
  const cleaned = await runtime.cleanup({ keepNewest: 1 });
  assert.ok(cleaned.deleted >= 1);
});

test('skill bundle runtime normalizes frontmatter, strips unsafe files and verifies immutable bundle hashes', async () => {
  const runtime = new SkillBundleRuntime();
  const bundle = runtime.createBundle({
    id: 'review-code',
    files: {
      'SKILL.md': '---\nname: Review Code\npermissions: [repository:read]\n---\nCheck the diff.',
      'examples/basic.md': 'Example',
      '../escape.txt': 'bad',
      '.env': 'SECRET=x',
    },
  });
  assert.deepEqual(Object.keys(bundle.files), ['SKILL.md', 'examples/basic.md']);
  assert.equal(bundle.manifest.name, 'Review Code');
  assert.equal(bundle.manifest.permissions[0], 'repository:read');
  assert.equal(runtime.verifyBundle(bundle).valid, true);
  assert.equal(runtime.verifyBundle({ ...bundle, files: { ...bundle.files, 'SKILL.md': 'changed' } }).valid, false);
});

test('dashboard auth runtime supports password verification, one-time sessions, roles and drain mode', () => {
  const runtime = new DashboardAuthRuntime({ secret: 'server-secret', clock: () => 1_000 });
  runtime.registerUser({ id: 'u1', password: 'correct horse battery staple', roles: ['admin'] });
  assert.throws(() => runtime.login({ userId: 'u1', password: 'bad' }), /invalid credentials/);
  const session = runtime.login({ userId: 'u1', password: 'correct horse battery staple', ttlMs: 500 });
  assert.equal(runtime.authorize({ token: session.token, role: 'admin' }).authorized, true);
  runtime.setDrainMode(true);
  assert.throws(() => runtime.login({ userId: 'u1', password: 'correct horse battery staple' }), /drain mode/);
  assert.equal(JSON.stringify(runtime.snapshot()).includes('server-secret'), false);
});

test('session search runtime indexes bounded public text and supports filters without hidden reasoning leakage', () => {
  const runtime = new SessionSearchRuntime({ maxDocuments: 3 });
  runtime.index({ sessionId: 's1', profileId: 'p1', title: 'Fix parser', messages: [{ role: 'user', content: 'JSON parser bug' }], hiddenReasoning: 'secret chain' });
  runtime.index({ sessionId: 's2', profileId: 'p2', title: 'UI polish', messages: [{ role: 'assistant', content: 'Improve focus states' }] });
  const result = runtime.search({ query: 'parser', profileId: 'p1', limit: 5 });
  assert.equal(result.items[0].sessionId, 's1');
  assert.equal(JSON.stringify(result).includes('secret chain'), false);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('cron provider runtime validates schedules, deduplicates deliveries and recovers stale leases', async () => {
  let now = 1_000;
  const delivered = [];
  const runtime = new CronProviderRuntime({ clock: () => now, handler: async (job) => { delivered.push(job.id); return { ok: true }; } });
  runtime.register({ id: 'j1', intervalMs: 100, nextRunAtMs: 1_000, payload: { task: 'sync' } });
  const first = await runtime.runDue();
  assert.equal(first.completed, 1);
  const duplicate = await runtime.runDue();
  assert.equal(duplicate.completed, 0);
  now = 1_200;
  runtime.acquireLease('j1', { owner: 'dead', ttlMs: 10 });
  now = 1_300;
  const recovered = runtime.recoverStaleLeases();
  assert.deepEqual(recovered, ['j1']);
  assert.deepEqual(delivered, ['j1']);
});

test('JSON fast-path runtime parses bounded JSON, rejects duplicate keys and reports fallback safely', () => {
  const runtime = new JsonFastPathRuntime({ maxBytes: 64 });
  assert.deepEqual(runtime.parse('{"a":1,"b":[2]}').value, { a: 1, b: [2] });
  assert.throws(() => runtime.parse('{"a":1,"a":2}'), /duplicate key/);
  assert.throws(() => runtime.parse('{"long":"' + 'x'.repeat(100) + '"}'), /byte budget/);
  const fallback = runtime.tryParse('not-json');
  assert.equal(fallback.ok, false);
  assert.equal(fallback.input, undefined);
});
