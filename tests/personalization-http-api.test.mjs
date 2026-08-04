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

test('personalization HTTP API exposes profile, context, preview, import and bounded updates', async () => {
  const calls = [];
  const personalizationProfile = {
    exportProfile: async (input) => ({ schema: 'profile', input }),
    compileContext: async (input) => ({ schema: 'context', input }),
    previewImport: async (input) => ({ schema: 'preview', input }),
    applyImport: async (input) => ({ schema: 'applied', input }),
    updatePreferences: async (input) => { calls.push(input); return { schema: 'updated' }; }
  };
  const route = createRoutes({ personalizationProfile });
  assert.equal((await call(route, { pathname: '/api/personalization/profile?projectId=p1' })).body.input.projectId, 'p1');
  assert.equal((await call(route, { pathname: '/api/personalization/context' })).body.schema, 'context');
  assert.equal((await call(route, { method: 'POST', pathname: '/api/personalization/import/preview', body: { profile: { schema: 'x' } } })).body.schema, 'preview');
  assert.equal((await call(route, { method: 'POST', pathname: '/api/personalization/import', body: { profile: { schema: 'x' }, source: 'onboarding' } })).body.input.source, 'onboarding');
  assert.equal((await call(route, { method: 'PATCH', pathname: '/api/personalization/preferences', body: { patch: { experience: { level: 'studio' } } } })).body.schema, 'updated');
  assert.equal(calls[0].patch.experience.level, 'studio');
});
