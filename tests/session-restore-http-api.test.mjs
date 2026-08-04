import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoutes } from '../src/server/routes.mjs';

async function call(route, { method = 'GET', pathname, body = null }) {
  let status; let data = '';
  const req = { method, async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(JSON.stringify(body)); } };
  const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
  await route(req, res, new URL(`http://local${pathname}`));
  return { status, body: data ? JSON.parse(data) : null };
}

test('session HTTP API exposes restore and composer-draft lifecycle without accepting paths from Electron', async () => {
  const calls = [];
  const sessionRestore = {
    restore: async () => ({ schema: 'restore' }),
    updateRestore: async (body) => { calls.push(['restore', body]); return { schema: 'updated' }; },
    draft: async (scope) => ({ scope, objective: 'draft' }),
    saveDraft: async (body) => { calls.push(['draft', body]); return { schema: 'saved' }; },
    clearDraft: async (scope) => ({ schema: 'deleted', scope })
  };
  const route = createRoutes({ sessionRestore });
  assert.equal((await call(route, { pathname: '/api/session/restore' })).body.schema, 'restore');
  assert.equal((await call(route, { method: 'PATCH', pathname: '/api/session/restore', body: { activeRoute: '/missions' } })).body.schema, 'updated');
  assert.equal((await call(route, { pathname: '/api/session/draft?scope=home' })).body.draft.objective, 'draft');
  assert.equal((await call(route, { method: 'PUT', pathname: '/api/session/draft', body: { scope: 'home', draft: { objective: 'x' } } })).body.schema, 'saved');
  assert.equal((await call(route, { method: 'DELETE', pathname: '/api/session/draft?scope=home' })).body.scope, 'home');
  assert.deepEqual(calls[0], ['restore', { activeRoute: '/missions' }]);
});
