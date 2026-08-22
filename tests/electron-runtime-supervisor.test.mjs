import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { RuntimeSupervisor } = require('../desktop/runtime-supervisor.cjs');

class FakeProcess extends EventEmitter {
  constructor(onStart) { super(); this.killed = false; queueMicrotask(() => onStart?.(this)); }
  kill() { this.killed = true; this.emit('exit', 0); }
}

test('RuntimeSupervisor gives a complete local runtime graph a two-minute startup budget by default', () => {
  const supervisor = new RuntimeSupervisor({
    runtimeFile: 'runtime.json',
    modulePath: '/app/src/app.mjs',
    processFactory: () => new FakeProcess(),
  });
  assert.equal(supervisor.startupTimeoutMs, 120_000);
});

test('RuntimeSupervisor waits for an authenticated runtime handoff', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-electron-runtime-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runtimeFile = path.join(root, 'runtime.json');
  const supervisor = new RuntimeSupervisor({
    runtimeFile,
    modulePath: '/app/src/app.mjs',
    startupTimeoutMs: 1_000,
    pollMs: 5,
    processFactory: () => new FakeProcess(async () => {
      await writeFile(runtimeFile, JSON.stringify({ url: 'http://127.0.0.1:4123', token: 'secret', pid: 2 }));
    }),
  });
  const runtime = await supervisor.start();
  assert.equal(runtime.url, 'http://127.0.0.1:4123');
  assert.equal(runtime.token, 'secret');
  await supervisor.stop();
});

test('RuntimeSupervisor restarts a process that exits before handoff but stops at the bound', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-electron-restart-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runtimeFile = path.join(root, 'runtime.json');
  let attempts = 0;
  const supervisor = new RuntimeSupervisor({
    runtimeFile,
    modulePath: '/app/src/app.mjs',
    maxRestarts: 1,
    startupTimeoutMs: 500,
    pollMs: 5,
    processFactory: () => {
      attempts += 1;
      return new FakeProcess(async (child) => {
        if (attempts === 1) child.emit('exit', 1);
        else await writeFile(runtimeFile, JSON.stringify({ url: 'http://127.0.0.1:4999', token: 'ok', pid: 3 }));
      });
    },
  });
  const runtime = await supervisor.start();
  assert.equal(runtime.token, 'ok');
  assert.equal(attempts, 2);
  await supervisor.stop();
});

test('RuntimeSupervisor reports an unexpected exit after readiness and shuts down idempotently', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-electron-exit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runtimeFile = path.join(root, 'runtime.json');
  let child;
  let reported = null;
  const supervisor = new RuntimeSupervisor({
    runtimeFile,
    modulePath: '/app/src/app.mjs',
    startupTimeoutMs: 1_000,
    pollMs: 5,
    onUnexpectedExit(info) { reported = info; },
    processFactory: () => (child = new FakeProcess(async () => {
      await writeFile(runtimeFile, JSON.stringify({ url: 'http://127.0.0.1:4555', token: 'ready', pid: 4 }));
    })),
  });
  await supervisor.start();
  child.emit('exit', 7);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reported.code, 7);
  await supervisor.stop();
  await supervisor.stop();
});
