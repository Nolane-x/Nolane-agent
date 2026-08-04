const STAGES = Object.freeze(['initial', 'symbol-neighborhood', 'targeted-expansion', 'full-file-exception']);
const DEFAULT_BUDGETS = Object.freeze({ initial: 3_000, 'symbol-neighborhood': 6_000, 'targeted-expansion': 10_000, 'full-file-exception': 16_000 });

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function budget(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new TypeError(`${label} must be a positive integer`);
  return number;
}
function cancelled(signal) {
  if (signal?.aborted) throw signal.reason ?? Object.assign(new Error('context escalation cancelled'), { code: 'CONTEXT_ESCALATION_CANCELLED' });
}

export class ContextEscalationController {
  constructor({ budgets = {}, confidenceThreshold = 0.7, maxExpansions = 3 } = {}) {
    this.budgets = Object.freeze({ ...DEFAULT_BUDGETS, ...budgets });
    let previous = 0;
    for (const stage of STAGES) {
      const current = budget(this.budgets[stage], `budget for ${stage}`);
      if (current < previous) throw new TypeError('context escalation budgets must be monotonic');
      previous = current;
    }
    this.confidenceThreshold = Number(confidenceThreshold);
    if (!Number.isFinite(this.confidenceThreshold) || this.confidenceThreshold < 0 || this.confidenceThreshold > 1) throw new TypeError('confidenceThreshold must be between 0 and 1');
    this.maxExpansions = Math.max(0, Math.min(3, Math.floor(Number(maxExpansions) || 0)));
  }

  start({ budgetTokens } = {}) {
    const initialBudget = budgetTokens == null ? this.budgets.initial : budget(budgetTokens, 'initial context budgetTokens');
    if (initialBudget > this.budgets['full-file-exception']) throw new TypeError('initial context budget exceeds the full-file exception budget');
    return freeze({ schema: 'forge.context-escalation-state.v1', stage: 'initial', budgetTokens: initialBudget, expansionCount: 0, history: [] });
  }

  evaluate(state, { confidence, unresolvedHypotheses = [], needsMoreContext = false, signal } = {}) {
    cancelled(signal);
    if (!state || !STAGES.includes(state.stage)) throw new TypeError('valid context escalation state is required');
    const unresolved = Array.isArray(unresolvedHypotheses) ? unresolvedHypotheses.map(String).filter(Boolean).slice(0, 16) : [];
    const hasConfidence = confidence !== undefined && confidence !== null;
    const normalizedConfidence = hasConfidence ? Number(confidence) : null;
    if (hasConfidence && (!Number.isFinite(normalizedConfidence) || normalizedConfidence < 0 || normalizedConfidence > 1)) throw new TypeError('confidence must be between 0 and 1');
    let reason = null;
    if (unresolved.length) reason = 'unresolved-hypothesis';
    else if (needsMoreContext === true) reason = 'provider-requested-context';
    else if (hasConfidence && normalizedConfidence < this.confidenceThreshold) reason = 'low-confidence';
    else if (!hasConfidence) return freeze({ action: 'stop', reason: 'no-escalation-signal', state });
    else return freeze({ action: 'stop', reason: 'confidence-sufficient', state });

    const currentIndex = STAGES.indexOf(state.stage);
    if (state.expansionCount >= this.maxExpansions || currentIndex >= STAGES.length - 1) return freeze({ action: 'stop', reason: 'maximum-context-stage', state });
    const nextStage = STAGES[currentIndex + 1];
    const nextState = freeze({
      schema: 'forge.context-escalation-state.v1', stage: nextStage, budgetTokens: this.budgets[nextStage],
      expansionCount: state.expansionCount + 1,
      history: [...(state.history ?? []), { from: state.stage, to: nextStage, reason, confidence: normalizedConfidence, unresolvedHypotheses: unresolved }],
    });
    return freeze({ action: 'expand', reason, state, nextState });
  }
}

export const CONTEXT_ESCALATION_STAGES = STAGES;
