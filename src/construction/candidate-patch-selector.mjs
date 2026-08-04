import { boundedNumber, signed, text } from './construction-utils.mjs';

export function selectCandidate({ verificationContractSha256, candidates = [] } = {}) {
  const contract = text(verificationContractSha256, 'verificationContractSha256', 512);
  if (!Array.isArray(candidates) || candidates.length < 2 || candidates.length > 3) throw new TypeError('candidate selection requires 2-3 candidates');
  const normalized = candidates.map((item, index) => {
    const candidateId = text(item.candidateId, `candidates[${index}].candidateId`, 256);
    if (String(item.verificationContractSha256) !== contract) throw new Error(`candidate verification contract mismatch: ${candidateId}`);
    if (item.isolated !== true || !item.isolationReceiptId) throw new Error(`candidate must be isolated: ${candidateId}`);
    return {
      candidateId, verificationContractSha256: contract, isolated: true, isolationReceiptId: String(item.isolationReceiptId),
      verifiedCriteriaScore: boundedNumber(item.verifiedCriteriaScore, 0, 0, 1_000_000, 'verifiedCriteriaScore'),
      requiredCriteriaScore: boundedNumber(item.requiredCriteriaScore, 0, 0, 1_000_000, 'requiredCriteriaScore'),
      criticalInvariantFailures: boundedNumber(item.criticalInvariantFailures, 0, 0, 1_000_000, 'criticalInvariantFailures'),
      regressionFailures: boundedNumber(item.regressionFailures, 0, 0, 1_000_000, 'regressionFailures'),
      semanticFootprint: boundedNumber(item.semanticFootprint, 0, 0, 1_000_000, 'semanticFootprint'),
      tokenCost: boundedNumber(item.tokenCost, 0, 0, Number.MAX_SAFE_INTEGER, 'tokenCost'),
      rssMbSeconds: boundedNumber(item.rssMbSeconds, 0, 0, Number.MAX_SAFE_INTEGER, 'rssMbSeconds'),
      editCost: boundedNumber(item.editCost, 0, 0, Number.MAX_SAFE_INTEGER, 'editCost'),
      changedLines: boundedNumber(item.changedLines, 0, 0, Number.MAX_SAFE_INTEGER, 'changedLines'),
    };
  });
  const rejectedCandidates = []; const eligible = [];
  for (const candidate of normalized) {
    const correct = candidate.verifiedCriteriaScore >= candidate.requiredCriteriaScore && candidate.criticalInvariantFailures === 0 && candidate.regressionFailures === 0;
    if (!correct) rejectedCandidates.push({ candidateId: candidate.candidateId, reason: 'correctness-gate-failed' });
    else eligible.push(candidate);
  }
  eligible.sort((a, b) => a.semanticFootprint - b.semanticFootprint || (a.tokenCost + a.rssMbSeconds + a.editCost) - (b.tokenCost + b.rssMbSeconds + b.editCost) || a.changedLines - b.changedLines || a.candidateId.localeCompare(b.candidateId));
  return signed({ schema: 'forge.candidate-patch-selection.v1', verificationContractSha256: contract, selectedCandidateId: eligible[0]?.candidateId ?? null, eligibleCandidates: eligible.map((item) => item.candidateId), rejectedCandidates, claims: { correctnessPrecedesEfficiency: true, worktreesCreatedDirectly: false } });
}
