import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { CapabilityGrantLedger } from '../src/security/capability-registry.mjs';
import { EnvironmentControlService } from '../src/runtime/environment-control-service.mjs';
import { EnvironmentSupervisor } from '../src/runtime/environment-supervisor.mjs';

class FakeDriver {
  constructor() { this.nextPid = 7000; this.alive = new Set(); this.starts = []; }
  async start(spec) { const handle = new EventEmitter(); handle.pid = ++this.nextPid; this.alive.add(handle.pid); this.starts.push(structuredClone(spec)); return handle; }
  isAlive(pid) { return this.alive.has(Number(pid)); }
  async stop(pid) { this.alive.delete(Number(pid)); }
  async isPortOccupied() { return false; }
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-env-control-'));
  const driver = new FakeDriver();
  const supervisor = new EnvironmentSupervisor({
    file: path.join(root, 'environment.db'), root: path.join(root, 'runtime'), processDriver: driver,
    healthProbe: async () => ({ reachable: true, status: 200, latencyMs: 1 }), sleep: async () => {},
  });
  t.after(() => supervisor.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const ledger = new CapabilityGrantLedger();
  const events = [];
  const service = new EnvironmentControlService({ supervisor, capabilityLedger: ledger, projectResolver: (id) => ['p1', 'p2'].includes(id) ? { id, workspaceRoot: root } : null, eventSink: (event) => events.push(event) });
  return { root, driver, supervisor, ledger, events, service };
}

function grantEnvironmentAuthority(ledger, principalId = 'operator-1', sessionId = 'session-1') {
  const common = { principalId, effect: 'allow', mode: 'session', sessionId, reason: 'Manage the approved local development environment.', expectedImpact: 'Starts or stops one bounded project process.', approvedBy: 'owner-1' };
  ledger.grant({ ...common, capabilities: ['shell.run'], scope: { commands: [process.execPath], arguments: ['server.mjs'], tools: ['environment.*'] } });
  ledger.grant({ ...common, capabilities: ['port.open'], scope: { tools: ['environment.*'] } });
}

test('EnvironmentControlService fails closed without scoped capability grants and never exposes secret values', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    () => f.service.register({ id: 'web', projectId: 'p1', cwd: f.root, command: process.execPath, args: ['server.mjs'], env: { API_TOKEN: 'super-secret-value' }, health: { kind: 'http', url: 'http://127.0.0.1:4173/health' } }, { principal: { subject: 'operator-1' }, sessionId: 'session-1' }),
    (error) => error.code === 'ENVIRONMENT_CAPABILITY_DENIED',
  );
  assert.equal(f.supervisor.list().length, 0);

  grantEnvironmentAuthority(f.ledger);
  const registered = await f.service.register({ id: 'web', projectId: 'p1', cwd: f.root, command: process.execPath, args: ['server.mjs'], env: { API_TOKEN: 'super-secret-value' }, health: { kind: 'http', url: 'http://127.0.0.1:4173/health' } }, { principal: { subject: 'operator-1' }, sessionId: 'session-1' });
  assert.deepEqual(registered.environment.envNames, ['API_TOKEN']);
  assert.equal(JSON.stringify(registered).includes('super-secret-value'), false);
  assert.match(registered.operationReceiptSha256, /^[a-f0-9]{64}$/);
});

test('EnvironmentControlService starts, heals, stops, scopes by project, and emits evidence receipts', async (t) => {
  const f = await fixture(t);
  grantEnvironmentAuthority(f.ledger);
  await f.service.register({ id: 'web', projectId: 'p1', cwd: f.root, command: process.execPath, args: ['server.mjs'], health: { kind: 'http', url: 'http://127.0.0.1:4173/health' } }, { principal: { subject: 'operator-1' }, sessionId: 'session-1' });
  const started = await f.service.start('web', { principal: { subject: 'operator-1' }, sessionId: 'session-1', projectId: 'p1' });
  assert.equal(started.state, 'healthy');
  assert.match(started.operationReceiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(f.driver.starts.length, 1);
  assert.equal((await f.service.status('web', { projectId: 'p1' })).projectId, 'p1');
  assert.throws(() => f.service.status('web', { projectId: 'p2' }), (error) => error.code === 'ENVIRONMENT_PROJECT_SCOPE_DENIED');
  const stopped = await f.service.stop('web', { principal: { subject: 'operator-1' }, sessionId: 'session-1', projectId: 'p1' });
  assert.equal(stopped.state, 'stopped');
  assert.equal(f.events.some((event) => event.type === 'environment.operation' && event.action === 'start'), true);
  assert.equal(f.events.some((event) => event.type === 'environment.operation' && event.action === 'stop'), true);
});
