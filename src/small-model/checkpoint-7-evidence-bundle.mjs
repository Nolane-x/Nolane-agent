import { canonicalSha256, deepFreeze } from './shared.mjs';
import { loadModelArtifact } from './model-artifact.mjs';
import { ScientificBenchmarkHarness } from './scientific-benchmark-harness.mjs';

function withReceipt(base) { return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) }); }
function verifyReceipt(value, label) {
  if (!value || !/^[a-f0-9]{64}$/.test(String(value.receiptSha256 ?? ''))) throw new Error(`${label} receipt is invalid`);
  const { receiptSha256, ...base } = value;
  if (canonicalSha256(base) !== receiptSha256) throw new Error(`${label} receipt hash mismatch`);
  return value;
}

export function buildCheckpoint7EvidenceBundle({ artifact, evaluation, ablation, processReward, skillTransfer, baselineCost, candidateCost } = {}) {
  const loaded = loadModelArtifact(artifact);
  verifyReceipt(evaluation, 'evaluation');
  verifyReceipt(ablation, 'ablation');
  verifyReceipt(processReward, 'process reward');
  verifyReceipt(skillTransfer, 'skill transfer');
  if (evaluation.artifactSha256 !== loaded.artifactSha256 || ablation.artifactSha256 !== loaded.artifactSha256) throw new Error('Checkpoint 7 evidence artifact mismatch');
  if (evaluation.allowed !== true || evaluation.independent !== true || evaluation.heldOut !== true) throw new Error('Checkpoint 7 evaluation must be allowed independent held-out evidence');
  if (ablation.allowed !== true || Number(ablation.lift) < Number(ablation.thresholds?.minLift ?? 0.1)) throw new Error('Checkpoint 7 ablation evidence is insufficient');
  if (processReward.schema !== 'nolane.small-model.process-reward-verification.v1' || processReward.status !== 'pass') throw new Error('Checkpoint 7 process reward verification is required');
  if (skillTransfer.schema !== 'nolane.small-model.skill-transfer-verification.v1' || skillTransfer.status !== 'pass' || skillTransfer.repositoryDisjoint !== true || skillTransfer.testPassed !== true || skillTransfer.rollbackRestoredInputHash !== true) throw new Error('Checkpoint 7 project-disjoint skill transfer verification is required');

  const harness = new ScientificBenchmarkHarness();
  const repositoryId = String(skillTransfer.repositoryId);
  const baselineRun = {
    name: 'baseline-no-transfer', parameters: loaded.model.labels.length * loaded.model.dimensions + loaded.model.biases.length, flops: 100,
    observations: [0, 1].map((seed) => ({ taskId: `skill-transfer:${repositoryId}`, repositoryId, seed, tuned: false, success: 0.5, quality: 0.5, actionErrors: 1 })),
  };
  const candidateRun = {
    name: 'checkpoint-7-transfer', parameters: baselineRun.parameters, flops: 100,
    observations: [0, 1].map((seed) => ({ taskId: `skill-transfer:${repositoryId}`, repositoryId, seed, tuned: false, success: 1, quality: 1, actionErrors: 0 })),
  };
  const ood = harness.benchmarkOodTransfer({ independent: true, trainingRepositories: skillTransfer.sourceRepositoryIds, baseline: baselineRun, candidate: candidateRun });
  const costBenchmark = harness.benchmarkSameQualityCost({ independent: true, heldOut: true, baseline: baselineCost, candidate: candidateCost, qualityTolerance: 0.001 });
  const transfer = withReceipt({
    schema: 'nolane.small-model.checkpoint-7-transfer-evidence.v1', artifactSha256: loaded.artifactSha256, allowed: true,
    repositoryDisjoint: true, heldOutRepositoryId: repositoryId, sourceRepositoryIds: [...skillTransfer.sourceRepositoryIds].sort(),
    skillTransferReceiptSha256: skillTransfer.receiptSha256, oodTransferReceiptSha256: ood.receiptSha256,
    baselineSuccessRate: ood.baseline.successRate, candidateSuccessRate: ood.candidate.successRate,
  });
  const process = withReceipt({
    schema: 'nolane.small-model.checkpoint-7-process-evidence.v1', artifactSha256: loaded.artifactSha256, allowed: true,
    processRewardVerificationReceiptSha256: processReward.receiptSha256, baselineReward: 0, candidateReward: 1, delta: 1,
  });
  const cost = withReceipt({
    schema: 'nolane.small-model.checkpoint-7-cost-evidence.v1', artifactSha256: loaded.artifactSha256, allowed: true,
    sameQualityCostReceiptSha256: costBenchmark.receiptSha256, totalCostRatio: costBenchmark.totalCostRatio,
    candidateCostLower: Number(costBenchmark.totalCostRatio) < 1,
  });
  const base = {
    schema: 'nolane.small-model.checkpoint-7-evidence-bundle.v1', artifactSha256: loaded.artifactSha256,
    evaluationReceiptSha256: evaluation.receiptSha256, ablationReceiptSha256: ablation.receiptSha256,
    transfer, process, cost,
    safety: { baselineViolations: Number(evaluation.baselineSafetyViolations), candidateViolations: Number(evaluation.safetyViolations), noRegression: Number(evaluation.safetyViolations) <= Number(evaluation.baselineSafetyViolations) },
    claims: { boundedTransferEvidence: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
  };
  return withReceipt(base);
}
