import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutes } from '../src/server/routes.mjs';

async function call(route, { method = 'GET', pathname, body = null }) {
  let status; let data = '';
  const req = { method, async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(JSON.stringify(body)); } };
  const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
  await route(req, res, new URL(`http://local${pathname}`));
  return { status, body: data ? JSON.parse(data) : null };
}

test('settings HTTP API exposes catalog effective update and reset', async () => {
  const calls = [];
  const settingsService = {
    catalog: () => ({ schema: 'catalog', categories: [] }),
    effective: async (projectId) => ({ value: { projectId }, provenance: {} }),
    update: async (input) => { calls.push(['update', input]); return { ok: true, input }; },
    reset: async (input) => { calls.push(['reset', input]); return { ok: true, input }; },
  };
  const route = createRoutes({ settingsService });
  assert.equal((await call(route, { pathname: '/api/settings/catalog' })).status, 200);
  assert.equal((await call(route, { pathname: '/api/settings/effective?projectId=p1' })).body.value.projectId, 'p1');
  assert.equal((await call(route, { method: 'PUT', pathname: '/api/settings', body: { layer: 'user', patch: { appearance: { theme: 'dark' } } } })).status, 200);
  assert.equal((await call(route, { method: 'POST', pathname: '/api/settings/reset', body: { layer: 'user', paths: ['appearance.theme'] } })).status, 200);
  assert.equal(calls.length, 2);
});
