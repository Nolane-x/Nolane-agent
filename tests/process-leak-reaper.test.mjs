import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

import { ProcessLeakReaper } from '../src/runtime/process-leak-reaper.mjs';
import { createPlatformResourceDriver } from '../src/sandbox/platform-resource-driver.mjs';

const sha = (c) => c.repeat(64);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate, timeoutMs = 4_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await predicate()) return;
    await sleep(25);
  }
  throw new Error('condition timed out');
}

test('reaps a real Linux child and grandchild tree with graceful escalation evidence', { skip: process.platform !== 'linux' }, async (t) => {
  const script = `const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(c.pid);setInterval(()=>{},1000);`;
  const root = spawn(process.execPath, ['-e', script], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
  t.after(() => { try { process.kill(-root.pid, 'SIGKILL'); } catch {} });
  await new Promise((resolve, reject) => { root.stdout.once('data', resolve); root.once('error', reject); });
  const driver = createPlatformResourceDriver({ platform: 'linux' });
  const before = await driver.sampleTree(root.pid);
  assert.ok(before.pids.length >= 2);
  const reaper = new ProcessLeakReaper({ driver, sleep });
  const result = await reaper.reapMission({
    missionId: 'm-real', rootPid: root.pid, registeredPids: before.pids,
    rootIdentity: before.rootIdentity, identityReceiptSha256: sha('a'), graceMs: 100,
  });
  assert.ok(['graceful', 'escalated'].includes(result.status));
  await waitFor(async () => !(await driver.isTreeAlive(root.pid)));
  assert.equal(result.killedPids.every((pid) => before.pids.includes(pid)), true);
});

test('blocks stale PID identity and any PID outside the registered mission tree', async () => {
  const calls = [];
  const driver = {
    async sampleTree() { return { pids: [100, 101, 999], rootIdentity: { pid: 100, startTimeTicks: 5 } }; },
    async killTree(pid, options) { calls.push([pid, options]); return { terminated: [101, 100], signal: options.signal }; },
    async isTreeAlive() { return true; },
  };
  const reaper = new ProcessLeakReaper({ driver, sleep: async () => {} });
  const stale = await reaper.reapMission({ missionId: 'm1', rootPid: 100, registeredPids: [100, 101, 999], rootIdentity: { pid: 100, startTimeTicks: 4 }, identityReceiptSha256: sha('a') });
  assert.equal(stale.status, 'safety_blocked');
  assert.match(stale.reason, /identity/i);
  const outside = await reaper.reapMission({ missionId: 'm1', rootPid: 100, registeredPids: [100, 101], rootIdentity: { pid: 100, startTimeTicks: 5 }, identityReceiptSha256: sha('b') });
  assert.equal(outside.status, 'safety_blocked');
  assert.deepEqual(outside.outsideRegisteredPids, [999]);
  assert.equal(calls.length, 0);
});

test('reports unsupported, already-exited, graceful and escalated outcomes explicitly', async () => {
  const unsupported = await new ProcessLeakReaper({ driver: {} }).reapMission({ missionId: 'm', rootPid: 1, registeredPids: [1], rootIdentity: { pid: 1 }, identityReceiptSha256: sha('a') });
  assert.equal(unsupported.status, 'unsupported');

  const goneError = Object.assign(new Error('gone'), { code: 'SANDBOX_PROCESS_NOT_FOUND' });
  const gone = await new ProcessLeakReaper({ driver: { async sampleTree() { throw goneError; }, async killTree() {}, async isTreeAlive() { return false; } } }).reapMission({ missionId: 'm', rootPid: 2, registeredPids: [2], rootIdentity: { pid: 2 }, identityReceiptSha256: sha('b') });
  assert.equal(gone.status, 'already_exited');

  let aliveChecks = 0;
  const signals = [];
  const driver = {
    async sampleTree() { return { pids: [3], rootIdentity: { pid: 3, startTimeTicks: 1 } }; },
    async killTree(_pid, { signal }) { signals.push(signal); return { terminated: [3], signal }; },
    async isTreeAlive() { aliveChecks += 1; return aliveChecks === 1; },
  };
  const escalated = await new ProcessLeakReaper({ driver, sleep: async () => {} }).reapMission({ missionId: 'm', rootPid: 3, registeredPids: [3], rootIdentity: { pid: 3, startTimeTicks: 1 }, identityReceiptSha256: sha('c'), graceMs: 0 });
  assert.equal(escalated.status, 'escalated');
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
});
