import assert from 'node:assert/strict';
import test from 'node:test';

import { TrustAwareInstructionDiscovery, TrustAwareMcpGateway, TrustAwarePluginContext } from '../src/security/workspace-trust-gates.mjs';

function trustStub(initial = 'untrusted') {
  let state = initial;
  return {
    set(value) { state = value; },
    async status(projectId) { return { projectId, state, reason: state === 'trusted' ? null : 'no-trust-decision' }; },
    async requireTrusted(projectId, feature) {
      if (state === 'trusted') return { projectId, state };
      throw Object.assign(new Error(`Workspace trust is required before using ${feature}`), { statusCode: 409, code: 'WORKSPACE_TRUST_REQUIRED' });
    },
  };
}

test('trust-aware instruction discovery returns no project guidance until trusted', async () => {
  const trust = trustStub();
  const calls = [];
  const base = {
    async discover(root) { calls.push(root); return [{ sourcePath: 'AGENTS.md', text: 'Run tests' }]; },
    select(records) { return { items: records, omissions: [] }; },
  };
  const service = new TrustAwareInstructionDiscovery({ base, trust });
  assert.deepEqual(await service.discover('/repo', { projectId: 'p1' }), []);
  assert.equal(calls.length, 0);
  trust.set('trusted');
  assert.equal((await service.discover('/repo', { projectId: 'p1' }))[0].sourcePath, 'AGENTS.md');
  assert.equal(calls.length, 1);
});

test('trust-aware MCP gateway hides schemas and rejects calls before trust', async () => {
  const trust = trustStub();
  const calls = [];
  const base = {
    async schemasForTask(task) { calls.push(['schemas', task.id]); return [{ type: 'function', function: { name: 'docs.search' } }]; },
    async execute(task, name, args) { calls.push(['execute', task.id, name, args]); return { status: 'pass' }; },
  };
  const gateway = new TrustAwareMcpGateway({ base, trust });
  const task = { id: 't1', projectId: 'p1' };
  assert.deepEqual(await gateway.schemasForTask(task), []);
  await assert.rejects(() => gateway.execute(task, 'docs.search', {}), (error) => error.code === 'WORKSPACE_TRUST_REQUIRED');
  assert.equal(calls.length, 0);
  trust.set('trusted');
  assert.equal((await gateway.schemasForTask(task))[0].function.name, 'docs.search');
  assert.equal((await gateway.execute(task, 'docs.search', {})).status, 'pass');
});

test('trust-aware plugin context omits all behavior-shaping content before trust', async () => {
  const trust = trustStub();
  const base = { async contextForProject(projectId) { return { projectId, items: [{ name: 'skill' }], omissions: [], usedChars: 4, maxChars: 100 }; } };
  const service = new TrustAwarePluginContext({ base, trust });
  const blocked = await service.contextForProject('p1');
  assert.deepEqual(blocked.items, []);
  assert.equal(blocked.omissions[0].reason, 'workspace-untrusted');
  trust.set('trusted');
  assert.equal((await service.contextForProject('p1')).items[0].name, 'skill');
});
