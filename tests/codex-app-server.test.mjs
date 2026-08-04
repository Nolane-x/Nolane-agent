import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CodexAppServerClient, isRetryableCodexError } from '../src/providers/codex-app-server.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(root, 'fixtures', 'codex-app-server.mjs');

function client(overrides = {}) {
  return new CodexAppServerClient({ executable: process.execPath, args: [fixture], timeoutMs: 1_000, approvalHandler: async (request) => ({ decision: request.command?.[0] === 'git' ? 'accept' : 'decline' }), ...overrides });
}

test('CodexAppServerClient sends the thread sandbox enum and turn sandboxPolicy object', async (t) => {
  const codex = client();
  t.after(() => codex.close());
  const initialized = await codex.connect();
  assert.equal(initialized.userAgent, 'fixture');
  const account = await codex.accountRead();
  assert.equal(account.account.planType, 'plus');
  const defaultThread = await codex.startThread({ cwd: process.cwd(), ephemeral: true });
  const thread = await codex.startThread({ cwd: process.cwd(), ephemeral: true, sandboxPolicy: { type: 'readOnly' } });
  assert.notEqual(defaultThread.id, thread.id);
  const result = await codex.startTurn({ threadId: thread.id, input: 'Inspect this repository', cwd: process.cwd() });
  assert.equal(result.status, 'completed');
  assert.equal(result.text, 'fixture answer');
  assert.equal(result.usage.totalTokens, 16);
  assert.deepEqual(result.approvals.map((item) => item.decision), ['accept']);
});

test('CodexAppServerClient complete() preserves method-specific sandbox shapes and retry classification', async (t) => {
  const codex = client();
  t.after(() => codex.close());
  const resumed = await codex.resumeThread('thr_saved');
  assert.equal(resumed.id, 'thr_saved');
  const completed = await codex.complete({ messages: [{ role: 'user', content: 'Plan safely' }] });
  assert.equal(completed.providerId, 'codex-app-server');
  assert.equal(completed.text, 'fixture answer');
  assert.equal(completed.finishReason, 'stop');
  await codex.interrupt(completed.raw.threadId, completed.raw.turnId);
  assert.equal(isRetryableCodexError(Object.assign(new Error('overloaded'), { code: -32001 })), true);
  assert.equal(isRetryableCodexError(Object.assign(new Error('bad request'), { code: -32602 })), false);
});

test('CodexAppServerClient translates Forge action envelopes into governed tool calls', async (t) => {
  const codex = client();
  t.after(() => codex.close());
  const completed = await codex.complete({
    messages: [{ role: 'user', content: 'Read README through ForgeOS.' }],
    tools: [{ type: 'function', function: { name: 'fs.read', description: 'Read file', parameters: { type: 'object' } } }],
  });
  assert.match(completed.raw.prompt, /FORGE_ACTION_PROTOCOL/);
  assert.equal(completed.text, 'Need README.');
  assert.deepEqual(completed.toolCalls, [{ id: 'codex_read', name: 'fs.read', arguments: { path: 'README.md' }, rawArguments: '{"path":"README.md"}' }]);
});

test('CodexAppServerClient exposes documented account login, cancel, and logout RPCs', async (t) => {
  const codex = client();
  t.after(() => codex.close());
  const browser = await codex.loginStart({ type: 'chatgpt' });
  assert.equal(browser.type, 'chatgpt');
  assert.match(browser.authUrl, /^https:\/\//);
  const api = await codex.loginStart({ type: 'apiKey', apiKey: 'sk-test-only' });
  assert.equal(api.type, 'apiKey');
  await codex.loginCancel(browser.loginId);
  await codex.logout();
  const account = await codex.accountRead();
  assert.equal(account.account, null);
});
