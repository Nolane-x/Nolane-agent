import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserComputerUseFabric } from '../src/native-core/browser-computer-use-fabric.mjs';
import { GatewayAdapterRuntime } from '../src/native-core/gateway-adapter-runtime.mjs';
import { CommandSurfaceRuntime } from '../src/native-core/command-surface-runtime.mjs';
import { UsageObservabilityRuntime } from '../src/native-core/usage-observability-runtime.mjs';

test('browser computer-use fabric requires approval for mutations and emits bounded receipts', async () => {
  const calls = [];
  const fabric = new BrowserComputerUseFabric({ browser: {
    snapshot: async () => ({ text: 'page'.repeat(100), nodes: [{ id: 'n1' }] }),
    click: async (input) => { calls.push(['click', input.target]); return { ok: true }; },
    open: async (input) => { calls.push(['open', input.url]); return { ok: true }; },
  }, approval: async ({ action }) => ({ approved: action === 'click', approver: 'user' }), maxOutputBytes: 80 });
  await fabric.execute({ action: 'open', projectId: 'p1', url: 'https://example.com' });
  await fabric.execute({ action: 'click', projectId: 'p1', target: '#ship' });
  await assert.rejects(() => fabric.execute({ action: 'type', projectId: 'p1', target: '#x', text: 'secret' }), /unsupported browser action/);
  const snap = await fabric.execute({ action: 'snapshot', projectId: 'p1' });
  assert.ok(snap.outputBytes <= 80);
  assert.deepEqual(calls, [['open', 'https://example.com'], ['click', '#ship']]);
  assert.match(snap.receiptSha256, /^[a-f0-9]{64}$/);
});

test('gateway adapter runtime normalizes inbound/outbound messages and prevents duplicate delivery', async () => {
  const delivered = [];
  const runtime = new GatewayAdapterRuntime();
  runtime.register({ id: 'matrix', platform: 'matrix', capabilities: ['message:send'], adapter: {
    async start() {}, async stop() {},
    async send(message) { delivered.push(message); return { externalId: `x-${message.eventId}` }; },
    normalizeInbound(raw) { return { eventId: raw.id, principalId: raw.user, channel: raw.room, text: raw.body, attachments: [] }; },
  } });
  await runtime.start('matrix');
  const inbound = runtime.normalizeInbound('matrix', { id: '1', user: 'u', room: 'r', body: 'hi' });
  assert.equal(inbound.platform, 'matrix');
  const a = await runtime.deliver('matrix', { eventId: 'e1', channel: 'r', text: 'hello' });
  const b = await runtime.deliver('matrix', { eventId: 'e1', channel: 'r', text: 'ignored' });
  assert.equal(a.replayed, false);
  assert.equal(b.replayed, true);
  assert.equal(delivered.length, 1);
  await runtime.stop('matrix');
});

test('command surface runtime shares commands across CLI/TUI and sanitizes terminal output', async () => {
  const runtime = new CommandSurfaceRuntime({ maxOutputBytes: 40 });
  runtime.register({ id: 'status', description: 'Show status', handler: async ({ args, emit }) => { emit('progress', { step: 1 }); return { text: `ok ${args.join(' ')}` }; } });
  const cli = await runtime.execute({ command: 'status', args: ['now'], surface: 'cli' });
  const tui = await runtime.execute({ command: 'status', args: ['later'], surface: 'tui' });
  assert.equal(cli.result.text, 'ok now');
  assert.equal(tui.result.text, 'ok later');
  assert.deepEqual(runtime.list().map((entry) => entry.id), ['status']);
  runtime.register({ id: 'ansi', description: 'ansi', handler: async () => ({ text: '\u001b[31mred\u001b[0m' }) });
  const ansi = await runtime.execute({ command: 'ansi', surface: 'cli' });
  assert.equal(ansi.result.text.includes('\u001b'), false);
});

test('usage observability runtime prices attempts, enforces budgets and exports tamper-evident snapshots', () => {
  const runtime = new UsageObservabilityRuntime({ pricing: { 'model-a': { inputPerMillion: 2, outputPerMillion: 8 } }, maxCostUsd: 0.01 });
  runtime.record({ providerId: 'p', model: 'model-a', inputTokens: 1000, outputTokens: 500, latencyMs: 50, status: 'ok' });
  const snapshot = runtime.snapshot();
  assert.equal(snapshot.totals.tokens, 1500);
  assert.equal(snapshot.totals.costUsd, 0.006);
  assert.match(snapshot.receiptSha256, /^[a-f0-9]{64}$/);
  assert.throws(() => runtime.record({ providerId: 'p', model: 'model-a', inputTokens: 1000, outputTokens: 1000, latencyMs: 50, status: 'ok' }), /cost budget exceeded/);
});

test('browser fabric hosts a bounded web-search provider registry without leaking credential references', async () => {
  const fabric = new BrowserComputerUseFabric({ browser: { snapshot: async () => ({}) } });
  fabric.registerSearchProvider({ id: 'local-search', credentialRef: 'vault:search', search: async ({ query, limit }) => [{ title: query, url: 'https://example.com', snippet: 'result' }].slice(0, limit) });
  const result = await fabric.searchWeb({ query: 'nolane', limit: 5 });
  assert.equal(result.items[0].title, 'nolane');
  assert.equal(JSON.stringify(result).includes('vault:search'), false);
  assert.equal(fabric.snapshot().searchProviders[0], 'local-search');
});
