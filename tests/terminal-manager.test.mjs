import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { TerminalManager } from '../src/terminal/terminal-manager.mjs';

class FakeClient extends EventEmitter {
  constructor() { super(); this.calls = []; this.sessions = new Map(); }
  async request(method, params = {}) {
    this.calls.push([method, params]);
    if (method === 'session/create') { this.sessions.set(params.id, params); return { id: params.id, state: 'running' }; }
    if (method === 'session/list') return [...this.sessions.values()].map((item) => ({ id: item.id, state: 'running' }));
    if (method === 'session/snapshot') return { sessionId: params.sessionId, data: 'snap', cursor: 4 };
    return { ok: true };
  }
  async close() { this.closed = true; }
}

test('TerminalManager isolates projects, maps session ownership, and forwards only owned events', async () => {
  const clients = [];
  const projects = new Map([
    ['p1', { id: 'p1', workspaceRoot: process.cwd() }],
    ['p2', { id: 'p2', workspaceRoot: process.cwd() }],
  ]);
  const manager = new TerminalManager({
    projectResolver: (id) => projects.get(id),
    clientFactory: () => { const client = new FakeClient(); clients.push(client); return client; },
    allowedShells: [process.execPath], maxSessionsPerProject: 2,
  });
  const events = []; manager.on('output', (event) => events.push(event));
  const first = await manager.create({ projectId: 'p1', shell: process.execPath });
  const second = await manager.create({ projectId: 'p2', shell: process.execPath });
  assert.notEqual(first.id, second.id);
  clients[0].emit('session/output', { sessionId: first.id, data: 'p1' });
  clients[1].emit('session/output', { sessionId: second.id, data: 'p2' });
  assert.deepEqual(events.map((event) => event.projectId), ['p1', 'p2']);
  await manager.input(first.id, 'hello');
  assert.equal(clients[0].calls.at(-1)[0], 'session/input');
  await assert.rejects(() => manager.input('missing', 'x'), /unknown terminal session/i);
  await manager.close();
  assert.ok(clients.every((client) => client.closed));
});

test('TerminalManager fails closed for unknown projects and resource admission rejection', async () => {
  const manager = new TerminalManager({
    projectResolver: () => null,
    clientFactory: () => new FakeClient(),
    allowedShells: [process.execPath],
    governor: { admit(kind) { return { allowed: kind !== 'terminal', reason: 'brownout' }; } },
  });
  await assert.rejects(() => manager.create({ projectId: 'missing', shell: process.execPath }), /unknown project/i);
  manager.projectResolver = () => ({ id: 'p', workspaceRoot: process.cwd() });
  await assert.rejects(() => manager.create({ projectId: 'p', shell: process.execPath }), /brownout/i);
});

test('TerminalManager creates and attaches a resource sandbox for a PID-bearing PTY session', async () => {
  const client = new FakeClient();
  client.request = async function request(method, params = {}) {
    this.calls.push([method, params]);
    if (method === 'session/create') { this.sessions.set(params.id, params); return { id: params.id, state: 'running', pid: 4321 }; }
    if (method === 'session/list') return [];
    return { ok: true };
  };
  const calls = [];
  const resourceSandbox = {
    async createLease(input) { calls.push(['create', input]); return { id: 'sandbox-1' }; },
    async attachProcess(id, pid, scope) { calls.push(['attach', id, pid, scope]); return { id, state: 'active' }; },
    async closeLease(id, options) { calls.push(['close', id, options]); return { id, state: 'closed' }; },
  };
  const manager = new TerminalManager({
    projectResolver: () => ({ id: 'p1', workspaceRoot: process.cwd() }),
    clientFactory: () => client,
    allowedShells: [process.execPath],
    resourceSandbox,
  });
  const result = await manager.create({ projectId: 'p1', principalId: 'alice', shell: process.execPath, sandbox: { limits: { cpuPercent: 100 } } });
  assert.equal(result.pid, 4321);
  assert.equal(result.sandboxLeaseId, 'sandbox-1');
  assert.equal(calls[0][0], 'create');
  assert.equal(calls[0][1].workspaceRoot, process.cwd());
  assert.deepEqual(calls[1], ['attach', 'sandbox-1', 4321, { projectId: 'p1', principalId: 'alice' }]);
  await manager.terminate(result.id);
  assert.equal(calls.at(-1)[0], 'close');
});

test('TerminalManager rolls back the PTY and lease when a sandboxed session has no attachable PID', async () => {
  const client = new FakeClient();
  const closes = [];
  const resourceSandbox = {
    async createLease() { return { id: 'sandbox-no-pid' }; },
    async attachProcess() { throw new Error('must not attach'); },
    async closeLease(id, options) { closes.push([id, options]); },
  };
  const manager = new TerminalManager({
    projectResolver: () => ({ id: 'p1', workspaceRoot: process.cwd() }),
    clientFactory: () => client,
    allowedShells: [process.execPath],
    resourceSandbox,
  });
  await assert.rejects(() => manager.create({ projectId: 'p1', principalId: 'alice', shell: process.execPath, sandbox: { limits: { cpuPercent: 100 } } }), /positive pid/i);
  assert.equal(client.calls.some(([method]) => method === 'session/terminate'), true);
  assert.deepEqual(closes[0][0], 'sandbox-no-pid');
});

test('TerminalManager closes a sandbox lease when the PTY exits asynchronously', async () => {
  const client = new FakeClient();
  client.request = async function request(method, params = {}) {
    this.calls.push([method, params]);
    if (method === 'session/create') { this.sessions.set(params.id, params); return { id: params.id, state: 'running', pid: 99 }; }
    if (method === 'session/list') return [];
    return { ok: true };
  };
  const closed = [];
  const resourceSandbox = {
    async createLease() { return { id: 'sandbox-exit' }; },
    async attachProcess() { return { state: 'active' }; },
    async closeLease(id, options) { closed.push([id, options]); },
  };
  const manager = new TerminalManager({ projectResolver: () => ({ id: 'p1', workspaceRoot: process.cwd() }), clientFactory: () => client, allowedShells: [process.execPath], resourceSandbox });
  const session = await manager.create({ projectId: 'p1', principalId: 'alice', shell: process.execPath, sandbox: { limits: { cpuPercent: 100 } } });
  client.emit('session/exit', { sessionId: session.id, exitCode: 0, signal: null });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(closed.length, 1);
  assert.equal(closed[0][0], 'sandbox-exit');
});
