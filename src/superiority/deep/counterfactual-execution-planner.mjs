import { boundedNumber, deepFreeze, nonEmpty, requireSha256, signed, uniqueStrings } from '../superiority-utils.mjs';

function dominates(a, b) {
  const atLeast = a.benefit >= b.benefit && a.risk <= b.risk && a.uncertainty <= b.uncertainty && a.proofCoverage >= b.proofCoverage && a.rollbackCoverage >= b.rollbackCoverage && a.cost <= b.cost;
  const strict = a.benefit > b.benefit || a.risk < b.risk || a.uncertainty < b.uncertainty || a.proofCoverage > b.proofCoverage || a.rollbackCoverage > b.rollbackCoverage || a.cost < b.cost;
  return atLeast && strict;
}

export class CounterfactualExecutionPlanner {
  constructor({ clock = () => Date.now(), limits = {} } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxPlans = Math.max(1, Math.floor(Number(limits.maxPlans) || 500));
    this.plans = new Map();
  }

  open(input = {}) {
    const planningId = nonEmpty(input.planningId, 'planningId');
    if (this.plans.has(planningId)) throw new Error(`Planning session already exists ${planningId}`);
    const constraints = deepFreeze({
      maxRisk: boundedNumber(input?.constraints?.maxRisk, 0.5),
      minProofCoverage: boundedNumber(input?.constraints?.minProofCoverage, 0.7),
      minRollbackCoverage: boundedNumber(input?.constraints?.minRollbackCoverage, 0.7),
      maxDecisionUncertainty: boundedNumber(input?.constraints?.maxDecisionUncertainty, 0.35),
    });
    const state = { planningId, goal: nonEmpty(input.goal, 'goal'), constraints, causalReceiptSha256: requireSha256(input.causalReceiptSha256, 'causalReceiptSha256'), candidates: new Map(), openedAtMs: Number(this.clock()) };
    this.plans.set(planningId, state);
    while (this.plans.size > this.maxPlans) this.plans.delete(this.plans.keys().next().value);
    return this.#public(state);
  }

  registerCandidate(planningId, input = {}) {
    const state = this.#state(planningId);
    const planId = nonEmpty(input.planId, 'planId');
    if (state.candidates.has(planId)) throw new Error(`Duplicate planId ${planId}`);
    const evidenceHashes = uniqueStrings(input.evidenceHashes).map((hash) => requireSha256(hash, 'evidenceHash'));
    if (!evidenceHashes.length) throw new TypeError('evidenceHashes must contain observed evidence');
    const candidate = deepFreeze({
      planId, benefit: boundedNumber(input.benefit, 0), risk: boundedNumber(input.risk, 1), uncertainty: boundedNumber(input.uncertainty, 1),
      proofCoverage: boundedNumber(input.proofCoverage, 0), rollbackCoverage: boundedNumber(input.rollbackCoverage, 0),
      cost: Math.max(0, Number(input.cost) || 0), dependenciesSatisfied: input.dependenciesSatisfied === true, evidenceHashes,
      registeredAtMs: Number(this.clock()),
    });
    state.candidates.set(planId, candidate);
    return signed({ schema: 'nolane.superiority.counterfactual-candidate.v1', planningId, candidate });
  }

  decide(planningId) {
    const state = this.#state(planningId);
    const candidates = [...state.candidates.values()];
    const rejected = [];
    const preliminary = [];
    for (const candidate of candidates) {
      const reasons = [];
      if (!candidate.dependenciesSatisfied) reasons.push('dependencies-unsatisfied');
      if (candidate.risk > state.constraints.maxRisk) reasons.push('risk-budget');
      if (candidate.proofCoverage < state.constraints.minProofCoverage) reasons.push('proof-coverage');
      if (candidate.rollbackCoverage < state.constraints.minRollbackCoverage) reasons.push('rollback-coverage');
      if (candidate.uncertainty > state.constraints.maxDecisionUncertainty) reasons.push('uncertainty-probe');
      if (reasons.length) rejected.push(deepFreeze({ planId: candidate.planId, reasons }));
      else preliminary.push(candidate);
    }
    const eligible = [];
    for (const candidate of preliminary) {
      if (preliminary.some((other) => other.planId !== candidate.planId && dominates(other, candidate))) rejected.push(deepFreeze({ planId: candidate.planId, reasons: ['dominated'] }));
      else eligible.push(candidate);
    }
    const ranked = eligible.map((candidate) => ({
      ...candidate,
      score: candidate.benefit * candidate.proofCoverage * candidate.rollbackCoverage - candidate.risk - candidate.uncertainty - candidate.cost * 0.1,
    })).sort((a, b) => b.score - a.score || a.planId.localeCompare(b.planId));
    const selected = ranked[0] ?? null;
    const margin = selected && ranked[1] ? selected.score - ranked[1].score : selected ? selected.score : 0;
    const realProbeRequired = !selected || (ranked.length > 1 && margin < 0.05);
    return signed({
      schema: 'nolane.superiority.counterfactual-decision.v1', planningId: state.planningId, goal: state.goal,
      selectedPlanId: realProbeRequired ? null : selected.planId, ranked: deepFreeze(ranked.map(({ evidenceHashes, ...item }) => ({ ...item, evidenceCount: evidenceHashes.length }))),
      rejected: deepFreeze(rejected.sort((a, b) => a.planId.localeCompare(b.planId))), realProbeRequired, decisionMargin: margin,
      decidedAtMs: Number(this.clock()), authorization: { automaticExecutionAllowed: false, humanApprovalRequired: true },
      boundaries: { hiddenReasoningStored: false, rawPromptStored: false, rawModelOutputStored: false },
    });
  }

  snapshot() { return signed({ schema: 'nolane.superiority.counterfactual-planner.v1', sessions: [...this.plans.values()].map((state) => this.#public(state)), claims: { automaticExecutionAllowed: false, guessedWinnerAllowed: false } }); }
  #state(id) { const key = nonEmpty(id, 'planningId'); const state = this.plans.get(key); if (!state) throw new Error(`Unknown planning session ${key}`); return state; }
  #public(state) { return signed({ schema: 'nolane.superiority.counterfactual-session.v1', planningId: state.planningId, goal: state.goal, constraints: state.constraints, causalReceiptSha256: state.causalReceiptSha256, candidateCount: state.candidates.size, openedAtMs: state.openedAtMs }); }
}
