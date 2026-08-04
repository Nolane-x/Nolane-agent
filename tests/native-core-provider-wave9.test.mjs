import test from 'node:test';
import assert from 'node:assert/strict';
import { ProviderTransportRuntimeWave9, ProviderError } from '../src/native-core/provider-transport-runtime-wave9.mjs';

const protocols = ['openai-responses', 'openai-chat', 'anthropic-messages', 'gemini-native', 'bedrock-messages', 'azure-openai', 'codex-app-server', 'local-openai', 'mcp-tools-server', 'proxy-source'];

test('wave9 registers all native protocol families and normalizes streaming text, tools and usage', async () => {
  const runtime = new ProviderTransportRuntimeWave9();
  for (const protocol of protocols) runtime.register({ id: protocol, protocol, credentialRefs: ['vault://one'], transport: async ({ emit }) => {
    emit({ type: 'text-delta', delta: 'hello ' });
    emit({ type: 'text-delta', delta: protocol });
    emit({ type: 'tool-call-delta', id: 'c1', name: 'read', delta: '{"path":' });
    emit({ type: 'tool-call-delta', id: 'c1', delta: '"a.js"}' });
    emit({ type: 'usage', usage: { inputTokens: 3, outputTokens: 5, costUsd: 0.01 } });
  } });
  const result = await runtime.complete({ providerId: 'bedrock-messages', messages: [{ role: 'user', content: 'hi' }], tools: [{ name: 'read' }] });
  assert.equal(result.text, 'hello bedrock-messages');
  assert.deepEqual(result.toolCalls[0].arguments, { path: 'a.js' });
  assert.deepEqual(result.usage, { inputTokens: 3, outputTokens: 5, costUsd: 0.01 });
  assert.equal(result.events, 5);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('credential pool rotates only on retryable errors and never exposes credential references', async () => {
  const runtime = new ProviderTransportRuntimeWave9({ maxAttempts: 3 });
  const seen = [];
  runtime.register({ id: 'p', protocol: 'openai-responses', credentialRefs: ['vault://a', 'vault://b'], transport: async ({ credentialRef, emit }) => {
    seen.push(credentialRef);
    if (credentialRef === 'vault://a') throw new ProviderError('rate limited', { code: 'RATE_LIMITED', retryable: true, retryAfterMs: 1 });
    emit({ type: 'text-delta', delta: 'ok' });
  } });
  const result = await runtime.complete({ providerId: 'p', messages: [] });
  assert.deepEqual(seen, ['vault://a', 'vault://b']);
  assert.equal(result.text, 'ok');
  assert.equal(JSON.stringify(result).includes('vault://'), false);
});

test('non-retryable provider errors fail immediately with structured taxonomy', async () => {
  const runtime = new ProviderTransportRuntimeWave9({ maxAttempts: 3 });
  let calls = 0;
  runtime.register({ id: 'p', protocol: 'anthropic-messages', transport: async () => { calls += 1; throw new ProviderError('bad auth', { code: 'AUTH_FAILED', retryable: false }); } });
  await assert.rejects(() => runtime.complete({ providerId: 'p', messages: [] }), (error) => error.code === 'AUTH_FAILED' && error.retryable === false);
  assert.equal(calls, 1);
});

test('disconnect is retryable, cancellation is propagated and invalid tool JSON fails closed', async () => {
  const runtime = new ProviderTransportRuntimeWave9({ maxAttempts: 2 });
  let attempt = 0;
  runtime.register({ id: 'reconnect', protocol: 'codex-app-server', transport: async ({ emit }) => {
    attempt += 1;
    if (attempt === 1) throw new ProviderError('disconnect', { code: 'DISCONNECTED', retryable: true });
    emit({ type: 'text-delta', delta: 'reconnected' });
  } });
  assert.equal((await runtime.complete({ providerId: 'reconnect', messages: [] })).text, 'reconnected');

  const controller = new AbortController(); controller.abort('stop');
  await assert.rejects(() => runtime.complete({ providerId: 'reconnect', messages: [], signal: controller.signal }), (error) => error.code === 'ABORT_ERR');

  runtime.register({ id: 'bad-tool', protocol: 'mcp-tools-server', transport: async ({ emit }) => emit({ type: 'tool-call-delta', id: 'c', name: 'x', delta: '{bad' }) });
  await assert.rejects(() => runtime.complete({ providerId: 'bad-tool', messages: [] }), (error) => error.code === 'INVALID_TOOL_ARGUMENTS');
});

test('schema compatibility downgrades unsupported fields without mutating source messages', async () => {
  const runtime = new ProviderTransportRuntimeWave9();
  let request;
  runtime.register({ id: 'proxy', protocol: 'proxy-source', schemaVersion: 1, transport: async (input) => { request = input.request; input.emit({ type: 'text-delta', delta: 'ok' }); } });
  const messages = [{ role: 'user', content: [{ type: 'text', text: 'hello' }], unsupported: true }];
  await runtime.complete({ providerId: 'proxy', messages, responseSchema: { type: 'object' }, reasoning: { effort: 'high' } });
  assert.equal(request.responseSchema, undefined);
  assert.equal(request.reasoning, undefined);
  assert.deepEqual(messages, [{ role: 'user', content: [{ type: 'text', text: 'hello' }], unsupported: true }]);
});
