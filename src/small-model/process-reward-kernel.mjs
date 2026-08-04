import { canonicalSha256, deepFreeze } from './shared.mjs';

const HIDDEN = /(?:chain.?of.?thought|hidden.?reasoning|reasoning.?trace|private.?scratchpad)/i;
function scan(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (HIDDEN.test(key) && !(key === 'hiddenChainOfThoughtStored' && child === false)) throw new TypeError(`Hidden reasoning is forbidden at ${path}.${key}`);
    scan(child, `${path}.${key}`);
  }
}
function finite(value, label, { min = -10, max = 10 } = {}) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < min || number > max) throw new TypeError(`${label} must be finite and bounded`);
  return number;
}

export function scoreProcessStep(step) {
  if (!step || typeof step !== 'object') throw new TypeError('Process step is required');
  scan(step);
  if (step.verifier?.valid !== true) throw new Error('Process reward requires a valid verifier');
  if (step.verifier?.rewardHacking === true) throw new Error('Process reward rejects reward hacking');
  if (step.actualEffect?.changed !== true) throw new Error('Process reward requires a verified effect');
  const positive = {
    informationGain: finite(step.actualEffect.informationGain, 'informationGain'),
    criterionDelta: finite(step.actualEffect.criterionDelta, 'criterionDelta'),
    recoveryDelta: finite(step.actualEffect.recoveryDelta, 'recoveryDelta'),
    bestCandidatePreserved: step.actualEffect.bestCandidatePreserved === true ? 1 : 0,
  };
  const negative = {
    irreversibleRisk: finite(step.actualEffect.irreversibleRisk, 'irreversibleRisk', { min: 0, max: 10 }),
    redundantAction: finite(step.actualEffect.redundantAction, 'redundantAction', { min: 0, max: 10 }),
    repeatedFailure: finite(step.actualEffect.repeatedFailure, 'repeatedFailure', { min: 0, max: 10 }),
    regressionDelta: finite(step.actualEffect.regressionDelta, 'regressionDelta', { min: 0, max: 10 }),
    resourceWaste: finite(step.actualEffect.resourceWaste, 'resourceWaste', { min: 0, max: 10 }),
  };
  const reward = Number((Object.values(positive).reduce((sum, value) => sum + value, 0) - Object.values(negative).reduce((sum, value) => sum + value, 0)).toFixed(8));
  const label = reward > 0 ? 'progress' : reward < 0 ? 'regression' : 'neutral';
  const base = {
    schema: 'nolane.small-model.process-reward.v1', stepId: String(step.id ?? ''), missionId: String(step.missionId ?? ''), phase: String(step.phase ?? ''),
    positive, negative, reward, label, verifierStatus: String(step.verifier.status ?? 'unknown'), hiddenChainOfThoughtStored: false,
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
