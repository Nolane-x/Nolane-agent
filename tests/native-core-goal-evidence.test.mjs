import test from 'node:test';
import assert from 'node:assert/strict';

import { GoalEvidenceContract } from '../src/native-core/goal-evidence-contract.mjs';

const effect = (sha, matched = true) => Object.freeze({ effectMatched: matched, receiptSha256: sha });
const shaA = 'a'.repeat(64);
const shaB = 'b'.repeat(64);

test('goal evidence contract completes only when every criterion references an observed effect receipt', () => {
  const contract = new GoalEvidenceContract({ missionId: 'm1', objective: 'Update repository', criteria: [{ id: 'tests' }, { id: 'diff' }] });
  const result = contract.verify({
    actorId: 'agent-1', verifierId: 'verifier-1', effects: [effect(shaA), effect(shaB)],
    response: { criteriaProof: [
      { id: 'tests', verified: true, evidenceReceiptSha256: shaA },
      { id: 'diff', verified: true, evidenceReceiptSha256: shaB },
    ] },
  });
  assert.equal(result.verified, true);
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.criteria.map((item) => item.id), ['tests', 'diff']);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('goal evidence contract rejects self verification, hidden reasoning and unobserved evidence', () => {
  const contract = new GoalEvidenceContract({ missionId: 'm2', objective: 'Safe change', criteria: [{ id: 'safe' }] });
  assert.throws(() => contract.verify({ actorId: 'same', verifierId: 'same', effects: [effect(shaA)], response: { criteriaProof: [{ id: 'safe', verified: true, evidenceReceiptSha256: shaA }] } }), /independent verifier/i);
  assert.throws(() => contract.verify({ actorId: 'a', verifierId: 'v', effects: [effect(shaA)], response: { hiddenReasoning: 'secret', criteriaProof: [{ id: 'safe', verified: true, evidenceReceiptSha256: shaA }] } }), /hidden reasoning/i);
  const missing = contract.verify({ actorId: 'a', verifierId: 'v', effects: [effect(shaA)], response: { criteriaProof: [{ id: 'safe', verified: true, evidenceReceiptSha256: shaB }] } });
  assert.equal(missing.verified, false);
  assert.equal(missing.status, 'needs-evidence');
  assert.equal(missing.criteria[0].verified, false);
});

test('goal evidence contract is deterministic and rejects duplicate criteria or malformed effects', () => {
  assert.throws(() => new GoalEvidenceContract({ missionId: 'm3', objective: 'x', criteria: [{ id: 'same' }, { id: 'same' }] }), /duplicate criterion/i);
  const contract = new GoalEvidenceContract({ missionId: 'm4', objective: 'x', criteria: [] });
  assert.throws(() => contract.verify({ actorId: 'a', verifierId: 'v', effects: [{ effectMatched: true, receiptSha256: 'bad' }], response: {} }), /effect receipt/i);
  const input = { actorId: 'a', verifierId: 'v', effects: [effect(shaA)], response: {} };
  assert.equal(contract.verify(input).receiptSha256, contract.verify(input).receiptSha256);
});
