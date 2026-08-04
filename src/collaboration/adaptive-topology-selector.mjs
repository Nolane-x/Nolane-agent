import { boundedNumber, signed, text } from '../construction/construction-utils.mjs';
const RISK = Object.freeze({ low: 0.1, medium: 0.35, high: 0.7, critical: 1 });

export class AdaptiveTopologySelector {
  select(input = {}) {
    const risk = String(input.risk ?? 'medium').toLowerCase(); const riskScore = RISK[risk] ?? RISK.medium;
    const independent = Math.max(0, Math.floor(Number(input.independentSubtasks) || 0)); const uncertainty = boundedNumber(input.uncertainty, 0.3, 0, 1, 'uncertainty');
    const slots = Math.max(0, Math.floor(Number(input.availableAgentSlots) || 0)); const pressure = boundedNumber(input.resourcePressure, 0, 0, 1, 'resourcePressure');
    let topology = 'solo'; const reasons = [];
    if (slots < 2 || pressure >= 0.75) reasons.push('resource-constrained');
    else if (input.securitySensitive || risk === 'critical') { topology = 'executor-reviewer'; reasons.push('independent-adversarial-review'); }
    else if (independent >= 2 && riskScore >= 0.65 && Number(input.candidateValue ?? 0) >= 0.6) { topology = 'parallel-candidates'; reasons.push('independent-high-value-candidates'); }
    else if (independent >= 2 && uncertainty >= 0.65) { topology = 'blackboard'; reasons.push('shared-state-coordination'); }
    else if (independent >= 1 && riskScore >= 0.35) { topology = 'planner-executor'; reasons.push('bounded-decomposition'); }
    else reasons.push('single-agent-is-sufficient');
    return signed({ schema: 'forge.adaptive-topology-decision.v1', topology, reasons, inputs: { risk, independentSubtasks: independent, uncertainty, availableAgentSlots: slots, resourcePressure: pressure }, claims: { agentsCreated: false, fixedSwarmUsed: false } });
  }
}

export class DomainTrustRegistry {
  constructor() { this.records = []; }
  record(input = {}) { const record = signed({ schema: 'forge.domain-trust-observation.v1', agentId: text(input.agentId, 'agentId', 256), domain: text(input.domain, 'domain', 256), taskType: text(input.taskType, 'taskType', 128), evidenceType: text(input.evidenceType, 'evidenceType', 128), success: Boolean(input.success), confidence: boundedNumber(input.confidence, 0.5, 0, 1, 'confidence'), observedAtMs: Date.now() }); this.records.push(record); return record; }
  rank({ domain, taskType, evidenceType, candidates = [] } = {}) {
    const ids = candidates.map((id) => text(id, 'candidate', 256));
    return Object.freeze(ids.map((agentId) => { const matches = this.records.filter((r) => r.agentId === agentId && r.domain === domain && r.taskType === taskType && r.evidenceType === evidenceType); const score = matches.length ? matches.reduce((sum, r) => sum + (r.success ? 1 : -1) * r.confidence, 0) / matches.length : 0; return Object.freeze({ agentId, score, observations: matches.length }); }).sort((a, b) => b.score - a.score || a.agentId.localeCompare(b.agentId)));
  }
}

export function assignCausalCredit({ outcomeValue, contributions = [] } = {}) {
  const outcome = boundedNumber(outcomeValue, 0, -1_000, 1_000, 'outcomeValue');
  const raw = contributions.map((item) => ({ actorId: text(item.actorId, 'actorId', 256), delta: Math.max(0, outcome - boundedNumber(item.withoutActorValue, outcome, -1_000, 1_000, 'withoutActorValue')) }));
  const total = raw.reduce((sum, item) => sum + item.delta, 0) || 1;
  const credits = raw.map((item) => Object.freeze({ actorId: item.actorId, credit: item.delta / total, counterfactualDelta: item.delta })).sort((a, b) => b.credit - a.credit || a.actorId.localeCompare(b.actorId));
  return signed({ schema: 'forge.causal-credit-assignment.v1', outcomeValue: outcome, credits, claims: { finalActorReceivesAllCredit: false } });
}
