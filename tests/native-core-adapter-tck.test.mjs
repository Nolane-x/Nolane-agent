import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { NativeAdapterTck } from '../src/native-core/native-adapter-tck.mjs';
import { NolaneNativeOrchestrationService } from '../src/nolane-native/orchestration-service.mjs';

const manifest = (overrides = {}) => ({
  schema: 'nolane.native.adapter.v1',
  id: 'local-search',
  kind: 'web-search',
  version: '1.0.0',
  capabilities: ['search:query'],
  credentialRefs: ['search-api-key'],
  permissions: ['network:https'],
  ...overrides,
});

test('adapter TCK validates typed manifests and rejects embedded secrets or unknown permissions', () => {
  const tck = new NativeAdapterTck({ allowedPermissions: ['network:https'] });
  assert.equal(tck.validateManifest(manifest()).id, 'local-search');
  assert.throws(() => tck.validateManifest(manifest({ apiKey: 'secret-value' })), /embedded secret/i);
  assert.throws(() => tck.validateManifest(manifest({ permissions: ['process:shell'] })), /permission is not allowed/i);
  assert.throws(() => tck.validateManifest(manifest({ version: 'latest' })), /semantic version/i);
});

test('adapter lifecycle produces hash-chained receipts and never records credential values', async () => {
  const calls = [];
  const tck = new NativeAdapterTck({
    allowedPermissions: ['network:https'],
    credentialResolver: async (reference) => ({ reference, value: 'TOP-SECRET' }),
  });
  tck.register({
    manifest: manifest(),
    adapter: {
      async probe() { calls.push('probe'); return { ready: true }; },
      async start() { calls.push('start'); },
      async execute(input, context) {
        calls.push('execute');
        assert.equal(context.credentials['search-api-key'], 'TOP-SECRET');
        assert.equal(context.signal.aborted, false);
        return { results: [{ title: input.query, score: 1 }] };
      },
      async stop() { calls.push('stop'); },
    },
  });
  await tck.probe('local-search');
  await tck.start('local-search');
  const result = await tck.execute('local-search', { query: 'nolane' });
  await tck.stop('local-search');
  assert.deepEqual(calls, ['probe', 'start', 'execute', 'stop']);
  assert.deepEqual(result.output, { results: [{ title: 'nolane', score: 1 }] });
  const snapshot = tck.snapshot();
  assert.equal(snapshot.adapters[0].state, 'stopped');
  assert.equal(snapshot.receipts.length, 4);
  assert.equal(snapshot.receipts[1].previousSha256, snapshot.receipts[0].sha256);
  assert.doesNotMatch(JSON.stringify(snapshot), /TOP-SECRET/);
  assert.deepEqual(snapshot.adapters[0].credentialRefs, ['search-api-key']);
});

test('adapter execution enforces timeout, cancellation and cleanup exactly once', async () => {
  let stops = 0;
  const tck = new NativeAdapterTck({ allowedPermissions: [], defaultTimeoutMs: 25 });
  tck.register({
    manifest: manifest({ id: 'slow', kind: 'memory', credentialRefs: [], permissions: [] }),
    adapter: {
      async probe() { return { ready: true }; },
      async start() {},
      async execute(_input, { signal }) {
        await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
        throw signal.reason;
      },
      async stop() { stops += 1; },
    },
  });
  await tck.start('slow');
  await assert.rejects(() => tck.execute('slow', { value: 1 }), /timed out/i);
  assert.equal(stops, 1);
  assert.equal(tck.describe('slow').state, 'failed');
  assert.equal(tck.snapshot().receipts.at(-1).type, 'execute-failed');
});

test('adapter TCK rejects duplicate registration and execution before start', async () => {
  const tck = new NativeAdapterTck({ allowedPermissions: [] });
  const definition = {
    manifest: manifest({ id: 'memory-local', kind: 'memory', credentialRefs: [], permissions: [] }),
    adapter: { async probe() { return { ready: true }; }, async start() {}, async execute() { return {}; }, async stop() {} },
  };
  tck.register(definition);
  assert.throws(() => tck.register(definition), /already registered/i);
  await assert.rejects(() => tck.execute('memory-local', {}), /must be running/i);
});

test('orchestration exposes the production adapter registry without leaking implementations', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-adapter-tck-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new NolaneNativeOrchestrationService({ dataDir: root });
  await service.open();
  service.registerNativeAdapter({
    manifest: manifest({ id: 'simulated-search', credentialRefs: [], permissions: [] }),
    adapter: { async probe() { return { ready: true }; }, async start() {}, async execute(input) { return { echoed: input }; }, async stop() {} },
  });
  await service.startNativeAdapter('simulated-search');
  const result = await service.executeNativeAdapter('simulated-search', { query: 'x' });
  assert.deepEqual(result.output, { echoed: { query: 'x' } });
  const status = service.status();
  assert.equal(status.adapters.adapters, 1);
  assert.equal(status.adapters.running, 1);
  assert.equal('adapter' in status.adapters, false);
});
