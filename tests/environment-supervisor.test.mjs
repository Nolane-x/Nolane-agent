import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { EnvironmentSupervisor } from '../src/runtime/environment-supervisor.mjs';

class FakeProcessDriver {
  constructor() { this.nextPid = 1000; this.processes = new Map(); this.starts = []; this.stops = []; this.portOccupied = false; }
  async start(spec) {
    const pid = this.nextPid += 1;
    const handle = new EventEmitter();
    Object.assign(handle, { pid, stdoutPreview: '', stderrPreview: '' });
    this.processes.set(pid, { alive: true, handle, spec });
    this.starts.push({ ...spec, env: { ...spec.env } });
    return handle;
  }
  isAlive(pid) { return this.processes.get(Number(pid))?.alive === true; }
  async stop(pid) { const record = this.processes.get(Number(pid)); if (record) { record.alive = false; record.handle.emit('exit', { exitCode: 0, signal: 'SIGTERM' }); } this.stops.push(Number(pid)); }
  crash(pid) { const record = this.processes.get(Number(pid)); if (record) { record.alive = false; record.handle.emit('exit', { exitCode: 1, signal: null }); } }
  async isPortOccupied() { return this.portOccupied; }
}

async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-env-supervisor-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const driver = options.driver ?? new FakeProcessDriver();
  const health = options.health ?? (async () => ({ reachable: true, status: 200, latencyMs: 4 }));
  const bootstrapCalls = [];
  const supervisor = new EnvironmentSupervisor({
    file: path.join(root, 'environment.db'),
    root: path.join(root, 'runtime'),
    processDriver: driver,
    healthProbe: health,
    bootstrapRunner: async (request) => { bootstrapCalls.push(request); return { exitCode: 0, stdout: 'bootstrapped', stderr: '' }; },
    sleep: async () => {},
    clock: (() => { let tick = 0; return () => new Date(Date.UTC(2026, 6, 29, 0, 0, tick++)).toISOString(); })(),
  });
  t.after(() => supervisor.close());
  return { root, driver, supervisor, bootstrapCalls };
}

test('environment supervisor starts an argv-only process, proves health, and never persists secret values', async (t) => {
  const { root, driver, supervisor } = await fixture(t);
  supervisor.register({
    id: 'web', projectId: 'p1', cwd: root, command: process.execPath, args: ['server.mjs'], env: { API_KEY: 'do-not-persist' },
    health: { kind: 'http', url: 'http://127.0.0.1:4173/health', expectedStatuses: [200] }, restart: { maxAttempts: 3, backoffMs: 10 },
  });
  const started = await supervisor.start('web');
  assert.equal(started.state, 'healthy');
  assert.equal(driver.starts[0].shell, false);
  assert.deepEqual(driver.starts[0].args, ['server.mjs']);
  assert.match(started.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(started.environment.envNames.includes('API_KEY'), true);
  assert.equal(JSON.stringify(started).includes('do-not-persist'), false);
  assert.equal((await readFile(path.join(root, 'environment.db'))).toString('utf8').includes('do-not-persist'), false);
});

test('environment supervisor restarts only infrastructure failures with bounded backoff and then blocks', async (t) => {
  const driver = new FakeProcessDriver();
  let reachable = true;
  const { supervisor } = await fixture(t, { driver, health: async () => reachable ? { reachable: true, status: 200 } : { reachable: false, errorCode: 'ECONNREFUSED' } });
  supervisor.register({ id: 'dev', projectId: 'p1', cwd: process.cwd(), command: process.execPath, args: ['dev.mjs'], health: { kind: 'http', url: 'http://127.0.0.1:3000/health', expectedStatuses: [200] }, restart: { maxAttempts: 2, backoffMs: 1 } });
  const first = await supervisor.start('dev');
  driver.crash(first.pid); reachable = false;
  const healed1 = await supervisor.heal('dev');
  assert.equal(healed1.action, 'restarted');
  driver.crash(healed1.pid);
  const healed2 = await supervisor.heal('dev');
  assert.equal(healed2.action, 'restarted');
  driver.crash(healed2.pid);
  const blocked = await supervisor.heal('dev');
  assert.equal(blocked.state, 'blocked');
  assert.equal(blocked.reason, 'restart-budget-exhausted');
  assert.equal(driver.starts.length, 3);
});

test('unexpected HTTP status is classified as an application failure and is not hidden by restart', async (t) => {
  const driver = new FakeProcessDriver();
  const { supervisor } = await fixture(t, { driver, health: async () => ({ reachable: true, status: 500, latencyMs: 3 }) });
  supervisor.register({ id: 'api', projectId: 'p1', cwd: process.cwd(), command: process.execPath, args: ['api.mjs'], health: { kind: 'http', url: 'http://127.0.0.1:8080/health', expectedStatuses: [200] }, restart: { maxAttempts: 4, backoffMs: 1 } });
  const result = await supervisor.start('api');
  assert.equal(result.state, 'needs-agent');
  assert.equal(result.reason, 'application-health-check-failed');
  assert.equal(driver.starts.length, 1);
  const healed = await supervisor.heal('api');
  assert.equal(healed.action, 'no-restart');
  assert.equal(driver.starts.length, 1);
});

test('bootstrap cache is content-addressed and reruns only when manifest inputs change', async (t) => {
  const { root, supervisor, bootstrapCalls } = await fixture(t);
  const lock = path.join(root, 'package-lock.json');
  await writeFile(lock, '{"lockfileVersion":3}\n');
  supervisor.register({
    id: 'build', projectId: 'p1', cwd: root, command: process.execPath, args: ['app.mjs'],
    bootstrap: { command: process.execPath, args: ['bootstrap.mjs'], manifestPaths: ['package-lock.json'] },
    restart: { maxAttempts: 1, backoffMs: 1 },
  });
  await supervisor.start('build'); await supervisor.stop('build'); await supervisor.start('build'); await supervisor.stop('build');
  assert.equal(bootstrapCalls.length, 1);
  await writeFile(lock, '{"lockfileVersion":4}\n');
  await supervisor.start('build');
  assert.equal(bootstrapCalls.length, 2);
  const snapshot = await supervisor.environmentSnapshot('build');
  assert.match(snapshot.manifestSha256, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.files[0].path, 'package-lock.json');
});

test('supervisor recovers durable process ownership after application restart without respawning a healthy process', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-env-recover-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const driver = new FakeProcessDriver();
  const file = path.join(root, 'environment.db');
  const options = { file, root: path.join(root, 'runtime'), processDriver: driver, healthProbe: async () => ({ reachable: true, status: 200 }), sleep: async () => {} };
  const first = new EnvironmentSupervisor(options);
  first.register({ id: 'web', projectId: 'p1', cwd: root, command: process.execPath, args: ['server.mjs'], health: { kind: 'http', url: 'http://127.0.0.1:4173/health', expectedStatuses: [200] } });
  const started = await first.start('web');
  first.close();

  const second = new EnvironmentSupervisor(options);
  t.after(() => second.close());
  const recovered = await second.recover('web');
  assert.equal(recovered.state, 'healthy');
  assert.equal(recovered.pid, started.pid);
  assert.equal(driver.starts.length, 1);
});
