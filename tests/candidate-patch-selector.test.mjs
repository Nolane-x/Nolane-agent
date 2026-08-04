import test from 'node:test';
import assert from 'node:assert/strict';

import { selectCandidate } from '../src/construction/candidate-patch-selector.mjs';

const base = { verificationContractSha256: 'contract-sha', isolated: true, isolationReceiptId: 'isolation', criticalInvariantFailures: 0, regressionFailures: 0, verifiedCriteriaScore: 10, requiredCriteriaScore: 10 };

test('correctness dominates cost and semantic footprint dominates resource yield', () => {
  const result = selectCandidate({ verificationContractSha256: 'contract-sha', candidates: [
    { ...base, candidateId: 'incorrect-cheap', verifiedCriteriaScore: 7, semanticFootprint: 1, tokenCost: 10, rssMbSeconds: 10, editCost: 1, changedLines: 2 },
    { ...base, candidateId: 'small-correct', semanticFootprint: 4, tokenCost: 100, rssMbSeconds: 100, editCost: 5, changedLines: 20 },
    { ...base, candidateId: 'cheap-but-wide', semanticFootprint: 9, tokenCost: 20, rssMbSeconds: 20, editCost: 2, changedLines: 5 },
  ] });
  assert.equal(result.selectedCandidateId, 'small-correct');
  assert.ok(result.rejectedCandidates.some((item) => item.candidateId === 'incorrect-cheap' && item.reason === 'correctness-gate-failed'));
});

test('rejects mismatched verification contracts and non-isolated candidates', () => {
  assert.throws(() => selectCandidate({ verificationContractSha256: 'contract-sha', candidates: [
    { ...base, candidateId: 'a', semanticFootprint: 1, tokenCost: 1, rssMbSeconds: 1, editCost: 1, changedLines: 1 },
    { ...base, candidateId: 'b', verificationContractSha256: 'other', semanticFootprint: 2, tokenCost: 1, rssMbSeconds: 1, editCost: 1, changedLines: 1 },
  ] }), /verification contract/i);
  assert.throws(() => selectCandidate({ verificationContractSha256: 'contract-sha', candidates: [
    { ...base, candidateId: 'a', semanticFootprint: 1, tokenCost: 1, rssMbSeconds: 1, editCost: 1, changedLines: 1 },
    { ...base, candidateId: 'b', isolated: false, semanticFootprint: 2, tokenCost: 1, rssMbSeconds: 1, editCost: 1, changedLines: 1 },
  ] }), /isolated/i);
});
