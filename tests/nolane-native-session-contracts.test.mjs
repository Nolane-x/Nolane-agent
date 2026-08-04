import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneSessionStore } from '../src/nolane-native/session-store.mjs';

test('session store contract persists recovers searches and compresses bounded history', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-session-contract-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new NolaneSessionStore({ root });
  await store.open();
  await store.createSession({ id: 's1', title: 'Provider recovery', projectId: 'p1', profileId: 'owner' });
  await store.appendMessage('s1', { id: 'm1', role: 'user', text: 'repair provider retry policy' }, { profileId: 'owner' });
  await store.appendMessage('s1', { id: 'm2', role: 'assistant', text: 'focused verification passed' }, { profileId: 'owner' });
  assert.equal(store.search('provider retry', { profileId: 'owner' })[0].sessionId, 's1');
  const compressed = store.compressSession('s1', { maxCharacters: 80, keepRecent: 1 });
  assert.equal(compressed.totalMessages, 2);
  assert.equal(compressed.recent.length, 1);
  assert.match(compressed.summarySha256, /^[a-f0-9]{64}$/);
  const primary = path.join(root, 'sessions.json');
  const backup = path.join(root, 'sessions.json.bak');
  await writeFile(backup, await readFile(primary));
  await writeFile(primary, '{"corrupt":true}');
  const recovered = new NolaneSessionStore({ root });
  assert.equal((await recovered.open()).recoveredFromBackup, true);
  assert.equal(recovered.getSession('s1', { profileId: 'owner' }).messages.length, 2);
});

test('session store contract rejects cross-profile access conflicts duplicates and invalid compression', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-session-contract-negative-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new NolaneSessionStore({ root });
  await store.open();
  await store.createSession({ id: 's1', title: 'Scoped', projectId: 'p1', profileId: 'owner' });
  await assert.rejects(() => store.createSession({ id: 's1', title: 'Duplicate', projectId: 'p1', profileId: 'owner' }), /already exists/);
  assert.throws(() => store.getSession('s1', { profileId: 'attacker' }), /scope denied/);
  await assert.rejects(() => store.appendMessage('s1', { id: 'm1', role: 'user', text: 'x' }, { profileId: 'attacker' }), /scope denied/);
  assert.throws(() => store.compressSession('missing', { maxCharacters: 10 }), /unknown session/);
});
