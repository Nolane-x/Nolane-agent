import test from 'node:test';
import assert from 'node:assert/strict';
import { AcpStreamingRuntime } from '../src/native-core/acp-streaming-runtime.mjs';
import { ProviderProtocolRuntime } from '../src/native-core/provider-protocol-runtime.mjs';
import { RepositoryIntelligenceFabric } from '../src/native-core/repository-intelligence-fabric.mjs';
import { DelegationContextRuntime } from '../src/native-core/delegation-context-runtime.mjs';

test('ACP runtime validates JSON-RPC, orders events, deduplicates requests and supports cancellation', async () => {
  const calls = [];
  const runtime = new AcpStreamingRuntime({
    handlers: {
      'session/run': async ({ params, emit, signal }) => {
        calls.push(params.objective);
        emit('progress', { percent: 10 });
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 10);
          signal.addEventListener('abort', () => { clearTimeout(timer); reject(Object.assign(new Error('cancelled'), { code: 'ABORT_ERR' })); }, { once: true });
        });
        emit('progress', { percent: 100 });
        return { ok: true };
      },
    },
  });
  await assert.rejects(() => runtime.handle({ jsonrpc: '1.0', id: 1, method: 'session/run' }), /JSON-RPC 2.0/);
  const first = await runtime.handle({ jsonrpc: '2.0', id: 'r1', method: 'session/run', params: { objective: 'ship' } });
  const duplicate = await runtime.handle({ jsonrpc: '2.0', id: 'r1', method: 'session/run', params: { objective: 'ignored' } });
  assert.deepEqual(first.response.result, { ok: true });
  assert.equal(duplicate.replayed, true);
  assert.deepEqual(calls, ['ship']);
  assert.deepEqual(first.events.map((event) => event.sequence), [1, 2]);
  assert.equal(first.events[1].previousSha256, first.events[0].receiptSha256);
  const pending = runtime.handle({ jsonrpc: '2.0', id: 'r2', method: 'session/run', params: { objective: 'cancel' } });
  await new Promise((resolve) => setTimeout(resolve, 1));
  const cancelled = runtime.cancel('r2', 'user');
  assert.equal(cancelled.cancelled, true);
  const outcome = await pending;
  assert.equal(outcome.response.error.code, -32800);
  assert.equal(runtime.snapshot().active, 0);
});

test('provider protocol runtime normalizes messages, assembles streamed tool calls and never exposes credentials', async () => {
  const runtime = new ProviderProtocolRuntime();
  runtime.register({ id: 'openai-main', protocol: 'openai-responses', credentialRef: 'vault:openai', transport: async ({ request, emit }) => {
    assert.equal(request.input[0].role, 'user');
    emit({ type: 'response.output_text.delta', delta: 'hello ' });
    emit({ type: 'response.function_call_arguments.delta', callId: 'c1', name: 'search', delta: '{"q":' });
    emit({ type: 'response.function_call_arguments.delta', callId: 'c1', name: 'search', delta: '"repo"}' });
    emit({ type: 'response.completed', usage: { inputTokens: 3, outputTokens: 4 } });
  } });
  const result = await runtime.complete({ providerId: 'openai-main', messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(result.text, 'hello ');
  assert.deepEqual(result.toolCalls, [{ id: 'c1', name: 'search', arguments: { q: 'repo' } }]);
  assert.deepEqual(result.usage, { inputTokens: 3, outputTokens: 4 });
  assert.equal(JSON.stringify(result).includes('vault:openai'), false);
  assert.throws(() => runtime.register({ id: 'bad', protocol: 'unknown', transport: async () => {} }), /unsupported provider protocol/);
});

test('repository intelligence fabric combines bounded search, safe hints, LSP and file-sync receipts', async () => {
  const fabric = new RepositoryIntelligenceFabric({
    search: async ({ query, limit }) => [{ path: 'src/a.mjs', line: 2, preview: query, score: 0.9 }].slice(0, limit),
    codeIntelligence: { workspaceSymbols: async () => ({ source: 'lsp', items: [{ name: 'Alpha', path: 'src/a.mjs' }] }) },
  });
  const result = await fabric.search({ query: 'Alpha', limit: 10, workspaceRoot: '/repo', hints: ['src', '../escape', '.git', 'tests'] });
  assert.deepEqual(result.hints, ['src', 'tests']);
  assert.equal(result.results.length, 1);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  const symbols = await fabric.symbols({ projectRoot: '/repo', languageId: 'javascript', query: 'Al' });
  assert.equal(symbols.items[0].name, 'Alpha');
  const sync = fabric.planFileSync({ sourceRoot: '/repo', targetRoot: '/tmp/mirror', files: ['src/a.mjs', '../secret', '.env', 'tests/a.test.mjs'] });
  assert.deepEqual(sync.files, ['src/a.mjs', 'tests/a.test.mjs']);
  assert.equal(sync.rejected.length, 2);
});

test('delegation context runtime limits child context and records omissions without hidden reasoning', () => {
  const runtime = new DelegationContextRuntime({ maxBytes: 180 });
  const result = runtime.build({ objective: 'Review security', parentSummary: 'A'.repeat(200), files: ['src/a.mjs', '.env', 'tests/a.test.mjs'], evidence: [{ id: 'e1', summary: 'verified' }], hiddenReasoning: 'secret chain' });
  assert.equal(result.objective, 'Review security');
  assert.deepEqual(result.files, ['src/a.mjs', 'tests/a.test.mjs']);
  assert.equal(JSON.stringify(result).includes('secret chain'), false);
  assert.ok(result.omissions.length > 0);
  assert.ok(result.byteLength <= 180);
});
