import { canonicalSha256, clone, deepFreeze } from './shared.mjs';

const finite = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite`);
  return number;
};

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value), 0) / values.length : 0;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (Number(value) - average) ** 2, 0) / values.length);
}

function validateRun(run, label) {
  if (!run?.name || !Number.isFinite(Number(run.parameters)) || Number(run.parameters) <= 0 || !Number.isFinite(Number(run.flops)) || Number(run.flops) <= 0) {
    throw new TypeError(`${label} requires name, positive parameters and FLOPs`);
  }
  if (!Array.isArray(run.observations) || run.observations.length < 2) throw new TypeError(`${label} requires multi-seed observations`);
  const observations = run.observations.map((item, index) => {
    if (!item?.taskId || !item.repositoryId || !Number.isInteger(Number(item.seed))) throw new TypeError(`${label} observation ${index} requires taskId, repositoryId and seed`);
    if (item.tuned !== false) throw new Error(`${label} observations must be untuned held-out evidence`);
    const success = finite(item.success, `${label} success`);
    const quality = finite(item.quality, `${label} quality`);
    const actionErrors = finite(item.actionErrors ?? 0, `${label} actionErrors`);
    if (success < 0 || success > 1 || quality < 0 || quality > 1 || actionErrors < 0) throw new TypeError(`${label} observation metrics are out of range`);
    return { taskId: String(item.taskId), repositoryId: String(item.repositoryId), seed: Number(item.seed), tuned: false, success, quality, actionErrors };
  });
  return { name: String(run.name), parameters: Number(run.parameters), flops: Number(run.flops), observations };
}

function assertIndependentHeldOut({ independent, heldOut = true } = {}) {
  if (independent !== true) throw new Error('Benchmark evidence must be independent');
  if (heldOut !== true) throw new Error('Benchmark evidence must use held-out cohorts');
}

function cohortKey(item) {
  return `${item.taskId}\u0000${item.repositoryId}\u0000${item.seed}`;
}

function assertMatchedCohort(a, b) {
  const left = a.observations.map(cohortKey).sort();
  const right = b.observations.map(cohortKey).sort();
  if (left.length !== right.length || left.some((value, index) => value !== right[index])) throw new Error('Benchmark cohort must match by task, repository and seed');
}

function summarize(run) {
  const success = run.observations.map((item) => item.success);
  const quality = run.observations.map((item) => item.quality);
  const errors = run.observations.map((item) => item.actionErrors);
  return {
    name: run.name,
    parameters: run.parameters,
    flops: run.flops,
    observations: run.observations.length,
    successRate: mean(success),
    successStdDev: stdDev(success),
    quality: mean(quality),
    qualityStdDev: stdDev(quality),
    actionErrorRate: mean(errors),
  };
}

function receipt(schema, body) {
  const base = { schema, ...body };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

function totalCost(value) {
  for (const key of ['tokens', 'flops', 'rssMbSeconds', 'wallMs', 'humanCorrections']) finite(value?.[key], key);
  return Number(value.tokens) + Number(value.flops) + Number(value.rssMbSeconds) + Number(value.wallMs) / 10 + Number(value.humanCorrections) * 1000;
}

export class ScientificBenchmarkHarness {
  #receipts = [];

  runAblation({ mode, independent, heldOut, baseline, candidate } = {}) {
    assertIndependentHeldOut({ independent, heldOut });
    if (!['same-flop', 'same-parameter'].includes(mode)) throw new TypeError('Ablation mode must be same-flop or same-parameter');
    const a = validateRun(baseline, 'baseline');
    const b = validateRun(candidate, 'candidate');
    assertMatchedCohort(a, b);
    if (mode === 'same-flop' && a.flops !== b.flops) throw new Error('same-FLOP ablation requires identical FLOP budgets');
    if (mode === 'same-parameter' && a.parameters !== b.parameters) throw new Error('same-parameter ablation requires identical parameter counts');
    const value = receipt('nolane.small-model.scientific-ablation.v1', {
      mode,
      independent: true,
      heldOut: true,
      matchedBudget: true,
      baseline: summarize(a),
      candidate: summarize(b),
      delta: {
        successRate: summarize(b).successRate - summarize(a).successRate,
        quality: summarize(b).quality - summarize(a).quality,
        actionErrorRate: summarize(b).actionErrorRate - summarize(a).actionErrorRate,
      },
      seeds: a.observations.length,
      claimAllowed: false,
      claimReason: 'Scientific ablation evidence is scoped to the supplied held-out cohort and does not establish general model superiority',
    });
    this.#receipts.push(value);
    return value;
  }

  gateQuantizationStability({ independent, heldOut, reference, quantized, maxQualityDrop = 0.02, maxActionErrorIncrease = 0.02 } = {}) {
    assertIndependentHeldOut({ independent, heldOut });
    const a = validateRun(reference, 'reference');
    const b = validateRun(quantized, 'quantized');
    assertMatchedCohort(a, b);
    const referenceSummary = summarize(a);
    const quantizedSummary = summarize(b);
    const qualityDrop = referenceSummary.quality - quantizedSummary.quality;
    const actionErrorIncrease = quantizedSummary.actionErrorRate - referenceSummary.actionErrorRate;
    const findings = [];
    if (qualityDrop > finite(maxQualityDrop, 'maxQualityDrop')) findings.push('quality-regression');
    if (actionErrorIncrease > finite(maxActionErrorIncrease, 'maxActionErrorIncrease')) findings.push('action-error-regression');
    const value = receipt('nolane.small-model.quantization-stability-gate.v1', {
      independent: true,
      heldOut: true,
      reference: referenceSummary,
      quantized: quantizedSummary,
      qualityDrop,
      actionErrorIncrease,
      thresholds: { maxQualityDrop: Number(maxQualityDrop), maxActionErrorIncrease: Number(maxActionErrorIncrease) },
      allowed: findings.length === 0,
      findings: findings.sort(),
      claimAllowed: false,
    });
    this.#receipts.push(value);
    return value;
  }

  benchmarkOodTransfer({ independent, trainingRepositories, baseline, candidate } = {}) {
    if (independent !== true) throw new Error('OOD benchmark evidence must be independent');
    if (!Array.isArray(trainingRepositories) || trainingRepositories.length === 0) throw new TypeError('trainingRepositories are required');
    const a = validateRun(baseline, 'baseline');
    const b = validateRun(candidate, 'candidate');
    assertMatchedCohort(a, b);
    const trained = new Set(trainingRepositories.map(String));
    const evaluated = new Set([...a.observations, ...b.observations].map((item) => item.repositoryId));
    if ([...evaluated].some((repositoryId) => trained.has(repositoryId))) throw new Error('OOD repositories must be disjoint from training repositories');
    const value = receipt('nolane.small-model.ood-transfer-benchmark.v1', {
      independent: true,
      repositoryDisjoint: true,
      trainingRepositories: [...trained].sort(),
      heldOutRepositories: [...evaluated].sort(),
      baseline: summarize(a),
      candidate: summarize(b),
      seeds: a.observations.length,
      claimAllowed: false,
      claimReason: 'OOD transfer is measured only for the recorded repository cohort',
    });
    this.#receipts.push(value);
    return value;
  }

  benchmarkSameQualityCost({ independent, heldOut, qualityTolerance = 0.01, baseline, candidate } = {}) {
    assertIndependentHeldOut({ independent, heldOut });
    const tolerance = finite(qualityTolerance, 'qualityTolerance');
    for (const [label, value] of [['baseline', baseline], ['candidate', candidate]]) {
      if (!value?.name) throw new TypeError(`${label} name is required`);
      for (const key of ['quality', 'successRate']) {
        const metric = finite(value[key], `${label}.${key}`);
        if (metric < 0 || metric > 1) throw new TypeError(`${label}.${key} is out of range`);
      }
      if (!Number.isInteger(Number(value.safetyViolations)) || Number(value.safetyViolations) < 0) throw new TypeError(`${label}.safetyViolations must be non-negative`);
    }
    const qualityGap = Math.abs(Number(baseline.quality) - Number(candidate.quality));
    const successGap = Math.abs(Number(baseline.successRate) - Number(candidate.successRate));
    if (qualityGap > tolerance || successGap > tolerance || Number(candidate.safetyViolations) > Number(baseline.safetyViolations)) {
      throw new Error('same-quality cost benchmark requires matched quality, success and non-worse safety');
    }
    const baselineCost = totalCost(baseline);
    const candidateCost = totalCost(candidate);
    const value = receipt('nolane.small-model.same-quality-cost-benchmark.v1', {
      independent: true,
      heldOut: true,
      comparable: true,
      qualityTolerance: tolerance,
      baseline: clone(baseline),
      candidate: clone(candidate),
      baselineTotalCost: baselineCost,
      candidateTotalCost: candidateCost,
      totalCostRatio: baselineCost === 0 ? null : candidateCost / baselineCost,
      claimAllowed: false,
      claimReason: 'Cost evidence is cohort-specific and includes no competitor-superiority claim',
    });
    this.#receipts.push(value);
    return value;
  }

  snapshot() {
    return deepFreeze({ schema: 'nolane.small-model.scientific-benchmark-harness.v1', receipts: this.#receipts.length });
  }
}
