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

test('model intelligence HTTP API exposes canonical entities, facts, evaluations, comparison, and routing explanation', async () => {
  const calls = [];
  const manager = {
    truthSnapshot: () => ({ schema: 'nolane.model-truth-plane.v1' }),
    truthEntities: (id) => ({ schema: 'nolane.model-truth-view.v1', id }),
    truthFacts: (id, options) => ({ schema: 'nolane.model-facts.v1', id, options }),
    recordFact: (body) => { calls.push(['fact', body]); return { schema: 'nolane.model-fact.v1' }; },
    recordEvaluation: (body) => { calls.push(['evaluation', body]); return { schema: 'nolane.model-evaluation.v1' }; },
    compare: (body) => ({ schema: 'nolane.model-comparison.v1', body }),
    explain: (body) => ({ schema: 'nolane.model-routing-explanation.v1', body }),
  };
  const route = createRoutes({ modelManager: manager });
  assert.equal((await call(route, { pathname: '/api/model-intelligence/snapshot' })).body.schema, 'nolane.model-truth-plane.v1');
  assert.equal((await call(route, { pathname: '/api/model-intelligence/entities?modelId=acme%2Fm' })).body.id, 'acme/m');
  assert.equal((await call(route, { pathname: '/api/model-intelligence/facts?modelId=acme%2Fm&pathPrefix=context' })).body.options.pathPrefix, 'context');
  assert.equal((await call(route, { method: 'POST', pathname: '/api/model-intelligence/facts', body: { modelId: 'acme/m', path: 'context.maxOutputTokens', value: 1 } })).status, 201);
  assert.equal((await call(route, { method: 'POST', pathname: '/api/model-intelligence/evaluations', body: { modelId: 'acme/m', suiteId: 's', suiteVersion: '1' } })).status, 201);
  assert.equal((await call(route, { method: 'POST', pathname: '/api/model-intelligence/compare', body: { modelIds: ['a', 'b'] } })).body.schema, 'nolane.model-comparison.v1');
  assert.equal((await call(route, { method: 'POST', pathname: '/api/model-management/explain', body: { request: {} } })).body.schema, 'nolane.model-routing-explanation.v1');
  assert.equal(calls.length, 2);
});
