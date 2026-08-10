import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { NolaneSessionStore } from '../src/nolane-native/session-store.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer nolane-token', 'content-type': 'application/json', ...(options.headers ?? {}) } });

test('canonical Nolane session API persists, searches and compresses session history', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-session-http-'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const sessionStore = new NolaneSessionStore({ root: path.join(root, 'sessions') });
  await sessionStore.open();
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'nolane-token' }, store, providers: new ProviderRegistry(), missionRunner: {}, sessionStore, uiRoot: root });
  t.after(() => service.close());

  assert.equal((await fetch(`${service.url}/api/nolane/sessions`)).status, 401);
  const created = await (await fetch(`${service.url}/api/nolane/sessions`, auth({ method: 'POST', body: JSON.stringify({ id: 's1', title: 'Repair provider retry', projectId: 'p1' }) }))).json();
  assert.equal(created.id, 's1');
  for (const message of [
    { id: 'm1', role: 'user', text: 'fix provider retry policy' },
    { id: 'm2', role: 'assistant', text: 'added deterministic tests' },
    { id: 'm3', role: 'user', text: 'verify fallback' },
    { id: 'm4', role: 'assistant', text: 'verification passed' },
  ]) {
    assert.equal((await fetch(`${service.url}/api/nolane/sessions/s1/messages`, auth({ method: 'POST', body: JSON.stringify(message) }))).status, 201);
  }
  const search = await (await fetch(`${service.url}/api/nolane/sessions/search?q=provider%20retry`, auth())).json();
  assert.equal(search[0].sessionId, 's1');
  const read = await (await fetch(`${service.url}/api/nolane/sessions/s1`, auth())).json();
  assert.equal(read.messages.length, 4);
  const compressed = await (await fetch(`${service.url}/api/nolane/sessions/s1/compress`, auth({ method: 'POST', body: JSON.stringify({ maxCharacters: 120, keepRecent: 2 }) }))).json();
  assert.equal(compressed.recent.length, 2);
  assert.match(compressed.summarySha256, /^[a-f0-9]{64}$/);
});

test('application opens the canonical Nolane session store before serving requests', async () => {
  const source = await readFile('src/app.mjs', 'utf8');
  assert.match(source, /NolaneSessionStore/);
  assert.match(source, /const sessionStore = new NolaneSessionStore\(\{ root: path\.join\(config\.dataDir, 'nolane-sessions'\) \}\)/);
  assert.match(source, /await sessionStore\.open\(\)/);
  assert.match(source, /sessionStore,/);
});
