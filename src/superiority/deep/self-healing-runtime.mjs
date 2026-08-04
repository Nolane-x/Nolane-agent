import { deepFreeze, nonEmpty, requireSha256, signed, uniqueStrings } from '../superiority-utils.mjs';

const SEVERITY = Object.freeze({ low: 1, medium: 2, high: 3, critical: 4 });

export class SelfHealingRuntime {
  constructor({ clock = () => Date.now(), limits = {} } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxComponents = Math.max(1, Math.floor(Number(limits.maxComponents) || 500));
    this.components = new Map();
    this.plans = new Map();
  }

  registerComponent(input = {}) {
    const componentId = nonEmpty(input.componentId, 'componentId');
    if (this.components.has(componentId)) throw new Error(`Component already exists ${componentId}`);
    const allowedRepairs = uniqueStrings(input?.policy?.allowedRepairs);
    if (!allowedRepairs.length) throw new TypeError('allowedRepairs must not be empty');
    const state = { componentId, baselineHash: requireSha256(input.baselineHash, 'baselineHash'), policy: deepFreeze({ maxRepairAttempts: Math.max(1, Math.floor(Number(input?.policy?.maxRepairAttempts) || 1)), allowedRepairs, approvalRequiredRepairs: uniqueStrings(input?.policy?.approvalRequiredRepairs) }), anomalies: new Map(), attempts: 0, circuitOpen: false, status: 'healthy', registeredAtMs: Number(this.clock()) };
    this.components.set(componentId, state);
    while (this.components.size > this.maxComponents) this.components.delete(this.components.keys().next().value);
    return this.#public(state);
  }

  observe(input = {}) {
    const state = this.#component(input.componentId);
    if (input.observed !== true) throw new Error('Anomaly must be observed');
    const severity = String(input.severity ?? '').toLowerCase();
    if (!SEVERITY[severity]) throw new TypeError('Invalid anomaly severity');
    const anomalyId = nonEmpty(input.anomalyId, 'anomalyId');
    const anomaly = deepFreeze({ anomalyId, severity, observed: true, evidenceHash: requireSha256(input.evidenceHash, 'evidenceHash'), symptoms: uniqueStrings(input.symptoms), observedAtMs: Number(this.clock()) });
    state.anomalies.set(anomalyId, anomaly);
    state.status = 'degraded';
    if (SEVERITY[severity] >= SEVERITY.high) state.circuitOpen = true;
    return signed({ schema: 'nolane.superiority.self-healing-anomaly.v1', componentId: state.componentId, ...anomaly, circuitOpen: state.circuitOpen });
  }

  planRepair(componentId, input = {}) {
    const state = this.#component(componentId);
    const anomalyId = nonEmpty(input.anomalyId, 'anomalyId');
    const anomaly = state.anomalies.get(anomalyId);
    if (!anomaly) throw new Error(`Unknown anomaly ${anomalyId}`);
    if (state.attempts >= state.policy.maxRepairAttempts) throw new Error('Repair attempt budget exhausted');
    const preferred = uniqueStrings(input.preferredActions);
    const allowedPreferred = preferred.filter((action) => state.policy.allowedRepairs.includes(action));
    const fallbackOrder = anomaly.severity === 'critical' ? ['rollback', 'isolate', 'restart'] : anomaly.severity === 'high' ? ['restart', 'isolate', 'rollback'] : ['restart', 'isolate'];
    const action = [...allowedPreferred, ...fallbackOrder].find((candidate, index, array) => state.policy.allowedRepairs.includes(candidate) && array.indexOf(candidate) === index);
    if (!action) throw new Error('No allowed repair action');
    const planId = `repair:${componentId}:${anomalyId}:${state.attempts + 1}`;
    const plan = { planId, componentId, anomalyId, action, approvalRequired: state.policy.approvalRequiredRepairs.includes(action), evidenceHash: anomaly.evidenceHash, createdAtMs: Number(this.clock()), status: 'planned' };
    this.plans.set(planId, plan);
    return signed({ schema: 'nolane.superiority.self-healing-plan.v1', ...plan, circuitOpen: state.circuitOpen, authorization: { automaticRepairAllowed: !plan.approvalRequired, humanApprovalRequired: plan.approvalRequired } });
  }

  async executeRepair(planId, input = {}) {
    const plan = this.plans.get(nonEmpty(planId, 'planId'));
    if (!plan) throw new Error(`Unknown repair plan ${planId}`);
    if (plan.status !== 'planned') throw new Error('Repair plan already executed');
    const state = this.#component(plan.componentId);
    if (plan.approvalRequired && input.approvedByHuman !== true) throw new Error('Repair approval required');
    const adapter = input.adapter;
    if (!adapter || typeof adapter[plan.action] !== 'function') throw new TypeError(`Repair adapter missing ${plan.action}()`);
    state.attempts += 1;
    const result = await adapter[plan.action](state.componentId, { anomalyId: plan.anomalyId, evidenceHash: plan.evidenceHash });
    if (result?.observed !== true) throw new Error('Repair result must be observed');
    const effectHash = requireSha256(result.effectHash, 'effectHash');
    const success = result.success === true;
    plan.status = success ? 'repaired' : 'failed';
    state.status = success ? 'healthy' : 'degraded';
    state.circuitOpen = !success && state.attempts < state.policy.maxRepairAttempts;
    if (success) state.circuitOpen = false;
    return signed({
      schema: 'nolane.superiority.self-healing-result.v1', planId: plan.planId, componentId: state.componentId, anomalyId: plan.anomalyId, action: plan.action,
      status: plan.status, observed: true, success, effectHash, circuitOpen: state.circuitOpen, attempts: state.attempts, actor: input.actor ? String(input.actor) : 'runtime', completedAtMs: Number(this.clock()),
      claims: { unboundedSelfModificationAllowed: false, automaticPolicyMutationAllowed: false, hiddenReasoningStored: false },
    });
  }

  snapshot() { return signed({ schema: 'nolane.superiority.self-healing-runtime.v1', components: [...this.components.values()].map((state) => this.#public(state)), planCount: this.plans.size, claims: { unboundedSelfModificationAllowed: false, destructiveRepairWithoutApprovalAllowed: false } }); }
  #component(id) { const key = nonEmpty(id, 'componentId'); const state = this.components.get(key); if (!state) throw new Error(`Unknown component ${key}`); return state; }
  #public(state) { return signed({ schema: 'nolane.superiority.self-healing-component.v1', componentId: state.componentId, baselineHash: state.baselineHash, policy: state.policy, anomalyCount: state.anomalies.size, attempts: state.attempts, circuitOpen: state.circuitOpen, status: state.status, registeredAtMs: state.registeredAtMs }); }
}
