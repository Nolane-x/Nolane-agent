import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { TerminalManager } from '../src/terminal/terminal-manager.mjs';

class Client extends EventEmitter {
  constructor({ pid = 123 } = {}) { super(); this.pid = pid; this.calls = []; this.sessions = new Map(); }
  async request(method, params = {}) { this.calls.push([method, params]); if (method === 'session/create') { this.sessions.set(params.id, params); return { id: params.id, state: 'running', pid: this.pid }; } if (method === 'session/list') return []; return { ok: true }; }
  async close() { this.closed = true; }
}

test('terminal lifecycle isolates project ownership and releases sandbox leases', async () => {
  const client = new Client(); const events = []; const closes = [];
  const sandbox = { async createLease() { return { id: 'lease-1' }; }, async attachProcess(id, pid) { assert.equal(pid, 123); return { id, state: 'active' }; }, async closeLease(id, options) { closes.push([id, options]); } };
  const manager = new TerminalManager({ projectResolver: (id) => id === 'p1' ? { id, workspaceRoot: process.cwd() } : null, clientFactory: () => client, allowedShells: [process.execPath], resourceSandbox: sandbox });
  manager.on('output', (event) => events.push(event));
  const session = await manager.create({ projectId: 'p1', principalId: 'alice', shell: process.execPath, sandbox: { limits: { cpuPercent: 100 } } });
  assert.equal(session.sandboxLeaseId, 'lease-1');
  client.emit('session/output', { sessionId: session.id, data: 'ok' });
  assert.equal(events[0].projectId, 'p1');
  await manager.terminate(session.id);
  assert.equal(closes.length, 1);
  await manager.close();
});

test('terminal lifecycle rejects unknown projects disallowed shells and missing attachable PIDs', async () => {
  const manager = new TerminalManager({ projectResolver: () => null, clientFactory: () => new Client(), allowedShells: [process.execPath] });
  await assert.rejects(() => manager.create({ projectId: 'missing', shell: process.execPath }), /unknown project/i);
  manager.projectResolver = () => ({ id: 'p1', workspaceRoot: process.cwd() });
  await assert.rejects(() => manager.create({ projectId: 'p1', shell: '/definitely/not/allowed' }), /not allowed/i);
  const noPid = new TerminalManager({ projectResolver: () => ({ id: 'p1', workspaceRoot: process.cwd() }), clientFactory: () => new Client({ pid: null }), allowedShells: [process.execPath], resourceSandbox: { async createLease() { return { id: 'lease-x' }; }, async attachProcess() {}, async closeLease() {} } });
  await assert.rejects(() => noPid.create({ projectId: 'p1', shell: process.execPath, sandbox: { limits: {} } }), /positive pid/i);
});
