import assert from 'node:assert/strict';
import test from 'node:test';
import { JointCommitmentLedger } from '../src/collaboration/joint-commitment-ledger.mjs';
const hash = (c) => c.repeat(64);

test('public contract change blocks dependents until renegotiation is acknowledged', () => {
  const ledger = new JointCommitmentLedger();
  const commitment = ledger.create({
    commitmentId: 'auth-contract', goal: 'Keep auth API compatible', interfaceId: 'SessionApi', revision: 1,
    participants: [{ agentId: 'backend', role: 'owner' }, { agentId: 'frontend', role: 'consumer' }],
    handoffCriteria: ['contract-tests-pass'],
  });
  assert.equal(commitment.state, 'active');
  const changed = ledger.renegotiate({ commitmentId: 'auth-contract', actorAgentId: 'backend', nextRevision: 2, reason: 'Add expiresAt field', affectedAgents: ['frontend'], receiptSha256: hash('a') });
  assert.equal(changed.state, 'renegotiating');
  assert.equal(ledger.canProceed('frontend').allowed, false);
  ledger.acknowledge({ commitmentId: 'auth-contract', agentId: 'frontend', revision: 2, receiptSha256: hash('b') });
  assert.equal(ledger.canProceed('frontend').allowed, true);
});

test('structured handoff validates artifact and verification receipts', () => {
  const ledger = new JointCommitmentLedger();
  ledger.create({ commitmentId: 'handoff', goal: 'Ship session patch', interfaceId: 'SessionStore', participants: [{ agentId: 'executor', role: 'owner' }, { agentId: 'reviewer', role: 'reviewer' }], handoffCriteria: ['tests-pass'] });
  assert.throws(() => ledger.handoff({ commitmentId: 'handoff', fromAgentId: 'executor', toAgentId: 'reviewer', artifactSha256: 'bad', verificationReceiptSha256: hash('c') }), /artifact sha/i);
  const receipt = ledger.handoff({ commitmentId: 'handoff', fromAgentId: 'executor', toAgentId: 'reviewer', artifactSha256: hash('d'), verificationReceiptSha256: hash('e') });
  assert.equal(receipt.state, 'handed-off');
});

test('deadlock detection supports revoke and reassign recovery', () => {
  const ledger = new JointCommitmentLedger();
  ledger.create({ commitmentId: 'a', goal: 'A', interfaceId: 'A', participants: [{ agentId: 'agent-a', role: 'owner' }] });
  ledger.create({ commitmentId: 'b', goal: 'B', interfaceId: 'B', participants: [{ agentId: 'agent-b', role: 'owner' }] });
  ledger.waitFor({ waitingAgentId: 'agent-a', blockingAgentId: 'agent-b', commitmentId: 'a' });
  ledger.waitFor({ waitingAgentId: 'agent-b', blockingAgentId: 'agent-a', commitmentId: 'b' });
  const deadlocks = ledger.detectDeadlocks();
  assert.equal(deadlocks.cycles.length, 1);
  ledger.revoke({ commitmentId: 'b', agentId: 'agent-b', reason: 'deadlock recovery', receiptSha256: hash('f') });
  ledger.reassign({ commitmentId: 'b', fromAgentId: 'agent-b', toAgentId: 'agent-c', receiptSha256: hash('1') });
  assert.equal(ledger.detectDeadlocks().cycles.length, 0);
});
