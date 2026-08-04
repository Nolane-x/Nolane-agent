import test from 'node:test';
import assert from 'node:assert/strict';

import { ManagedProcessRegistry } from '../src/execution/managed-process-registry.mjs';

async function waitFor(predicate, timeoutMs = 2_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('condition timed out');
}

test('registers a real positive PID, rejects duplicate server IDs, and stops the whole managed process', async (t) => {
  const registry = new ManagedProcessRegistry({ maxOutputBytes: 8_192, stopGraceMs: 100 });
  t.after(() => registry.close());
  const started = await registry.start({ id: 'api', command: process.execPath, args: ['-e', "console.log('ready');setInterval(()=>{},1000)"], cwd: process.cwd(), env: process.env, startupDelayMs: 30 });
  assert.equal(started.id, 'api');
  assert.ok(Number.isInteger(started.pid) && started.pid > 0);
  assert.equal(started.state, 'running');
  await assert.rejects(() => registry.start({ id: 'api', command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], cwd: process.cwd(), env: process.env }), /already managed/i);
  assert.equal(registry.list().length, 1);
  const stopped = await registry.stop('api');
  assert.equal(stopped.state, 'exited');
  await waitFor(() => {
    try { process.kill(started.pid, 0); return false; } catch { return true; }
  });
  assert.deepEqual(registry.list(), []);
});

test('close terminates every managed server and startup failure leaves no registry entry', async () => {
  const registry = new ManagedProcessRegistry({ stopGraceMs: 50 });
  await assert.rejects(() => registry.start({ id: 'bad', command: '/definitely/missing/executable', args: [], cwd: process.cwd(), env: {} }), /ENOENT|spawn/i);
  assert.deepEqual(registry.list(), []);
  const one = await registry.start({ id: 'one', command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], cwd: process.cwd(), env: process.env, startupDelayMs: 20 });
  const two = await registry.start({ id: 'two', command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], cwd: process.cwd(), env: process.env, startupDelayMs: 20 });
  await registry.close();
  for (const pid of [one.pid, two.pid]) await waitFor(() => { try { process.kill(pid, 0); return false; } catch { return true; } });
  assert.deepEqual(registry.list(), []);
});

test('stop routes cleanup through the identity-aware platform driver contract', async (t) => {
  const { createPlatformResourceDriver } = await import('../src/sandbox/platform-resource-driver.mjs');
  const base = createPlatformResourceDriver({ platform: process.platform });
  const calls = [];
  const driver = {
    sampleTree: (...args) => base.sampleTree(...args),
    isTreeAlive: (...args) => base.isTreeAlive(...args),
    async killTree(pid, options) { calls.push([pid, options.signal, options.expectedRootIdentity]); return base.killTree(pid, options); },
  };
  const registry = new ManagedProcessRegistry({ processDriver: driver, stopGraceMs: 100 });
  t.after(() => registry.close());
  const started = await registry.start({ id: 'driver-stop', command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], cwd: process.cwd(), env: process.env, startupDelayMs: 30 });
  await registry.stop('driver-stop');
  assert.equal(calls[0][0], started.pid);
  assert.equal(calls[0][1], 'SIGTERM');
  assert.ok(calls[0][2] && calls[0][2].pid === started.pid);
});
