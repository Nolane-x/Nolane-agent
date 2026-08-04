import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { createRoutes } from '../src/server/routes.mjs';

function response() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(body = '') { this.body = String(body); },
  };
}

function request(method, body = null, principal = { subject: 'user-local', roles: ['developer'] }) {
  const req = new EventEmitter();
  req.method = method;
  req.headers = {};
  req.forgePrincipal = principal;
  req[Symbol.asyncIterator] = async function* iterator() {
    if (body !== null) yield Buffer.from(JSON.stringify(body));
  };
  return req;
}

function routesWith(service) {
  return createRoutes({ store: { listProjects: () => [] }, providers: {}, missionRunner: {}, gitGovernance: service });
}

test('Git governance commit and checkpoint APIs use authenticated principal and bounded fields only', async () => {
  const calls = [];
  const service = {
    async commit(input) { calls.push(['commit', input]); return { schema: 'forge.git-completion.v1', kind: 'final' }; },
    async checkpoint(input) { calls.push(['checkpoint', input]); return { schema: 'forge.git-completion.v1', kind: 'checkpoint' }; },
  };
  const routes = routesWith(service);
  const forged = {
    taskId: 'builder', expectedHead: 'abc123', paths: ['src/app.mjs'], message: 'fix(builder): safe commit',
    testReceipts: [{ status: 'pass', receiptSha256: 'a'.repeat(64) }], residualRisks: ['None known'], idempotencyKey: 'commit-1',
    principal: { subject: 'attacker' }, principalId: 'attacker', projectRoot: '/attacker', argv: ['reset', '--hard'], workspaceRoot: '/attacker',
  };
  const commitRes = response();
  await routes(request('POST', forged), commitRes, new URL('/api/git-governance/commit', 'http://localhost'));
  assert.equal(commitRes.statusCode, 201);
  const checkpointRes = response();
  await routes(request('POST', { ...forged, idempotencyKey: 'checkpoint-1' }), checkpointRes, new URL('/api/git-governance/checkpoint', 'http://localhost'));
  assert.equal(checkpointRes.statusCode, 201);

  const expectedBase = {
    taskId: 'builder', principal: { subject: 'user-local', roles: ['developer'] }, expectedHead: 'abc123', paths: ['src/app.mjs'],
    message: 'fix(builder): safe commit', testReceipts: [{ status: 'pass', receiptSha256: 'a'.repeat(64) }], residualRisks: ['None known'],
  };
  assert.deepEqual(calls, [
    ['commit', { ...expectedBase, idempotencyKey: 'commit-1' }],
    ['checkpoint', { ...expectedBase, idempotencyKey: 'checkpoint-1' }],
  ]);
});

test('Git governance collision and read APIs preserve mission/task scope and authenticated principal', async () => {
  const calls = [];
  const service = {
    async collisionMap(input) { calls.push(['collisionMap', input]); return { schema: 'forge.git-collision-map.v1', ready: false }; },
    getMissionCollisionMap(input) { calls.push(['getMissionCollisionMap', input]); return { schema: 'forge.git-collision-map.v1', missionId: input.missionId }; },
    listTaskCompletions(input) { calls.push(['listTaskCompletions', input]); return [{ schema: 'forge.git-completion.v1', taskId: input.taskId }]; },
  };
  const routes = routesWith(service);
  const postRes = response();
  await routes(request('POST', { missionId: 'mission 1', targetRef: 'main', idempotencyKey: 'map-1', principalId: 'forged', workspaceRoot: '/bad' }), postRes, new URL('/api/git-governance/collisions', 'http://localhost'));
  assert.equal(postRes.statusCode, 201);
  const missionRes = response();
  await routes(request('GET'), missionRes, new URL('/api/git-governance/missions/mission%201', 'http://localhost'));
  assert.equal(missionRes.statusCode, 200);
  const taskRes = response();
  await routes(request('GET'), taskRes, new URL('/api/git-governance/tasks/task%201/completions', 'http://localhost'));
  assert.equal(taskRes.statusCode, 200);
  assert.deepEqual(calls, [
    ['collisionMap', { missionId: 'mission 1', principal: { subject: 'user-local', roles: ['developer'] }, targetRef: 'main', idempotencyKey: 'map-1' }],
    ['getMissionCollisionMap', { missionId: 'mission 1', principal: { subject: 'user-local', roles: ['developer'] } }],
    ['listTaskCompletions', { taskId: 'task 1', principal: { subject: 'user-local', roles: ['developer'] } }],
  ]);
});


test('Git governance conflict resolution API verifies an existing conflict receipt without accepting raw mutation controls', async () => {
  const calls = [];
  const service = {
    async recordConflictResolution(input) { calls.push(input); return { schema: 'forge.git-conflict-resolution.v1', receiptSha256: 'f'.repeat(64) }; },
  };
  const routes = routesWith(service);
  const res = response();
  await routes(request('POST', {
    missionId: 'mission-1', leftTaskId: 'agent-a', rightTaskId: 'agent-b', expectedConflictReceiptSha256: 'a'.repeat(64),
    resolutionSummary: 'Resolved the shared implementation and reran tests.', testReceipts: [{ status: 'pass', receiptSha256: 'b'.repeat(64) }], idempotencyKey: 'resolution-1',
    argv: ['merge', '--continue'], projectRoot: '/attacker', principalId: 'attacker',
  }), res, new URL('/api/git-governance/resolutions', 'http://localhost'));
  assert.equal(res.statusCode, 201);
  assert.deepEqual(calls, [{
    missionId: 'mission-1', leftTaskId: 'agent-a', rightTaskId: 'agent-b', principal: { subject: 'user-local', roles: ['developer'] },
    expectedConflictReceiptSha256: 'a'.repeat(64), resolutionSummary: 'Resolved the shared implementation and reran tests.',
    testReceipts: [{ status: 'pass', receiptSha256: 'b'.repeat(64) }], idempotencyKey: 'resolution-1',
  }]);
});

test('Git governance API requires configured service and exposes no raw Git execution route', async () => {
  const routes = createRoutes({ store: { listProjects: () => [] }, providers: {}, missionRunner: {} });
  await assert.rejects(
    () => routes(request('POST', { taskId: 'x' }), response(), new URL('/api/git-governance/commit', 'http://localhost')),
    (error) => error.statusCode === 503,
  );
  const serviceRoutes = routesWith({});
  const rawRes = response();
  const handled = await serviceRoutes(request('POST', { argv: ['reset', '--hard'] }), rawRes, new URL('/api/git-governance/raw', 'http://localhost'));
  assert.equal(handled, false);
});
