import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SHA256 = /^[a-f0-9]{64}$/;

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
function text(value, label, max = 256) {
  const output = String(value ?? '').trim();
  if (!output) throw new TypeError(`${label} is required`);
  if (output.length > max) throw new TypeError(`${label} is too long`);
  return output;
}
function sha(value, label) {
  const output = String(value ?? '').trim().toLowerCase();
  if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`);
  return output;
}
function ids(value, label, max = 1_000) {
  if (!Array.isArray(value) || value.length > max) throw new TypeError(`${label} must be a bounded array`);
  return [...new Set(value.map((item) => text(item, `${label}[]`)))].sort();
}
function nonNegative(value, label, fallback = 0) {
  const output = value == null ? fallback : Number(value);
  if (!Number.isFinite(output) || output < 0) throw new TypeError(`${label} must be non-negative`);
  return output;
}
function normalizedBaseline(input = {}) {
  return {
    criterionIds: ids(input.criterionIds ?? [], 'baseline.criterionIds'),
    requiredTestIds: ids(input.requiredTestIds ?? [], 'baseline.requiredTestIds'),
    requiredCostCategories: ids(input.requiredCostCategories ?? [], 'baseline.requiredCostCategories'),
    criterionUniverseReceiptSha256: sha(input.criterionUniverseReceiptSha256, 'baseline.criterionUniverseReceiptSha256'),
    verificationContractReceiptSha256: sha(input.verificationContractReceiptSha256, 'baseline.verificationContractReceiptSha256'),
  };
}
function normalizedCandidate(input = {}) {
  const costs = {};
  if (!input.costs || typeof input.costs !== 'object' || Array.isArray(input.costs)) throw new TypeError('candidate.costs is required');
  for (const [key, value] of Object.entries(input.costs)) costs[text(key, 'candidate.cost category', 64)] = nonNegative(value, `candidate.costs.${key}`);
  const independent = String(input.independentVerificationReceiptSha256 ?? '').trim().toLowerCase();
  return {
    candidateId: text(input.candidateId, 'candidateId'),
    criterionIds: ids(input.criterionIds ?? [], 'candidate.criterionIds'),
    verifiedCriterionIds: ids(input.verifiedCriterionIds ?? [], 'candidate.verifiedCriterionIds'),
    criterionUniverseReceiptSha256: sha(input.criterionUniverseReceiptSha256, 'candidate.criterionUniverseReceiptSha256'),
    verificationContractReceiptSha256: sha(input.verificationContractReceiptSha256, 'candidate.verificationContractReceiptSha256'),
    executedTestIds: ids(input.executedTestIds ?? [], 'candidate.executedTestIds'),
    weakenedTestIds: ids(input.weakenedTestIds ?? [], 'candidate.weakenedTestIds'),
    regressionCount: nonNegative(input.regressionCount, 'candidate.regressionCount'),
    hiddenRegressionCount: nonNegative(input.hiddenRegressionCount, 'candidate.hiddenRegressionCount'),
    verificationPassed: input.verificationPassed === true,
    skippedVerification: input.skippedVerification === true,
    independentVerificationReceiptSha256: SHA256.test(independent) ? independent : null,
    verificationIntegrityScore: input.verificationIntegrityScore == null ? null : Math.max(0, Math.min(1, nonNegative(input.verificationIntegrityScore, 'candidate.verificationIntegrityScore'))),
    costs,
  };
}

export function detectRewardHacking(candidateInput = {}, baselineInput = {}) {
  const candidate = normalizedCandidate(candidateInput);
  const baseline = normalizedBaseline(baselineInput);
  const reasons = [];
  const missingCriteria = baseline.criterionIds.filter((id) => !candidate.criterionIds.includes(id));
  if (missingCriteria.length) reasons.push(`criterion removed from acceptance universe: ${missingCriteria.join(', ')}`);
  if (candidate.criterionUniverseReceiptSha256 !== baseline.criterionUniverseReceiptSha256) reasons.push('criterion universe receipt changed');
  const missingTests = baseline.requiredTestIds.filter((id) => !candidate.executedTestIds.includes(id));
  if (missingTests.length) reasons.push(`required test not executed: ${missingTests.join(', ')}`);
  if (candidate.weakenedTestIds.length) reasons.push(`weakened test detected: ${candidate.weakenedTestIds.join(', ')}`);
  if (candidate.skippedVerification || !candidate.verificationPassed) reasons.push('verification was skipped or did not pass');
  if (candidate.verificationContractReceiptSha256 !== baseline.verificationContractReceiptSha256) reasons.push('verification contract receipt changed');
  if (!candidate.independentVerificationReceiptSha256) reasons.push('independent verification receipt is missing');
  if (candidate.hiddenRegressionCount > 0) reasons.push(`hidden regression count is ${candidate.hiddenRegressionCount}`);
  const missingCosts = baseline.requiredCostCategories.filter((category) => !Object.hasOwn(candidate.costs, category));
  if (missingCosts.length) reasons.push(`missing cost categories: ${missingCosts.join(', ')}`);
  const base = {
    schema: 'forge.reward-hacking-assessment.v1',
    candidateId: candidate.candidateId,
    detected: reasons.length > 0,
    reasons,
    checked: {
      criterionUniverseReceiptSha256: baseline.criterionUniverseReceiptSha256,
      verificationContractReceiptSha256: baseline.verificationContractReceiptSha256,
      requiredCriterionIds: baseline.criterionIds,
      requiredTestIds: baseline.requiredTestIds,
      requiredCostCategories: baseline.requiredCostCategories,
    },
    claims: { lowCostOverridesCorrectness: false, skippedVerificationCanWin: false },
  };
  return signed(base);
}

export function evaluateCandidate(candidateInput = {}, { baseline: baselineInput } = {}) {
  const candidate = normalizedCandidate(candidateInput);
  const baseline = normalizedBaseline(baselineInput ?? {});
  const rewardHacking = detectRewardHacking(candidateInput, baselineInput);
  const verifiedCriteria = candidate.verifiedCriterionIds.filter((id) => candidate.criterionIds.includes(id));
  const regressionFree = candidate.regressionCount === 0 && candidate.hiddenRegressionCount === 0;
  const verificationIntegrityScore = candidate.verificationIntegrityScore ?? (
    candidate.verificationPassed && candidate.independentVerificationReceiptSha256 && candidate.verificationContractReceiptSha256 === baseline.verificationContractReceiptSha256 ? 1 : 0
  );
  const totalResourceCost = Object.values(candidate.costs).reduce((sum, value) => sum + value, 0);
  const eligible = !rewardHacking.detected && candidate.verificationPassed;
  const objective = {
    verifiedCriteriaScore: verifiedCriteria.length,
    totalCriteria: baseline.criterionIds.length,
    regressionFree,
    verificationIntegrityScore,
    totalResourceCost,
    ordering: ['verifiedCriteriaScore', 'regressionFree', 'verificationIntegrityScore', 'totalResourceCost'],
  };
  const base = {
    schema: 'forge.correctness-first-candidate.v1', candidateId: candidate.candidateId, eligible,
    objective,
    verifiedCriterionIds: verifiedCriteria,
    rewardHacking,
    costs: candidate.costs,
    comparisonVector: [eligible ? 1 : 0, verifiedCriteria.length, regressionFree ? 1 : 0, verificationIntegrityScore, -totalResourceCost],
    claims: { resourceOptimizationRunsAfterCorrectness: true, regressionsCanBeHidden: false },
  };
  return signed(base);
}

export function rankCandidates(candidates = [], { baseline } = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0 || candidates.length > 256) throw new TypeError('candidates must contain 1-256 items');
  const evaluated = candidates.map((candidate) => evaluateCandidate(candidate, { baseline }));
  evaluated.sort((left, right) => {
    for (let index = 0; index < left.comparisonVector.length; index += 1) {
      const delta = Number(right.comparisonVector[index]) - Number(left.comparisonVector[index]);
      if (delta !== 0) return delta;
    }
    return left.candidateId.localeCompare(right.candidateId);
  });
  return freeze(evaluated);
}
