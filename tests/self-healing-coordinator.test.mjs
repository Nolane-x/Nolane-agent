import test from 'node:test';
import assert from 'node:assert/strict';
import { SelfHealingCoordinator } from '../src/frontier/self-healing-coordinator.mjs';

const H=(c)=>c.repeat(64);

test('self healing proposal resets to clean baseline and creates bounded worktree with regression test', async () => {
  const calls=[];
  const coordinator = new SelfHealingCoordinator({ adapter:{
    async resetToBaseline(input){ calls.push(['reset',input.baselineSha256]); return { status:'clean', receiptSha256:H('8') }; },
    async createWorktree(input){ calls.push(['worktree',input.proposalId]); return { status:'created', worktreeId:'wt-1', baselineSha256:input.baselineSha256, receiptSha256:H('9') }; },
  }, clock:()=>1000 });
  const proposal = await coordinator.propose({ proposalId:'heal-1', incidentTrace:{ incidentId:'inc-1', status:'attributed', selfHealingEligible:true, receiptSha256:H('1'), attribution:{ patchReceiptSha256:H('2'), commitReceiptSha256:H('3') } }, relationConfidence:0.94, baselineSha256:H('4'), regressionTestId:'test:auth-regression', rollbackRef:'rollback/auth', leaseMs:60_000 });
  assert.deepEqual(calls.map(x=>x[0]),['reset','worktree']);
  assert.equal(proposal.status,'proposed');
  assert.equal(proposal.worktreeId,'wt-1');
  assert.equal(proposal.claims.mergeAllowed,false);
  assert.equal(proposal.claims.publishAllowed,false);
});

test('self healing rejects ambiguous incidents and missing regression evidence', async () => {
  const coordinator = new SelfHealingCoordinator({ adapter:{ resetToBaseline:async()=>({status:'clean',receiptSha256:H('1')}), createWorktree:async()=>({status:'created',worktreeId:'x',receiptSha256:H('2')}) } });
  await assert.rejects(()=>coordinator.propose({ proposalId:'bad', incidentTrace:{status:'ambiguous',selfHealingEligible:false,receiptSha256:H('3')}, relationConfidence:0.5, baselineSha256:H('4'), regressionTestId:'t', rollbackRef:'r', leaseMs:1000 }),/directly attributed/);
  await assert.rejects(()=>coordinator.propose({ proposalId:'bad2', incidentTrace:{incidentId:'i',status:'attributed',selfHealingEligible:true,receiptSha256:H('3'),attribution:{patchReceiptSha256:H('4')}}, relationConfidence:0.9, baselineSha256:H('5'), rollbackRef:'r', leaseMs:1000 }),/regressionTestId/);
});
