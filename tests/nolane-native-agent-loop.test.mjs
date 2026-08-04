import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAgentState, STOP_REASONS } from '../src/nolane-native/agent-state.mjs';
import { ProviderRegistry, RetryableProviderError } from '../src/nolane-native/provider-registry.mjs';
import { ToolRegistry } from '../src/nolane-native/tool-registry.mjs';
import { NolaneAgentLoop } from '../src/nolane-native/agent-loop.mjs';

test('typed agent state enforces lifecycle transitions and objective stop conditions', () => {
  const state = createAgentState({ missionId: 'm1', objective: 'Fix tests', criteria: ['tests-pass'], budgets: { maxTurns: 2, maxTokens: 100, maxWallMs: 1000 }, startedAt: 10 });
  state.transition('planning'); state.transition('executing');
  state.recordTurn({ tokens: 40, progress: true, at: 20 });
  assert.equal(state.shouldStop({ now: 21 }), null);
  state.recordTurn({ tokens: 61, progress: false, at: 30 });
  assert.equal(state.shouldStop({ now: 31 }), STOP_REASONS.TOKEN_BUDGET);
  assert.throws(() => state.transition('draft'), /illegal transition/i);
});

test('provider registry selects capability-compatible providers and only falls back on retryable failures', async () => {
  const registry = new ProviderRegistry(); const calls = [];
  registry.register({ id: 'local-small', priority: 1, capabilities: ['tools'], invoke: async (request) => { calls.push(['small', request.stateCapsule]); throw new RetryableProviderError('busy'); } });
  registry.register({ id: 'local-large', priority: 2, capabilities: ['tools','vision'], invoke: async (request) => { calls.push(['large', request.stateCapsule]); return { type: 'final', answer: 'done' }; } });
  const result = await registry.invoke({ requiredCapabilities: ['tools'], stateCapsule: { turn: 3 }, payload: {} });
  assert.equal(result.providerId, 'local-large');
  assert.deepEqual(calls.map((entry) => entry[1]), [{ turn: 3 }, { turn: 3 }]);
  registry.register({ id: 'broken', priority: 0, capabilities: ['secure'], invoke: async () => { throw new Error('auth failed'); } });
  await assert.rejects(() => registry.invoke({ requiredCapabilities: ['secure'], stateCapsule: {}, payload: {} }), /auth failed/);
});

test('tool registry enforces capability, approval and per-action budgets', async () => {
  const tools = new ToolRegistry({ maxCalls: 2 });
  tools.register({ name: 'read-file', capability: 'project:read', risk: 'low', reversible: true, execute: async ({ path }) => ({ path, content: 'ok' }) });
  tools.register({ name: 'delete-file', capability: 'project:write', risk: 'high', reversible: false, execute: async () => ({ deleted: true }) });
  const context = { grantedCapabilities: ['project:read','project:write'], approvals: [] };
  assert.equal((await tools.execute('read-file', { path: 'a' }, context)).output.content, 'ok');
  await assert.rejects(() => tools.execute('delete-file', {}, context), /approval required/i);
  await tools.execute('delete-file', {}, { ...context, approvals: ['delete-file'] });
  await assert.rejects(() => tools.execute('read-file', { path: 'b' }, context), /tool call budget/i);
});

test('Nolane agent loop binds expected effects, verification and SHA-256 receipts', async () => {
  const providers = new ProviderRegistry(); let turn = 0;
  providers.register({ id: 'p1', priority: 1, capabilities: ['tools'], invoke: async () => ++turn === 1 ? { type: 'tool', tool: 'write', input: { path: 'a', content: 'fixed' }, expectedEffect: { path: 'a', sha256: 'a'.repeat(64) } } : { type: 'final', answer: 'Fixed', criteria: ['tests-pass'] } });
  const tools = new ToolRegistry({ maxCalls: 3 });
  tools.register({ name: 'write', capability: 'project:write', risk: 'medium', reversible: true, execute: async (input) => ({ ...input, sha256: 'a'.repeat(64) }) });
  const traces = [];
  const loop = new NolaneAgentLoop({ providers, tools, verifier: async ({ criteria }) => ({ verified: criteria.includes('tests-pass'), evidenceIds: ['test-1'] }), traceSink: (event) => traces.push(event), clock: () => 100 });
  const result = await loop.run({ missionId: 'm1', objective: 'Fix', criteria: ['tests-pass'], requiredCapabilities: ['tools'], grantedCapabilities: ['project:write'], budgets: { maxTurns: 5, maxTokens: 1000, maxWallMs: 1000 } });
  assert.equal(result.status, 'completed');
  assert.equal(result.verification.verified, true);
  assert.match(result.receipt.sha256, /^[a-f0-9]{64}$/);
  assert.equal(traces.some((item) => item.type === 'tool-effect' && item.effectMatched === true), true);
});

test('Nolane native loop source does not import NolaneNative runtime code', async () => {
  for (const file of ['src/nolane-native/agent-loop.mjs','src/nolane-native/agent-state.mjs','src/nolane-native/provider-registry.mjs','src/nolane-native/tool-registry.mjs']) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /from\s+['"][^'"]*nolane_native|import\(['"][^'"]*nolane_native/i);
  }
});
