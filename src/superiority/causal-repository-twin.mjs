import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { boundedNumber, deepFreeze, nonEmpty, requireSha256, signed, uniqueStrings } from './superiority-utils.mjs';

export class CausalRepositoryTwin {
  constructor({ clock = () => Date.now(), limits = {} } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxNodes = Math.max(1, Math.floor(Number(limits.maxNodes) || 50_000));
    this.maxEdges = Math.max(1, Math.floor(Number(limits.maxEdges) || 200_000));
    this.maxPredictions = Math.max(1, Math.floor(Number(limits.maxPredictions) || 1_000));
    this.nodes = new Map();
    this.edges = new Map();
    this.outgoing = new Map();
    this.staleSourceHashes = new Set();
    this.predictions = new Map();
  }

  registerNode(input = {}) {
    const nodeId = nonEmpty(input.nodeId, 'nodeId');
    const kind = nonEmpty(input.kind, 'kind');
    const node = deepFreeze({ nodeId, kind, locator: nonEmpty(input.locator, 'locator'), sourceHash: input.sourceHash ? requireSha256(input.sourceHash, 'sourceHash') : null, metadata: deepFreeze({ ...(input.metadata ?? {}) }), registeredAtMs: Number(this.clock()) });
    if (!this.nodes.has(nodeId) && this.nodes.size >= this.maxNodes) throw new Error('Repository twin node limit exceeded');
    this.nodes.set(nodeId, node);
    if (!this.outgoing.has(nodeId)) this.outgoing.set(nodeId, new Set());
    return signed({ schema: 'nolane.superiority.repository-node.v1', node });
  }

  link(input = {}) {
    const from = nonEmpty(input.from, 'from');
    const to = nonEmpty(input.to, 'to');
    if (!this.nodes.has(from) || !this.nodes.has(to)) throw new Error('Both edge nodes must be registered');
    const relation = nonEmpty(input.relation, 'relation');
    const sourceHash = requireSha256(input.sourceHash, 'sourceHash');
    const edgeId = `edge:${canonicalSha256({ from, to, relation, sourceHash }).slice(0, 24)}`;
    const previous = this.edges.get(edgeId);
    const edge = {
      edgeId, from, to, relation, sourceHash,
      confidence: boundedNumber(input.confidence, previous?.confidence ?? 0.5, 0.05, 0.99),
      observations: previous?.observations ?? 0,
      registeredAtMs: previous?.registeredAtMs ?? Number(this.clock()),
      updatedAtMs: Number(this.clock()),
    };
    if (!previous && this.edges.size >= this.maxEdges) throw new Error('Repository twin edge limit exceeded');
    this.edges.set(edgeId, edge);
    if (!this.outgoing.has(from)) this.outgoing.set(from, new Set());
    this.outgoing.get(from).add(edgeId);
    return deepFreeze({ ...edge });
  }

  invalidateEvidence(sourceHash) {
    const hash = requireSha256(sourceHash, 'sourceHash');
    this.staleSourceHashes.add(hash);
    return signed({ schema: 'nolane.superiority.repository-evidence-invalidation.v1', sourceHash: hash, invalidatedAtMs: Number(this.clock()) });
  }

  predictImpact(input = {}) {
    const changedNodeIds = uniqueStrings(input.changedNodeIds);
    if (!changedNodeIds.length) throw new TypeError('changedNodeIds is required');
    for (const nodeId of changedNodeIds) if (!this.nodes.has(nodeId)) throw new Error(`Unknown node ${nodeId}`);
    const maxDepth = Math.max(1, Math.min(20, Math.floor(Number(input.maxDepth) || 6)));
    const minimumConfidence = boundedNumber(input.minimumConfidence, 0.25, 0.05, 0.99);
    const visited = new Set(changedNodeIds);
    const queue = changedNodeIds.map((nodeId) => ({ nodeId, depth: 0 }));
    const reachedByEdge = new Map();
    let excludedStaleEdges = 0;
    while (queue.length) {
      const current = queue.shift();
      if (current.depth >= maxDepth) continue;
      for (const edgeId of this.outgoing.get(current.nodeId) ?? []) {
        const edge = this.edges.get(edgeId);
        if (this.staleSourceHashes.has(edge.sourceHash)) { excludedStaleEdges += 1; continue; }
        if (edge.confidence < minimumConfidence) continue;
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          reachedByEdge.set(edge.to, edgeId);
          queue.push({ nodeId: edge.to, depth: current.depth + 1 });
        }
      }
    }
    const affectedNodeIds = [...visited].filter((nodeId) => !changedNodeIds.includes(nodeId)).sort();
    const requiredTestNodeIds = affectedNodeIds.filter((nodeId) => this.nodes.get(nodeId)?.kind === 'test').sort();
    const affectedContractNodeIds = affectedNodeIds.filter((nodeId) => this.nodes.get(nodeId)?.kind === 'contract').sort();
    const base = {
      schema: 'nolane.superiority.repository-impact-prediction.v1',
      changedNodeIds: [...changedNodeIds].sort(), affectedNodeIds, requiredTestNodeIds, affectedContractNodeIds,
      maxDepth, minimumConfidence, excludedStaleEdges, predictedAtMs: Number(this.clock()),
      claims: { sourceMutationAllowed: false, predictionIsObservedEvidence: false, hiddenReasoningStored: false },
    };
    const result = signed(base);
    this.predictions.set(result.receiptSha256, { result, reachedByEdge });
    while (this.predictions.size > this.maxPredictions) this.predictions.delete(this.predictions.keys().next().value);
    return result;
  }

  recordObservedOutcome(input = {}) {
    if (input.observed !== true) throw new Error('Repository outcome must be observed');
    const predictionReceiptSha256 = requireSha256(input.predictionReceiptSha256, 'predictionReceiptSha256');
    const verificationReceiptSha256 = requireSha256(input.verificationReceiptSha256, 'verificationReceiptSha256');
    const prediction = this.predictions.get(predictionReceiptSha256);
    if (!prediction) throw new Error('Unknown impact prediction receipt');
    const observedNodeIds = uniqueStrings(input.observedNodeIds);
    for (const nodeId of observedNodeIds) if (!this.nodes.has(nodeId)) throw new Error(`Unknown observed node ${nodeId}`);
    const predicted = new Set(prediction.result.affectedNodeIds);
    const observed = new Set(observedNodeIds);
    const truePositiveNodeIds = [...predicted].filter((nodeId) => observed.has(nodeId)).sort();
    const falsePositiveNodeIds = [...predicted].filter((nodeId) => !observed.has(nodeId)).sort();
    const falseNegativeNodeIds = [...observed].filter((nodeId) => !predicted.has(nodeId)).sort();
    for (const nodeId of truePositiveNodeIds) this.#adjustEdge(prediction.reachedByEdge.get(nodeId), +0.05);
    for (const nodeId of falsePositiveNodeIds) this.#adjustEdge(prediction.reachedByEdge.get(nodeId), -0.1);
    return signed({
      schema: 'nolane.superiority.repository-impact-outcome.v1', predictionReceiptSha256, verificationReceiptSha256,
      truePositiveNodeIds, falsePositiveNodeIds, falseNegativeNodeIds, observedAtMs: Number(this.clock()),
      claims: { confidenceUpdateBounded: true, automaticSourceMutationAllowed: false, observedEvidenceRequired: true },
    });
  }

  snapshot() {
    const base = {
      schema: 'nolane.superiority.causal-repository-twin.v1',
      nodes: [...this.nodes.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
      edges: [...this.edges.values()].map((edge) => deepFreeze({ ...edge, stale: this.staleSourceHashes.has(edge.sourceHash) })).sort((a, b) => a.edgeId.localeCompare(b.edgeId)),
      staleSourceHashes: [...this.staleSourceHashes].sort(),
      predictionCount: this.predictions.size,
      claims: { automaticSourceMutationAllowed: false, hiddenReasoningStored: false, observedOutcomeRequiredForLearning: true },
    };
    return signed(base);
  }

  #adjustEdge(edgeId, delta) {
    if (!edgeId) return;
    const edge = this.edges.get(edgeId);
    if (!edge) return;
    edge.confidence = boundedNumber(edge.confidence + delta, edge.confidence, 0.05, 0.99);
    edge.observations += 1;
    edge.updatedAtMs = Number(this.clock());
  }
}
