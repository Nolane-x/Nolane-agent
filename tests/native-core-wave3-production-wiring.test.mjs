import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneNativeOrchestrationService } from '../src/nolane-native/orchestration-service.mjs';
import { createRoutes } from '../src/server/routes.mjs';

async function serviceFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave3-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const browser = {
    open: async ({ url }) => ({ url, opened: true }),
    snapshot: async () => ({ text: 'ready', nodes: [] }),
    click: async ({ target }) => ({ target, clicked: true }),
  };
  const service = new NolaneNativeOrchestrationService({ dataDir: root, clock: (() => { let n = 0; return () => ++n; })(), usagePricing: { local: { inputPerMillion: 1, outputPerMillion: 1 } } });
  service.attachRuntimeWave3({
    browser,
    approval: async () => ({ approved: true, approver: 'user' }),
    repositorySearch: async ({ query }) => [{ path: 'src/app.mjs', line: 1, preview: query, score: 1 }],
    codeIntelligence: { workspaceSymbols: async () => ({ source: 'lsp', items: [{ name: 'App', path: 'src/app.mjs' }] }) },
  });
  await service.open();
  return service;
}

test('orchestration service production-wires ACP, repository, browser, commands, gateway adapters and usage', async (t) => {
  const service = await serviceFixture(t);
  const acp = await service.handleAcp({ jsonrpc: '2.0', id: 's1', method: 'runtime/status', params: {} });
  assert.equal(acp.response.result.schema, 'nolane.agent.native-orchestration.v8');
  const search = await service.searchNativeRepository({ query: 'App', workspaceRoot: '/repo' });
  assert.equal(search.results[0].path, 'src/app.mjs');
  const browser = await service.executeNativeBrowser({ action: 'open', projectId: 'p1', url: 'https://example.com' });
  assert.equal(browser.output.opened, true);
  const command = await service.executeNativeCommand({ command: 'status', surface: 'tui' });
  assert.equal(command.result.schema, 'nolane.agent.native-orchestration.v8');
  service.registerGatewayAdapter({ id: 'local-v2', platform: 'local', capabilities: ['message:send'], adapter: { async start() {}, async stop() {}, async send(message) { return { externalId: message.eventId }; }, normalizeInbound(raw) { return { eventId: raw.id, principalId: 'u', channel: 'c', text: raw.text, attachments: [] }; } } });
  await service.startGatewayAdapter('local-v2');
  const delivery = await service.deliverGatewayAdapter('local-v2', { eventId: 'e1', channel: 'c', text: 'hi' });
  assert.equal(delivery.externalId, 'e1');
  service.recordNativeUsage({ providerId: 'local', model: 'local', inputTokens: 10, outputTokens: 20, latencyMs: 5 });
  assert.equal(service.nativeUsageStatus().totals.tokens, 30);
  assert.equal(service.status().runtimeWave3.acp.methods.includes('runtime/status'), true);
});

test('authenticated HTTP routes expose bounded runtime wave endpoints', async (t) => {
  const nativeOrchestration = await serviceFixture(t);
  const route = createRoutes({ nativeOrchestration });
  const call = async ({ method = 'GET', pathname, body = null }) => {
    let status; let data = '';
    const req = { method, forgePrincipal: { subject: 'user:1' }, async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(JSON.stringify(body)); } };
    const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
    const handled = await route(req, res, new URL(`http://local${pathname}`));
    return { handled, status, body: data ? JSON.parse(data) : null };
  };
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/acp', body: { jsonrpc: '2.0', id: '1', method: 'runtime/status' } })).status, 200);
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/repository/search', body: { query: 'App', workspaceRoot: '/repo' } })).body.results.length, 1);
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/browser/execute', body: { action: 'snapshot', projectId: 'p1' } })).body.action, 'snapshot');
  assert.equal((await call({ method: 'POST', pathname: '/api/nolane/native-core/commands/execute', body: { command: 'status', surface: 'web' } })).body.command, 'status');
  assert.equal((await call({ method: 'GET', pathname: '/api/nolane/native-core/usage' })).body.totals.tokens, 0);
});

test('application attaches repository, LSP and browser services to the native runtime wave', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('src/app.mjs', 'utf8');
  assert.match(source, /nativeOrchestration\.attachRuntimeWave3\(/);
  assert.match(source, /browser:\s*browserService/);
  assert.match(source, /codeIntelligence/);
  assert.match(source, /repositoryIndex\.search/);
});
