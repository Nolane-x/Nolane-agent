import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

function auth(init = {}) {
  return { ...init, headers: { authorization: 'Bearer simple-token', 'content-type': 'application/json', ...(init.headers ?? {}) } };
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-simple-agent-api-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'App', workspaceRoot: root });
  const calls = [];
  const snapshot = (missionId) => ({
    mission: store.getMission(missionId),
    project,
    messages: store.listMessages({ missionId }),
    autonomyGrant: store.getAutonomyGrant(project.id),
    activities: { currentPhase: store.getMission(missionId).status === 'completed' ? 'completed' : 'building', activities: [{ id: 'a1', title: 'Đang thực hiện', status: 'active' }], usage: { totalTokens: 42 } },
    running: true,
  });
  const runCoordinator = {
    createRun(input) {
      calls.push(['createRun', input]);
      const mission = store.createMission({ projectId: input.projectId, objective: input.objective, status: 'running', metadata: { autonomyProfile: input.autonomyProfile } });
      store.createMessage({ projectId: input.projectId, missionId: mission.id, role: 'user', content: input.objective, metadata: { secret: 'hidden' } });
      store.createAutonomyGrant({ projectId: input.projectId, profile: input.autonomyProfile, scope: { allowedPaths: ['**'] } });
      return snapshot(mission.id);
    },
    snapshot(missionId) { calls.push(['snapshot', missionId]); return snapshot(missionId); },
    sendMessage(missionId, content) { calls.push(['message', missionId, content]); return store.createMessage({ projectId: project.id, missionId, role: 'user', content }); },
    pause(missionId) { calls.push(['pause', missionId]); store.updateMission(missionId, { status: 'paused' }); return snapshot(missionId); },
    resume(missionId) { calls.push(['resume', missionId]); store.updateMission(missionId, { status: 'running' }); return snapshot(missionId); },
    stop(missionId) { calls.push(['stop', missionId]); store.updateMission(missionId, { status: 'stopped' }); return snapshot(missionId); },
    retry(missionId) { calls.push(['retry', missionId]); store.updateMission(missionId, { status: 'running' }); return snapshot(missionId); },
  };
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'simple-token' },
    store,
    providers: new ProviderRegistry(),
    missionRunner: {},
    runCoordinator,
    uiRoot: path.resolve('ui'),
  });
  t.after(() => service.close());
  return { ...service, store, project, calls };
}

test('outcome-first run API starts a run, returns snapshots, and accepts follow-up messages', async (t) => {
  const f = await fixture(t);
  const create = await fetch(`${f.url}/api/agent/runs`, auth({
    method: 'POST',
    body: JSON.stringify({ projectId: f.project.id, objective: 'Build a polished settings page', autonomyProfile: 'workspace-autopilot' }),
  }));
  assert.equal(create.status, 201);
  const created = await create.json();
  assert.equal(created.mission.status, 'running');
  assert.equal(created.messages[0].content, 'Build a polished settings page');
  assert.equal(JSON.stringify(created).includes('hidden'), false);

  const detail = await (await fetch(`${f.url}/api/agent/runs/${created.mission.id}`, auth())).json();
  assert.equal(detail.activities.usage.totalTokens, 42);
  const activities = await (await fetch(`${f.url}/api/agent/runs/${created.mission.id}/activities`, auth())).json();
  assert.equal(activities.currentPhase, 'building');

  const message = await (await fetch(`${f.url}/api/agent/runs/${created.mission.id}/messages`, auth({ method: 'POST', body: JSON.stringify({ content: 'Keep the current keyboard shortcuts.' }) }))).json();
  assert.equal(message.content, 'Keep the current keyboard shortcuts.');
  assert.deepEqual(f.calls.slice(0, 4).map((item) => item[0]), ['createRun', 'snapshot', 'snapshot', 'message']);
});

test('outcome-first run API exposes pause, resume, stop, retry, recent runs, and autonomy settings', async (t) => {
  const f = await fixture(t);
  const created = await (await fetch(`${f.url}/api/agent/runs`, auth({ method: 'POST', body: JSON.stringify({ projectId: f.project.id, objective: 'Refactor', autonomyProfile: 'guided' }) }))).json();
  const id = created.mission.id;
  for (const action of ['pause', 'resume', 'stop', 'retry']) {
    const response = await fetch(`${f.url}/api/agent/runs/${id}/${action}`, auth({ method: 'POST', body: '{}' }));
    assert.equal(response.status, 200, action);
  }
  const recent = await (await fetch(`${f.url}/api/agent/runs?projectId=${encodeURIComponent(f.project.id)}`, auth())).json();
  assert.equal(recent[0].mission.id, id);

  const update = await fetch(`${f.url}/api/projects/${f.project.id}/autonomy`, auth({ method: 'PUT', body: JSON.stringify({ profile: 'workspace-autopilot', scope: { allowedPaths: ['src/**'] } }) }));
  assert.equal(update.status, 200);
  const grant = await update.json();
  assert.equal(grant.profile, 'workspace-autopilot');
  const loaded = await (await fetch(`${f.url}/api/projects/${f.project.id}/autonomy`, auth())).json();
  assert.deepEqual(loaded.scope.allowedPaths, ['src/**']);
});

test('provider connection API exposes readiness, configure, login, test, logout, and delete without returning secrets', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-provider-http-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const calls = [];
  const providerConnections = {
    list() { calls.push(['list']); return [{ id: 'codex-app-server', label: 'Codex', authenticated: false }]; },
    readiness(input) { calls.push(['readiness', input]); return { ready: false, readyProviders: [] }; },
    async configureApi(input) { calls.push(['configure', input]); return { id: input.id, authenticated: true, healthy: true }; },
    async test(id) { calls.push(['test', id]); return { id, healthy: true }; },
    async startLogin(id, input) { calls.push(['login', id, input]); return { loginId: 'login-1', authUrl: 'https://auth.example.test' }; },
    async cancelLogin(id, input) { calls.push(['cancel', id, input]); return { cancelled: true }; },
    async logout(id) { calls.push(['logout', id]); return { id, authenticated: false }; },
    async deleteApi(id) { calls.push(['delete', id]); return true; },
    async refreshAll() { calls.push(['refresh']); return this.list(); },
  };
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'simple-token' },
    store,
    providers: new ProviderRegistry(),
    missionRunner: {},
    providerConnections,
    uiRoot: path.resolve('ui'),
  });
  t.after(() => service.close());

  assert.equal((await fetch(`${service.url}/api/provider-connections`, auth())).status, 200);
  assert.equal((await fetch(`${service.url}/api/provider-connections/readiness`, auth())).status, 200);
  const configured = await fetch(`${service.url}/api/provider-connections/configure`, auth({ method: 'POST', body: JSON.stringify({ id: 'openai-api', kind: 'openai-responses', model: 'gpt-test', apiKey: 'sk-never-return' }) }));
  assert.equal(configured.status, 201);
  assert.doesNotMatch(await configured.text(), /sk-never-return/);
  assert.equal((await fetch(`${service.url}/api/provider-connections/openai-api/test`, auth({ method: 'POST', body: '{}' }))).status, 200);
  assert.equal((await fetch(`${service.url}/api/provider-connections/codex-app-server/login`, auth({ method: 'POST', body: JSON.stringify({ type: 'chatgpt' }) }))).status, 200);
  assert.equal((await fetch(`${service.url}/api/provider-connections/codex-app-server/login/cancel`, auth({ method: 'POST', body: JSON.stringify({ loginId: 'login-1' }) }))).status, 200);
  assert.equal((await fetch(`${service.url}/api/provider-connections/codex-app-server/logout`, auth({ method: 'POST', body: '{}' }))).status, 200);
  assert.equal((await fetch(`${service.url}/api/provider-connections/openai-api`, auth({ method: 'DELETE' }))).status, 200);
  assert.deepEqual(calls.map((item) => item[0]), ['list', 'readiness', 'configure', 'test', 'login', 'cancel', 'logout', 'delete']);
});

test('agent run API preserves provider_setup_required as an actionable 409', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-provider-preflight-http-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'App', workspaceRoot: root });
  const runCoordinator = {
    createRun() { throw Object.assign(new Error('Kết nối AI trước khi bắt đầu.'), { statusCode: 409, code: 'provider_setup_required', readiness: { ready: false, readyProviders: [] } }); },
  };
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'simple-token' }, store, providers: new ProviderRegistry(), missionRunner: {}, runCoordinator, uiRoot: path.resolve('ui') });
  t.after(() => service.close());
  const response = await fetch(`${service.url}/api/agent/runs`, auth({ method: 'POST', body: JSON.stringify({ projectId: project.id, objective: 'Do work' }) }));
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, 'provider_setup_required');
  assert.equal(body.readiness.ready, false);
  assert.equal(store.listMissions({ projectId: project.id }).length, 0);
});
