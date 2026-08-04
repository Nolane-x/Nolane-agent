import test from 'node:test';
import assert from 'node:assert/strict';

import { AgentOperationsService } from '../src/operations/agent-operations-service.mjs';

const missionA = { id: 'm1', projectId: 'p1', title: 'Build auth', status: 'running', providerId: 'codex', createdAt: '2026-07-29T00:00:00.000Z', updatedAt: '2026-07-29T00:01:00.000Z', metadata: { secret: 'must-not-leak' } };
const taskA = { id: 't1', projectId: 'p1', missionId: 'm1', title: 'Review auth', role: 'reviewer', status: 'running', providerId: 'claude', createdAt: missionA.createdAt, updatedAt: missionA.updatedAt, metadata: { token: 'must-not-leak' } };

function fixture(overrides = {}) {
  return new AgentOperationsService({
    version: '1.4.0',
    providers: { publicView: () => [{ id: 'codex', label: 'Codex', kind: 'cli', capabilities: ['coding'], qualityTier: 4, costTier: 1, latencyTier: 2, available: true, authenticated: true, healthy: true, token: 'secret' }] },
    adaptiveIntelligence: { status: async () => ({ schema: 'forge.adaptive-intelligence-status.v1', capabilities: ['routing'], services: { routing: true }, externalGates: [] }) },
    operatingPlane: { status: async () => ({ schema: 'forge.operating-plane.status.v1', capabilities: ['scoped-subagents'], externalGates: [] }), listProfiles: async () => [{ id: 'reviewer', description: 'Review code', tools: ['fs.read'], capabilities: ['file.read'], prompt: 'private profile prompt' }] },
    toolCatalog: { summaries: () => [{ name: 'fs.read', source: 'core', tags: ['filesystem'], capability: 'file.read', description: 'Read a file', pinned: true, hasFullSchema: false }] },
    mcpRegistry: { publicView: () => [{ id: 'github', label: 'GitHub', kind: 'stdio', state: 'ready', executable: 'npx', args: ['--token', 'secret'], env: { TOKEN: 'secret' }, serverInfo: { name: 'github', version: '1.0' } }], listTools: async () => [{ name: 'github__issue_search', originalName: 'issue_search', serverId: 'github', description: 'Search issues', inputSchema: { type: 'object' }, token: 'secret' }] },
    capabilityRegistry: { list: () => [{ id: 'file.read', risk: 'low', approval: 'policy' }, { id: 'git.push', risk: 'critical', approval: 'always' }] },
    capabilityLedger: { listGrants: () => [{ id: 'g1', principalId: 'agent-1', capabilities: ['file.read'], effect: 'allow', mode: 'session', sessionId: 's1', scope: { paths: ['src/**'], domains: [], commands: [], arguments: [], repositories: [], tools: [] }, reason: 'Read source', expectedImpact: 'Read project files', approvedBy: 'admin', createdAt: missionA.createdAt, usesRemaining: null, revokedAt: null, receiptSha256: 'a'.repeat(64), secret: 'must-not-leak' }] },
    store: {
      listMissions: ({ projectId }) => projectId === 'p1' ? [missionA] : [{ ...missionA, id: 'other', projectId: 'p2' }],
      listTasks: ({ projectId }) => projectId === 'p1' ? [taskA] : [{ ...taskA, id: 'other-task', projectId: 'p2' }],
    },
    ...overrides,
  });
}

test('AgentOperationsService returns a bounded project-scoped safe control-center snapshot', async () => {
  const snapshot = await fixture().snapshot({ projectId: 'p1', principalId: 'local-admin' });
  assert.equal(snapshot.schema, 'forge.agent-operations-center.v1');
  assert.equal(snapshot.version, '1.4.0');
  assert.equal(snapshot.projectId, 'p1');
  assert.equal(snapshot.providers[0].id, 'codex');
  assert.equal(snapshot.providers[0].token, undefined);
  assert.deepEqual(snapshot.tools.map((item) => item.name), ['fs.read']);
  assert.equal(snapshot.mcp.servers[0].executable, undefined);
  assert.equal(snapshot.mcp.servers[0].args, undefined);
  assert.equal(snapshot.mcp.tools[0].inputSchema, undefined);
  assert.equal(snapshot.grants[0].secret, undefined);
  assert.equal(snapshot.agents.missions[0].metadata, undefined);
  assert.equal(snapshot.agents.tasks[0].metadata, undefined);
  assert.equal(snapshot.agents.profiles[0].prompt, undefined);
  assert.equal(snapshot.summary.providersReady, 1);
  assert.equal(snapshot.summary.activeTasks, 1);
  assert.match(snapshot.receiptSha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(snapshot), /must-not-leak|"secret"|--token/);
});

test('AgentOperationsService degrades profile inventory without failing the whole dashboard', async () => {
  const snapshot = await fixture({ operatingPlane: { status: async () => ({ capabilities: [] }), listProfiles: async () => { throw Object.assign(new Error('Workspace is untrusted'), { code: 'WORKSPACE_UNTRUSTED' }); } } }).snapshot({ projectId: 'p1', principalId: 'local-admin' });
  assert.deepEqual(snapshot.agents.profiles, []);
  assert.equal(snapshot.agents.profilesState, 'blocked');
  assert.equal(snapshot.agents.profilesReason, 'WORKSPACE_UNTRUSTED');
});

test('AgentOperationsService requires an authenticated principal and a project id', async () => {
  await assert.rejects(() => fixture().snapshot({ projectId: 'p1' }), /authenticated principal/i);
  await assert.rejects(() => fixture().snapshot({ principalId: 'local-admin' }), /projectId is required/i);
});
