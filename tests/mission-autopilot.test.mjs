import test from 'node:test';
import assert from 'node:assert/strict';

import { MissionAutopilot } from '../src/orchestration/mission-autopilot.mjs';

test('MissionAutopilot runs, automatically verifies, and stops only when the mission is completed', async () => {
  const calls = [];
  let index = 0;
  const store = {
    getMission() { return { id: 'mission-1', status: index >= 2 ? 'completed' : 'running' }; },
  };
  const missionRunner = {
    async runNext(input) {
      calls.push(['run', input.workerId, input.providerId]);
      if (index >= 2) return null;
      index += 1;
      return { task: { id: `task-${index}`, status: 'review', leaseOwner: input.workerId, fencingToken: index }, lease: { fencingToken: index } };
    },
    async verify(input) { calls.push(['verify', input.taskId, input.fencingToken]); return { task: { id: input.taskId, status: 'done' } }; },
  };
  const verificationRunner = {
    async runTask(taskId) { calls.push(['gate', taskId]); return { status: 'pass', evidence: [{ status: 'pass', commit: 'abc', artifactSha256: 'a'.repeat(64), receiptSha256: 'b'.repeat(64) }] }; },
  };
  const autopilot = new MissionAutopilot({ store, missionRunner, verificationRunner });
  const result = await autopilot.run({ missionId: 'mission-1', providerId: 'auto', workerId: 'desktop', maxTasks: 4 });
  assert.equal(result.status, 'completed');
  assert.equal(result.completedTasks, 2);
  assert.deepEqual(calls.map((item) => item[0]), ['run', 'gate', 'verify', 'run', 'gate', 'verify']);
});

test('MissionAutopilot fails closed on verification failure and respects cancellation', async () => {
  const store = { getMission: () => ({ id: 'mission-1', status: 'running' }) };
  const missionRunner = { async runNext() { return { task: { id: 'task-1', status: 'review', leaseOwner: 'w', fencingToken: 1 }, lease: { fencingToken: 1 } }; }, async verify() { throw new Error('must not verify'); } };
  const verificationRunner = { async runTask() { return { status: 'fail', evidence: [] }; } };
  const autopilot = new MissionAutopilot({ store, missionRunner, verificationRunner });
  await assert.rejects(() => autopilot.run({ missionId: 'mission-1', workerId: 'w' }), /verification failed/i);

  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => autopilot.run({ missionId: 'mission-1', workerId: 'w', signal: controller.signal }), /cancelled/i);
});

test('MissionAutopilot rejects unbounded execution and no-progress scheduling', async () => {
  const store = { getMission: () => ({ id: 'mission-1', status: 'running' }) };
  const autopilot = new MissionAutopilot({ store, missionRunner: { async runNext() { return null; }, async verify() {} }, verificationRunner: { async runTask() {} } });
  await assert.rejects(() => autopilot.run({ missionId: 'mission-1', maxTasks: 0 }), /maxTasks/i);
  await assert.rejects(() => autopilot.run({ missionId: 'mission-1', maxTasks: 2 }), /no ready task/i);
});

test('MissionAutopilot records a failed verification transition before stopping', async () => {
  const calls = [];
  const store = { getMission: () => ({ id: 'mission-1', status: 'running' }) };
  const report = { status: 'fail', evidence: [{ kind: 'verification-command', status: 'fail', summary: 'npm test failed.' }] };
  const missionRunner = {
    async runNext() { return { task: { id: 'task-1', status: 'review', leaseOwner: 'w', fencingToken: 1 }, lease: { fencingToken: 1 } }; },
    async verify() { throw new Error('must not verify'); },
    async rejectVerification(input) { calls.push(input); return { task: { id: input.taskId, status: 'failed' } }; },
  };
  const verificationRunner = { async runTask() { return report; } };
  const autopilot = new MissionAutopilot({ store, missionRunner, verificationRunner });

  await assert.rejects(() => autopilot.run({ missionId: 'mission-1', workerId: 'w' }), /npm test failed/i);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].taskId, 'task-1');
  assert.equal(calls[0].report, report);
});

test('MissionAutopilot uses bounded self-fix for a new test regression and reruns full verification before completion', async () => {
  const calls = [];
  let completed = false;
  let gateRuns = 0;
  const store = { getMission: () => ({ id: 'mission-1', status: completed ? 'completed' : 'running' }) };
  const task = { id: 'task-1', projectId: 'p1', missionId: 'mission-1', status: 'review', leaseOwner: 'w', fencingToken: 1, metadata: { testBaseline: { output: 'src/a.mjs:1:1 error OLD: existing' }, testMatrix: { relatedTests: ['tests/a.test.mjs'] } } };
  const missionRunner = {
    async runNext() { calls.push('run'); return { task, lease: { fencingToken: 1 } }; },
    async verify() { calls.push('verify'); completed = true; return { task: { ...task, status: 'done' } }; },
    async rejectVerification() { throw new Error('must not reject after successful self-fix'); },
  };
  const verificationRunner = {
    async runTask() {
      gateRuns += 1;
      calls.push(`gate-${gateRuns}`);
      return gateRuns === 1
        ? { status: 'fail', evidence: [{ kind: 'test-file', status: 'fail', receiptSha256: 'a'.repeat(64), summary: 'related test failed' }] }
        : { status: 'pass', evidence: [{ kind: 'test-full', status: 'pass', commit: 'abc', artifactSha256: 'b'.repeat(64), receiptSha256: 'c'.repeat(64) }] };
    },
  };
  const selfFixInputs = [];
  const selfFixFactory = async (input) => {
    selfFixInputs.push(input);
    return { async run(request) { calls.push('self-fix'); assert.equal(request.test.scope, 'file'); assert.equal(request.test.path, 'tests/a.test.mjs'); assert.match(request.baselineOutput, /OLD/); return { status: 'pass', attempts: 1, receipt: { receiptSha256: 'd'.repeat(64) } }; } };
  };
  const autopilot = new MissionAutopilot({ store, missionRunner, verificationRunner, selfFixFactory });

  const result = await autopilot.run({ missionId: 'mission-1', workerId: 'w', providerId: 'auto' });

  assert.equal(result.status, 'completed');
  assert.equal(selfFixInputs.length, 1);
  assert.deepEqual(calls, ['run', 'gate-1', 'self-fix', 'gate-2', 'verify']);
  assert.equal(result.reports[0].selfFix.status, 'pass');
});

test('MissionAutopilot fails closed when bounded self-fix cannot make progress', async () => {
  const calls = [];
  const store = { getMission: () => ({ id: 'mission-1', status: 'running' }) };
  const report = { status: 'fail', evidence: [{ kind: 'test-package', status: 'fail', summary: 'package tests failed' }] };
  const missionRunner = {
    async runNext() { return { task: { id: 'task-1', status: 'review', leaseOwner: 'w', fencingToken: 1, metadata: { selfFix: { enabled: true }, testBaseline: { output: '' } } }, lease: { fencingToken: 1 } }; },
    async verify() { throw new Error('must not verify'); },
    async rejectVerification(input) { calls.push(['reject', input.report]); },
  };
  const autopilot = new MissionAutopilot({
    store,
    missionRunner,
    verificationRunner: { async runTask() { return report; } },
    selfFixFactory: async () => ({ async run() { return { status: 'blocked', reason: 'no-progress', attempts: 2 }; } }),
  });

  await assert.rejects(() => autopilot.run({ missionId: 'mission-1', workerId: 'w' }), /package tests failed/i);
  assert.equal(calls.length, 1);
});
