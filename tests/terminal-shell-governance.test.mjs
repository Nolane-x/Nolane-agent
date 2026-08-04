import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ShellCommandCodec } from '../src/security/shell-command-codec.mjs';
import { TerminalService } from '../src/terminal/terminal-service.mjs';
import { TerminalManager } from '../src/terminal/terminal-manager.mjs';

class FakeClient extends EventEmitter {
  constructor({ pid = 321 } = {}) { super(); this.calls = []; this.pid = pid; }
  async request(method, params = {}) {
    this.calls.push([method, params]);
    if (method === 'session/create') return { id: params.id, state: 'running', pid: this.pid };
    if (method === 'session/list') return [];
    return { ok: true };
  }
  async close() {}
}

test('TerminalService prepares interactive shells through the bounded shell codec', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-terminal-shell-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const client = new FakeClient();
  const service = new TerminalService({
    client,
    workspaceRoot: root,
    allowedShells: [process.execPath],
    shellCodec: new ShellCommandCodec({ platform: 'win32' }),
  });
  const session = await service.create({ shell: process.execPath, shellKind: 'powershell', args: ['-NoLogo', '-NoProfile'] });
  const create = client.calls.find(([method]) => method === 'session/create')[1];
  assert.equal(create.shell, process.execPath);
  assert.deepEqual(create.args, ['-NoLogo', '-NoProfile']);
  assert.equal(session.shellKind, 'powershell');
  await assert.rejects(() => service.create({ shell: process.execPath, shellKind: 'powershell', args: ['safe\nunsafe'] }), /newline/i);
});

test('TerminalManager authorizes the exact prepared shell before PTY creation and links the receipt', async () => {
  const client = new FakeClient();
  const calls = [];
  const governance = {
    authorize(input) {
      calls.push(input);
      assert.equal(client.calls.some(([method]) => method === 'session/create'), false);
      return { decision: 'allow', receiptSha256: 'd'.repeat(64), categories: [] };
    },
  };
  const manager = new TerminalManager({
    projectResolver: () => ({ id: 'p1', workspaceRoot: process.cwd() }),
    clientFactory: () => client,
    allowedShells: [process.execPath],
    shellCodec: new ShellCommandCodec({ platform: process.platform }),
    commandGovernance: governance,
  });
  const session = await manager.create({ projectId: 'p1', principalId: 'alice', taskId: 'task-1', shell: process.execPath, shellKind: 'bash', args: ['--no-warnings'] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].principalId, 'alice');
  assert.equal(calls[0].projectId, 'p1');
  assert.equal(calls[0].taskId, 'task-1');
  assert.equal(calls[0].sessionId, session.id);
  assert.equal(calls[0].origin, 'user');
  assert.equal(session.governanceReceiptSha256, 'd'.repeat(64));
  await manager.close();
});


test('TerminalManager assigns a stable fallback task identity when UI omits taskId', async () => {
  const client = new FakeClient();
  const calls = [];
  const manager = new TerminalManager({
    projectResolver: () => ({ id: 'p1', workspaceRoot: process.cwd() }),
    clientFactory: () => client,
    allowedShells: [process.execPath],
    commandGovernance: { authorize(input) { calls.push(input); return { decision: 'allow', receiptSha256: 'e'.repeat(64) }; } },
  });
  await manager.create({ projectId: 'p1', principalId: 'alice', taskId: '', shell: process.execPath, shellKind: 'bash' });
  assert.equal(calls[0].taskId, 'terminal:p1');
  await manager.close();
});

test('TerminalManager fails closed before PTY creation when command governance denies', async () => {
  const client = new FakeClient();
  const manager = new TerminalManager({
    projectResolver: () => ({ id: 'p1', workspaceRoot: process.cwd() }),
    clientFactory: () => client,
    allowedShells: [process.execPath],
    commandGovernance: { authorize() { const error = new Error('approval required'); error.code = 'COMMAND_APPROVAL_REQUIRED'; throw error; } },
  });
  await assert.rejects(() => manager.create({ projectId: 'p1', principalId: 'alice', taskId: 'task-1', shell: process.execPath, shellKind: 'bash' }), /approval required/i);
  assert.equal(client.calls.some(([method]) => method === 'session/create'), false);
  await manager.close();
});

test('application terminal manager shares command governance and shell codec with task execution', async () => {
  const { readFile } = await import('node:fs/promises');
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /const shellCommandCodec = new ShellCommandCodec/);
  assert.match(app, /shellCodec:\s*shellCommandCodec/);
  assert.match(app, /commandGovernance:\s*commandExecutionGovernance/);
});


test('terminal websocket forwards bounded shell identity and task scope instead of dropping them', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/server/terminal-websocket.mjs', import.meta.url), 'utf8');
  assert.match(source, /taskId:\s*String\(message\.taskId/);
  assert.match(source, /shellKind:\s*String\(message\.shellKind/);
  assert.match(source, /distribution:\s*message\.distribution/);
  assert.match(source, /env:\s*message\.env/);
});
