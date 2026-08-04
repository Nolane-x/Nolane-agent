import { canonicalSha256, deepFreeze } from './shared.mjs';
import { loadModelArtifact } from './model-artifact.mjs';
import { LinearPolicyRuntime } from './linear-policy-runtime.mjs';
import { boundedNumber } from './shared.mjs';

export function evaluateSpecialistArtifact({ artifact, examples = [], independent, heldOut, minAccuracy = 0.8, baselineSafetyViolations = 0, abstainThreshold = 0 } = {}) {
  if (independent !== true) throw new Error('Specialist evaluation must be independent');
  if (heldOut !== true) throw new Error('Specialist evaluation must use held-out examples');
  if (!Array.isArray(examples) || examples.length === 0) throw new TypeError('held-out examples are required');
  const minimum = boundedNumber(minAccuracy, 'minAccuracy', { min: 0, max: 1 });
  const baselineSafety = Number(baselineSafetyViolations); if (!Number.isSafeInteger(baselineSafety) || baselineSafety < 0) throw new TypeError('baselineSafetyViolations must be non-negative');
  const loaded = loadModelArtifact(artifact); const runtime = new LinearPolicyRuntime({ artifact: loaded, abstainThreshold });
  let correct = 0, abstentions = 0, safetyViolations = 0; const confusion = {};
  for (const [index, example] of examples.entries()) {
    const expected = String(example?.action?.type ?? example?.label ?? '').trim(); if (!expected || !example?.state) throw new TypeError(`example ${index} requires state and action`);
    const result = runtime.infer(example.state, { topK: Math.min(3, loaded.model.labels.length) }); const predicted = result.action;
    if (result.status === 'abstain') abstentions += 1;
    if (predicted === expected) correct += 1;
    if (example.state.safetyCritical === true && predicted !== expected) safetyViolations += 1;
    const key = `${expected}->${predicted ?? 'abstain'}`; confusion[key] = (confusion[key] ?? 0) + 1;
  }
  const accuracy = correct / examples.length; const allowed = accuracy >= minimum && safetyViolations <= baselineSafety;
  const base = {
    schema: 'nolane.small-model.specialist-evaluation.v1', artifactSha256: loaded.artifactSha256, specialist: loaded.specialist,
    independent: true, heldOut: true, examples: examples.length, correct, accuracy, abstentions, safetyViolations, baselineSafetyViolations: baselineSafety,
    thresholds: { minAccuracy: minimum }, confusion, allowed,
    claims: { boundedHeldOutEvidence: true, generalCodingIntelligence: false, competitorSuperiority: false },
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
