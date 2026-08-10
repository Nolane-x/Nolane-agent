import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { PodmanSandboxDriver } from '../src/sandbox/podman-sandbox-driver.mjs';
import { WindowsJobObjectDriver } from '../src/sandbox/windows-job-object-driver.mjs';
import { MacOsSandboxDriver } from '../src/sandbox/macos-sandbox-driver.mjs';

test('Podman driver is fail-closed and builds a bounded no-shell container contract', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-podman-'));
  const workspace = path.join(root, 'workspace'); await mkdir(workspace);
  const calls = [];
  const driver = new PodmanSandboxDriver({ runner: async (command, args, options) => {
    calls.push({ command, args, options });
    if (args[0] === 'version') return { stdout: JSON.stringify({ Client: { Version: '5.0.0' } }), stderr: '' };
    if (args[0] === 'create') return { stdout: 'container-id\n', stderr: '' };
    return { stdout: '', stderr: '' };
  } });
  assert.equal((await driver.capabilities()).available, true);
  const result = await driver.create({ id: 'task-1', image: 'node:22-alpine', workspaceRoot: workspace, limits: { cpuPercent: 150, memoryBytes: 536870912, processCount: 64 }, command: ['node', '--version'] });
  assert.equal(result.containerId, 'container-id');
  const args = calls.find((call) => call.args[0] === 'create').args;
  assert.ok(args.includes('--network=none'));
  assert.ok(args.includes('--read-only'));
  assert.ok(args.includes('--pids-limit=64'));
  assert.ok(args.includes('--cpus=1.5'));
  assert.ok(args.includes('--memory=536870912'));
  assert.ok(args.includes(`${result.workspaceRoot}:/workspace:rw,rprivate,nosuid,nodev`));
  assert.equal(args.at(-3), 'node:22-alpine');
  assert.deepEqual(args.slice(-2), ['node', '--version']);
  assert.equal(calls.some((call) => typeof call.command !== 'string' || call.command.includes(' ')), false);
});

test('Podman driver rejects unavailable runtime and unsafe image or workspace', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-podman-deny-'));
  const driver = new PodmanSandboxDriver({ runner: async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); } });
  assert.equal((await driver.capabilities()).available, false);
  await assert.rejects(() => driver.create({ id: 'x', image: 'bad image;rm', workspaceRoot: root, limits: { cpuPercent: 100, memoryBytes: 1, processCount: 1 } }), /image reference/i);
  await assert.rejects(() => driver.create({ id: 'x', image: 'node:22', workspaceRoot: root, limits: { cpuPercent: 100, memoryBytes: 1, processCount: 1 } }), (error) => error.code === 'PODMAN_UNAVAILABLE');
});

test('Windows Job Object driver refuses non-Windows hosts and uses a bounded native-helper protocol', async () => {
  const linux = new WindowsJobObjectDriver({ platform: 'linux', runner: async () => ({ stdout: '{}' }) });
  assert.equal((await linux.capabilities()).available, false);
  await assert.rejects(() => linux.create({ id: 'job-1', limits: { cpuPercent: 100, memoryBytes: 1024, processCount: 3 } }), (error) => error.code === 'WINDOWS_JOB_OBJECT_UNAVAILABLE');
  const calls = [];
  const win = new WindowsJobObjectDriver({ platform: 'win32', helperPath: 'forge-job-object.exe', runner: async (command, args) => { calls.push({ command, args }); return { stdout: args[0] === 'capabilities' ? '{"jobObjects":true,"version":"1"}' : '{"ok":true}' }; } });
  assert.equal((await win.capabilities()).available, true);
  await win.create({ id: 'job-1', limits: { cpuPercent: 125, memoryBytes: 268435456, processCount: 32 } });
  await win.attach({ id: 'job-1', pid: 1234 });
  assert.deepEqual(calls.find((call) => call.args[0] === 'create').args, ['create', '--id', 'job-1', '--cpu-percent', '125', '--memory-bytes', '268435456', '--process-count', '32']);
  assert.deepEqual(calls.find((call) => call.args[0] === 'attach').args, ['attach', '--id', 'job-1', '--pid', '1234']);
});

test('macOS sandbox driver refuses non-macOS hosts and writes a deny-default profile', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-macos-sandbox-'));
  const linux = new MacOsSandboxDriver({ platform: 'linux', runner: async () => ({ stdout: '' }) });
  assert.equal((await linux.capabilities()).available, false);
  await assert.rejects(() => linux.prepare({ id: 'mac-1', workspaceRoot: root, command: ['node', '--version'] }), (error) => error.code === 'MACOS_SANDBOX_UNAVAILABLE');
  const calls = [];
  const mac = new MacOsSandboxDriver({ platform: 'darwin', profileRoot: path.join(root, 'profiles'), runner: async (command, args) => { calls.push({ command, args }); return { stdout: '', stderr: '' }; } });
  assert.equal((await mac.capabilities()).available, true);
  assert.deepEqual(calls[0], { command: '/usr/bin/sandbox-exec', args: ['-p', '(version 1) (allow default)', '/usr/bin/true'] });
  const prepared = await mac.prepare({ id: 'mac-1', workspaceRoot: root, command: ['node', '--version'], allowNetwork: false });
  assert.match(prepared.profile, /\(deny default\)/);
  assert.match(prepared.profile, /\(deny network\*\)/);
  assert.match(prepared.profile, /file-write\*/);
  assert.equal(prepared.command, '/usr/bin/sandbox-exec');
  assert.deepEqual(prepared.args.slice(-2), ['node', '--version']);
});
