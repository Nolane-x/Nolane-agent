import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');

test('application composes and exposes Mission State Progress', () => {
  assert.match(app, /new MissionStateProgressService\(\{/);
  assert.match(app, /createHttpServer\(\{[^}]*missionStateProgress/s);
  assert.match(http, /missionStateProgress = null/);
  assert.match(routes, /\/api\/mission-state-progress/);
  assert.match(routes, /\/api\/mission-state-progress\/cost-check/);
});
