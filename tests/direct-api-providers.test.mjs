import test from 'node:test';
import assert from 'node:assert/strict';

import { OpenAIResponsesProvider } from '../src/providers/openai-responses.mjs';
import { AnthropicMessagesProvider } from '../src/providers/anthropic-messages.mjs';
import { GeminiGenerateContentProvider } from '../src/providers/gemini-generate-content.mjs';

const tool = { type: 'function', function: { name: 'fs_read', description: 'Read one file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } };

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

test('OpenAI Responses provider resolves a vault key and normalizes text, function calls, and usage', async () => {
  let request;
  const provider = new OpenAIResponsesProvider({
    id: 'openai-main', model: 'gpt-5', credentialRef: { service: 'forge.provider.openai-main', account: 'default' },
    credentialResolver: async () => 'sk-openai-secret',
    fetchImpl: async (url, init) => { request = { url, init }; return response({ id: 'resp_1', model: 'gpt-5', output: [
      { type: 'message', content: [{ type: 'output_text', text: 'I will inspect it.' }] },
      { type: 'function_call', call_id: 'call_1', name: 'fs_read', arguments: '{"path":"src/app.mjs"}' },
    ], usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 }, status: 'completed' }); },
  });
  const result = await provider.complete({ messages: [{ role: 'user', content: 'Inspect the app' }], tools: [tool] });
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.init.headers.authorization, 'Bearer sk-openai-secret');
  assert.equal(JSON.parse(request.init.body).store, false);
  assert.equal(result.text, 'I will inspect it.');
  assert.deepEqual(result.toolCalls[0].arguments, { path: 'src/app.mjs' });
  assert.equal(result.usage.totalTokens, 18);
  assert.equal(provider.publicView().credentialRef, undefined);
});

test('Anthropic Messages provider normalizes tool_use and never leaks a rejected key', async () => {
  const provider = new AnthropicMessagesProvider({
    id: 'anthropic-main', model: 'claude-sonnet-4-5', credentialRef: { service: 'forge.provider.anthropic-main', account: 'default' },
    credentialResolver: async () => 'sk-ant-private',
    fetchImpl: async (_url, init) => response({ id: 'msg_1', model: 'claude-sonnet-4-5', content: [
      { type: 'text', text: 'Checking.' }, { type: 'tool_use', id: 'toolu_1', name: 'fs_read', input: { path: 'README.md' } },
    ], usage: { input_tokens: 8, output_tokens: 5 }, stop_reason: 'tool_use' }),
  });
  const result = await provider.complete({ messages: [{ role: 'system', content: 'Be precise' }, { role: 'user', content: 'Read it' }], tools: [tool] });
  assert.equal(result.text, 'Checking.');
  assert.equal(result.toolCalls[0].name, 'fs_read');
  assert.equal(result.usage.totalTokens, 13);

  const failing = new AnthropicMessagesProvider({ id: 'bad', model: 'claude-sonnet-4-5', apiKey: 'sk-ant-private', fetchImpl: async () => { throw new Error('network rejected sk-ant-private'); } });
  await assert.rejects(() => failing.complete({ messages: [{ role: 'user', content: 'x' }] }), (error) => !String(error.message).includes('sk-ant-private'));
});

test('Gemini GenerateContent provider normalizes functionCall and usage metadata', async () => {
  let body;
  const provider = new GeminiGenerateContentProvider({
    id: 'gemini-main', model: 'gemini-3.6-flash', credentialRef: { service: 'forge.provider.gemini-main', account: 'default' },
    credentialResolver: async () => 'gemini-private',
    fetchImpl: async (_url, init) => { body = JSON.parse(init.body); return response({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [
      { text: 'I found it.' }, { functionCall: { name: 'fs_read', args: { path: 'package.json' } } },
    ] } }], usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 6, totalTokenCount: 15 }, modelVersion: 'gemini-3.6-flash' }); },
  });
  const result = await provider.complete({ messages: [{ role: 'system', content: 'Stay bounded' }, { role: 'user', content: 'Inspect package' }], tools: [tool] });
  assert.equal(result.text, 'I found it.');
  assert.deepEqual(result.toolCalls[0].arguments, { path: 'package.json' });
  assert.equal(result.usage.totalTokens, 15);
  assert.equal(body.tools[0].functionDeclarations[0].name, 'fs_read');
  assert.match(body.systemInstruction.parts[0].text, /Stay bounded/);
});

test('Direct API providers expose stable setup and execution errors without returning credentials', async () => {
  const missingCredential = new OpenAIResponsesProvider({ id: 'missing', model: 'gpt-5' });
  await assert.rejects(
    () => missingCredential.complete({ messages: [{ role: 'user', content: 'x' }] }),
    (error) => error?.code === 'PROVIDER_SETUP_REQUIRED' && error?.message === 'Provider credential is unavailable',
  );

  const failedRequest = new AnthropicMessagesProvider({
    id: 'failed-request', model: 'claude-sonnet-4-5', apiKey: 'sk-ant-private',
    fetchImpl: async () => { throw new Error('network rejected sk-ant-private'); },
  });
  await assert.rejects(
    () => failedRequest.complete({ messages: [{ role: 'user', content: 'x' }] }),
    (error) => error?.code === 'PROVIDER_EXECUTION_FAILED' && error?.message === 'Provider request failed' && !String(error.message).includes('sk-ant-private'),
  );
});
