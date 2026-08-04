import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LspSessionPool } from '../src/repository/lsp-session-pool.mjs';
import { LspClient } from '../src/repository/lsp-client.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const fakeServer = path.join(root, 'fixtures', 'fake-lsp-server.mjs');

test('LspSessionPool reuses a client for the same workspace and language then evicts it when idle', async () => {
  let created = 0;
  const pool = new LspSessionPool({ idleTtlMs: 20, clientFactory: (definition) => { created += 1; return new LspClient(definition); } });
  const definition = { id: 'ts', command: process.execPath, args: [fakeServer], cwd: root, timeoutMs: 1000 };
  const a = await pool.acquire({ languageId: 'typescript', workspaceRoot: '/workspace', definition });
  const b = await pool.acquire({ languageId: 'typescript', workspaceRoot: '/workspace', definition });
  assert.equal(a.client, b.client);
  assert.equal(created, 1);
  a.release(); b.release();
  await new Promise((resolve) => setTimeout(resolve, 40));
  await pool.sweep();
  assert.equal(pool.snapshot().sessions.length, 0);
  await pool.close();
});
