import { canonicalSha256, deepFreeze } from './shared.mjs';

const SHA = /^[a-f0-9]{64}$/i;
const bounded = (value, label, min = 0, max = 1) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return number;
};

function receipt(schema, body) {
  const base = { schema, ...body };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export class AdaptationPolicyLearner {
  #learningRate;
  #maxExploration;
  #minBackwardTransfer;
  #scores = new Map();
  #evaluations = [];
  #canaries = [];
  #rollbacks = 0;

  constructor({ learningRate = 0.3, maxExploration = 0.2, minBackwardTransfer = -0.05 } = {}) {
    this.#learningRate = bounded(learningRate, 'learningRate');
    this.#maxExploration = bounded(maxExploration, 'maxExploration');
    this.#minBackwardTransfer = Number(minBackwardTransfer);
  }

  recordOutcome({ contextKey, action, reward, verified, receiptSha256 } = {}) {
    if (!contextKey || !action || verified !== true || !SHA.test(String(receiptSha256 ?? ''))) throw new Error('Adaptation learning requires a verified outcome receipt');
    const value = bounded(reward, 'reward', -1, 1);
    const context = this.#scores.get(String(contextKey)) ?? new Map();
    const current = context.get(String(action)) ?? { qValue: 0, updates: 0 };
    const qValue = current.qValue + this.#learningRate * (value - current.qValue);
    const stored = { qValue: Number(qValue.toFixed(6)), updates: current.updates + 1 };
    context.set(String(action), stored);
    this.#scores.set(String(contextKey), context);
    return receipt('nolane.small-model.adaptation-outcome.v1', { contextKey: String(contextKey), action: String(action), reward: value, qValue: stored.qValue, updates: stored.updates, evidenceReceiptSha256: String(receiptSha256) });
  }

  select({ contextKey, allowedActions, exploration = 0 } = {}) {
    if (!contextKey || !Array.isArray(allowedActions) || allowedActions.length === 0) throw new TypeError('contextKey and allowedActions are required');
    const explorationValue = bounded(exploration, 'exploration');
    if (explorationValue > this.#maxExploration) throw new Error(`Exploration budget exceeded: ${explorationValue} > ${this.#maxExploration}`);
    const unique = [...new Set(allowedActions.map(String))].sort();
    const context = this.#scores.get(String(contextKey));
    const candidates = unique.map((action) => ({ action, ...(context?.get(action) ?? { qValue: 0, updates: 0 }) })).filter((item) => item.updates > 0);
    if (candidates.length === 0) {
      if (explorationValue > 0) return receipt('nolane.small-model.adaptation-decision.v1', { contextKey: String(contextKey), action: unique[0], status: 'exploration', exploration: explorationValue, hiddenChainOfThoughtStored: false });
      return receipt('nolane.small-model.adaptation-decision.v1', { contextKey: String(contextKey), action: null, status: 'abstain', exploration: explorationValue, hiddenChainOfThoughtStored: false });
    }
    candidates.sort((a, b) => b.qValue - a.qValue || b.updates - a.updates || a.action.localeCompare(b.action));
    return receipt('nolane.small-model.adaptation-decision.v1', { contextKey: String(contextKey), action: candidates[0].action, status: 'shadow', qValue: candidates[0].qValue, updates: candidates[0].updates, exploration: explorationValue, hiddenChainOfThoughtStored: false });
  }

  evaluateHeldOut({ independent, heldOut, cases } = {}) {
    if (independent !== true || heldOut !== true) throw new Error('Adaptation policy evaluation requires independent held-out cases');
    if (!Array.isArray(cases) || cases.length < 2) throw new TypeError('At least two held-out adaptation cases are required');
    let candidateCorrect = 0; let baselineCorrect = 0; let candidateSafety = 0; let baselineSafety = 0;
    const results = cases.map((item, index) => {
      if (!item?.contextKey || !Array.isArray(item.allowedActions) || !item.optimalAction || !item.baselineAction) throw new TypeError(`Held-out case ${index} is incomplete`);
      const decision = this.select({ contextKey: item.contextKey, allowedActions: item.allowedActions, exploration: 0 });
      const candidateAction = decision.action;
      if (candidateAction === item.optimalAction) candidateCorrect += 1;
      if (item.baselineAction === item.optimalAction) baselineCorrect += 1;
      candidateSafety += Number(item.safety?.[candidateAction] ?? 1);
      baselineSafety += Number(item.safety?.[item.baselineAction] ?? 1);
      return { contextKey: String(item.contextKey), candidateAction, baselineAction: String(item.baselineAction), optimalAction: String(item.optimalAction) };
    });
    const candidateAccuracy = candidateCorrect / cases.length;
    const baselineAccuracy = baselineCorrect / cases.length;
    const allowed = candidateAccuracy >= baselineAccuracy && candidateSafety <= baselineSafety && results.every((item) => item.candidateAction !== null);
    const value = receipt('nolane.small-model.adaptation-policy-evaluation.v1', { version: String(this.#evaluations.length + 1), independent: true, heldOut: true, cases: results, candidateAccuracy, baselineAccuracy, candidateSafetyViolations: candidateSafety, baselineSafetyViolations: baselineSafety, allowed });
    this.#evaluations.push(value);
    return value;
  }

  promoteCanary({ evaluationReceipt, canaryFraction = 0.05 } = {}) {
    if (evaluationReceipt?.schema !== 'nolane.small-model.adaptation-policy-evaluation.v1' || evaluationReceipt.allowed !== true || !SHA.test(String(evaluationReceipt.receiptSha256 ?? ''))) throw new Error('Allowed evaluation receipt is required for canary promotion');
    const fraction = bounded(canaryFraction, 'canaryFraction');
    if (fraction <= 0 || fraction > 0.25) throw new Error('Canary fraction must be greater than 0 and at most 0.25');
    const value = receipt('nolane.small-model.adaptation-policy-canary.v1', { version: evaluationReceipt.version, status: 'canary', canaryFraction: fraction, evaluationReceiptSha256: evaluationReceipt.receiptSha256 });
    this.#canaries.push(value);
    return value;
  }

  recordCanaryOutcome({ version, verified, forwardTransfer, backwardTransfer, safetyViolations = 0 } = {}) {
    const canary = this.#canaries.find((item) => item.version === String(version));
    if (!canary || verified !== true) throw new Error('Verified canary outcome is required');
    const forward = Number(forwardTransfer); const backward = Number(backwardTransfer);
    if (!Number.isFinite(forward) || !Number.isFinite(backward) || !Number.isInteger(Number(safetyViolations)) || Number(safetyViolations) < 0) throw new TypeError('Canary transfer and safety metrics are required');
    if (backward < this.#minBackwardTransfer || Number(safetyViolations) > 0) {
      this.#canaries = this.#canaries.filter((item) => item !== canary);
      this.#rollbacks += 1;
      throw new Error('Adaptation policy negative transfer triggered rollback');
    }
    return receipt('nolane.small-model.adaptation-policy-promotion.v1', { version: String(version), status: 'promoted', forwardTransfer: forward, backwardTransfer: backward, safetyViolations: Number(safetyViolations), canaryReceiptSha256: canary.receiptSha256 });
  }

  snapshot() {
    return deepFreeze({ schema: 'nolane.small-model.adaptation-policy-learner.v1', contexts: this.#scores.size, evaluations: this.#evaluations.length, canaries: this.#canaries.length, rollbacks: this.#rollbacks, stableCoreModified: false });
  }
}
