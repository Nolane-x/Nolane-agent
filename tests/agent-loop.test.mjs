import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AgentLoop } from '../src/agent/agent-loop.mjs';
import { ContextBuilder } from '../src/agent/context-builder.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { AdaptiveProviderRouter } from '../src/providers/adaptive-router.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';

async function fixture(t, responses) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-loop-'));
  await writeFile(path.join(root, 'README.md'), 'hello');
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const task = store.createTask({ projectId: project.id, title: 'Inspect', objective: 'Inspect README and report.' });
  const calls = [];
  const forge = {
    async buildContextPack(input) {
      calls.push(['route', input.query]);
      return {
        routePlan: { routePlanSha256: 'a'.repeat(64), steps: [{ techniqueId: 'tdd' }] },
        skills: [{ skillId: 'tdd', text: 'Use tests first.', sections: [{ id: 'procedure' }] }],
        compiled: { context: { system: [{ text: 'Forge authority' }], task: [{ text: input.task }], skills: [{ text: 'Use tests first.' }], code: [], artifacts: [], memory: [], toolOutput: [], references: [] }, omissions: [], contextReceiptSha256: 'b'.repeat(64) },
        contextPackSha256: 'c'.repeat(64),
      };
    },
    async recordEvidence(projectId, evidence) { calls.push(['evidence', projectId, evidence.type]); return { id: 'forge-evidence', ...evidence, status: 'unverified' }; },
  };
  let index = 0;
  const provider = {
    id: 'fake-model', kind: 'test', publicView: () => ({ id: 'fake-model', kind: 'test' }),
    async complete(request) { calls.push(['model', request.messages.length]); const item = responses[Math.min(index++, responses.length - 1)]; if (item instanceof Error) throw item; return item; },
  };
  const providers = new ProviderRegistry(); providers.register(provider);
  const broker = new ToolBroker({ workspaceRoot: root, allowedCommands: [process.execPath] });
  const loop = new AgentLoop({ forge, providers, broker, store, contextBuilder: new ContextBuilder() });
  return { root, store, project, task, calls, loop, providers, forge, broker };
}

test('AgentLoop routes before the model, executes tools through receipts, and checkpoints', async (t) => {
  const f = await fixture(t, [
    { text: 'Reading.', toolCalls: [{ id: 'call_1', name: 'fs.read', arguments: { path: 'README.md' } }], usage: { totalTokens: 20 } },
    { text: 'README says hello.', toolCalls: [], usage: { totalTokens: 10 } },
  ]);
  const result = await f.loop.run(f.task, { providerId: 'fake-model', budgets: { maxTurns: 4, maxToolCalls: 4, maxEstimatedTokens: 100, maxElapsedMs: 1000 } });
  assert.deepEqual(f.calls.slice(0, 2).map((item) => item[0]), ['route', 'model']);
  assert.equal(result.state, 'awaiting-verification');
  assert.equal(result.output, 'README says hello.');
  assert.equal(result.receipts.length, 1);
  assert.equal(result.activity.usage.totalTokens, 30);
  assert.deepEqual(result.activity.filesRead, ['README.md']);
  assert.match(result.receipts[0].receiptSha256, /^[a-f0-9]{64}$/);
  const run = f.store.getRun(result.runId);
  assert.equal(run.state, 'awaiting-verification');
  assert.equal(run.checkpoint.turn, 2);
  assert.ok(f.store.listEvents().some((event) => event.type === 'agent.tool.completed'));
  assert.equal(f.calls.filter((item) => item[0] === 'evidence').length, 1);
});

test('AgentLoop never accepts model self-certification and classifies transient retries', async (t) => {
  const transient = new Error('Model HTTP 429: rate limited');
  const f = await fixture(t, [transient, { text: 'All tests pass. Task completed.', toolCalls: [], usage: { totalTokens: 5 } }]);
  const result = await f.loop.run(f.task, { providerId: 'fake-model', retryDelaysMs: [1], budgets: { maxTurns: 2, maxToolCalls: 0, maxEstimatedTokens: 50, maxElapsedMs: 1000 } });
  assert.equal(result.state, 'awaiting-verification');
  assert.equal(result.claimAssessment.status, 'blocked-unverified-claims');
  assert.match(result.output, /UNVERIFIED CLAIMS/i);
  assert.ok(result.claimAssessment.unsupportedClaims.includes('test-success'));
  assert.ok(result.claimAssessment.unsupportedClaims.includes('completion'));
  assert.equal(f.calls.filter((item) => item[0] === 'model').length, 2);
  assert.ok(f.store.listEvents().some((event) => event.type === 'agent.model.retrying'));
  assert.ok(f.store.listEvents().some((event) => event.type === 'agent.completion.claims-assessed'));
});

test('AgentLoop stops on cancellation and budget exhaustion', async (t) => {
  const controller = new AbortController(); controller.abort();
  const f = await fixture(t, [{ text: 'never', toolCalls: [], usage: { totalTokens: 1 } }]);
  await assert.rejects(() => f.loop.run(f.task, { providerId: 'fake-model', signal: controller.signal }), /cancelled/i);

  const limited = await fixture(t, [{ text: 'again', toolCalls: [{ id: '1', name: 'fs.read', arguments: { path: 'README.md' } }], usage: { totalTokens: 1000 } }]);
  await assert.rejects(() => limited.loop.run(limited.task, { providerId: 'fake-model', budgets: { maxTurns: 1, maxToolCalls: 1, maxEstimatedTokens: 10, maxElapsedMs: 1000 } }), /token/i);
  const latest = limited.store.listRuns({ taskId: limited.task.id }).at(-1);
  assert.equal(latest.state, 'failed');
});


test('AgentLoop auto-routes and falls back after a transient provider circuit opens', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-loop-router-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const task = store.createTask({ projectId: project.id, title: 'Build', objective: 'Build safely.' });
  const forge = {
    async buildContextPack(input) {
      return {
        routePlan: { routePlanSha256: 'a'.repeat(64), steps: [{ techniqueId: 'tdd' }] },
        skills: [],
        compiled: { context: { system: [{ text: 'Forge authority' }], task: [{ text: input.task }], skills: [], code: [], artifacts: [], memory: [], toolOutput: [], references: [] }, omissions: [], contextReceiptSha256: 'b'.repeat(64) },
        contextPackSha256: 'c'.repeat(64),
      };
    },
    async recordEvidence() { return { status: 'unverified' }; },
  };
  const providers = new ProviderRegistry();
  providers.register({
    id: 'primary', profile: { capabilities: ['coding', 'tool-calling', 'governed-actions'], qualityTier: 5, costTier: 1, latencyTier: 1 },
    publicView() { return { id: this.id, ...this.profile }; },
    async complete() { throw new Error('HTTP 503 temporarily unavailable'); },
  });
  providers.register({
    id: 'fallback', profile: { capabilities: ['coding', 'tool-calling', 'governed-actions'], qualityTier: 3, costTier: 1, latencyTier: 1 },
    publicView() { return { id: this.id, ...this.profile }; },
    async complete() { return { text: 'fallback result', toolCalls: [], usage: { totalTokens: 1 } }; },
  });
  const router = new AdaptiveProviderRouter({ registry: providers, failureThreshold: 1, cooldownMs: 60_000 });
  const loop = new AgentLoop({ forge, providers, router, broker: new ToolBroker({ workspaceRoot: root, allowedCommands: [] }), store, contextBuilder: new ContextBuilder() });

  const result = await loop.run(task, { providerId: 'auto', retryDelaysMs: [], budgets: { maxTurns: 2, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.providerId, 'fallback');
  assert.equal(result.output, 'fallback result');
  assert.ok(store.listEvents().some((event) => event.type === 'agent.provider.fallback' && event.payload.from === 'primary' && event.payload.to === 'fallback'));
});

test('AgentLoop progressively exposes allowlisted MCP schemas and routes calls through the governed MCP gateway', async (t) => {
  const f = await fixture(t, []);
  const gatewayCalls = [];
  const mcpGateway = {
    async schemasForTask(task) { assert.deepEqual(task.metadata.mcpAllowedTools, ['docs__search']); return [{ type: 'function', function: { name: 'docs__search', description: 'Search docs', parameters: { type: 'object' } } }]; },
    async execute(task, name, args) { gatewayCalls.push([task.id, name, args]); return { status: 'pass', output: { structuredContent: { answer: 'found' } }, receipt: { receiptSha256: 'd'.repeat(64) } }; },
  };
  const task = f.store.updateTask(f.task.id, { metadata: { ...f.task.metadata, mcpAllowedTools: ['docs__search'] } });
  const responses = [
    { text: '', toolCalls: [{ id: 'mcp-1', name: 'docs__search', arguments: { q: 'policy' }, rawArguments: '{"q":"policy"}' }], usage: { totalTokens: 1 } },
    { text: 'done', toolCalls: [], usage: { totalTokens: 1 } },
  ];
  f.providers.register({
    id: 'mcp-model', publicView: () => ({ id: 'mcp-model' }),
    async complete({ tools, messages }) {
      assert.equal(tools.some((item) => item.function.name === 'docs__search'), true);
      if (responses.length === 1) assert.match(messages.at(-1).content, /found/);
      return responses.shift();
    },
  });
  const loop = new AgentLoop({ forge: f.forge, providers: f.providers, mcpGateway, broker: f.broker, store: f.store, contextBuilder: new ContextBuilder() });
  const result = await loop.run(task, { providerId: 'mcp-model', budgets: { maxTurns: 2, maxToolCalls: 1, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.state, 'awaiting-verification');
  assert.deepEqual(gatewayCalls, [[task.id, 'docs__search', { q: 'policy' }]]);
  assert.equal(result.receipts[0].receiptSha256, 'd'.repeat(64));
});

test('AgentLoop emits observable tool lifecycle events with safe target and result metadata', async (t) => {
  const f = await fixture(t, [
    { text: 'Reading.', toolCalls: [{ id: 'call_1', name: 'fs.read', arguments: { path: 'README.md' } }], usage: { totalTokens: 3 } },
    { text: 'Done.', toolCalls: [], usage: { totalTokens: 2 } },
  ]);
  await f.loop.run(f.task, { providerId: 'fake-model', budgets: { maxTurns: 3, maxToolCalls: 2, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  const events = f.store.listEvents();
  const started = events.find((event) => event.type === 'agent.tool.started');
  const completed = events.find((event) => event.type === 'agent.tool.completed');
  assert.equal(started.payload.tool, 'fs.read');
  assert.equal(started.payload.target, 'README.md');
  assert.equal(completed.payload.target, 'README.md');
  assert.equal(completed.payload.status, 'pass');
  assert.equal(Number.isInteger(completed.payload.durationMs), true);
  assert.equal(completed.payload.bytes > 0, true);
  assert.equal(Object.hasOwn(completed.payload, 'content'), false);
});

test('AgentLoop progressively exposes allowlisted browser tools and routes them through governed browser receipts', async (t) => {
  const f = await fixture(t, []);
  const browserCalls = [];
  const browserGateway = {
    schemasForTask(task) { assert.deepEqual(task.metadata.browserAllowedActions, ['snapshot']); return [{ type: 'function', function: { name: 'browser.snapshot', description: 'Snapshot page', parameters: { type: 'object' } } }]; },
    async execute(task, name, args) { browserCalls.push([task.id, name, args]); return { status: 'pass', output: { output: 'button Continue [ref=e3]', untrusted: true }, receipt: { receiptSha256: 'e'.repeat(64) } }; },
  };
  const task = f.store.updateTask(f.task.id, { metadata: { ...f.task.metadata, browserAllowedActions: ['snapshot'] } });
  const responses = [
    { text: '', toolCalls: [{ id: 'browser-1', name: 'browser.snapshot', arguments: { depth: 3 } }], usage: { totalTokens: 1 } },
    { text: 'Page inspected.', toolCalls: [], usage: { totalTokens: 1 } },
  ];
  f.providers.register({
    id: 'browser-model', publicView: () => ({ id: 'browser-model' }),
    async complete({ tools, messages }) {
      assert.equal(tools.some((item) => item.function.name === 'browser.snapshot'), true);
      if (responses.length === 1) assert.match(messages.at(-1).content, /Continue/);
      return responses.shift();
    },
  });
  const loop = new AgentLoop({ forge: f.forge, providers: f.providers, browserGateway, broker: f.broker, store: f.store, contextBuilder: new ContextBuilder() });
  const result = await loop.run(task, { providerId: 'browser-model', budgets: { maxTurns: 2, maxToolCalls: 1, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.state, 'awaiting-verification');
  assert.deepEqual(browserCalls, [[task.id, 'browser.snapshot', { depth: 3 }]]);
  assert.equal(result.receipts[0].receiptSha256, 'e'.repeat(64));
});

test('AgentLoop injects active plugin skills and agents as bounded untrusted references', async (t) => {
  const f = await fixture(t, [{ text: 'Used plugin guidance.', toolCalls: [], usage: { totalTokens: 1 } }]);
  const pluginService = {
    async contextForProject(projectId) {
      assert.equal(projectId, f.project.id);
      return { items: [{ pluginId: 'p1', pluginName: 'feature-dev', contentSha256: 'f'.repeat(64), kind: 'skill', name: 'explore', sourcePath: 'skills/explore/SKILL.md', text: '# Explore\nInspect architecture.', truncated: false, trust: 'community-plugin-untrusted' }], omissions: [] };
    },
  };
  let captured;
  f.forge.buildContextPack = async (input) => {
    captured = input;
    return {
      routePlan: { routePlanSha256: 'a'.repeat(64), steps: [{ techniqueId: 'tdd' }] }, skills: [],
      compiled: { context: { system: [{ text: 'Forge authority' }], task: [{ text: input.task }], skills: [], code: [], artifacts: [], memory: [], toolOutput: [], references: input.references.map((item) => ({ text: item.text })) }, omissions: [], contextReceiptSha256: 'b'.repeat(64) },
      contextPackSha256: 'c'.repeat(64),
    };
  };
  const loop = new AgentLoop({ forge: f.forge, providers: f.providers, pluginService, broker: f.broker, store: f.store, contextBuilder: new ContextBuilder() });
  await loop.run(f.task, { providerId: 'fake-model', budgets: { maxTurns: 1, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  const pluginRef = captured.references.find((item) => item.id === 'plugin:p1:skill:explore');
  assert.match(pluginRef.text, /untrusted-community-plugin/);
  assert.match(pluginRef.text, /Inspect architecture/);
  assert.equal(pluginRef.metadata.contentSha256, 'f'.repeat(64));
  assert.ok(f.store.listEvents().some((event) => event.type === 'agent.plugins.selected'));
});

test('AgentLoop exposes durable goal discovery tools and routes new findings through the replanner gateway', async (t) => {
  const f = await fixture(t, []);
  const calls = [];
  const goalGateway = {
    schemasForTask(task) { assert.equal(task.metadata.goalId, 'goal-1'); return [{ type: 'function', function: { name: 'goal.record_finding', description: 'Record finding', parameters: { type: 'object' } } }]; },
    async execute(task, name, args) { calls.push([task.id, name, args]); return { status: 'pass', output: { fact: { claim: args.claim }, patch: { status: 'applied' } }, receipt: { receiptSha256: '9'.repeat(64) } }; },
  };
  const task = f.store.updateTask(f.task.id, { metadata: { ...f.task.metadata, goalId: 'goal-1', goalAutoApplyPlanPatches: true } });
  const responses = [
    { text: '', toolCalls: [{ id: 'goal-1', name: 'goal.record_finding', arguments: { claim: 'Need another task', impact: 'high' } }], usage: { totalTokens: 1 } },
    { text: 'Plan updated.', toolCalls: [], usage: { totalTokens: 1 } },
  ];
  f.providers.register({ id: 'goal-model', publicView: () => ({ id: 'goal-model' }), async complete({ tools }) { assert.equal(tools.some((item) => item.function.name === 'goal.record_finding'), true); return responses.shift(); } });
  const loop = new AgentLoop({ forge: f.forge, providers: f.providers, goalGateway, broker: f.broker, store: f.store, contextBuilder: new ContextBuilder() });
  const result = await loop.run(task, { providerId: 'goal-model', budgets: { maxTurns: 2, maxToolCalls: 1, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.state, 'awaiting-verification');
  assert.deepEqual(calls, [[task.id, 'goal.record_finding', { claim: 'Need another task', impact: 'high' }]]);
});

test('AgentLoop exposes governed ForgeOS tools and records their receipts', async (t) => {
  const f = await fixture(t, []);
  const gatewayCalls = [];
  const forgeGateway = {
    schemasForTask(task) {
      assert.equal(task.id, f.task.id);
      return [{ type: 'function', function: { name: 'forge.status', description: 'Inspect ForgeOS status', parameters: { type: 'object', additionalProperties: false, properties: {} } } }];
    },
    async execute(task, name, args) {
      gatewayCalls.push([task.id, name, args]);
      return { status: 'pass', output: { version: '0.6.1', techniques: 128 }, receipt: { receiptSha256: '8'.repeat(64), durationMs: 1 } };
    },
  };
  const responses = [
    { text: '', toolCalls: [{ id: 'forge-1', name: 'forge.status', arguments: {} }], usage: { totalTokens: 1 } },
    { text: 'ForgeOS inspected.', toolCalls: [], usage: { totalTokens: 1 } },
  ];
  f.providers.register({
    id: 'forge-model', publicView: () => ({ id: 'forge-model' }),
    async complete({ tools, messages }) {
      assert.equal(tools.some((item) => item.function.name === 'forge.status'), true);
      if (responses.length === 1) assert.match(messages.at(-1).content, /0\.6\.1/);
      return responses.shift();
    },
  });
  const loop = new AgentLoop({ forge: f.forge, providers: f.providers, forgeGateway, broker: f.broker, store: f.store, contextBuilder: new ContextBuilder() });
  const result = await loop.run(f.task, { providerId: 'forge-model', budgets: { maxTurns: 2, maxToolCalls: 1, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.state, 'awaiting-verification');
  assert.deepEqual(gatewayCalls, [[f.task.id, 'forge.status', {}]]);
  assert.equal(result.receipts[0].receiptSha256, '8'.repeat(64));
  assert.ok(f.store.listEvents().some((event) => event.type === 'agent.forgeos.tools-authorized'));
});

test('AgentLoop exposes bounded range-read, search, and stdin schemas to models', async (t) => {
  const f = await fixture(t, []);
  f.providers.register({
    id: 'schema-model',
    publicView: () => ({ id: 'schema-model' }),
    async complete({ tools }) {
      const byName = new Map(tools.map((tool) => [tool.function.name, tool.function.parameters]));
      assert.equal(byName.has('fs.search'), true);
      assert.equal(byName.get('fs.read').properties.startLine.type, 'integer');
      assert.equal(byName.get('fs.read').properties.headLines.type, 'integer');
      assert.equal(byName.get('fs.read').properties.tailLines.type, 'integer');
      assert.equal(byName.get('process.run').properties.stdin.type, 'string');
      assert.equal(byName.get('process.run').properties.env.type, 'object');
      return { text: 'schemas inspected', toolCalls: [], usage: { totalTokens: 1 } };
    },
  });
  const result = await f.loop.run(f.task, { providerId: 'schema-model', budgets: { maxTurns: 1, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.output, 'schemas inspected');
});

test('AgentLoop progressively exposes authorized operating-plane tools and routes them through receipts', async (t) => {
  const f = await fixture(t, []);
  const calls = [];
  const operatingPlaneGateway = {
    schemasForTask(task) {
      assert.equal(task.id, f.task.id);
      return [{ type: 'function', function: { name: 'code.symbols', description: 'Symbols', parameters: { type: 'object' } } }];
    },
    async execute(task, name, args) {
      calls.push([task.id, name, args]);
      return { status: 'pass', output: { source: 'lsp', items: [{ name: 'AgentLoop' }] }, receipt: { receiptSha256: '7'.repeat(64), durationMs: 2 } };
    },
  };
  const responses = [
    { text: '', toolCalls: [{ id: 'op-1', name: 'code.symbols', arguments: { languageId: 'javascript', query: 'AgentLoop' } }], usage: { totalTokens: 1 } },
    { text: 'Symbol found.', toolCalls: [], usage: { totalTokens: 1 } },
  ];
  f.providers.register({
    id: 'operating-model', publicView: () => ({ id: 'operating-model' }),
    async complete({ tools, messages }) {
      assert.equal(tools.some((item) => item.function.name === 'code.symbols'), true);
      if (responses.length === 1) assert.match(messages.at(-1).content, /AgentLoop/);
      return responses.shift();
    },
  });
  const loop = new AgentLoop({ forge: f.forge, providers: f.providers, operatingPlaneGateway, broker: f.broker, store: f.store, contextBuilder: new ContextBuilder() });
  const result = await loop.run(f.task, { providerId: 'operating-model', budgets: { maxTurns: 2, maxToolCalls: 1, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.state, 'awaiting-verification');
  assert.deepEqual(calls, [[f.task.id, 'code.symbols', { languageId: 'javascript', query: 'AgentLoop' }]]);
  assert.ok(f.store.listEvents().some((event) => event.type === 'agent.operating-plane.tools-authorized'));
});

test('AgentLoop applies lifecycle hook context and safe argument rewrites before tool execution', async (t) => {
  const f = await fixture(t, []);
  const hookEvents = [];
  const hookEngineFactory = async () => ({
    async run(eventName, payload) {
      hookEvents.push([eventName, payload]);
      if (eventName === 'SessionStart') return { decision: 'allow', payload, additionalContext: ['Use the governed hook policy.'], allowedTools: null, retry: false, audit: [{ hookId: 'policy' }] };
      if (eventName === 'BeforeTool') return { decision: 'allow', payload: { ...payload, arguments: { path: 'README.md' } }, additionalContext: [], allowedTools: ['fs.read'], retry: false, audit: [{ hookId: 'rewrite' }] };
      return { decision: 'allow', payload, additionalContext: [], allowedTools: null, retry: false, audit: [] };
    },
  });
  let contextInput;
  f.forge.buildContextPack = async (input) => {
    contextInput = input;
    return {
      routePlan: { routePlanSha256: 'a'.repeat(64), steps: [{ techniqueId: 'tdd' }] }, skills: [],
      compiled: { context: { system: [{ text: 'Forge authority' }], task: [{ text: input.task }], skills: [], code: [], artifacts: [], memory: [], toolOutput: [], references: input.references.map((item) => ({ text: item.text })) }, omissions: [], contextReceiptSha256: 'b'.repeat(64) },
      contextPackSha256: 'c'.repeat(64),
    };
  };
  const responses = [
    { text: '', toolCalls: [{ id: 'hook-1', name: 'fs.read', arguments: { path: 'missing.txt' } }], usage: { totalTokens: 1 } },
    { text: 'Hooked read succeeded.', toolCalls: [], usage: { totalTokens: 1 } },
  ];
  f.providers.register({ id: 'hook-model', publicView: () => ({ id: 'hook-model' }), async complete() { return responses.shift(); } });
  const loop = new AgentLoop({ forge: f.forge, providers: f.providers, hookEngineFactory, broker: f.broker, store: f.store, contextBuilder: new ContextBuilder() });
  const result = await loop.run(f.task, { providerId: 'hook-model', budgets: { maxTurns: 2, maxToolCalls: 1, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.state, 'awaiting-verification');
  assert.ok(contextInput.references.some((item) => item.id.startsWith('hook:') && /governed hook policy/i.test(item.text)));
  assert.equal(result.receipts.length, 1);
  assert.ok(hookEvents.some(([name]) => name === 'BeforeTool'));
  assert.ok(hookEvents.some(([name]) => name === 'AfterTool'));
  assert.ok(f.store.listEvents().some((event) => event.type === 'agent.hook.completed'));
});

test('AgentLoop enforces deny-first hook decisions before a tool is executed', async (t) => {
  const f = await fixture(t, [{ text: '', toolCalls: [{ id: 'deny-1', name: 'fs.read', arguments: { path: 'README.md' } }], usage: { totalTokens: 1 } }]);
  const hookEngineFactory = async () => ({
    async run(eventName, payload) {
      return eventName === 'BeforeTool'
        ? { decision: 'deny', reason: 'blocked by policy', payload, additionalContext: [], allowedTools: null, retry: false, audit: [{ hookId: 'deny' }] }
        : { decision: 'allow', payload, additionalContext: [], allowedTools: null, retry: false, audit: [] };
    },
  });
  const loop = new AgentLoop({ forge: f.forge, providers: f.providers, hookEngineFactory, broker: f.broker, store: f.store, contextBuilder: new ContextBuilder() });
  await assert.rejects(() => loop.run(f.task, { providerId: 'fake-model', budgets: { maxTurns: 1, maxToolCalls: 1, maxEstimatedTokens: 20, maxElapsedMs: 1000 } }), (error) => error.code === 'HOOK_POLICY_DENIED');
  assert.equal(f.store.listEvidence({ projectId: f.project.id }).length, 0);
});

test('AgentLoop restricts base tool schemas to the task-owned allowlist', async (t) => {
  const f = await fixture(t, []);
  const task = f.store.updateTask(f.task.id, { metadata: { ...f.task.metadata, allowedToolNames: ['fs.read', 'fs.search'] } });
  f.providers.register({
    id: 'scoped-schema-model', publicView: () => ({ id: 'scoped-schema-model' }),
    async complete({ tools }) {
      const names = tools.map((tool) => tool.function.name);
      assert.equal(names.includes('fs.read'), true);
      assert.equal(names.includes('fs.search'), true);
      assert.equal(names.includes('fs.write'), false);
      assert.equal(names.includes('process.run'), false);
      return { text: 'scoped', toolCalls: [], usage: { totalTokens: 1 } };
    },
  });
  const result = await f.loop.run(task, { providerId: 'scoped-schema-model', budgets: { maxTurns: 1, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.output, 'scoped');
});


test('AgentLoop detects repeated identical actions without new progress and persists activity state', async (t) => {
  const repeated = Array.from({ length: 4 }, (_, index) => ({ text: `read-${index}`, toolCalls: [{ id: `repeat-${index}`, name: 'fs.read', arguments: { path: 'README.md' } }], usage: { totalTokens: 1 } }));
  const f = await fixture(t, repeated);
  const task = f.store.updateTask(f.task.id, { metadata: { ...f.task.metadata, duplicateActionLimit: 2 } });
  await assert.rejects(() => f.loop.run(task, { providerId: 'fake-model', budgets: { maxTurns: 5, maxToolCalls: 5, maxEstimatedTokens: 20, maxElapsedMs: 2000 } }), (error) => error.code === 'DUPLICATE_ACTION_LOOP');
  const run = f.store.listRuns({ taskId: task.id }).at(-1);
  assert.equal(run.state, 'failed');
  assert.equal(run.checkpoint.activity.filesRead[0], 'README.md');
  assert.equal(run.checkpoint.activity.usage.totalTokens, 4);
  assert.ok(run.checkpoint.activity.errors.some((item) => item.code === 'DUPLICATE_ACTION_LOOP'));
});

test('AgentLoop awaits adaptive repository and cited-memory context services before model routing', async (t) => {
  const f = await fixture(t, [{ text: 'done', toolCalls: [], usage: { totalTokens: 1 } }]);
  const repositoryIndex = {
    async index(project) { return { projectId: project.id, semantic: { phase: 'ready' } }; },
    async contextForTask() { return { items: [{ path: 'src/auth.mjs', sha256: 'a'.repeat(64), language: 'javascript', score: 10, text: 'export function authenticate() {}', truncated: false }], omissions: [] }; },
  };
  const memoryService = {
    async context() { return [{ id: 'memory:1', text: 'Use token validation.', sha256: 'b'.repeat(64), priority: 900, metadata: { status: 'active' } }]; },
  };
  const seen = [];
  const forge = {
    ...f.forge,
    async buildContextPack(input) {
      seen.push(input);
      return f.forge.buildContextPack(input);
    },
  };
  const loop = new AgentLoop({ forge, providers: f.providers, repositoryIndex, memoryService, broker: f.broker, store: f.store, contextBuilder: new ContextBuilder() });
  await loop.run(f.task, { providerId: 'fake-model', budgets: { maxTurns: 2, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(seen[0].code[0].metadata.path, 'src/auth.mjs');
  assert.equal(seen[0].memory[0].metadata.status, 'active');
});

test('AgentLoop dynamically discovers and loads rare authorized tool schemas before execution', async (t) => {
  const f = await fixture(t, []);
  await writeFile(path.join(f.root, 'remove-me.txt'), 'temporary');
  const { DynamicToolCatalog } = await import('../src/agent/dynamic-tool-catalog.mjs');
  const { CORE_TOOL_SCHEMAS } = await import('../src/agent/agent-loop.mjs');
  const catalog = new DynamicToolCatalog({ pinnedTools: ['fs.read'] });
  for (const schema of CORE_TOOL_SCHEMAS) catalog.register(schema, { source: 'core' });
  const task = f.store.updateTask(f.task.id, {
    metadata: { ...f.task.metadata, dynamicToolDiscovery: true, allowedToolNames: ['fs.read', 'fs.delete'] },
  });
  let turn = 0;
  f.providers.register({
    id: 'dynamic-tool-model',
    publicView: () => ({ id: 'dynamic-tool-model' }),
    async complete({ tools, messages }) {
      turn += 1;
      const names = tools.map((schema) => schema.function.name);
      if (turn === 1) {
        assert.deepEqual(names.sort(), ['fs.read', 'tool.catalog.load', 'tool.catalog.search']);
        return { text: '', toolCalls: [{ id: 'search', name: 'tool.catalog.search', arguments: { query: 'delete file' } }], usage: { totalTokens: 1 } };
      }
      if (turn === 2) {
        assert.match(messages.at(-1).content, /fs\.delete/);
        assert.equal(names.includes('fs.delete'), false);
        return { text: '', toolCalls: [{ id: 'load', name: 'tool.catalog.load', arguments: { name: 'fs.delete' } }], usage: { totalTokens: 1 } };
      }
      if (turn === 3) {
        assert.equal(names.includes('fs.delete'), true);
        return { text: '', toolCalls: [{ id: 'delete', name: 'fs.delete', arguments: { path: 'remove-me.txt' } }], usage: { totalTokens: 1 } };
      }
      assert.match(messages.at(-1).content, /receiptSha256|receipt_sha256/i);
      return { text: 'Rare tool loaded and executed.', toolCalls: [], usage: { totalTokens: 1 } };
    },
  });
  const loop = new AgentLoop({ forge: f.forge, providers: f.providers, dynamicToolCatalog: catalog, broker: f.broker, store: f.store, contextBuilder: new ContextBuilder() });
  const result = await loop.run(task, { providerId: 'dynamic-tool-model', budgets: { maxTurns: 4, maxToolCalls: 3, maxEstimatedTokens: 20, maxElapsedMs: 2_000 } });
  assert.equal(result.output, 'Rare tool loaded and executed.');
  assert.equal(result.receipts.length, 3);
  assert.ok(f.store.listEvents().some((event) => event.type === 'agent.tool-schema.loaded' && event.payload.tool === 'fs.delete'));
});

test('AgentLoop exposes governed adaptive-intelligence tools and routes them through receipts', async (t) => {
  const f = await fixture(t, []);
  const calls = [];
  const adaptiveIntelligenceGateway = {
    schemasForTask(task) {
      assert.equal(task.id, f.task.id);
      return [{ type: 'function', function: { name: 'repository.semanticSearch', description: 'Semantic search', parameters: { type: 'object', required: ['query'], properties: { query: { type: 'string' } } } } }];
    },
    async execute(task, name, args) {
      calls.push([task.id, name, args]);
      return { status: 'pass', output: { items: [{ path: 'src/auth.mjs' }] }, receipt: { receiptSha256: '6'.repeat(64) } };
    },
  };
  const responses = [
    { text: '', toolCalls: [{ id: 'adaptive-1', name: 'repository.semanticSearch', arguments: { query: 'login' } }], usage: { totalTokens: 1 } },
    { text: 'Found auth.', toolCalls: [], usage: { totalTokens: 1 } },
  ];
  f.providers.register({ id: 'adaptive-model', publicView: () => ({ id: 'adaptive-model' }), async complete({ tools, messages }) { assert.equal(tools.some((item) => item.function.name === 'repository.semanticSearch'), true); if (responses.length === 1) assert.match(messages.at(-1).content, /auth\.mjs/); return responses.shift(); } });
  const loop = new AgentLoop({ forge: f.forge, providers: f.providers, adaptiveIntelligenceGateway, broker: f.broker, store: f.store, contextBuilder: new ContextBuilder() });
  const result = await loop.run(f.task, { providerId: 'adaptive-model', budgets: { maxTurns: 2, maxToolCalls: 1, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.output, 'Found auth.');
  assert.deepEqual(calls, [[f.task.id, 'repository.semanticSearch', { query: 'login' }]]);
  assert.ok(f.store.listEvents().some((event) => event.type === 'agent.adaptive-intelligence.tools-authorized'));
});
