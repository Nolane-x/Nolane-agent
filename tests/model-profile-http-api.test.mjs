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
