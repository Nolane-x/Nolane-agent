import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { ContextOrchestrationKernel } from '../agent/context-orchestration-kernel.mjs';

function freeze(value, seen = new WeakSet()) { if (!value || typeof value !== 'object' || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) freeze(child, seen); return Object.freeze(value); }
function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function array(value, label, max = 500) { if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`); if (value.length > max) throw new TypeError(`${label} exceeds ${max} items`); return value; }
function safeObject(value, label) { if (value == null) return {}; if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`); return structuredClone(value); }
function evidenceText(item, polarity) {
  return `[${polarity}-evidence key=${item.key} source=${item.sources.join(',')} freshness=${item.freshness} confidence=${item.confidence}]\nReason: ${item.reason}\nSource: ${item.path ?? item.lease?.sourceRef ?? 'runtime'}:${item.startLine ?? 1}-${item.endLine ?? 1}\nHash: ${item.sourceHash}\n${item.text}`;
}
function sourceType(item) {
  if (item.runtime) return 'diagnostics';
  if (item.sources.includes('historical')) return 'memory';
  if (item.sources.includes('structural')) return 'code';
  return item.path ? 'file' : 'code';
}
function packetEvidence(item) {
  return freeze({
    key: item.key, nodeId: item.nodeId, source: item.path ? `${item.path}:${item.startLine}-${item.endLine}` : item.lease?.sourceRef,
    sourceHash: item.sourceHash, retrievedAt: item.updatedAt, reason: item.reason, confidence: item.confidence, freshness: item.freshness,
    validUntil: item.lease?.validUntil ?? 'source_changed', sourceVersion: item.metadata?.version ?? null, createdBy: item.metadata?.createdBy ?? null,
    score: item.score, rrfScore: item.rrfScore, sources: item.sources, text: item.text,
  });
}
function toolFingerprint(call) { return `${String(call.tool ?? '')}:${String(call.inputHash ?? canonicalSha256(call.input ?? {}))}`; }

export class ContextPacketRuntimeService {
  constructor({ version = '0.0.0', retrieval, graph, kernel = new ContextOrchestrationKernel(), clock = () => new Date().toISOString() } = {}) {
    if (!retrieval?.retrieve) throw new TypeError('ContextPacketRuntimeService retrieval is required');
    if (!graph?.graph) throw new TypeError('ContextPacketRuntimeService graph is required');
    if (!kernel?.plan) throw new TypeError('ContextPacketRuntimeService kernel is required');
    this.version = String(version); this.retrieval = retrieval; this.graph = graph; this.kernel = kernel; this.clock = clock;
  }

  async build(input = {}) {
    const projectId = required(input.projectId, 'projectId'); const principalId = required(input.principalId, 'principalId');
    const role = String(input.role ?? 'executor');
    const goal = safeObject(input.goal, 'goal');
    const objective = required(goal.objective ?? input.query, 'goal.objective');
    const retrieval = input.retrievalResult ?? await this.retrieval.retrieve({ projectId, principalId, query: objective, hypothesis: input.hypothesis, limit: input.retrievalLimit ?? 40, maxQueries: input.maxQueries ?? 12 });
    if (!retrieval?.receiptSha256 || !Array.isArray(retrieval.evidence) || !Array.isArray(retrieval.counterEvidence)) throw new TypeError('retrievalResult is invalid');
    const supportItems = retrieval.evidence.map((item) => ({ id: `support:${item.key}`, sourceType: sourceType(item), text: evidenceText(item, 'supporting'), sourceHash: item.sourceHash, currentHash: item.currentHash, updatedAt: item.updatedAt, current: item.runtime === true, severity: item.runtime ? 'error' : undefined, priority: Math.round(item.score * 10_000), metadata: { polarity: 'support', evidence: item } }));
    const counterItems = retrieval.counterEvidence.map((item) => ({ id: `counter:${item.key}`, sourceType: sourceType(item), text: evidenceText(item, 'counter'), sourceHash: item.sourceHash, currentHash: item.currentHash, updatedAt: item.updatedAt, current: true, severity: 'warning', pinned: true, priority: Math.round(item.score * 10_000), metadata: { polarity: 'counter', evidence: item } }));
    const plan = this.kernel.plan({ projectId, principalId, role, budgetTokens: input.budgetTokens, items: [...supportItems, ...counterItems] });
    const selectedSupport = []; const selectedCounter = [];
    for (const selected of plan.selected) {
      const item = selected.metadata?.evidence;
      if (!item) continue;
      (selected.metadata.polarity === 'counter' ? selectedCounter : selectedSupport).push(packetEvidence(item));
    }
    const allSelected = [...selectedSupport, ...selectedCounter];
    const leaseSummary = { fresh: allSelected.filter((item) => item.freshness === 'fresh').length, stale: allSelected.filter((item) => item.freshness === 'stale').length, unknown: allSelected.filter((item) => !['fresh', 'stale'].includes(item.freshness)).length, conditions: [...new Set(allSelected.map((item) => item.validUntil))].sort() };
    const base = {
      schema: 'forge.structured-context-packet.v1', version: this.version, projectId, principalId, role,
      goal, currentState: safeObject(input.currentState, 'currentState'), constraints: array(input.constraints ?? [], 'constraints', 200).map(String),
      planStep: safeObject(input.planStep, 'planStep'), hypothesis: input.hypothesis == null ? null : String(input.hypothesis),
      evidence: selectedSupport, counterEvidence: selectedCounter,
      relevantSymbols: array(input.relevantSymbols ?? [], 'relevantSymbols', 500).map(String), recentFailures: array(input.recentFailures ?? [], 'recentFailures', 500).map(String),
      availableTools: array(input.availableTools ?? [], 'availableTools', 500).map(String), completionCriteria: array(input.completionCriteria ?? [], 'completionCriteria', 200).map(String),
      omissions: [...retrieval.omissions, ...plan.omissions], leaseSummary: freeze(leaseSummary),
      budget: freeze({ budgetTokens: plan.budgetTokens, usedTokens: plan.usedTokens, remainingTokens: plan.remainingTokens, sourceUsage: plan.sourceUsage, planReceiptSha256: plan.receiptSha256 }),
      retrievalReceiptSha256: retrieval.receiptSha256, generatedAt: this.clock(),
    };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  audit(input = {}) {
    const projectId = required(input.projectId, 'projectId'); const principalId = required(input.principalId, 'principalId');
    const packet = input.packet; if (!packet?.receiptSha256) throw new TypeError('packet is required');
    const graph = this.graph.graph({ projectId, principalId });
    const active = new Set(graph.nodes.map((node) => node.id));
    const references = [...(packet.evidence ?? []), ...(packet.counterEvidence ?? [])].map((item) => item.nodeId).filter(Boolean);
    const missing = references.filter((id) => !active.has(id));
    const issues = [];
    if (missing.length) issues.push(freeze({ code: 'STALE_OR_MISSING_EVIDENCE', severity: 'high', nodeIds: [...new Set(missing)] }));
    if (packet.hypothesis && !(packet.counterEvidence ?? []).length) issues.push(freeze({ code: 'COUNTER_EVIDENCE_MISSING', severity: 'medium' }));
    if (!(packet.completionCriteria ?? []).length) issues.push(freeze({ code: 'COMPLETION_CRITERIA_MISSING', severity: 'high' }));
    if ((packet.leaseSummary?.stale ?? 0) > 0) issues.push(freeze({ code: 'STALE_CONTEXT_INCLUDED', severity: 'high', count: packet.leaseSummary.stale }));
    const base = { schema: 'forge.context-packet-audit.v1', version: this.version, projectId, principalId, packetReceiptSha256: packet.receiptSha256, graphReceiptSha256: graph.receiptSha256, ready: issues.length === 0, issues, auditedAt: this.clock() };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  recover(input = {}) {
    const projectId = required(input.projectId, 'projectId'); const principalId = required(input.principalId, 'principalId');
    const calls = array(input.recentToolCalls ?? [], 'recentToolCalls', 2_000);
    const outcomes = array(input.testOutcomes ?? [], 'testOutcomes', 2_000);
    const previous = safeObject(input.previousState, 'previousState'); const current = safeObject(input.currentState, 'currentState');
    const callCounts = new Map(); for (const call of calls) callCounts.set(toolFingerprint(call), (callCounts.get(toolFingerprint(call)) ?? 0) + 1);
    const failureCounts = new Map(); for (const outcome of outcomes.filter((item) => item.status === 'fail')) { const key = `${outcome.id}:${outcome.errorHash ?? ''}`; failureCounts.set(key, (failureCounts.get(key) ?? 0) + 1); }
    const signals = [];
    if ([...callCounts.values()].some((count) => count >= 3)) signals.push('repeated-tool-call');
    if ([...failureCounts.values()].some((count) => count >= 2)) signals.push('repeated-test-failure');
    if (Number(input.staleContextCount ?? 0) > 0) signals.push('stale-context');
    const deltas = {
      errorsReduced: Number(previous.errorCount ?? 0) - Number(current.errorCount ?? 0),
      passingTestsGained: Number(current.passingTests ?? 0) - Number(previous.passingTests ?? 0),
      evidenceGained: Number(current.evidenceCount ?? 0) - Number(previous.evidenceCount ?? 0),
      uncertaintyReduced: Number(previous.uncertaintyCount ?? 0) - Number(current.uncertaintyCount ?? 0),
      hypothesesRejected: array(input.rejectedHypotheses ?? [], 'rejectedHypotheses', 500).length,
    };
    const madeProgress = deltas.errorsReduced > 0 || deltas.passingTestsGained > 0 || deltas.evidenceGained > 0 || deltas.uncertaintyReduced > 0 || deltas.hypothesesRejected > 0;
    if (!madeProgress) signals.push('no-state-progress');
    const actions = [];
    const add = (type, reason, priority) => { if (!actions.some((item) => item.type === type)) actions.push(freeze({ type, reason, priority })); };
    if (input.dangerousActionPending === true) add('freeze-dangerous-action', 'Evidence is not progressing while a dangerous action is pending.', 100);
    if (signals.includes('stale-context')) add('invalidate-stale-context', 'Rebuild context from current hashes and leases.', 95);
    if (signals.includes('repeated-tool-call')) add('expand-graph-neighbors', 'The same retrieval/action is repeating; inspect callers, dependencies, tests, and counter-evidence.', 85);
    if (signals.includes('repeated-test-failure')) add('switch-hypothesis', 'The same failure survived the current hypothesis.', 90);
    if (!madeProgress) add('delegate-independent-investigation', 'Use an independent subagent with a fresh packet and structured evidence return.', 80);
    if (!madeProgress && signals.includes('repeated-test-failure')) add('consider-rollback', 'Rollback is a recommendation only and still requires the normal patch/governance path.', 70);
    actions.sort((a, b) => b.priority - a.priority || a.type.localeCompare(b.type));
    const base = { schema: 'forge.context-aware-recovery.v1', version: this.version, projectId, principalId, progress: { ...deltas, madeProgress }, signals, actions, executed: false, generatedAt: this.clock() };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
