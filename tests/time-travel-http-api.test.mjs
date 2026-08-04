import assert from 'node:assert/strict';
import test from 'node:test';

import { createRoutes } from '../src/server/routes.mjs';

async function call(route, { method = 'GET', pathname, body = null }) {
  let status; let data = '';
  const req = { method, async *[Symbol.asyncIterator]() { if (body != null) yield Buffer.from(JSON.stringify(body)); } };
  const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
  await route(req, res, new URL(`http://local${pathname}`));
  return { status, body: data ? JSON.parse(data) : null };
}

test('Time Travel HTTP API exposes checkpoint, compare, restore, branch, replay, and export operations', async () => {
  const calls = [];
  const checkpoint = { id: 'c1', projectId: 'p1', missionId: 'm1' };
  const timeTravel = {
    list: async (input) => ({ checkpoints: [checkpoint], input }), get: async () => checkpoint,
    create: async (body) => { calls.push(['create', body]); return checkpoint; },
    compare: async (id) => ({ schema: 'nolane.time-travel-comparison.v1', id }),
    restoreFile: async (body) => { calls.push(['restore', body]); return { schema: 'nolane.time-travel-restore-receipt.v1' }; },
    createBranch: async (body) => { calls.push(['branch', body]); return { schema: 'nolane.time-travel-branch-receipt.v1' }; },
    replayMission: async (body) => { calls.push(['replay', body]); return { schema: 'nolane.time-travel-replay-receipt.v1' }; },
    exportEvidence: async () => ({ schema: 'nolane.time-travel-evidence-bundle.v1' }),
  };
  const store = { getMission: () => ({ id: 'm1', projectId: 'p1' }) };
  const workspaceTrust = { requireTrusted: async () => true };
  const route = createRoutes({ timeTravel, store, workspaceTrust });
  assert.equal((await call(route, { pathname: '/api/time-travel/checkpoints?missionId=m1' })).status, 200);
  assert.equal((await call(route, { method: 'POST', pathname: '/api/time-travel/checkpoints', body: { missionId: 'm1' } })).status, 201);
  assert.equal((await call(route, { pathname: '/api/time-travel/checkpoints/c1/compare' })).body.schema, 'nolane.time-travel-comparison.v1');
  assert.equal((await call(route, { method: 'POST', pathname: '/api/time-travel/checkpoints/c1/restore-file', body: { path: 'a.txt', confirmOverwrite: true } })).body.schema, 'nolane.time-travel-restore-receipt.v1');
  assert.equal((await call(route, { method: 'POST', pathname: '/api/time-travel/checkpoints/c1/branch', body: {} })).status, 201);
  assert.equal((await call(route, { method: 'POST', pathname: '/api/time-travel/checkpoints/c1/replay', body: {} })).status, 201);
  assert.equal((await call(route, { pathname: '/api/time-travel/checkpoints/c1/export' })).body.schema, 'nolane.time-travel-evidence-bundle.v1');
  assert.equal(calls.length, 4);
});
