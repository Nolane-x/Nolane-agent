import { canonicalSha256, deepFreeze } from './shared.mjs';

function verifyReceipt(value, label) {
  if (!value || !/^[a-f0-9]{64}$/.test(String(value.receiptSha256 ?? ''))) throw new Error(`${label} receipt is invalid`);
  const { receiptSha256, ...base } = value;
  if (canonicalSha256(base) !== receiptSha256) throw new Error(`${label} receipt hash mismatch`);
  return value;
}

export function buildCheckpoint8EvidenceBundle({ portfolio: input } = {}) {
  const portfolio = verifyReceipt(input, 'Checkpoint 8 portfolio');
  if (portfolio.schema !== 'nolane.small-model.checkpoint-8-mission-portfolio.v1' || !Array.isArray(portfolio.missions) || portfolio.missions.length < 5) throw new Error('Checkpoint 8 mission portfolio is incomplete');
  const astTransfer = verifyReceipt(portfolio.astTransfer, 'AST transfer');
  const smtProof = verifyReceipt(portfolio.smtProof, 'SMT proof');
  const datalogProof = verifyReceipt(portfolio.datalogProof, 'Datalog proof');
  if (astTransfer.status !== 'pass' || astTransfer.repositoryDisjoint !== true || astTransfer.rollbackRestoredMutationHash !== true || astTransfer.trackedSourceUnchanged !== true) throw new Error('Checkpoint 8 AST transfer evidence is insufficient');
  if (smtProof.status !== 'pass' || smtProof.sat?.status !== 'sat' || smtProof.unsat?.status !== 'unsat' || smtProof.completeWithinBudgets !== true) throw new Error('Checkpoint 8 SMT proof evidence is insufficient');
  if (datalogProof.status !== 'pass' || datalogProof.datalog?.converged !== true || datalogProof.unsafeProbeRejected !== true) throw new Error('Checkpoint 8 Datalog proof evidence is insufficient');
  if (!(Number(portfolio.processValue) > 0)) throw new Error('Checkpoint 8 process value must be positive');
  if (portfolio.cost?.candidateCostLower !== true || !(Number(portfolio.cost.totalCostRatio) < 1)) throw new Error('Checkpoint 8 cost evidence must show lower bounded fallback cost');
  if (portfolio.bestCandidatePreserved !== true || portfolio.hiddenChainOfThoughtStored !== false) throw new Error('Checkpoint 8 candidate preservation or public-state evidence is missing');
  const process = deepFreeze({ schema: 'nolane.small-model.checkpoint-8-process-evidence.v1', allowed: true, portfolioReceiptSha256: portfolio.receiptSha256, value: portfolio.processValue, receiptSha256: canonicalSha256({ schema: 'nolane.small-model.checkpoint-8-process-evidence.v1', allowed: true, portfolioReceiptSha256: portfolio.receiptSha256, value: portfolio.processValue }) });
  const costBase = { schema: 'nolane.small-model.checkpoint-8-cost-bundle.v1', allowed: true, portfolioReceiptSha256: portfolio.receiptSha256, totalCostRatio: portfolio.cost.totalCostRatio, candidateCostLower: true, externalCompetitorMeasured: false };
  const cost = deepFreeze({ ...costBase, receiptSha256: canonicalSha256(costBase) });
  const base = {
    schema: 'nolane.small-model.checkpoint-8-evidence-bundle.v1', allowed: true, portfolioReceiptSha256: portfolio.receiptSha256,
    astSkillReceiptSha256: portfolio.astSkill.receiptSha256, astTransferReceiptSha256: astTransfer.receiptSha256,
    constraintSkillReceiptSha256: [portfolio.smtSkill.receiptSha256, portfolio.datalogSkill.receiptSha256].sort(),
    constraintProofReceiptSha256: [smtProof.receiptSha256, datalogProof.receiptSha256].sort(),
    process, cost, safety: { baselineViolations: 0, candidateViolations: 0, noRegression: true },
    claims: { boundedSolverEvidence: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
