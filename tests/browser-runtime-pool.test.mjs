import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { BrowserAgentService } from '../src/browser/browser-agent-service.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-browser-pool-'));
  const driverCalls = [];
  const poolCalls = [];
  const driver = {
    detect: async () => ({ available: true, version: '1.0.0' }),
    run: async (input) => { driverCalls.push(input); return { exitCode: 0, stdout: 'ok', stderr: '', durationMs: 1 }; },
  };
  const leasePool = {
    async run(input, fn) { poolCalls.push(input); return fn({ key: input.key }); },
  };
  const service = new BrowserAgentService({ driver, leasePool, browserRoot: root, getProject: (id) => ({ id, workspaceRoot: root }), lookup: async () => [{ address: '93.184.216.34', family: 4 }] });
  return { root, service, driverCalls, poolCalls };
}

test('BrowserAgentService admits actions through project-scoped leases and attributes task context', async (t) => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  await f.service.goto({ projectId: 'project-a', url: 'https://example.com', leaseContext: { missionId: 'm1', taskId: 't1', action: 'goto' } });
  assert.equal(f.driverCalls.length, 1);
  assert.deepEqual(f.poolCalls[0], { key: 'project-a', missionId: 'm1', taskId: 't1', signal: null, metadata: { action: 'goto' } });
});

test('BrowserAgentService releases the lease when driver execution fails', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-browser-pool-fail-')); t.after(() => rm(root, { recursive: true, force: true }));
  let entered = 0; let exited = 0;
  const service = new BrowserAgentService({
    browserRoot: root,
    getProject: (id) => ({ id, workspaceRoot: root }),
    driver: { detect: async () => ({ available: true }), run: async () => ({ exitCode: 2, stdout: '', stderr: 'bad' }) },
    leasePool: { async run(_input, fn) { entered += 1; try { return await fn({}); } finally { exited += 1; } } },
  });
  await assert.rejects(service.click({ projectId: 'p', target: 'button' }), /Browser action failed/);
  assert.equal(entered, 1);
  assert.equal(exited, 1);
});

test('BrowserAgentService does not invoke the driver when lease admission rejects', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-browser-pool-block-')); t.after(() => rm(root, { recursive: true, force: true }));
  let driverCalls = 0;
  const blocked = Object.assign(new Error('browser admission blocked'), { code: 'RUNTIME_LEASE_ADMISSION_BLOCKED' });
  const service = new BrowserAgentService({
    browserRoot: root,
    getProject: (id) => ({ id, workspaceRoot: root }),
    driver: { detect: async () => ({ available: true }), run: async () => { driverCalls += 1; return { exitCode: 0 }; } },
    leasePool: { async run() { throw blocked; } },
  });
  await assert.rejects(service.snapshot({ projectId: 'p' }), (error) => error.code === 'RUNTIME_LEASE_ADMISSION_BLOCKED');
  assert.equal(driverCalls, 0);
});
