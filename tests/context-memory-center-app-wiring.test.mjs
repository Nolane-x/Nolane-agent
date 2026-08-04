import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');
test('application composes and exposes the Context and Memory Center', () => {
  assert.match(app, /new ContextMemoryCenterService\(\{/);
  assert.match(app, /historyArchive: contextHistoryArchive/);
  assert.match(app, /memorySidecar: projectMemorySidecar/);
  assert.match(app, /createHttpServer\(\{[^}]*contextMemoryCenter/s);
  assert.match(http, /contextMemoryCenter = null/);
  assert.match(routes, /\/api\/context-memory-center/);
});
