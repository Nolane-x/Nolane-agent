import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';

import { PtyHostClient } from '../src/terminal/pty-host-client.mjs';
import { TerminalService } from '../src/terminal/terminal-service.mjs';

const fixture = path.resolve('tests/fixtures/fake-pty-host.mjs');

async function setup(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-terminal-'));
  await mkdir(path.join(root, 'nested'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const client = new PtyHostClient({ command: process.execPath, args: [fixture], requestTimeoutMs: 2_000, maxFrameBytes: 64 * 1024 });
  t.after(() => client.close());
  await client.start();
  const service = new TerminalService({ client, workspaceRoot: root, allowedShells: [process.execPath], maxSessions: 2 });
  return { root, client, service };
}

test('PTY client initializes and terminal service creates, streams, snapshots, resizes, and terminates sessions', async (t) => {
  const { root, service } = await setup(t);
  const output = [];
  service.on('output', (event) => output.push(event));
  const created = await service.create({ cwd: path.join(root, 'nested'), shell: process.execPath, args: ['-e', ''], cols: 100, rows: 30 });
  assert.equal(created.state, 'running');
  assert.equal(created.cols, 100);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.match(Buffer.from(output[0].data, 'base64').toString(), /^ready:/);
  await service.input(created.id, 'hello');
  await service.resize(created.id, 120, 40);
  const snapshot = await service.snapshot(created.id, 0);
  assert.equal(snapshot.chunks.length, 2);
  assert.equal(Buffer.from(snapshot.chunks.at(-1).data, 'base64').toString(), 'hello');
  const terminated = await service.terminate(created.id);
  assert.equal(terminated.terminated, true);
});

test('terminal service rejects paths outside the workspace, disallowed shells, and session overflow', async (t) => {
  const { root, service } = await setup(t);
  await assert.rejects(() => service.create({ cwd: path.dirname(root), shell: process.execPath }), /outside workspace/i);
  await assert.rejects(() => service.create({ cwd: root, shell: '/definitely/not/allowed' }), /shell is not allowed/i);
  await service.create({ cwd: root, shell: process.execPath });
  await service.create({ cwd: root, shell: process.execPath });
  await assert.rejects(() => service.create({ cwd: root, shell: process.execPath }), /terminal session limit/i);
});

test('PTY client rejects oversized frames and pending requests on host exit', async (t) => {
  const script = `process.stdin.resume(); process.stdout.write(JSON.stringify({method:'x',params:{data:'${'x'.repeat(4096)}'}})+'\\n'); setTimeout(()=>process.exit(0),20)`;
  const client = new PtyHostClient({ command: process.execPath, args: ['-e', script], requestTimeoutMs: 200, maxFrameBytes: 512 });
  t.after(() => client.close());
  await assert.rejects(() => client.start(), /frame exceeds/i);
});

test('PTY startup timeout is independent from ordinary request timeout during protocol validation', async (t) => {
  const script = `process.stdin.resume(); setTimeout(() => process.stdout.write(JSON.stringify({method:'x',params:{data:'${'x'.repeat(4096)}'}})+'\\n'), 150)`;
  const client = new PtyHostClient({
    command: process.execPath,
    args: ['-e', script],
    requestTimeoutMs: 50,
    startupTimeoutMs: 500,
    maxFrameBytes: 512,
  });
  t.after(() => client.close());
  await assert.rejects(() => client.start(), /frame exceeds/i);
});

test('PTY client close waits for the host process to exit before teardown completes', async () => {
  const client = new PtyHostClient({ command: process.execPath, args: [fixture], requestTimeoutMs: 2_000, maxFrameBytes: 64 * 1024 });
  await client.start();
  const child = client.child;
  await client.close();
  assert.ok(child.exitCode !== null || child.signalCode !== null);
});
