import test from 'node:test';
import assert from 'node:assert/strict';
import { HostedLifecycleCoordinator } from '../src/orchestration/hosted-lifecycle-coordinator.mjs';

function adapter({ ci = [{ status: 'success', conclusion: 'success', id: 'ci-1' }] } = {}) {
  const calls = [];
  return {
    calls,
    capabilities: Object.freeze({ createBranch: true, createPullRequest: true, readCi: true, comment: true, merge: false }),
    async createBranch(input) { calls.push(['createBranch', input]); return { branch: input.branchName, receiptSha256: 'a'.repeat(64) }; },
    async createPullRequest(input) { calls.push(['createPullRequest', input]); return { id: 17, url: 'https://example.invalid/pr/17', receiptSha256: 'b'.repeat(64) }; },
    async readCi(input) { calls.push(['readCi', input]); return ci.shift() ?? { status: 'pending', conclusion: null, id: 'ci-pending' }; },
    async comment(input) { calls.push(['comment', input]); return { id: 9, receiptSha256: 'c'.repeat(64) }; },
  };
}

const verification = Object.freeze({ status: 'pass', commit: '1'.repeat(40), receiptSha256: 'd'.repeat(64) });

test('returns an explicit external gate when no hosted adapter is operated', () => {
  const coordinator = new HostedLifecycleCoordinator();
  const run = coordinator.start({ projectId: 'p1', missionId: 'm1', provider: 'github', issueId: '42' });
  assert.equal(run.state, 'external-gate');
  assert.equal(run.externalGate, true);
  assert.equal(run.reason, 'HOSTED_ADAPTER_NOT_OPERATED');
  assert.match(run.receiptSha256, /^[a-f0-9]{64}$/);
});

test('advances only through legal verified branch, pull request, CI and human merge states', async () => {
  const hosted = adapter();
  const coordinator = new HostedLifecycleCoordinator({ adapter: hosted });
  const started = coordinator.start({ projectId: 'p1', missionId: 'm1', provider: 'github', issueId: '42', sourceCommit: '1'.repeat(40), targetBranch: 'main' });
  assert.equal(started.state, 'awaiting-local-verification');
  await assert.rejects(() => coordinator.advance(started.id), /local verification/i);

  const verified = coordinator.recordLocalVerification(started.id, verification);
  assert.equal(verified.state, 'ready-to-publish');
  const branch = await coordinator.advance(started.id);
  assert.equal(branch.state, 'branch-created');
  const pr = await coordinator.advance(started.id);
  assert.equal(pr.state, 'pull-request-open');
  const ci = await coordinator.advance(started.id);
  assert.equal(ci.state, 'awaiting-human-merge');
  assert.equal(ci.humanMergeRequired, true);
  assert.equal(hosted.capabilities.merge, false);
  await assert.rejects(() => coordinator.advance(started.id), /human merge/i);
  assert.deepEqual(hosted.calls.map(([name]) => name), ['createBranch', 'createPullRequest', 'readCi']);
});

test('bounds CI repair attempts and requires a new local verification before republishing', async () => {
  const hosted = adapter({ ci: [
    { status: 'completed', conclusion: 'failure', id: 'ci-1' },
    { status: 'completed', conclusion: 'failure', id: 'ci-2' },
    { status: 'completed', conclusion: 'failure', id: 'ci-3' },
  ] });
  const coordinator = new HostedLifecycleCoordinator({ adapter: hosted, maxRepairAttempts: 2 });
  const started = coordinator.start({ projectId: 'p1', missionId: 'm1', provider: 'github', issueId: '42', sourceCommit: '1'.repeat(40), targetBranch: 'main' });
  coordinator.recordLocalVerification(started.id, verification);
  await coordinator.advance(started.id);
  await coordinator.advance(started.id);
  let failed = await coordinator.advance(started.id);
  assert.equal(failed.state, 'repair-required');

  let repair = await coordinator.requestRepair(started.id, { strategyId: 'targeted', receiptSha256: 'e'.repeat(64) });
  assert.equal(repair.state, 'awaiting-local-verification');
  assert.equal(repair.repairAttempts, 1);
  coordinator.recordLocalVerification(started.id, { ...verification, receiptSha256: 'f'.repeat(64) });
  failed = await coordinator.advance(started.id);
  assert.equal(failed.state, 'repair-required');

  repair = await coordinator.requestRepair(started.id, { strategyId: 'alternate', receiptSha256: '1'.repeat(64) });
  assert.equal(repair.repairAttempts, 2);
  coordinator.recordLocalVerification(started.id, { ...verification, receiptSha256: '2'.repeat(64) });
  failed = await coordinator.advance(started.id);
  assert.equal(failed.state, 'repair-exhausted');
  await assert.rejects(() => coordinator.requestRepair(started.id, { strategyId: 'third', receiptSha256: '3'.repeat(64) }), /repair limit/i);
});
