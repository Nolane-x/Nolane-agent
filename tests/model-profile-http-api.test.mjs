import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutes } from '../src/server/routes.mjs';

async function call(route, { method = 'GET', pathname, body = null }) { let status; let data=''; const req={method,async *[Symbol.asyncIterator](){if(body!==null)yield Buffer.from(JSON.stringify(body));}}; const res={writeHead(code){status=code;},end(chunk=''){data+=chunk;}}; await route(req,res,new URL(`http://local${pathname}`)); return {status,body:data?JSON.parse(data):null}; }

test('model profile HTTP API lists discovers and probes models', async () => {
  const modelProfiles = { publicView: ({ providerId = null } = {}) => ({ schema: 'profiles', providerId, models: [{ key: 'p/m' }] }), upsert: (profile) => ({ key: `${profile.providerId}/${profile.modelId}`, ...profile }) };
  const providerConnections = { discoverModels: async (id) => ({ providerId: id, models: [{ id: 'm' }] }), probeModel: async (id, input) => ({ providerId: id, modelId: input.modelId, capabilities: { text: true } }) };
  const providers = { publicView: () => [{ id: 'p', kind: 'cli', configured: true }] };
  const route = createRoutes({ modelProfiles, providerConnections, providers });
  assert.equal((await call(route,{pathname:'/api/model-profiles?providerId=p'})).body.providerId,'p');
  const added = await call(route,{method:'POST',pathname:'/api/model-profiles',body:{providerId:'p',modelId:'gpt-5.2-codex'}});
  assert.equal(added.status, 201);
  assert.equal(added.body.profile.key, 'p/gpt-5.2-codex');
  assert.equal((await call(route,{method:'POST',pathname:'/api/model-profiles/discover',body:{providerId:'p'}})).body.models[0].id,'m');
  assert.equal((await call(route,{method:'POST',pathname:'/api/model-profiles/probe',body:{providerId:'p',modelId:'m',probes:['text']}})).body.capabilities.text,true);
});

test('manual CLI model profiles inherit only provider-declared effort transport metadata', async () => {
  let received = null;
  const modelProfiles = {
    publicView: () => ({ schema: 'profiles', models: [] }),
    upsert: (profile) => { received = profile; return { key: `${profile.providerId}/${profile.modelId}`, ...profile }; },
  };
  const providers = {
    publicView: () => [{
      id: 'aider', kind: 'cli', configured: true,
      effort: { supported: true, mode: 'forwarded', levels: ['low', 'medium', 'high'] },
    }],
  };
  const route = createRoutes({ modelProfiles, providers });

  const added = await call(route, { method: 'POST', pathname: '/api/model-profiles', body: { providerId: 'aider', modelId: 'anthropic/claude-sonnet' } });

  assert.equal(added.status, 201);
  assert.deepEqual(received.reasoning, {
    supported: true,
    controllable: true,
    levels: ['low', 'medium', 'high'],
  });
  assert.deepEqual(received.metadata.effort, {
    provenance: 'provider-declared',
    transport: 'forwarded',
    modelCompatibility: 'provider-validated-at-execution',
  });
});

test('provider connection HTTP API applies a selected discovered model', async () => {
  const calls = [];
  const route = createRoutes({
    providerConnections: {
      async selectApiModel(providerId, input) { calls.push([providerId, input]); return { id: providerId, config: { model: input.modelId } }; },
    },
  });

  const result = await call(route, { method: 'POST', pathname: '/api/provider-connections/select-model', body: { providerId: 'openai-picker', modelId: 'gpt-live', testConnection: false } });

  assert.equal(result.status, 200);
  assert.equal(result.body.config.model, 'gpt-live');
  assert.deepEqual(calls, [['openai-picker', { modelId: 'gpt-live', testConnection: false }]]);
});
