import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';

test('mission resource fabric API is authenticated and read-only', async (t) => {
  const fabric = { publicView: () => ({ schema: 'forge.mission-resource-fabric.v1', receiptSha256: 'a'.repeat(64) }) };
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'fabric-token', performance: {} },
    store: { listEvents: () => [], listProjects: () => [] }, providers: new ProviderRegistry(), missionRunner: {},
    missionResourceFabric: fabric, uiRoot: path.resolve('ui'),
  });
  t.after(() => service.close());
  let response = await fetch(`${service.url}/api/mission-resource-fabric`);
  assert.equal(response.status, 401);
  response = await fetch(`${service.url}/api/mission-resource-fabric`, { headers: { authorization: 'Bearer fabric-token' } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).schema, 'forge.mission-resource-fabric.v1');
  response = await fetch(`${service.url}/api/mission-resource-fabric`, { method: 'POST', headers: { authorization: 'Bearer fabric-token' } });
  assert.equal(response.status, 404);
});
