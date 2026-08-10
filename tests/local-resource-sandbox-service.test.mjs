import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { LocalResourceSandboxService } from '../src/sandbox/local-resource-sandbox-service.mjs';

async function setup(t, overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-local-sandbox-'));
  const workspace = path.join(root, 'workspace');
  await mkdir(workspace);
  await writeFile(path.join(workspace, 'seed.txt'), '1234');
  const samples = overrides.samples ?? [
    { cpuTimeMs: 100, rssBytes: 10 * 1024 * 1024, processCount: 1, pids: [500] },
    { cpuTimeMs: 300, rssBytes: 100 * 1024 * 1024, processCount: 3, pids: [500, 501, 502] },
    { cpuTimeMs: 500, rssBytes: 100 * 1024 * 1024, processCount: 3, pids: [500, 501, 502] },
  ];
  const proc = {
    sampleIndex: 0,
    terminations: [],
    async sampleTree() { return samples[Math.min(this.sampleIndex++, samples.length - 1)]; },
    async terminateTree(pid, options) { this.terminations.push([pid, options]); return { terminated: [pid], signal: options.signal }; },
  };
  const cgroup = overrides.cgroup ?? {
    created: [], attached: [], removed: [],
    async available() { return false; },
    async createLease(id, limits) { const lease = { id, path: `/fake/${id}`, mode: 'cgroup-v2' }; this.created.push([id, limits]); return lease; },
    async attach(lease, pid) { this.attached.push([lease.id, pid]); },
    async sample() { return { cpuTimeMs: 10, rssBytes: 20, processCount: 1, pids: [] }; },
    async remove(lease) { this.removed.push(lease.id); },
  };
  let now = 1_000;
  const events = [];
  const service = new LocalResourceSandboxService({
    file: path.join(root, 'sandboxes.db'),
    projectResolver: (id) => id === 'p1' ? { id, workspaceRoot: workspace } : null,
    procDriver: proc,
    cgroupDriver: cgroup,
    clockMs: () => now,
    autoMonitor: false,
    eventSink: (event) => events.push(event),
    ...overrides.service,
  });
  t.after(() => { service.close(); return rm(root, { recursive: true, force: true }); });
  return { root, workspace, proc, cgroup, service, events, advance(ms) { now += ms; } };
}

const limits = { cpuPercent: 50, memoryBytes: 64 * 1024 * 1024, processCount: 2, diskBytes: 1024 * 1024, sampleIntervalMs: 250, violationGraceSamples: 2 };

test('local sandbox validates scope and creates a content-addressed watchdog lease', async (t) => {
  const { service, workspace } = await setup(t);
  await assert.rejects(() => service.createLease({ projectId: 'missing', workspaceRoot: workspace, principalId: 'alice', limits }), /unknown project/i);
  await assert.rejects(() => service.createLease({ projectId: 'p1', workspaceRoot: path.dirname(workspace), principalId: 'alice', limits }), /workspace root/i);
  await assert.rejects(() => service.createLease({ projectId: 'p1', workspaceRoot: workspace, principalId: '', limits }), /principal/i);

  const lease = await service.createLease({ id: 'lease-1', projectId: 'p1', workspaceRoot: workspace, principalId: 'alice', limits });
  assert.equal(lease.mode, 'watchdog-terminate');
  assert.equal(lease.state, 'created');
  assert.match(lease.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(service.list({ projectId: 'p1', principalId: 'alice' }).length, 1);
  await service.createLease({ id: 'lease-other', projectId: 'p1', workspaceRoot: workspace, principalId: 'bob', limits });
  assert.deepEqual(service.list({ projectId: 'p1', principalId: 'alice' }).map((item) => item.id), ['lease-1']);
  assert.throws(() => service.status('lease-1', { projectId: 'p1', principalId: 'bob' }), /scope denied/i);
});

test('watchdog requires consecutive violations before terminating the attached process tree', async (t) => {
  const { service, workspace, proc, advance, events } = await setup(t);
  await service.createLease({ id: 'lease-2', projectId: 'p1', workspaceRoot: workspace, principalId: 'alice', limits });
  const attached = await service.attachProcess('lease-2', 500, { projectId: 'p1', principalId: 'alice' });
  assert.equal(attached.state, 'active');

  const first = await service.sample('lease-2', { projectId: 'p1', principalId: 'alice' });
  assert.equal(first.usage.cpuPercent, 0);
  assert.equal(first.state, 'active');
  advance(1_000);
  const pressure = await service.sample('lease-2', { projectId: 'p1', principalId: 'alice' });
  assert.equal(pressure.usage.cpuPercent, 20);
  assert.deepEqual(pressure.violations.map((item) => item.dimension).sort(), ['memory', 'process']);
  assert.equal(pressure.state, 'pressure');
  assert.equal(proc.terminations.length, 0);
  advance(1_000);
  const violated = await service.sample('lease-2', { projectId: 'p1', principalId: 'alice' });
  assert.equal(violated.state, 'violated');
  assert.equal(proc.terminations.length, 1);
  assert.equal(events.at(-1).type, 'local-resource-sandbox.violation');
  assert.match(violated.receiptSha256, /^[a-f0-9]{64}$/);
});

test('service selects cgroup v2, attaches PID, and cleans the group on close', { skip: process.platform !== 'linux' ? 'cgroup v2 is Linux-only' : false }, async (t) => {
  const cgroup = {
    created: [], attached: [], removed: [],
    async available() { return true; },
    async createLease(id, inputLimits) { this.created.push([id, inputLimits]); return { id, path: `/fake/${id}`, mode: 'cgroup-v2' }; },
    async attach(lease, pid) { this.attached.push([lease.id, pid]); },
    async sample() { return { cpuTimeMs: 10, rssBytes: 20, processCount: 1, pids: [] }; },
    async remove(lease) { this.removed.push(lease.id); },
  };
  const { service, workspace } = await setup(t, { cgroup });
  const lease = await service.createLease({ id: 'lease-3', projectId: 'p1', workspaceRoot: workspace, principalId: 'alice', limits });
  assert.equal(lease.mode, 'cgroup-v2');
  assert.equal(lease.cgroupPath, '/fake/lease-3');
  await service.attachProcess('lease-3', 777, { projectId: 'p1', principalId: 'alice' });
  assert.deepEqual(cgroup.attached, [['lease-3', 777]]);
  const closed = await service.closeLease('lease-3', { projectId: 'p1', principalId: 'alice', terminate: false });
  assert.equal(closed.state, 'closed');
  assert.deepEqual(cgroup.removed, ['lease-3']);
});

test('capabilities report bounded local enforcement without claiming unsupported OS sandboxes', async (t) => {
  const { service } = await setup(t);
  const capabilities = await service.capabilities();
  assert.equal(capabilities.watchdogTerminate, true);
  assert.equal(capabilities.windowsJobObjects, false);
  assert.equal(capabilities.macOsSandbox, false);
  assert.equal(capabilities.podman, false);
  assert.deepEqual(capabilities.limits, ['cpu', 'memory', 'process', 'disk']);
});
