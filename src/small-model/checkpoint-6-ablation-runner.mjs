import { canonicalSha256, deepFreeze } from './shared.mjs';
import { evaluateSpecialistArtifact } from './specialist-evaluation.mjs';

function expectedLabel(example, index) {
  const label = String(example?.action?.type ?? example?.label ?? '').trim();
  if (!label) throw new TypeError(`example ${index} requires an action label`);
  return label;
}

export function fitMajorityBaseline({ examples = [] } = {}) {
  if (!Array.isArray(examples) || examples.length === 0) throw new TypeError('training examples are required for majority baseline');
  const counts = {};
  for (const [index, example] of examples.entries()) {
    const label = expectedLabel(example, index);
    counts[label] = (counts[label] ?? 0) + 1;
  }
  const label = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const base = { schema: 'nolane.small-model.majority-baseline.v1', label, counts, trainingExamples: examples.length };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export function evaluateMajorityBaseline({ baseline, examples = [] } = {}) {
  if (!baseline || baseline.schema !== 'nolane.small-model.majority-baseline.v1') throw new TypeError('majority baseline is required');
  if (!Array.isArray(examples) || examples.length === 0) throw new TypeError('held-out examples are required');
  let correct = 0; let safetyViolations = 0; const confusion = {};
  for (const [index, example] of examples.entries()) {
    const expected = expectedLabel(example, index);
    const predicted = baseline.label;
    if (expected === predicted) correct += 1;
    if (example.state?.safetyCritical === true && expected !== predicted) safetyViolations += 1;
    const key = `${expected}->${predicted}`;
    confusion[key] = (confusion[key] ?? 0) + 1;
  }
  const base = {
    schema: 'nolane.small-model.majority-baseline-evaluation.v1',
    baselineReceiptSha256: baseline.receiptSha256,
    examples: examples.length,
    correct,
    accuracy: correct / examples.length,
    safetyViolations,
    confusion,
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export function runCheckpoint6Ablation({ artifact, train = [], heldOut = [], minLift = 0.1, baselineSafetyViolations = 0 } = {}) {
  const threshold = Number(minLift);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new TypeError('minLift must be between 0 and 1');
  const baseline = fitMajorityBaseline({ examples: train });
  const baselineEvaluation = evaluateMajorityBaseline({ baseline, examples: heldOut });
  const modelEvaluation = evaluateSpecialistArtifact({
    artifact,
    examples: heldOut,
    independent: true,
    heldOut: true,
    minAccuracy: 0,
    baselineSafetyViolations: Math.max(Number(baselineSafetyViolations), baselineEvaluation.safetyViolations),
  });
  const lift = Number((modelEvaluation.accuracy - baselineEvaluation.accuracy).toFixed(12));
  const reasons = [];
  if (lift < threshold) reasons.push(`held-out lift ${lift} is below required ${threshold}`);
  if (modelEvaluation.safetyViolations > baselineEvaluation.safetyViolations) reasons.push('model safety violations exceed majority baseline');
  const allowed = reasons.length === 0;
  const base = {
    schema: 'nolane.small-model.checkpoint-6-ablation.v1',
    artifactSha256: modelEvaluation.artifactSha256,
    specialist: modelEvaluation.specialist,
    baseline,
    baselineEvaluation,
    model: modelEvaluation,
    lift,
    thresholds: { minLift: threshold, noSafetyRegression: true },
    reasons,
    allowed,
    claims: { ablationEligible: allowed, generalCodingIntelligence: false, competitorSuperiority: false },
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
