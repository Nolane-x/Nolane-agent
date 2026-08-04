import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentBehaviorRuntime } from '../src/native-core/agent-behavior-runtime.mjs';

test('agent behavior runtime removes hidden reasoning and creates deterministic public messages and titles', () => {
  const runtime = new AgentBehaviorRuntime({ maxMessageBytes: 256, titleMaxLength: 32, clock: () => 100 });
  const message = runtime.normalizeMessage({ id: 'm1', role: 'assistant', content: 'Result <think>private chain</think> done', reasoning: 'secret', portalTags: ['review', 'review', '  build  '], threadId: 't1' });
  assert.equal(message.content, 'Result  done');
  assert.deepEqual(message.portalTags, ['build', 'review']);
  assert.equal(JSON.stringify(message).includes('private chain'), false);
  assert.equal(JSON.stringify(message).includes('secret'), false);
  assert.equal(runtime.generateTitle([{ role: 'user', content: '  Fix **retry** handling in provider fallback please  ' }]), 'Fix retry handling in provider');
});

test('agent behavior runtime classifies errors, bounds one-shot execution and records independent review receipts', async () => {
  const runtime = new AgentBehaviorRuntime({ clock: (() => { let n = 10; return () => ++n; })() });
  assert.equal(runtime.classifyError(Object.assign(new Error('429 rate limit'), { statusCode: 429 })), 'rate_limit');
  assert.equal(runtime.classifyError(Object.assign(new Error('cancelled'), { code: 'ABORT_ERR' })), 'cancelled');
  await assert.rejects(() => runtime.runOneShot({ requestId: 'r1', input: { objective: 'hang' }, timeoutMs: 5, execute: ({ signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { code: 'ABORT_ERR' })), { once: true })) }), /timed out/i);
  const result = await runtime.runOneShot({ requestId: 'r2', input: { objective: 'done' }, execute: async () => ({ text: 'ok', hiddenReasoning: 'nope' }) });
  assert.deepEqual(result.output, { text: 'ok' });
  const review = await runtime.reviewEffects({ actorId: 'builder', reviewerId: 'reviewer', effects: [{ id: 'e1', observed: true, receiptSha256: 'a'.repeat(64) }], reviewer: async () => ({ accepted: true, evidenceIds: ['e1'], hiddenReasoning: 'remove' }) });
  assert.equal(review.accepted, true);
  assert.equal(JSON.stringify(review).includes('remove'), false);
  await assert.rejects(() => runtime.reviewEffects({ actorId: 'same', reviewerId: 'same', effects: [], reviewer: async () => ({ accepted: true }) }), /independent/i);
});

test('agent behavior runtime cleans replay events and chains thread-scoped outputs', () => {
  const runtime = new AgentBehaviorRuntime({ clock: () => 5 });
  const cleaned = runtime.cleanupReplay([
    { id: 'b', sequence: 2, type: 'tool', payload: { ok: true } },
    { id: 'a', sequence: 1, type: 'model', payload: { text: 'x' } },
    { id: 'a', sequence: 1, type: 'model', payload: { text: 'x' } },
    { id: 'orphan', sequence: 4, previousId: 'missing', type: 'tool', payload: {} },
  ]);
  assert.deepEqual(cleaned.events.map((event) => event.id), ['a', 'b']);
  assert.deepEqual(cleaned.dropped.map((entry) => entry.reason).sort(), ['duplicate', 'orphan']);
  const first = runtime.threadOutput({ threadId: 't1', type: 'progress', payload: { n: 1 } });
  const second = runtime.threadOutput({ threadId: 't1', type: 'progress', payload: { n: 2 } });
  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
  assert.equal(second.previousSha256, first.receiptSha256);
});
