import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CodexAppServerClient, isRetryableCodexError } from '../src/providers/codex-app-server.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(root, 'fixtures', 'codex-app-server.mjs');

function client(overrides = {}) {
  return new CodexAppServerClient({ executable: process.execPath, args: [fixture], timeoutMs: 5_000, approvalHandler: async (request) => ({ decision: request.command?.[0] === 'git' ? 'accept' : 'decline' }), ...overrides });
}

test('CodexAppServerClient does not pass undeclared parent variables to its app-server child', async (t) => {
  const inheritedName = 'NOLANE_TEST_PARENT_SECRET';
  const grantedName = 'NOLANE_TEST_CODEX_GRANTED';
  const previous = process.env[inheritedName];
  process.env[inheritedName] = 'parent-only';
  t.after(() => {
    if (previous === undefined) delete process.env[inheritedName];
    else process.env[inheritedName] = previous;
  });

  const codex = client({ env: { [grantedName]: 'granted-only' } });
  t.after(() => codex.close());
  await codex.connect();
  const result = await codex.rpc.request('test/environment', { names: [inheritedName, grantedName] });

  assert.deepEqual(result.present, { [inheritedName]: false, [grantedName]: true });
});

test('CodexAppServerClient detection does not pass undeclared parent variables to its probe child', async (t) => {
  const inheritedName = 'NOLANE_TEST_PARENT_SECRET';
  const previous = process.env[inheritedName];
  process.env[inheritedName] = 'parent-only';
  t.after(() => {
    if (previous === undefined) delete process.env[inheritedName];
    else process.env[inheritedName] = previous;
  });

  const detected = await client({ detectArgs: [fixture, '--environment-probe'] }).detect();

  assert.equal(detected.available, true);
  assert.match(detected.versionOutput, /secret-absent/);
});

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

test('CodexAppServerClient forwards a documented per-turn reasoning effort', async (t) => {
  const codex = client();
  t.after(() => codex.close());
  const thread = await codex.startThread({ cwd: process.cwd(), ephemeral: true });
  const result = await codex.startTurn({ threadId: thread.id, input: 'verify high effort', model: 'gpt-5.6-codex', effort: 'high' });
  assert.equal(result.status, 'completed');
});

test('CodexAppServerClient binds a full-access policy to one logical session and approval request', async (t) => {
  const approvals = [];
  const codex = client({
    approvalHandler: async (request) => {
      approvals.push(request.executionPolicy ?? null);
      return { decision: request.executionPolicy?.automaticApproval === true ? 'accept' : 'decline' };
    },
  });
  t.after(() => codex.close());
  const executionPolicy = {
    modeId: 'deep',
    sandboxPolicy: { type: 'dangerFullAccess' },
    automaticApproval: true,
  };

  const session = await codex.openSession({ scope: { cwd: process.cwd(), codexAppServerExecutionPolicy: executionPolicy } });
  await codex.completeInSession(session, { messages: [{ role: 'user', content: 'Write a local file' }] });
  const observed = await codex.rpc.request('test/calls', {});

  assert.deepEqual(session.executionPolicy, executionPolicy);
  assert.deepEqual(approvals, [executionPolicy]);
  assert.deepEqual(observed.calls.map((call) => call.sandbox ?? call.sandboxPolicy?.type), ['danger-full-access', 'dangerFullAccess']);
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

test('CodexAppServerClient complete() preserves the selected project working directory', async (t) => {
  const codex = client();
  t.after(() => codex.close());
  const calls = [];
  codex.startThread = async (request) => { calls.push(['thread', request]); return { id: 'thr_project' }; };
  codex.completeInSession = async (session, request) => { calls.push(['turn', session, request]); return { providerId: 'codex-app-server', text: 'fixture answer' }; };

  const cwd = path.join(process.cwd(), 'project-root');
  await codex.complete({ cwd, messages: [{ role: 'user', content: 'Work here.' }] });

  assert.equal(calls[0][1].cwd, cwd);
  assert.equal(calls[1][1].cwd, cwd);
});

test('CodexAppServerClient marks opaque app-server failures as provider failures', async (t) => {
  const codex = client();
  t.after(() => codex.close());
  codex.startTurn = async () => { throw new Error('JSON-RPC request timed out: turn/start'); };

  await assert.rejects(
    () => codex.completeInSession({ id: 'thr_timeout' }, { messages: [{ role: 'user', content: 'Plan safely' }] }),
    (error) => error?.code === 'PROVIDER_EXECUTION_FAILED' && error?.message === 'Codex app server execution failed' && /JSON-RPC request timed out/.test(String(error?.cause?.message)),
  );
});

test('CodexAppServerClient imports the app-server model catalog without inventing capabilities', async (t) => {
  const codex = client();
  t.after(() => codex.close());

  const catalog = await codex.listModels();

  assert.equal(catalog.status, 'fresh');
  assert.equal(catalog.models.length, 1);
  assert.deepEqual(catalog.models[0], {
    id: 'gpt-5.6-codex',
    displayName: 'GPT-5.6 Codex',
    discoveredAt: catalog.observedAt,
    metadata: {
      source: 'codex-app-server',
      hidden: false,
      defaultReasoningEffort: 'medium',
      supportedReasoningEfforts: ['low', 'medium', 'high'],
      additionalSpeedTiers: ['standard', 'fast'],
      serviceTiers: ['default', 'flex'],
      defaultServiceTier: 'default',
      modelSpecialty: 'coding',
      multiAgentVersion: null,
      upgrade: null,
      upgradeInfo: null,
      availabilityNux: null,
    },
  });
  assert.equal(catalog.models[0].capabilities, undefined);
});
