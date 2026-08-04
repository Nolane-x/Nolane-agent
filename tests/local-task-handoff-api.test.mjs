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

function request(method, body = null, principal = { subject: 'user-local' }) {
  const req = new EventEmitter();
  req.method = method;
  req.headers = {};
  req.forgePrincipal = principal;
  req[Symbol.asyncIterator] = async function* iterator() {
    if (body !== null) yield Buffer.from(JSON.stringify(body));
  };
  return req;
}

test('local task handoff API prepares a bounded handoff using authenticated principal identity', async () => {
  const calls = [];
  const localTaskHandoff = {
    async prepare(input) { calls.push(['prepare', input]); return { schema: 'forge.local-task-handoff.v1', taskId: 'builder', localWorkspace: '/managed/builder' }; },
    get(input) { calls.push(['get', input]); return { schema: 'forge.local-task-handoff.v1', taskId: input.taskId }; },
  };
  const routes = createRoutes({ store: { listProjects: () => [] }, providers: {}, missionRunner: {}, localTaskHandoff });
  const res = response();
  await routes(request('POST', {
    missionId: 'mission-1', taskId: 'builder', localWorkspace: '/attacker/path', worktree: { path: '/attacker/path' }, principalId: 'forged-user',
  }), res, new URL('/api/local-task-handoffs', 'http://localhost'));

  assert.equal(res.statusCode, 201);
  assert.deepEqual(calls, [['prepare', { missionId: 'mission-1', taskId: 'builder', principalId: 'user-local' }]]);
  assert.equal(JSON.parse(res.body).localWorkspace, '/managed/builder');
});

test('local task handoff API retrieves persisted handoff by task ID and principal', async () => {
  const calls = [];
  const localTaskHandoff = {
    async prepare() { throw new Error('not used'); },
    get(input) { calls.push(input); return { schema: 'forge.local-task-handoff.v1', taskId: input.taskId, principalId: input.principalId }; },
  };
  const routes = createRoutes({ store: { listProjects: () => [] }, providers: {}, missionRunner: {}, localTaskHandoff });
  const res = response();
  await routes(request('GET'), res, new URL('/api/local-task-handoffs/task%201', 'http://localhost'));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, [{ taskId: 'task 1', principalId: 'user-local' }]);
});

test('local task handoff API requires a configured service', async () => {
  const routes = createRoutes({ store: { listProjects: () => [] }, providers: {}, missionRunner: {} });
  await assert.rejects(
    () => routes(request('POST', { missionId: 'mission-1' }), response(), new URL('/api/local-task-handoffs', 'http://localhost')),
    (error) => error.statusCode === 503,
  );
});
