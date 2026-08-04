import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { OpenAICompatibleProvider } from '../src/providers/openai-compatible.mjs';
import { BudgetExceededError, RunBudget } from '../src/agent/budget.mjs';
import { repairToolArguments, sanitizeMessages } from '../src/agent/message-sanitization.mjs';

async function fakeModel(t, handler) {
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    await handler(req, res, body ? JSON.parse(body) : null);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  return `http://127.0.0.1:${address.port}/v1`;
}

test('OpenAICompatibleProvider returns text, normalized tool calls, and usage', async (t) => {
  const baseUrl = await fakeModel(t, (req, res, body) => {
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.headers.authorization, 'Bearer local-secret');
    assert.equal(body.model, 'forge-test');
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: 'I will inspect it.', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'fs.read', arguments: "{'path':'README.md',}" } }] }, finish_reason: 'tool_calls' }],
      usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
    }));
  });
  const provider = new OpenAICompatibleProvider({ id: 'local', baseUrl, apiKey: 'local-secret', model: 'forge-test' });
  const result = await provider.complete({ messages: [{ role: 'user', content: 'Inspect' }], tools: [{ type: 'function', function: { name: 'fs.read', parameters: { type: 'object' } } }] });
  assert.equal(result.text, 'I will inspect it.');
  assert.deepEqual(result.toolCalls[0], { id: 'call_1', name: 'fs.read', arguments: { path: 'README.md' }, rawArguments: "{'path':'README.md',}" });
  assert.equal(result.usage.totalTokens, 19);
});

test('OpenAICompatibleProvider rejects HTTP errors and times out', async (t) => {
  const errorUrl = await fakeModel(t, (_req, res) => { res.statusCode = 429; res.end('{"error":{"message":"rate limited"}}'); });
  const provider = new OpenAICompatibleProvider({ id: 'error', baseUrl: errorUrl, model: 'x', timeoutMs: 100 });
  await assert.rejects(() => provider.complete({ messages: [] }), /429.*rate limited/i);

  const slowUrl = await fakeModel(t, async (_req, res) => { await new Promise((resolve) => setTimeout(resolve, 200)); res.end('{}'); });
  const slow = new OpenAICompatibleProvider({ id: 'slow', baseUrl: slowUrl, model: 'x', timeoutMs: 20 });
  await assert.rejects(() => slow.complete({ messages: [] }), /timed out/i);
});

test('message sanitation repairs malformed tool JSON and isolated surrogates', () => {
  assert.deepEqual(repairToolArguments('```json\n{"a":1,}\n```'), { a: 1 });
  assert.deepEqual(repairToolArguments("{'path':'a.txt','count':2}"), { path: 'a.txt', count: 2 });
  const sanitized = sanitizeMessages([{ role: 'user', content: `bad\uD800text`, metadata: { note: `x\uDC00y` } }]);
  assert.equal(sanitized[0].content, 'bad�text');
  assert.equal(sanitized[0].metadata.note, 'x�y');
});

test('RunBudget enforces hard turn, tool, token, elapsed, and cancellation limits', async () => {
  const budget = new RunBudget({ maxTurns: 1, maxToolCalls: 2, maxEstimatedTokens: 10, maxElapsedMs: 30 });
  budget.consumeTurn();
  budget.consumeToolCalls(2);
  budget.consumeTokens(10);
  assert.throws(() => budget.consumeTurn(), BudgetExceededError);
  assert.throws(() => budget.consumeToolCalls(1), /tool-call/i);
  assert.throws(() => budget.consumeTokens(1), /token/i);
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.throws(() => budget.assertActive(), /elapsed/i);

  const controller = new AbortController();
  const cancelled = new RunBudget({ signal: controller.signal });
  controller.abort();
  assert.throws(() => cancelled.assertActive(), /cancelled/i);
});
