import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { GoalService } from '../src/goals/goal-service.mjs';
import { AdaptiveReplanner } from '../src/goals/adaptive-replanner.mjs';

function auth(init = {}) { return { ...init, headers: { authorization: 'Bearer goal-token', 'content-type': 'application/json', ...(init.headers ?? {}) } }; }

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-goal-api-'));
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const goalService = new GoalService({ store });
  const replanner = new AdaptiveReplanner({ store, goalService });
  const calls = [];
  const goalRunService = {
    createAndStart(input) { calls.push(['goal-start', input]); const goal = goalService.create(input); const mission = store.createMission({ projectId: input.projectId, objective: input.objective, status: 'running', metadata: { goalId: goal.id } }); goalService.attachMission(goal.id, mission.id, { relation: 'primary' }); return { goal: goalService.get(goal.id), run: { mission } }; },
    start(goalId, input) { calls.push(['goal-resume', goalId, input]); const goal = goalService.get(goalId); const mission = store.createMission({ projectId: goal.projectId, objective: goal.objective, status: 'running', metadata: { goalId } }); goalService.attachMission(goalId, mission.id, { relation: 'primary' }); return { goal: goalService.get(goalId), run: { mission } }; },
  };
  const commandRegistry = { list: () => [{ name: 'goal' }], async execute(command, context) { calls.push(['command', command, context]); return { ok: true, command: 'goal', value: { goals: [] } }; } };
  const browserService = {}; for (const action of ['detect','open','goto','snapshot','find','click','fill','press','tabs','screenshot','artifact','close','status']) browserService[action] = async (input = {}) => { calls.push(['browser', action, input]); return { action, input, untrusted: true }; };
  const browserRuntimeInstaller = { async status() { calls.push(['browser-runtime-status']); return { ready: false, version: '0.1.17' }; }, async install(input) { calls.push(['browser-runtime-install', input]); return { ready: true, version: '0.1.17' }; } };
  const pluginService = {
    publicView: () => [{ id: 'plugin-1', name: 'feature-dev' }], listMarketplaces: () => [{ id: 'market-1' }],
    async addMarketplace(input) { calls.push(['market-add', input]); return { id: 'market-2' }; }, async install(input) { calls.push(['plugin-install', input]); return { id: 'plugin-2' }; },
    async activate(id, input) { calls.push(['plugin-activate', id, input]); return { pluginId: id, ...input }; }, async deactivate(id, input) { calls.push(['plugin-deactivate', id, input]); return { pluginId: id, ...input }; },
    async review(id, input) { calls.push(['plugin-review', id, input]); return { pluginId: id, capabilities: { mcp: { servers: [{ id: 'docs' }] }, lsp: { servers: [{ id: 'typescript' }] } } }; },
  };
  const settingsService = { async effective(id) { calls.push(['settings-effective', id]); return { value: { agent: { model: 'auto' } }, provenance: {}, warnings: [] }; }, async update(input) { calls.push(['settings-update', input]); return { ...input, effective: { value: input.patch } }; } };
  const missionGraph = { snapshot(input) { calls.push(['graph', input]); return { schema: 'forge.studio.mission-graph.v1', nodes: [], edges: [], goal: input.goalId ? goalService.get(input.goalId) : null }; } };
  const goalScheduler = { async tick() { calls.push(['scheduler']); return { started: [], skipped: [] }; } };
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'goal-token' }, store, providers: new ProviderRegistry(), missionRunner: {}, goalService, goalRunService, replanner, commandRegistry, browserService, pluginService, settingsService, missionGraph, goalScheduler, browserRuntimeInstaller, uiRoot: path.resolve('ui') });
  t.after(() => service.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  return { ...service, store, project, goalService, calls };
}

test('Goal OS API creates, starts, updates, observes, replans, and projects durable goals', async (t) => {
  const f = await fixture(t);
  const create = await fetch(`${f.url}/api/goals`, auth({ method: 'POST', body: JSON.stringify({ projectId: f.project.id, title: 'Ship', objective: 'Ship Goal OS', start: true, browserAllowedActions: ['snapshot'] }) }));
  assert.equal(create.status, 201);
  const created = await create.json(); const goalId = created.goal.id;
  assert.equal(created.goal.activeMissionId, created.run.mission.id);
  assert.equal((await fetch(`${f.url}/api/goals?projectId=${f.project.id}`, auth())).status, 200);
  assert.equal((await fetch(`${f.url}/api/goals/${goalId}`, auth())).status, 200);
  assert.equal((await fetch(`${f.url}/api/goals/${goalId}`, auth({ method: 'PATCH', body: JSON.stringify({ budget: { maxTotalTokens: 1000 } }) }))).status, 200);
  assert.equal((await fetch(`${f.url}/api/goals/${goalId}/facts`, auth({ method: 'POST', body: JSON.stringify({ claim: 'Need browser tests', impact: 'medium', source: { kind: 'test' } }) }))).status, 201);
  const replan = await fetch(`${f.url}/api/goals/${goalId}/replan`, auth({ method: 'POST', body: JSON.stringify({ reason: 'Add verification', patch: { addTasks: [] }, idempotencyKey: 'api-1' }) }));
  assert.equal(replan.status, 201);
  const patch = await replan.json();
  assert.equal((await fetch(`${f.url}/api/replans/${patch.id}/apply`, auth({ method: 'POST', body: '{}' }))).status, 200);
  const graph = await (await fetch(`${f.url}/api/mission-graph?goalId=${goalId}`, auth())).json();
  assert.equal(graph.goal.id, goalId);
});

test('Goal OS API exposes commands, browser, plugins, settings, and scheduler through real service boundaries', async (t) => {
  const f = await fixture(t);
  assert.equal((await fetch(`${f.url}/api/commands`, auth())).status, 200);
  assert.equal((await fetch(`${f.url}/api/commands`, auth({ method: 'POST', body: JSON.stringify({ command: '/goal list', context: { projectId: f.project.id } }) }))).status, 200);
  assert.equal((await fetch(`${f.url}/api/browser/open`, auth({ method: 'POST', body: JSON.stringify({ projectId: f.project.id, url: 'https://example.com' }) }))).status, 200);
  assert.equal((await fetch(`${f.url}/api/browser/snapshot`, auth({ method: 'POST', body: JSON.stringify({ projectId: f.project.id, depth: 3 }) }))).status, 200);
  assert.equal((await fetch(`${f.url}/api/browser/artifact`, auth({ method: 'POST', body: JSON.stringify({ projectId: f.project.id, filename: 'workspace.png' }) }))).status, 200);
  assert.equal((await fetch(`${f.url}/api/browser/runtime`, auth())).status, 200);
  assert.equal((await fetch(`${f.url}/api/browser/runtime/install`, auth({ method: 'POST', body: JSON.stringify({ force: true }) }))).status, 200);
  assert.equal((await fetch(`${f.url}/api/plugins`, auth())).status, 200);
  assert.equal((await fetch(`${f.url}/api/plugins/marketplaces`, auth({ method: 'POST', body: JSON.stringify({ source: '/market' }) }))).status, 201);
  assert.equal((await fetch(`${f.url}/api/plugins/install`, auth({ method: 'POST', body: JSON.stringify({ marketplaceId: 'market-1', pluginName: 'feature-dev' }) }))).status, 201);
  const review = await fetch(`${f.url}/api/plugins/plugin-1/review?projectId=${f.project.id}`, auth());
  assert.equal(review.status, 200);
  assert.equal((await fetch(`${f.url}/api/plugins/plugin-1/activate`, auth({ method: 'POST', body: JSON.stringify({ projectId: f.project.id, requestedCapabilities: ['skills', 'mcp'], approvedServers: { mcp: ['docs'] } }) }))).status, 200);
  assert.equal((await fetch(`${f.url}/api/settings/effective?projectId=${f.project.id}`, auth())).status, 200);
  assert.equal((await fetch(`${f.url}/api/settings`, auth({ method: 'PUT', body: JSON.stringify({ layer: 'project', projectId: f.project.id, patch: { agent: { model: 'codex' } } }) }))).status, 200);
  assert.equal((await fetch(`${f.url}/api/goals/scheduler/tick`, auth({ method: 'POST', body: '{}' }))).status, 200);
  assert.equal(f.calls.some((item) => item[0] === 'browser' && item[1] === 'snapshot'), true);
  assert.equal(f.calls.some((item) => item[0] === 'plugin-activate'), true);
});
