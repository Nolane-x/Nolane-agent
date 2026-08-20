import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';

function auth(init = {}) { return { ...init, headers: { authorization: 'Bearer modes-token', 'content-type': 'application/json', ...(init.headers ?? {}) } }; }

test('authenticated Agent Modes API lists, resolves, and starts canonical mode runs', async (t) => {
  const calls = [];
  const agentModes = {
    list: () => [{ id: 'read-only', label: 'Read only', readOnly: true }],
    resolve(input) { calls.push(['resolve', input]); return { schema: 'forge.agent-mode-resolution.v1', modeId: input.modeId, policy: { readOnly: true }, receiptSha256: 'a'.repeat(64) }; },
  };
  const runCoordinator = {
    createRun(input) { calls.push(['run', input]); return { mission: { id: 'm1', projectId: input.projectId, metadata: { modeId: input.modeId } } }; },
  };
  const workspaceTrust = { async requireTrusted(projectId, surface) { calls.push(['trust', { projectId, surface }]); return true; } };
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'modes-token' },
    store: { listEvents: () => [], listProjects: () => [], listMissions: () => [] },
    providers: new ProviderRegistry(), missionRunner: {}, runCoordinator, agentModes, workspaceTrust, uiRoot: path.resolve('ui'),
  });
  t.after(() => service.close());

  assert.equal((await fetch(`${service.url}/api/agent-modes`)).status, 401);
  const listed = await (await fetch(`${service.url}/api/agent-modes`, auth())).json();
  assert.equal(listed[0].id, 'read-only');

  const resolved = await (await fetch(`${service.url}/api/agent-modes/resolve`, auth({ method: 'POST', body: JSON.stringify({ modeId: 'read-only', overrides: { maxTasks: 2 } }) }))).json();
  assert.equal(resolved.modeId, 'read-only');

  const run = await (await fetch(`${service.url}/api/agent/runs`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', objective: 'Explain auth', modeId: 'read-only', modeOverrides: { maxTasks: 2 } }) }))).json();
  assert.equal(run.mission.metadata.modeId, 'read-only');
  assert.deepEqual(calls, [
    ['resolve', { modeId: 'read-only', overrides: { maxTasks: 2 } }],
    ['trust', { projectId: 'p1', surface: 'background' }],
    ['run', { projectId: 'p1', objective: 'Explain auth', autonomyProfile: undefined, modeId: 'read-only', modeOverrides: { maxTasks: 2 }, providerId: 'auto', budgets: undefined, maxTasks: undefined, mcpAllowedTools: undefined, forgeOsCapabilities: undefined, remoteSandboxApproval: undefined }],
  ]);
});

test('agent runs apply the persisted permission default only when the caller has not selected a mode', async (t) => {
  const calls = [];
  const runCoordinator = { createRun(input) { calls.push(input); return { mission: { id: 'm2', projectId: input.projectId, metadata: { modeId: input.modeId } } }; } };
  const settingsService = { effective: async (projectId) => ({ value: { permissions: { defaultMode: projectId === 'full-project' ? 'full' : 'ask' } } }) };
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'modes-token' },
    store: { listEvents: () => [], listProjects: () => [], listMissions: () => [] },
    providers: new ProviderRegistry(), missionRunner: {}, runCoordinator, settingsService, uiRoot: path.resolve('ui'),
  });
  t.after(() => service.close());

  const full = await (await fetch(`${service.url}/api/agent/runs`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'full-project', objective: 'Apply the selected default' }) }))).json();
  const explicit = await (await fetch(`${service.url}/api/agent/runs`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'full-project', objective: 'Keep explicit mode', modeId: 'plan' }) }))).json();

  assert.equal(full.mission.metadata.modeId, 'deep');
  assert.equal(explicit.mission.metadata.modeId, 'plan');
  assert.equal(calls[0].modeId, 'deep');
  assert.equal(calls[1].modeId, 'plan');
});
