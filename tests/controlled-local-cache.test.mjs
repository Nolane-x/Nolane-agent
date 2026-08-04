import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { ControlledLocalCache } from '../src/operations/controlled-local-cache.mjs';

async function fixture(options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'forge-controlled-cache-'));
  let now = 1_000;
  const cache = new ControlledLocalCache({ file: path.join(dir, 'cache.sqlite'), maxBytes: options.maxBytes ?? 12, clockMs: () => now });
  return { cache, advance(ms) { now += ms; } };
}

test('cache isolates project and principal scopes and verifies receipts', async (t) => {
  const f = await fixture(); t.after(() => f.cache.close());
  const saved = f.cache.put({ projectId: 'p1', principalId: 'u1', namespace: 'viewer', key: 'a', value: Buffer.from('hello'), ttlMs: 1000 });
  assert.match(saved.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(f.cache.get({ projectId: 'p1', principalId: 'u1', namespace: 'viewer', key: 'a' }).value.toString(), 'hello');
  assert.equal(f.cache.get({ projectId: 'p1', principalId: 'u2', namespace: 'viewer', key: 'a' }), null);
  assert.equal(f.cache.get({ projectId: 'p2', principalId: 'u1', namespace: 'viewer', key: 'a' }), null);
});

test('cache expires entries and evicts least recently used data within quota', async (t) => {
  const f = await fixture({ maxBytes: 10 }); t.after(() => f.cache.close());
  f.cache.put({ projectId: 'p', principalId: 'u', namespace: 'n', key: 'old', value: Buffer.from('12345'), ttlMs: 100 });
  f.cache.put({ projectId: 'p', principalId: 'u', namespace: 'n', key: 'keep', value: Buffer.from('67890'), ttlMs: 1000 });
  f.cache.get({ projectId: 'p', principalId: 'u', namespace: 'n', key: 'keep' });
  f.cache.put({ projectId: 'p', principalId: 'u', namespace: 'n', key: 'new', value: Buffer.from('abcde'), ttlMs: 1000 });
  assert.equal(f.cache.get({ projectId: 'p', principalId: 'u', namespace: 'n', key: 'old' }), null);
  assert.ok(f.cache.get({ projectId: 'p', principalId: 'u', namespace: 'n', key: 'keep' }));
  f.advance(2000);
  assert.equal(f.cache.get({ projectId: 'p', principalId: 'u', namespace: 'n', key: 'keep' }), null);
});

test('cache rejects plaintext secrets and supports bounded listing and purge receipts', async (t) => {
  const f = await fixture({ maxBytes: 100 }); t.after(() => f.cache.close());
  assert.throws(() => f.cache.put({ projectId: 'p', principalId: 'u', namespace: 'n', key: 'secret', value: Buffer.from('sk-abcdefghijklmnopqrstuvwxyz123456'), ttlMs: 1000 }), /secret/i);
  f.cache.put({ projectId: 'p', principalId: 'u', namespace: 'n', key: 'a', value: Buffer.from('one'), ttlMs: 1000 });
  f.cache.put({ projectId: 'p', principalId: 'u', namespace: 'n', key: 'b', value: Buffer.from('two'), ttlMs: 1000 });
  const listed = f.cache.list({ projectId: 'p', principalId: 'u', namespace: 'n', limit: 1 });
  assert.equal(listed.entries.length, 1);
  assert.match(listed.receiptSha256, /^[a-f0-9]{64}$/);
  const purged = f.cache.purge({ projectId: 'p', principalId: 'u', namespace: 'n' });
  assert.equal(purged.deleted, 2);
  assert.match(purged.receiptSha256, /^[a-f0-9]{64}$/);
});
