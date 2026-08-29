import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AgentLoop } from '../src/agent/agent-loop.mjs';
import { ContextBuilder } from '../src/agent/context-builder.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';
import { normalizeTaskContract } from '../src/orchestration/task-contract.mjs';

function composeDefinition({ name = 'readFile', steps = null } = {}) {
  return {
    name,
    description: 'Read a workspace file through an ephemeral governed capability.',
    parameters: { type: 'object', additionalProperties: false, required: ['path'], properties: { path: { type: 'string', minLength: 1 } } },
    steps: steps ?? [{ id: 'read', tool: 'fs.read', args: { path: { $bind: { from: 'input', path: ['path'] } } } }],
    output: { $bind: { from: 'step', stepId: steps?.at(-1)?.id ?? 'read', path: ['output'] } },
  };
}

async function fixture(t, { metadata = {}, hookEngineFactory = null } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-ephemeral-capability-'));
  await writeFile(path.join(root, 'README.md'), 'hello ephemeral capability');
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  let task = store.createTask({ projectId: project.id, title: 'Inspect', objective: 'Inspect README and report.' });
  task = store.updateTask(task.id, { metadata: { ...task.metadata, ...metadata } });
  const evidence = [];
  const forge = {
    async buildContextPack(input) {
      return {
        routePlan: { routePlanSha256: 'a'.repeat(64), steps: [] },
        skills: [],
        compiled: { context: { system: [{ text: 'Forge authority' }], task: [{ text: input.task }], skills: [], code: [], artifacts: [], memory: [], toolOutput: [], references: [] }, omissions: [], contextReceiptSha256: 'b'.repeat(64) },
        contextPackSha256: 'c'.repeat(64),
      };
    },
    async recordEvidence(projectId, item) { evidence.push({ projectId, item }); return { id: `e${evidence.length}`, ...item, status: 'unverified' }; },
  };
  const providers = new ProviderRegistry();
  const broker = new ToolBroker({ workspaceRoot: root, allowedCommands: [process.execPath] });
  const loop = new AgentLoop({ forge, providers, broker, store, contextBuilder: new ContextBuilder(), hookEngineFactory });
  return { root, store, project, task, evidence, providers, broker, loop, forge };
}

function budgets(overrides = {}) {
  return { maxTurns: 6, maxToolCalls: 12, maxEstimatedTokens: 200, maxElapsedMs: 10_000, ...overrides };
}

test('ephemeral capability composition is absent unless explicitly enabled', async (t) => {
  const f = await fixture(t);
  f.providers.register({
    id: 'off-model', publicView: () => ({ id: 'off-model' }),
    async complete({ tools }) {
      assert.equal(tools.some((item) => item.function.name === 'tool.compose.create'), false);
      assert.equal(tools.some((item) => item.function.name.startsWith('ephemeral.')), false);
      return { text: 'done', toolCalls: [], usage: { totalTokens: 1 } };
    },
  });
  const result = await f.loop.run(f.task, { providerId: 'off-model', budgets: budgets({ maxToolCalls: 0 }) });
  assert.equal(result.state, 'awaiting-verification');
});

test('enabled run creates a namespaced capability, executes child tools through governance, and expires it at run end', async (t) => {
  const f = await fixture(t, { metadata: { ephemeralCapabilityComposition: true } });
  let phase = 0;
  f.providers.register({
    id: 'compose-model', publicView: () => ({ id: 'compose-model' }),
    async complete({ tools, messages }) {
      if (phase === 0) {
        assert.equal(tools.some((item) => item.function.name === 'tool.compose.create'), true);
        assert.equal(tools.some((item) => item.function.name === 'ephemeral.readFile'), false);
        phase += 1;
        return { text: '', toolCalls: [{ id: 'create-1', name: 'tool.compose.create', arguments: composeDefinition() }], usage: { totalTokens: 1 } };
      }
      if (phase === 1) {
        assert.equal(tools.some((item) => item.function.name === 'ephemeral.readFile'), true);
        assert.match(messages.at(-1).content, /ephemeral\.readFile/);
        phase += 1;
        return { text: '', toolCalls: [{ id: 'invoke-1', name: 'ephemeral.readFile', arguments: { path: 'README.md' } }], usage: { totalTokens: 1 } };
      }
      assert.match(messages.at(-1).content, /hello ephemeral capability/);
      return { text: 'done', toolCalls: [], usage: { totalTokens: 1 } };
    },
  });

  const result = await f.loop.run(f.task, { providerId: 'compose-model', budgets: budgets() });
  assert.equal(result.state, 'awaiting-verification');
  assert.deepEqual(result.activity.filesRead, ['README.md']);
  assert.equal(result.receipts.length, 3, 'definition + child primitive + aggregate execution receipts must remain first-class');
  assert.equal(f.evidence.length, 3);
  const events = f.store.listEvents();
  assert.ok(events.some((event) => event.type === 'agent.capability.registered' && event.payload.tool === 'ephemeral.readFile'));
  assert.ok(events.some((event) => event.type === 'agent.tool.completed' && event.payload.tool === 'fs.read' && event.payload.parentCompositeId === 'ephemeral.readFile' && event.payload.childStepId === 'read'));
  assert.ok(events.some((event) => event.type === 'agent.tool.completed' && event.payload.tool === 'ephemeral.readFile'));

  let secondTurn = 0;
  f.providers.register({
    id: 'second-model', publicView: () => ({ id: 'second-model' }),
    async complete({ tools }) {
      if (secondTurn++ === 0) assert.equal(tools.some((item) => item.function.name === 'ephemeral.readFile'), false, 'run-local capability must not survive into a new run');
      return { text: 'done', toolCalls: [], usage: { totalTokens: 1 } };
    },
  });
  await f.loop.run(f.task, { providerId: 'second-model', budgets: budgets({ maxToolCalls: 0 }) });
});

test('composite child effects consume the run tool-call budget instead of laundering one model call into many effects', async (t) => {
  const f = await fixture(t, { metadata: { ephemeralCapabilityComposition: true } });
  let phase = 0;
  f.providers.register({
    id: 'budget-model', publicView: () => ({ id: 'budget-model' }),
    async complete() {
      if (phase++ === 0) return { text: '', toolCalls: [{ id: 'create', name: 'tool.compose.create', arguments: composeDefinition() }], usage: { totalTokens: 1 } };
      return { text: '', toolCalls: [{ id: 'invoke', name: 'ephemeral.readFile', arguments: { path: 'README.md' } }], usage: { totalTokens: 1 } };
    },
  });
  await assert.rejects(() => f.loop.run(f.task, { providerId: 'budget-model', budgets: budgets({ maxToolCalls: 2 }) }), /tool call/i);
});

test('composite child calls still obey lifecycle hook denial', async (t) => {
  const hookEngineFactory = async () => ({
    async run(eventName, payload) {
      if (eventName === 'BeforeTool' && payload.parentCompositeId === 'ephemeral.readFile') return { decision: 'deny', reason: 'child denied by hook', audit: [] };
      return { decision: 'allow', audit: [] };
    },
  });
  const f = await fixture(t, { metadata: { ephemeralCapabilityComposition: true }, hookEngineFactory });
  let phase = 0;
  f.providers.register({
    id: 'hook-model', publicView: () => ({ id: 'hook-model' }),
    async complete() {
      if (phase++ === 0) return { text: '', toolCalls: [{ id: 'create', name: 'tool.compose.create', arguments: composeDefinition() }], usage: { totalTokens: 1 } };
      return { text: '', toolCalls: [{ id: 'invoke', name: 'ephemeral.readFile', arguments: { path: 'README.md' } }], usage: { totalTokens: 1 } };
    },
  });
  await assert.rejects(() => f.loop.run(f.task, { providerId: 'hook-model', budgets: budgets() }), /child denied by hook/i);
  assert.equal(f.store.listEvents().some((event) => event.type === 'agent.tool.completed' && event.payload.tool === 'fs.read'), false);
});

test('composite child calls still obey task-contract scope denial', async (t) => {
  const contract = normalizeTaskContract({
    objective: 'Read only allowed files and complete verification without expanding scope.',
    successCriteria: [{ id: 'scope', description: 'Scope remains bounded.', verification: { command: process.execPath, args: ['--version'] } }],
    scope: { allowedPaths: ['allowed/**'], deniedPaths: ['README.md'] },
    allowedCommands: [process.execPath], networkPolicy: { mode: 'deny' },
    testCriteria: ['scope test passes'], performanceCriteria: ['bounded'], securityCriteria: ['no scope expansion'], compatibilityCriteria: ['node'],
    outputContract: { kind: 'report', requiredArtifacts: ['allowed/report.txt'] }, allowCommit: false, allowDeploy: false, allowInternet: false,
    autonomy: 'guided', tokenBudget: 1000, deadline: '2026-08-30T00:00:00Z', riskLevel: 'medium', stopConditions: ['scope violation'],
  });
  const f = await fixture(t, { metadata: { ephemeralCapabilityComposition: true, taskContract: contract } });
  let phase = 0;
  f.providers.register({
    id: 'contract-model', publicView: () => ({ id: 'contract-model' }),
    async complete() {
      if (phase++ === 0) return { text: '', toolCalls: [{ id: 'create', name: 'tool.compose.create', arguments: composeDefinition() }], usage: { totalTokens: 1 } };
      return { text: '', toolCalls: [{ id: 'invoke', name: 'ephemeral.readFile', arguments: { path: 'README.md' } }], usage: { totalTokens: 1 } };
    },
  });
  await assert.rejects(() => f.loop.run(f.task, { providerId: 'contract-model', budgets: budgets() }), (error) => error?.code === 'TASK_SCOPE_DENIED');
});
