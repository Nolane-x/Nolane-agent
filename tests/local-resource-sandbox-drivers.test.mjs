import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { measureWorkspace } from '../src/sandbox/workspace-disk-meter.mjs';
import { LinuxProcResourceDriver } from '../src/sandbox/linux-proc-resource-driver.mjs';
import { CgroupV2ResourceDriver } from '../src/sandbox/cgroup-v2-resource-driver.mjs';

async function temp(t, prefix) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function procStat({ pid, ppid, utime, stime, rssPages, name = 'node worker' }) {
  const fields = [
    'S', String(ppid), '0', '0', '0', '0', '0', '0', '0', '0', '0',
    String(utime), String(stime), '0', '0', '0', '0', '1', '0', '100', '0', String(rssPages),
  ];
  return `${pid} (${name}) ${fields.join(' ')}\n`;
}

async function writeProc(root, spec) {
  const dir = path.join(root, String(spec.pid));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'stat'), procStat(spec));
}

test('workspace disk meter is bounded and does not follow symlinks outside the workspace', async (t) => {
  const root = await temp(t, 'forge-disk-meter-');
  const outside = await temp(t, 'forge-disk-outside-');
  await mkdir(path.join(root, 'nested'));
  await writeFile(path.join(root, 'a.txt'), '12345');
  await writeFile(path.join(root, 'nested', 'b.bin'), Buffer.alloc(7));
  await writeFile(path.join(outside, 'secret.bin'), Buffer.alloc(10_000));
  await symlink(path.join(outside, 'secret.bin'), path.join(root, 'outside-link'));

  const measured = await measureWorkspace(root, { maxEntries: 100, maxBytes: 1_000_000 });
  assert.equal(measured.bytes, 12);
  assert.equal(measured.files, 2);
  assert.equal(measured.directories, 2);
  assert.equal(measured.symlinks, 1);
  assert.equal(measured.truncated, false);

  const bounded = await measureWorkspace(root, { maxEntries: 1, maxBytes: 1_000_000 });
  assert.equal(bounded.truncated, true);
  assert.equal(bounded.reason, 'entry-limit');
});

test('Linux proc driver aggregates descendants and terminates children before the root', async (t) => {
  const procRoot = await temp(t, 'forge-proc-');
  await writeProc(procRoot, { pid: 100, ppid: 1, utime: 20, stime: 5, rssPages: 10 });
  await writeProc(procRoot, { pid: 101, ppid: 100, utime: 10, stime: 2, rssPages: 5 });
  await writeProc(procRoot, { pid: 102, ppid: 101, utime: 3, stime: 1, rssPages: 2 });
  await writeProc(procRoot, { pid: 200, ppid: 1, utime: 999, stime: 999, rssPages: 999 });
  const signals = [];
  const driver = new LinuxProcResourceDriver({ procRoot, clockTicks: 100, pageSize: 4096, kill: (pid, signal) => signals.push([pid, signal]) });

  const sample = await driver.sampleTree(100);
  assert.deepEqual(sample.pids, [100, 101, 102]);
  assert.equal(sample.processCount, 3);
  assert.equal(sample.cpuTimeMs, 410);
  assert.equal(sample.rssBytes, 17 * 4096);

  await driver.terminateTree(100, { signal: 'SIGTERM' });
  assert.deepEqual(signals, [[102, 'SIGTERM'], [101, 'SIGTERM'], [100, 'SIGTERM']]);
});

test('cgroup v2 driver writes bounded limits, attaches PID, samples usage, and removes lease', async (t) => {
  const root = await temp(t, 'forge-cgroup-');
  await writeFile(path.join(root, 'cgroup.controllers'), 'cpu memory pids');
  const driver = new CgroupV2ResourceDriver({ root });
  assert.equal(await driver.available(), true);

  const lease = await driver.createLease('lease-1', { cpuPercent: 150, memoryBytes: 64 * 1024 * 1024, processCount: 32 });
  assert.equal((await readFile(path.join(lease.path, 'cpu.max'), 'utf8')).trim(), '150000 100000');
  assert.equal((await readFile(path.join(lease.path, 'memory.max'), 'utf8')).trim(), String(64 * 1024 * 1024));
  assert.equal((await readFile(path.join(lease.path, 'pids.max'), 'utf8')).trim(), '32');

  await driver.attach(lease, 321);
  assert.equal((await readFile(path.join(lease.path, 'cgroup.procs'), 'utf8')).trim(), '321');
  await writeFile(path.join(lease.path, 'cpu.stat'), 'usage_usec 12345\nuser_usec 10000\nsystem_usec 2345\n');
  await writeFile(path.join(lease.path, 'memory.current'), '4096\n');
  await writeFile(path.join(lease.path, 'pids.current'), '3\n');
  const sample = await driver.sample(lease);
  assert.deepEqual(sample, { cpuTimeMs: 12.345, rssBytes: 4096, processCount: 3, pids: [] });

  await driver.remove(lease);
  await assert.rejects(() => readFile(path.join(lease.path, 'cpu.max'), 'utf8'), /ENOENT/);
});

test('platform driver uses bounded Windows CIM process-tree metrics and taskkill tree termination', async () => {
  const { createPlatformResourceDriver } = await import('../src/sandbox/platform-resource-driver.mjs');
  const calls = [];
  const executor = async (command, args) => {
    calls.push([command, args]);
    if (/powershell/i.test(command)) return { stdout: JSON.stringify([
      { ProcessId: 10, ParentProcessId: 1, KernelModeTime: 100000, UserModeTime: 200000, WorkingSetSize: 4096 },
      { ProcessId: 11, ParentProcessId: 10, KernelModeTime: 50000, UserModeTime: 50000, WorkingSetSize: 2048 },
      { ProcessId: 99, ParentProcessId: 1, KernelModeTime: 9, UserModeTime: 9, WorkingSetSize: 9999 },
    ]) };
    return { stdout: 'SUCCESS' };
  };
  const driver = createPlatformResourceDriver({ platform: 'win32', executor });
  const sample = await driver.sampleTree(10);
  assert.deepEqual(sample.pids, [10, 11]);
  assert.equal(sample.cpuTimeMs, 40);
  assert.equal(sample.rssBytes, 6144);
  assert.equal(sample.processCount, 2);
  await driver.terminateTree(10, { signal: 'SIGTERM' });
  assert.match(calls.at(-1)[0], /taskkill/i);
  assert.deepEqual(calls.at(-1)[1], ['/PID', '10', '/T', '/F']);
});

test('Linux process driver exposes identity-safe killTree and liveness contracts', async (t) => {
  const procRoot = await temp(t, 'forge-proc-contract-');
  await writeProc(procRoot, { pid: 300, ppid: 1, utime: 1, stime: 1, rssPages: 1 });
  await writeProc(procRoot, { pid: 301, ppid: 300, utime: 1, stime: 1, rssPages: 1 });
  const signals = [];
  const driver = new LinuxProcResourceDriver({ procRoot, kill: (pid, signal) => signals.push([pid, signal]) });
  const sample = await driver.sampleTree(300);
  assert.deepEqual(sample.rootIdentity, { pid: 300, startTimeTicks: 100 });
  assert.equal(await driver.isTreeAlive(300), true);
  await driver.killTree(300, { signal: 'SIGTERM', expectedRootIdentity: sample.rootIdentity });
  assert.deepEqual(signals, [[301, 'SIGTERM'], [300, 'SIGTERM']]);
  await assert.rejects(() => driver.killTree(300, { signal: 'SIGKILL', expectedRootIdentity: { pid: 300, startTimeTicks: 999 } }), /identity/i);
});
