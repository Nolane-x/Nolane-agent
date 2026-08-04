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

test('model management HTTP API exposes snapshot, recommendation, portfolio, observation, and dossier', async () => {
  const calls = [];
  const manager = {
    snapshot: () => ({ schema: 'snapshot' }),
    recommend: (body) => ({ schema: 'recommendation', body }),
    createPortfolio: (body) => ({ schema: 'portfolio', body }),
    recordExecution: (id, observation) => { calls.push([id, observation]); return { key: id, status: 'healthy' }; },
    dossier: (id) => ({ schema: 'dossier', canonicalId: id }),
  };
  const route = createRoutes({ modelManager: manager });
  assert.equal((await call(route, { pathname: '/api/model-management/snapshot' })).body.schema, 'snapshot');
  assert.equal((await call(route, { method: 'POST', pathname: '/api/model-management/recommend', body: { request: { taskClass: 'large' } } })).body.schema, 'recommendation');
  assert.equal((await call(route, { method: 'POST', pathname: '/api/model-management/portfolio', body: { roles: {} } })).body.schema, 'portfolio');
  assert.equal((await call(route, { method: 'POST', pathname: '/api/model-management/observations', body: { modelId: 'a/b', observation: { success: true } } })).status, 202);
  assert.deepEqual(calls, [['a/b', { success: true }]]);
  assert.equal((await call(route, { pathname: '/api/model-management/dossier?modelId=a%2Fb' })).body.canonicalId, 'a/b');
});
