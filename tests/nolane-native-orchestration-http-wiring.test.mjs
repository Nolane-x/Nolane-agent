import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer token', 'content-type': 'application/json', ...(options.headers ?? {}) } });

test('canonical orchestration API delegates only typed bounded operations', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-orchestration-http-'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const calls = [];
  let listOptions;
  const nativeOrchestration = {
    listSkills: async (options) => (listOptions = options, [{ id: 'repair' }]),
    skillCatalog: async (options) => (listOptions = options, { schema: 'nolane.agent.skill-hub-catalog.v1', readOnly: true, skills: [{ id: 'forgeos:v2:repair' }], counts: { total: 1 } }),
    loadSkill: async (id, body) => (calls.push(['load', id, body]), { id, receiptSha256: 'a'.repeat(64) }),
    installForgeOsSkill: async (id) => (calls.push(['install', id]), { id, provenanceStatus: 'forge-os-imported', receiptSha256: 'e'.repeat(64) }),
    spawnSubagent: (body) => (calls.push(['spawn', body]), { agentId: body.agentId, status: 'running' }),
    completeSubagent: (id, body) => (calls.push(['complete', id, body]), { handoffSha256: 'b'.repeat(64) }),
    startGateway: async (id) => ({ id, status: 'running' }), stopGateway: async (id) => ({ id, status: 'stopped' }), gatewayStatus: (id) => ({ id, status: 'stopped' }),
    sendMessage: async (body) => ({ externalId: 'local-1', ...body }), schedule: async (body) => body, runDue: async () => [],
    appendTrajectory: async (body) => ({ ...body, recordSha256: 'c'.repeat(64) }), exportTrajectories: async () => ({ records: 0, outputSha256: 'd'.repeat(64) }),
  };
  const server = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'token' }, store, providers: new ProviderRegistry(), missionRunner: {}, nativeOrchestration, uiRoot: root });
  t.after(() => server.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.equal((await fetch(`${server.url}/api/nolane/orchestration/skills`)).status, 401);
  assert.equal((await (await fetch(`${server.url}/api/nolane/orchestration/skills?source=forge-os&catalog=v2&q=inspect&limit=7`, auth())).json())[0].id, 'repair');
  assert.deepEqual(listOptions, { source: 'forge-os', catalog: 'v2', query: 'inspect', limit: 7 });
  const hub = await (await fetch(`${server.url}/api/skills/catalog?source=forge-os&catalog=v2&q=inspect&limit=7`, auth())).json();
  assert.equal(hub.schema, 'nolane.agent.skill-hub-catalog.v1');
  assert.equal(hub.readOnly, true);
  assert.equal(hub.skills[0].id, 'forgeos:v2:repair');
  assert.deepEqual(listOptions, { source: 'forge-os', catalog: 'v2', query: 'inspect', limit: 7 });
  assert.equal((await fetch(`${server.url}/api/skills/catalog/forgeos%3Av2%3Arepair/install`, auth({ method: 'POST', body: '{}' }))).status, 400);
  const installed = await fetch(`${server.url}/api/skills/catalog/forgeos%3Av2%3Arepair/install`, auth({ method: 'POST', body: JSON.stringify({ confirmed: true }) }));
  assert.equal(installed.status, 201);
  assert.equal((await installed.json()).provenanceStatus, 'forge-os-imported');
  assert.deepEqual(calls.at(-1), ['install', 'forgeos:v2:repair']);
  assert.equal((await fetch(`${server.url}/api/nolane/orchestration/subagents`, auth({ method: 'POST', body: JSON.stringify({ agentId: 'a1' }) }))).status, 201);
  assert.equal((await fetch(`${server.url}/api/nolane/orchestration/messages`, auth({ method: 'POST', body: JSON.stringify({ channel: 'local', text: 'hello' }) }))).status, 201);
  assert.ok(calls.some(([kind]) => kind === 'spawn'));
});

test('application opens and passes Nolane native orchestration service', async () => {
  const source = await readFile('src/app.mjs', 'utf8');
  assert.match(source, /NolaneNativeOrchestrationService/);
  assert.match(source, /const nativeOrchestration = new NolaneNativeOrchestrationService\(/);
  assert.match(source, /await nativeOrchestration\.open\(\)/);
  assert.match(source, /forgeOsRoots: \[config\.forgeOsRoot\]/);
  assert.match(source, /nativeOrchestration,/);
  assert.match(source, /skillContextResolver:\s*async \(id\) => nativeOrchestration\.loadSkill\(id, \{ grantedCapabilities: \[\] \}\)/);
});
