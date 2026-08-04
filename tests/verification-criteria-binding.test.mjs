import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { VerificationRunner } from '../src/orchestration/verification-runner.mjs';
import { VerificationClaimGuard } from '../src/security/verification-claim-guard.mjs';

function commandResult(request) {
  const args = request.input.args ?? [];
  if (args[0] === 'rev-parse') return { status: 'pass', output: { command: 'git', args, stdout: 'a'.repeat(40) + '\n', stderr: '', exitCode: 0 }, receipt: { receiptSha256: '1'.repeat(64), durationMs: 1 } };
  if (args[0] === 'diff' && args[1] === '--binary') return { status: 'pass', output: { command: 'git', args, stdout: 'diff', stderr: '', exitCode: 0 }, receipt: { receiptSha256: '2'.repeat(64), durationMs: 1 } };
  const failed = args.includes('process.exit(7)');
  return { status: failed ? 'fail' : 'pass', output: { command: request.input.command, args, stdout: '', stderr: '', exitCode: failed ? 7 : 0 }, receipt: { receiptSha256: (failed ? '3' : '4').repeat(64), durationMs: 1 } };
}

function runner() {
  const task = {
    id: 't1', projectId: 'p1', missionId: 'm1', status: 'review',
    metadata: {
      verificationCommands: [{ command: 'node', args: ['-e', 'process.exit(0)'] }],
      taskContract: {
        successCriteria: [
          { id: 'root-fixed', description: 'Root cause is removed', sourceHash: 'b'.repeat(64), verification: { command: 'node', args: ['-e', 'process.exit(0)'] } },
          { id: 'old-tests', description: 'Existing tests still pass', sourceHash: 'c'.repeat(64), verification: { command: 'node', args: ['-e', 'process.exit(7)'] } },
        ],
        outputContract: { requiredArtifacts: [] },
      },
    },
  };
  const store = { getTask(id) { return id === 't1' ? task : null; } };
  const broker = { async execute(request) { return commandResult(request); } };
  return new VerificationRunner({ store, brokerFactory: () => broker });
}

test('VerificationRunner binds receipts to exact criteria and lists verified and unverified criteria', async () => {
  const report = await runner().runTask('t1');
  assert.equal(report.status, 'fail');
  assert.deepEqual(report.criteria.verifiedCriterionIds, ['root-fixed']);
  assert.deepEqual(report.criteria.unverifiedCriterionIds, ['old-tests']);
  assert.equal(report.criteria.receipts.length, 2);
  const root = report.criteria.receipts.find((item) => item.criterionId === 'root-fixed');
  assert.equal(root.status, 'pass');
  assert.equal(root.sourceHash, 'b'.repeat(64));
  assert.equal(root.commit, report.commit);
  assert.equal(root.artifactSha256, report.artifactSha256);
  assert.match(root.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(report.evidence.some((item) => item.kind === 'verification-command' && item.status === 'pass'), true);
  assert.equal(report.criteria.verifiedCriterionIds.includes('old-tests'), false);
});

test('VerificationClaimGuard rejects completion supported only by unrelated green receipts', () => {
  const guard = new VerificationClaimGuard();
  const generic = { status: 'pass', receiptSha256: 'd'.repeat(64) };
  const blocked = guard.assess({ output: 'The task is complete.', receipts: [generic], requiredCriterionIds: ['root-fixed'], activity: { errors: [], stepResults: [] } });
  assert.equal(blocked.status, 'blocked-unverified-claims');
  assert.deepEqual(blocked.unverifiedCriterionIds, ['root-fixed']);

  const base = { schema: 'forge.acceptance-criterion-verification.v1', taskId: 't1', criterionId: 'root-fixed', status: 'pass', sourceHash: 'b'.repeat(64), verifier: 'success-criterion', evidenceReceiptSha256: 'e'.repeat(64), commit: 'a'.repeat(40), artifactSha256: 'f'.repeat(64) };
  const criterion = { ...base, receiptSha256: canonicalSha256(base) };
  const supported = guard.assess({ output: 'The task is complete.', receipts: [generic, criterion], requiredCriterionIds: ['root-fixed'], activity: { errors: [], stepResults: [] } });
  assert.equal(supported.status, 'supported-candidate');
  assert.deepEqual(supported.verifiedCriterionIds, ['root-fixed']);
  assert.deepEqual(supported.unverifiedCriterionIds, []);
});
