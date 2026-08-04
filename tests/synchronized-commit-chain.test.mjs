import test from 'node:test';
import assert from 'node:assert/strict';
import { SynchronizedCommitChain } from '../src/frontier/synchronized-commit-chain.mjs';

const H = (c) => c.repeat(64);
const plan = Object.freeze({
  planId: 'p1', receiptSha256: H('a'), transactional: true,
  steps: Object.freeze([
    Object.freeze({ repositoryId: 'backend', baselineSha256: H('1'), rollbackRef: 'rb/backend', verificationCommandId: 'verify-backend', order: 1 }),
    Object.freeze({ repositoryId: 'sdk', baselineSha256: H('2'), rollbackRef: 'rb/sdk', verificationCommandId: 'verify-sdk', order: 2 }),
  ]),
});

test('commit chain requires every repository, verification and human merge approval', () => {
  const ledger = new SynchronizedCommitChain();
  const chain = ledger.prepare(plan, { chainId: 'chain-1', actor: 'agent:planner' });
  ledger.recordPreparedCommit(chain.chainId, { repositoryId: 'backend', baselineSha256: H('1'), commitSha256: H('3'), provenanceReceiptSha256: H('4'), rollbackCommitSha256: H('5') });
  ledger.recordPreparedCommit(chain.chainId, { repositoryId: 'sdk', baselineSha256: H('2'), commitSha256: H('6'), provenanceReceiptSha256: H('7'), rollbackCommitSha256: H('8') });
  ledger.recordVerification(chain.chainId, { repositoryId: 'backend', status: 'pass', receiptSha256: H('9') });
  ledger.recordVerification(chain.chainId, { repositoryId: 'sdk', status: 'pass', receiptSha256: H('a') });
  assert.throws(() => ledger.authorizeHumanMerge(chain.chainId, { approved: false, actor: 'human:owner', receiptSha256: H('b') }), /human approval/);
  const ready = ledger.authorizeHumanMerge(chain.chainId, { approved: true, actor: 'human:owner', receiptSha256: H('b') });
  assert.equal(ready.status, 'ready-for-human-merge');
  assert.equal(ready.claims.autonomousMergeAllowed, false);
});

test('commit chain records synchronized rollback and rejects baseline mismatch', () => {
  const ledger = new SynchronizedCommitChain();
  const chain = ledger.prepare(plan, { chainId: 'chain-2', actor: 'agent:planner' });
  assert.throws(() => ledger.recordPreparedCommit(chain.chainId, { repositoryId: 'backend', baselineSha256: H('f'), commitSha256: H('3'), provenanceReceiptSha256: H('4'), rollbackCommitSha256: H('5') }), /baseline/);
  const rollback = ledger.recordRollback(chain.chainId, { repositoryIds: ['backend','sdk'], reason: 'verification-failed', receiptSha256: H('c') });
  assert.equal(rollback.status, 'rolled-back');
  assert.deepEqual(rollback.repositoryIds, ['backend','sdk']);
});
