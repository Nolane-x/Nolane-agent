import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');
test('application composes and exposes the Trace and Evidence Center', () => {
  assert.match(app, /new TraceEvidenceCenterService\(\{/);
  assert.match(app, /contextStore: dynamicContextStore/);
  assert.match(app, /createHttpServer\(\{[^}]*traceEvidenceCenter/s);
  assert.match(http, /traceEvidenceCenter = null/);
  assert.match(routes, /\/api\/trace-evidence/);
});
