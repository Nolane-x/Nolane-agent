import test from 'node:test';
import assert from 'node:assert/strict';

import { TurnStateMachine } from '../src/native-core/turn-state-machine.mjs';
import { RuntimeReceiptLedger } from '../src/native-core/runtime-receipt-ledger.mjs';
import { CancellationTree } from '../src/native-core/cancellation-tree.mjs';
import { ProviderRegistry } from '../src/nolane-native/provider-registry.mjs';
import { ToolRegistry } from '../src/nolane-native/tool-registry.mjs';
import { NolaneAgentLoop } from '../src/nolane-native/agent-loop.mjs';

const fixedClock = (() => { let now = 1000; return () => ++now; })();

test('turn state machine enforces lifecycle and independent model/tool/retry ceilings', () => {
  const machine = new TurnStateMachine({ missionId: 'm1', budgets: { maxModelTurns: 2, maxToolTurns: 1, maxRetries: 1 }, clock: fixedClock });
  machine.transition('planning');
  machine.transition('model');
  machine.consume('model');
  machine.transition('tool');
  machine.consume('tool');
  machine.transition('model');
  machine.consume('model');
  assert.throws(() => machine.consume('model'), /model.*budget/i);
  assert.throws(() => machine.consume('tool'), /tool.*budget/i);
  machine.consume('retry');
  assert.throws(() => machine.consume('retry'), /retry.*budget/i);
  machine.transition('verifying');
  machine.transition('completed');
  assert.equal(machine.snapshot().state, 'completed');
  assert.throws(() => machine.transition('model'), /illegal transition/i);
});

test('cancellation tree propagates parent cancellation exactly once and preserves reasons', () => {
  const tree = new CancellationTree({ clock: fixedClock });
  const root = tree.create({ id: 'root' });
  const child = tree.create({ id: 'child', parentId: root.id });
  const grandchild = tree.create({ id: 'grandchild', parentId: child.id });
  tree.cancel('root', 'user-stop');
  assert.equal(tree.signal('root').aborted, true);
  assert.equal(tree.signal('child').reason, 'user-stop');
  assert.equal(tree.signal('grandchild').reason, 'user-stop');
  const snapshot = tree.snapshot();
  assert.equal(snapshot.nodes.filter((entry) => entry.cancelled).length, 3);
  assert.equal(tree.cancel('root', 'second'), false);
  assert.throws(() => tree.create({ id: 'orphan', parentId: 'missing' }), /parent/i);
});

test('runtime receipt ledger is hash chained, immutable and recoverable after restart', () => {
  const ledger = new RuntimeReceiptLedger({ streamId: 'mission:m1', clock: fixedClock });
  ledger.append({ type: 'created', payload: { missionId: 'm1' } });
  ledger.append({ type: 'planning', payload: { objectiveHash: 'a'.repeat(64) } });
  const snapshot = ledger.snapshot();
  assert.equal(snapshot.events[0].sequence, 1);
  assert.equal(snapshot.events[1].previousSha256, snapshot.events[0].sha256);
  assert.equal(RuntimeReceiptLedger.verify(snapshot).valid, true);
  const restored = RuntimeReceiptLedger.restore(snapshot, { clock: fixedClock });
  restored.append({ type: 'resumed', payload: { afterCrash: true } });
  assert.equal(restored.snapshot().events[2].sequence, 3);
  const tampered = structuredClone(snapshot);
  tampered.events[0].payload.missionId = 'changed';
  assert.throws(() => RuntimeReceiptLedger.restore(tampered), /receipt chain|hash/i);
  assert.throws(() => { snapshot.events.push({}); }, /extensible|read only|object is not extensible/i);
});

test('production agent loop emits kernel lifecycle and cancels before provider invocation', async () => {
  const providers = new ProviderRegistry();
  let invocations = 0;
  providers.register({ id: 'p', priority: 1, capabilities: [], invoke: async () => { invocations += 1; return { type: 'final', answer: 'done' }; } });
  const tools = new ToolRegistry({ maxCalls: 1 });
  const controller = new AbortController();
  controller.abort('operator-cancelled');
  const loop = new NolaneAgentLoop({ providers, tools, verifier: async () => ({ verified: true }), clock: fixedClock });
  const cancelled = await loop.run({ missionId: 'cancelled', objective: 'Do not run', signal: controller.signal });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(invocations, 0);
  assert.equal(cancelled.kernel.state.state, 'cancelled');
  assert.equal(RuntimeReceiptLedger.verify(cancelled.kernel.receipts).valid, true);
});

test('production agent loop records model, tool, verification and completion in one receipt chain', async () => {
  const providers = new ProviderRegistry();
  let turn = 0;
  providers.register({ id: 'p', priority: 1, capabilities: ['tools'], invoke: async () => ++turn === 1
    ? { type: 'tool', tool: 'read', input: {}, expectedEffect: { ok: true }, tokens: 4 }
    : { type: 'final', answer: 'done', tokens: 3 } });
  const tools = new ToolRegistry({ maxCalls: 2 });
  tools.register({ name: 'read', capability: 'project:read', risk: 'low', reversible: true, execute: async () => ({ ok: true }) });
  const loop = new NolaneAgentLoop({ providers, tools, verifier: async () => ({ verified: true, evidenceIds: ['e1'] }), clock: fixedClock });
  const result = await loop.run({ missionId: 'm2', objective: 'Complete', requiredCapabilities: ['tools'], grantedCapabilities: ['project:read'], budgets: { maxModelTurns: 3, maxToolTurns: 2, maxRetries: 1, maxTurns: 5 } });
  assert.equal(result.status, 'completed');
  assert.equal(result.kernel.state.state, 'completed');
  assert.equal(result.kernel.state.counters.model, 2);
  assert.equal(result.kernel.state.counters.tool, 1);
  assert.deepEqual(result.kernel.receipts.events.map((entry) => entry.type), ['state-transition', 'state-transition', 'budget-consumed', 'state-transition', 'budget-consumed', 'tool-effect', 'state-transition', 'budget-consumed', 'state-transition', 'verification', 'state-transition']);
  assert.equal(RuntimeReceiptLedger.verify(result.kernel.receipts).valid, true);
});

test('native runtime service exposes a verifiable lifecycle receipt across start and stop', async () => {
  const { NolaneNativeRuntimeService } = await import('../src/nolane-native/runtime-service.mjs');
  const service = new NolaneNativeRuntimeService({ projectRoot: process.cwd(), clock: fixedClock });
  await service.start();
  await service.ping();
  await service.stop();
  const status = service.status();
  assert.equal(status.status, 'stopped');
  assert.equal(RuntimeReceiptLedger.verify(status.lifecycleReceipt).valid, true);
  assert.deepEqual(status.lifecycleReceipt.events.map((entry) => entry.type), ['preflight', 'starting', 'handshake', 'running', 'ping', 'stopping', 'stopped']);
});
