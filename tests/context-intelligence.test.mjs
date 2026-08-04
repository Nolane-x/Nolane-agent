import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AgentLoop } from '../src/agent/agent-loop.mjs';
import { ContextBuilder } from '../src/agent/context-builder.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';

test('AgentLoop injects bounded repository-ranked slices into Forge ContextPack and records omissions', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-context-intel-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const task = store.createTask({ projectId: project.id, title: 'Fix router', objective: 'Fix provider routing', metadata: { changedPaths: ['src/router.mjs'] } });
  const calls = [];
  const repositoryIndex = {
    async index(value) { calls.push(['index', value.id]); return { indexed: 1, reused: 2 }; },
    contextForTask(projectId, options) {
      calls.push(['context', projectId, options]);
      return {
        items: [
          { path: 'src/router.mjs', sha256: '1'.repeat(64), score: 120, text: '// repository:src/router.mjs\nexport function route(){}' },
          { path: 'tests/router.test.mjs', sha256: '2'.repeat(64), score: 80, text: '// repository:tests/router.test.mjs\ntest("route",()=>{})' },
        ],
        omissions: [{ path: 'src/legacy.mjs', reason: 'character-budget', score: 2 }],
      };
    },
  };
  const forge = {
    async buildContextPack(input) {
      calls.push(['forge', input.code]);
      return {
        routePlan: { routePlanSha256: 'a'.repeat(64), steps: [] }, skills: [], contextPackSha256: 'c'.repeat(64),
        compiled: { context: { system: [{ id: 'authority', text: 'Forge authority' }], task: [{ id: 'task', text: input.task }], skills: [], code: input.code, artifacts: [], memory: [], toolOutput: [], references: [] }, omissions: [], contextReceiptSha256: 'b'.repeat(64) },
      };
    },
    async recordEvidence() { return {}; },
  };
  const providers = new ProviderRegistry();
  providers.register({ id: 'fake', publicView: () => ({ id: 'fake' }), async complete({ messages }) { calls.push(['messages', messages]); return { text: 'done', toolCalls: [], usage: { totalTokens: 1 } }; } });
  const loop = new AgentLoop({ forge, providers, repositoryIndex, broker: new ToolBroker({ workspaceRoot: root, allowedCommands: [] }), store, contextBuilder: new ContextBuilder() });
  const result = await loop.run(task, { providerId: 'fake', budgets: { maxTurns: 1, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });

  assert.equal(result.state, 'awaiting-verification');
  const forgeCode = calls.find((entry) => entry[0] === 'forge')[1];
  assert.deepEqual(forgeCode.map((item) => item.id), ['repo:src/router.mjs', 'repo:tests/router.test.mjs']);
  assert.equal(forgeCode[0].priority > forgeCode[1].priority, true);
  const system = calls.find((entry) => entry[0] === 'messages')[1][0].content;
  assert.match(system, /repository:src\/router\.mjs/);
  const routedEvent = store.listEvents().find((event) => event.type === 'agent.routing.completed');
  assert.deepEqual(routedEvent.payload.omissions, [{ path: 'src/legacy.mjs', reason: 'character-budget', score: 2 }]);
});

test('AgentLoop injects immutable dependency handoffs so reviewers see builder intent and receipts', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-handoff-context-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const mission = store.createMission({ projectId: project.id, objective: 'Build and review', status: 'running' });
  const builder = store.createTask({ id: 'builder', projectId: project.id, missionId: mission.id, title: 'Build', objective: 'Implement', status: 'done', role: 'builder', metadata: { handoff: { schema: 'forge.task.handoff.v1', taskId: 'builder', output: 'Changed router safely.', receiptSha256s: ['a'.repeat(64)], handoffSha256: 'b'.repeat(64) } } });
  const reviewer = store.createTask({ id: 'reviewer', projectId: project.id, missionId: mission.id, title: 'Review', objective: 'Review the builder patch', role: 'reviewer', dependencies: [builder.id] });
  const captured = [];
  const forge = {
    async buildContextPack(input) {
      captured.push(input.references);
      return { routePlan: { routePlanSha256: 'a'.repeat(64), steps: [] }, skills: [], contextPackSha256: 'c'.repeat(64), compiled: { context: { system: [], task: [{ id: 'task', text: input.task }], skills: [], code: [], artifacts: [], memory: [], toolOutput: [], references: input.references }, omissions: [], contextReceiptSha256: 'd'.repeat(64) } };
    },
    async recordEvidence() { return {}; },
  };
  const providers = new ProviderRegistry();
  providers.register({ id: 'fake', publicView: () => ({ id: 'fake' }), async complete({ messages }) { assert.match(messages[0].content, /Changed router safely/); assert.match(messages[0].content, /handoffSha256/); return { text: 'reviewed', toolCalls: [], usage: { totalTokens: 1 } }; } });
  const loop = new AgentLoop({ forge, providers, broker: new ToolBroker({ workspaceRoot: root, allowedCommands: [] }), store, contextBuilder: new ContextBuilder() });
  await loop.run(reviewer, { providerId: 'fake', budgets: { maxTurns: 1, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(captured[0][0].id, 'handoff:builder');
  assert.match(captured[0][0].text, /Changed router safely/);
});

test('AgentLoop adds only approved active project memory to the governed ContextPack', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-active-memory-context-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const task = store.createTask({ projectId: project.id, title: 'Patch', objective: 'Apply a safe patch' });
  const memories = [{ id: 'memory:m1', text: '[approved-project-memory]\nUse hash preconditions.', sha256: 'a'.repeat(64), priority: 900 }];
  const memoryService = { context(projectId, query) { assert.equal(projectId, project.id); assert.match(query, /safe patch/); return memories; } };
  const captured = [];
  const forge = {
    async buildContextPack(input) { captured.push(input.memory); return { routePlan: { routePlanSha256: 'a'.repeat(64), steps: [] }, skills: [], contextPackSha256: 'c'.repeat(64), compiled: { context: { system: [], task: [{ id: 'task', text: input.task }], skills: [], code: [], artifacts: [], memory: input.memory, toolOutput: [], references: [] }, omissions: [], contextReceiptSha256: 'd'.repeat(64) } }; },
    async recordEvidence() { return {}; },
  };
  const providers = new ProviderRegistry();
  providers.register({ id: 'fake', publicView: () => ({ id: 'fake' }), async complete({ messages }) { assert.match(messages[0].content, /approved-project-memory/); return { text: 'done', toolCalls: [], usage: { totalTokens: 1 } }; } });
  const loop = new AgentLoop({ forge, providers, memoryService, broker: new ToolBroker({ workspaceRoot: root, allowedCommands: [] }), store, contextBuilder: new ContextBuilder() });
  await loop.run(task, { providerId: 'fake', budgets: { maxTurns: 1, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.deepEqual(captured[0], memories);
});

test('AgentLoop injects only matching project instruction records as untrusted references', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-instruction-context-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const task = store.createTask({ projectId: project.id, title: 'Patch TS', objective: 'Patch TypeScript', metadata: { changedPaths: ['src/app.ts'] } });
  const instructionDiscovery = {
    async discover(workspaceRoot) { assert.equal(workspaceRoot, root); return [{ id: 'instruction:ts', sourcePath: '.cursor/rules/ts.mdc', kind: 'instruction', text: '[untrusted-project-guidance]\nUse strict TS.', sha256: 'e'.repeat(64) }]; },
    select(records, options) { assert.equal(records.length, 1); assert.deepEqual(options.paths, ['src/app.ts']); return { items: records, omissions: [{ sourcePath: 'python.mdc', reason: 'scope-mismatch' }] }; },
  };
  const captured = [];
  const forge = {
    async buildContextPack(input) { captured.push(input.references); return { routePlan: { routePlanSha256: 'a'.repeat(64), steps: [] }, skills: [], contextPackSha256: 'c'.repeat(64), compiled: { context: { system: [], task: [{ id: 'task', text: input.task }], skills: [], code: [], artifacts: [], memory: [], toolOutput: [], references: input.references }, omissions: [], contextReceiptSha256: 'd'.repeat(64) } }; },
    async recordEvidence() { return {}; },
  };
  const providers = new ProviderRegistry();
  providers.register({ id: 'fake', publicView: () => ({ id: 'fake' }), async complete({ messages }) { assert.match(messages[0].content, /untrusted-project-guidance/); return { text: 'done', toolCalls: [], usage: { totalTokens: 1 } }; } });
  const loop = new AgentLoop({ forge, providers, instructionDiscovery, broker: new ToolBroker({ workspaceRoot: root, allowedCommands: [] }), store, contextBuilder: new ContextBuilder() });
  await loop.run(task, { providerId: 'fake', budgets: { maxTurns: 1, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(captured[0][0].id, 'project-instruction:.cursor/rules/ts.mdc');
  const event = store.listEvents().find((item) => item.type === 'agent.instructions.selected');
  assert.deepEqual(event.payload.omissions, [{ sourcePath: 'python.mdc', reason: 'scope-mismatch' }]);
});
