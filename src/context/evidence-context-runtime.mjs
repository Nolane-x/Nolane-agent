import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function freeze(value, seen = new WeakSet()) { if (!value || typeof value !== 'object' || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) freeze(child, seen); return Object.freeze(value); }
function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function typeFor(item) {
  if (item.runtime && /(?:error|fail|exception|denied|timeout)/i.test(item.text)) return 'Error';
  if (item.path && /(?:^|\/)(?:test|tests|spec|specs)(?:\/|\.|$)/i.test(item.path)) return 'Test';
  if (item.sources?.includes('historical')) return 'Decision';
  if (item.sources?.includes('structural') && !item.path) return 'Symbol';
  return item.path ? 'File' : 'Document';
}
function sourceKindFor(item) {
  if (item.runtime) return 'test';
  if (item.sources?.includes('historical')) return 'history';
  if (item.sources?.includes('structural')) return 'graph';
  return item.sources?.[0] ?? 'retrieval';
}
function cloneWithNode(item, nodeId) { return freeze({ ...item, nodeId }); }

export class EvidenceContextRuntime {
  constructor({ version = '0.0.0', graph, retrieval, packets, eventSink = () => {} } = {}) {
    if (!graph?.index || !graph?.graph || !graph?.invalidate) throw new TypeError('EvidenceContextRuntime graph is required');
    if (!retrieval?.retrieve) throw new TypeError('EvidenceContextRuntime retrieval is required');
    if (!packets?.build || !packets?.audit || !packets?.recover) throw new TypeError('EvidenceContextRuntime packet service is required');
    this.version = String(version); this.graphService = graph; this.retrievalService = retrieval; this.packetService = packets; this.eventSink = eventSink;
  }

  index(input) { return this.graphService.index(input); }
  retrieve(input) { return this.retrievalService.retrieve(input); }
  graph(input) { return this.graphService.graph(input); }
  invalidate(input) { return this.graphService.invalidate(input); }
  compact(input) { return this.graphService.compact(input); }
  proposeMemory(input) { return this.graphService.proposeMemory(input); }
  validateSubagentResult(input) { return this.graphService.validateSubagentResult(input); }
  audit(input) { return this.packetService.audit(input); }
  recover(input) { return this.packetService.recover(input); }
  close() { this.graphService.close?.(); }

  async packet(input = {}) {
    const projectId = required(input.projectId, 'projectId'); const principalId = required(input.principalId, 'principalId');
    const objective = required(input.goal?.objective ?? input.query, 'goal.objective');
    const retrieval = await this.retrievalService.retrieve({ projectId, principalId, query: objective, hypothesis: input.hypothesis, limit: input.retrievalLimit ?? 40, maxQueries: input.maxQueries ?? 12 });
    const nodeInputs = [];
    const edgeInputs = [];
    const goalHash = canonicalSha256({ objective, constraints: input.constraints ?? [], completionCriteria: input.completionCriteria ?? [] });
    nodeInputs.push({ key: 'goal', type: 'Requirement', label: objective.slice(0, 1_000), content: { objective, completionCriteria: input.completionCriteria ?? [], constraints: input.constraints ?? [] }, sourceKind: 'requirement', sourceRef: String(input.taskId ?? input.planStep?.id ?? `goal:${goalHash.slice(0, 16)}`), sourceHash: goalHash, version: String(input.planId ?? input.planStep?.id ?? '1'), validUntil: 'plan_revised', confidence: 1 });
    let hypothesisKey = null;
    if (input.hypothesis) {
      const hypothesis = String(input.hypothesis);
      const hash = canonicalSha256(hypothesis);
      hypothesisKey = 'hypothesis';
      nodeInputs.push({ key: hypothesisKey, type: 'Hypothesis', label: hypothesis.slice(0, 1_000), content: { text: hypothesis, planId: input.planId ?? input.planStep?.id ?? null }, sourceKind: 'plan', sourceRef: String(input.planId ?? input.planStep?.id ?? `hypothesis:${hash.slice(0, 16)}`), sourceHash: hash, version: String(input.planId ?? input.planStep?.id ?? '1'), validUntil: 'plan_revised', confidence: Number(input.hypothesisConfidence ?? 0.5) });
      edgeInputs.push({ from: hypothesisKey, to: 'goal', type: 'depends_on', confidence: 1 });
    }
    const rawItems = [...retrieval.evidence.map((item) => ({ item, polarity: 'support' })), ...retrieval.counterEvidence.map((item) => ({ item, polarity: 'counter' }))];
    rawItems.forEach(({ item, polarity }, index) => {
      const key = `retrieved:${index}`;
      nodeInputs.push({ key, type: typeFor(item), label: String(item.path ?? item.text ?? item.key).slice(0, 1_000), content: { text: item.text, path: item.path, startLine: item.startLine, endLine: item.endLine, reason: item.reason, sources: item.sources, score: item.score, rrfScore: item.rrfScore, polarity }, sourceKind: sourceKindFor(item), sourceRef: String(item.lease?.sourceRef ?? item.path ?? item.key), sourceHash: item.sourceHash, version: String(item.updatedAt ?? item.metadata?.version ?? '1'), validUntil: String(item.lease?.validUntil ?? 'source_changed'), confidence: item.confidence });
      edgeInputs.push({ from: key, to: polarity === 'counter' && hypothesisKey ? hypothesisKey : 'goal', type: polarity === 'counter' ? (hypothesisKey ? 'refutes' : 'contradicts') : 'supports', confidence: item.confidence, metadata: { retrievalKey: item.key } });
    });
    const indexed = this.graphService.index({ projectId, principalId, nodes: nodeInputs, edges: edgeInputs });
    const retrievedNodes = indexed.nodes.slice(hypothesisKey ? 2 : 1);
    let cursor = 0;
    const evidence = retrieval.evidence.map((item) => cloneWithNode(item, retrievedNodes[cursor++]?.id ?? item.nodeId));
    const counterEvidence = retrieval.counterEvidence.map((item) => cloneWithNode(item, retrievedNodes[cursor++]?.id ?? item.nodeId));
    const enriched = freeze({ ...retrieval, evidence, counterEvidence, graphIndexReceiptSha256: indexed.receiptSha256 });
    const packet = await this.packetService.build({ ...input, projectId, principalId, goal: { ...(input.goal ?? {}), objective }, retrievalResult: enriched });
    await this.eventSink({ type: 'evidence-context.packet-built', projectId, principalId, taskId: input.taskId ?? null, packetReceiptSha256: packet.receiptSha256, graphIndexReceiptSha256: indexed.receiptSha256, evidenceCount: packet.evidence.length, counterEvidenceCount: packet.counterEvidence.length });
    return packet;
  }

  async agentReference(input = {}) {
    const packet = await this.packet(input);
    const publicPacket = {
      schema: packet.schema, goal: packet.goal, currentState: packet.currentState, constraints: packet.constraints, planStep: packet.planStep,
      hypothesis: packet.hypothesis, evidence: packet.evidence, counterEvidence: packet.counterEvidence, relevantSymbols: packet.relevantSymbols,
      recentFailures: packet.recentFailures, availableTools: packet.availableTools, completionCriteria: packet.completionCriteria,
      omissions: packet.omissions, leaseSummary: packet.leaseSummary, budget: packet.budget, receiptSha256: packet.receiptSha256,
    };
    const text = `[governed-evidence-context-packet]\n${JSON.stringify(publicPacket)}`;
    return freeze({ id: `evidence-context:${packet.receiptSha256.slice(0, 20)}`, text: text.slice(0, 100_000), sha256: packet.receiptSha256, priority: 995, metadata: { trust: 'governed-evidence-runtime', evidenceCount: packet.evidence.length, counterEvidenceCount: packet.counterEvidence.length, leaseSummary: packet.leaseSummary } });
  }
}
