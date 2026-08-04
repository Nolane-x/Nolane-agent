import { boundedNumber, deepFreeze, nonEmpty, requireSha256, signed, uniqueStrings } from '../superiority-utils.mjs';

const DECISIONS = new Set(['allow', 'deny', 'approval']);

function normalizeBudget(value = {}) {
  return deepFreeze({
    tokens: Math.max(0, Number(value.tokens) || 0),
    elapsedMs: Math.max(0, Number(value.elapsedMs) || 0),
    costUsd: Math.max(0, Number(value.costUsd) || 0),
  });
}

function normalizeRules(items = []) {
  if (!Array.isArray(items) || !items.length) throw new TypeError('rules must contain at least one rule');
  const ids = new Set();
  const effects = new Set();
  return items.map((item) => {
    const ruleId = nonEmpty(item?.ruleId, 'ruleId');
    const effect = nonEmpty(item?.effect, 'effect');
    if (ids.has(ruleId)) throw new Error(`Duplicate ruleId ${ruleId}`);
    if (effects.has(effect)) throw new Error(`Duplicate effect rule ${effect}`);
    ids.add(ruleId); effects.add(effect);
    const decision = String(item?.decision ?? '').toLowerCase();
    if (!DECISIONS.has(decision)) throw new TypeError(`Invalid decision for ${ruleId}`);
    return deepFreeze({
      ruleId,
      effect,
      decision,
      maxRisk: boundedNumber(item?.maxRisk, decision === 'deny' ? 0 : 1),
      requiredCapabilities: uniqueStrings(item?.requiredCapabilities),
      reversibleRequired: item?.reversibleRequired === true,
    });
  });
}

export class MissionConstitutionEngine {
  constructor({ clock = () => Date.now(), limits = {} } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxConstitutions = Math.max(1, Math.floor(Number(limits.maxConstitutions) || 500));
    this.constitutions = new Map();
  }

  register(input = {}) {
    const constitutionId = nonEmpty(input.constitutionId, 'constitutionId');
    if (this.constitutions.has(constitutionId)) throw new Error(`Constitution already exists ${constitutionId}`);
    const state = {
      constitutionId,
      missionId: nonEmpty(input.missionId, 'missionId'),
      version: 1,
      rules: normalizeRules(input.rules),
      budgets: normalizeBudget(input.budgets),
      createdAtMs: Number(this.clock()),
      amendedAtMs: null,
      amendments: [],
      actionReceipts: [],
    };
    this.constitutions.set(constitutionId, state);
    while (this.constitutions.size > this.maxConstitutions) this.constitutions.delete(this.constitutions.keys().next().value);
    return this.#public(state);
  }

  evaluate(constitutionId, input = {}) {
    const state = this.#state(constitutionId);
    if (input.observed !== true) throw new Error('Action evidence must be observed');
    const actionId = nonEmpty(input.actionId, 'actionId');
    const evidenceHash = requireSha256(input.evidenceHash, 'evidenceHash');
    const effects = uniqueStrings(input.effects);
    if (!effects.length) throw new TypeError('effects must contain at least one effect');
    const capabilities = new Set(uniqueStrings(input.capabilities));
    const risk = boundedNumber(input.risk, 1);
    const reversible = input.reversible === true;
    const estimated = normalizeBudget(input.estimated);
    const violations = [];
    let approvalRequired = false;

    for (const effect of effects) {
      const rule = state.rules.find((item) => item.effect === effect);
      if (!rule) { violations.push({ code: 'EFFECT_UNSPECIFIED', effect }); continue; }
      if (rule.decision === 'deny') violations.push({ code: 'EFFECT_DENIED', effect, ruleId: rule.ruleId });
      if (rule.decision === 'approval') approvalRequired = true;
      if (risk > rule.maxRisk) violations.push({ code: 'RISK_LIMIT_EXCEEDED', effect, ruleId: rule.ruleId });
      const missing = rule.requiredCapabilities.filter((capability) => !capabilities.has(capability));
      if (missing.length) violations.push({ code: 'CAPABILITY_MISSING', effect, ruleId: rule.ruleId, missing });
      if (rule.reversibleRequired && !reversible) violations.push({ code: 'REVERSIBILITY_REQUIRED', effect, ruleId: rule.ruleId });
    }
    for (const key of ['tokens', 'elapsedMs', 'costUsd']) {
      const limit = state.budgets[key];
      if (limit > 0 && estimated[key] > limit) violations.push({ code: 'BUDGET_EXCEEDED', budget: key, estimated: estimated[key], limit });
    }
    const allowed = violations.length === 0 && !approvalRequired;
    const receipt = signed({
      schema: 'nolane.superiority.mission-constitution-action.v1', constitutionId: state.constitutionId, missionId: state.missionId,
      constitutionVersion: state.version, actionId, effects, risk, reversible, estimated, evidenceHash, observed: true,
      allowed, approvalRequired, violations: deepFreeze(violations), evaluatedAtMs: Number(this.clock()),
      authorization: { automaticExecutionAllowed: allowed && !approvalRequired, humanApprovalRequired: approvalRequired },
      boundaries: { hiddenReasoningStored: false, rawPromptStored: false, rawModelOutputStored: false, secretStored: false },
    });
    state.actionReceipts.push(receipt.receiptSha256);
    if (state.actionReceipts.length > 2_000) state.actionReceipts.shift();
    return receipt;
  }

  amend(constitutionId, input = {}) {
    const state = this.#state(constitutionId);
    if (input.approvedByHuman !== true) throw new Error('Constitution amendment requires explicit human approval');
    if (Number(input.expectedVersion) !== state.version) throw new Error('Constitution version conflict');
    const actor = nonEmpty(input.actor, 'actor');
    const approvalReceiptSha256 = requireSha256(input.approvalReceiptSha256, 'approvalReceiptSha256');
    const rules = normalizeRules(input.rules);
    const previousRulesHash = signed({ rules: state.rules }).receiptSha256;
    state.rules = rules;
    if (input.budgets) state.budgets = normalizeBudget(input.budgets);
    state.version += 1;
    state.amendedAtMs = Number(this.clock());
    state.amendments.push(deepFreeze({ actor, approvalReceiptSha256, previousRulesHash, version: state.version, amendedAtMs: state.amendedAtMs }));
    return this.#public(state);
  }

  snapshot() {
    return signed({
      schema: 'nolane.superiority.mission-constitution-engine.v1',
      constitutions: [...this.constitutions.values()].map((state) => this.#public(state)).sort((a, b) => a.constitutionId.localeCompare(b.constitutionId)),
      claims: { automaticPolicyMutationAllowed: false, unapprovedEffectAllowed: false, hiddenReasoningStored: false, secretStored: false },
    });
  }

  #state(id) {
    const constitutionId = nonEmpty(id, 'constitutionId');
    const state = this.constitutions.get(constitutionId);
    if (!state) throw new Error(`Unknown constitution ${constitutionId}`);
    return state;
  }

  #public(state) {
    return signed({
      schema: 'nolane.superiority.mission-constitution.v1', constitutionId: state.constitutionId, missionId: state.missionId,
      version: state.version, rules: state.rules, budgets: state.budgets, createdAtMs: state.createdAtMs, amendedAtMs: state.amendedAtMs,
      amendmentCount: state.amendments.length, actionReceiptCount: state.actionReceipts.length,
      claims: { automaticPolicyMutationAllowed: false, humanApprovalRequiredForAmendment: true, hiddenReasoningStored: false },
    });
  }
}
