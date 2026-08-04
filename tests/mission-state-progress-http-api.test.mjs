import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';

const auth = (init = {}) => ({ ...init, headers: { authorization: 'Bearer mission-state-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });

test('Mission State Progress API is authenticated and binds identity to the real principal', async (t) => {
  const calls = [];
  const missionStateProgress = {
    snapshot: (input) => { calls.push(['snapshot', input]); return { schema: 'forge.mission-state-progress.v1', ...input, receiptSha256: 'a'.repeat(64) }; },
    assertWithinCostLimit: (input) => { calls.push(['cost', input]); return { schema: 'forge.mission-cost-check.v1', ...input, allowed: true, receiptSha256: 'b'.repeat(64) }; },
  };
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'mission-state-token' }, store: { listEvents: () => [], listProjects: () => [] }, providers: new ProviderRegistry(), missionRunner: {}, missionStateProgress, uiRoot: path.resolve('ui') });
  t.after(() => service.close());

  assert.equal((await fetch(`${service.url}/api/mission-state-progress?projectId=p1&missionId=m1`)).status, 401);
  assert.equal((await fetch(`${service.url}/api/mission-state-progress?projectId=p1&missionId=m1`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/mission-state-progress/cost-check`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', missionId: 'm1', principalId: 'spoof', projectedCostUsd: 0.5 }) }))).status, 200);
  assert.deepEqual(calls.map(([name, input]) => [name, input.principalId]), [['snapshot', 'local-admin'], ['cost', 'local-admin']]);
});
