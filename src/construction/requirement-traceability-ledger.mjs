import { signed, stableId, text } from './construction-utils.mjs';

const NODE_TYPES = new Set(['criterion', 'decision', 'plan-step', 'symbol', 'test', 'verification']);

export class RequirementTraceabilityLedger {
  constructor({ maxNodes = 10_000, maxLinks = 50_000 } = {}) {
    this.maxNodes = Math.max(1, Number(maxNodes) || 10_000);
    this.maxLinks = Math.max(1, Number(maxLinks) || 50_000);
    this.nodes = new Map();
    this.links = [];
    this.specificationId = null;
    this.specificationReceiptSha256 = null;
  }

  registerSpecification(specification = {}) {
    const specificationId = text(specification.specificationId, 'specificationId', 256);
    if (this.specificationId && this.specificationId !== specificationId) throw new TypeError('ledger already belongs to another specification');
    this.specificationId = specificationId;
    this.specificationReceiptSha256 = text(specification.receiptSha256, 'specification.receiptSha256', 256);
    if (!Array.isArray(specification.criteria) || !specification.criteria.length) throw new TypeError('specification criteria are required');
    for (const criterion of specification.criteria) this.registerNode({
      type: 'criterion', id: criterion.criterionId,
      verificationIds: Array.isArray(criterion.verificationIds) ? criterion.verificationIds.map(String) : [],
      specificationId,
    });
    return this.snapshot();
  }

  registerNode(input = {}) {
    const type = text(input.type, 'node.type', 64);
    if (!NODE_TYPES.has(type)) throw new TypeError(`unsupported traceability node type: ${type}`);
    const id = text(input.id, 'node.id', 512);
    const key = stableId(type, id);
    if (this.nodes.has(key)) throw new TypeError(`duplicate traceability node: ${key}`);
    if (this.nodes.size >= this.maxNodes) throw new RangeError('traceability node limit exceeded');
    const node = signed({ schema: 'forge.traceability-node.v1', type, id, status: input.status ? String(input.status) : null, sourceHash: input.sourceHash ? String(input.sourceHash) : null, receiptId: input.receiptId ? String(input.receiptId) : null, verificationIds: Array.isArray(input.verificationIds) ? [...new Set(input.verificationIds.map(String))] : [], specificationId: input.specificationId ? String(input.specificationId) : null });
    this.nodes.set(key, node);
    return node;
  }

  link(input = {}) {
    const fromKey = stableId(input.fromType, input.fromId);
    const toKey = stableId(input.toType, input.toId);
    if (!this.nodes.has(fromKey)) throw new RangeError(`unknown source node: ${fromKey}`);
    if (!this.nodes.has(toKey)) throw new RangeError(`unknown target node: ${toKey}`);
    if (this.links.length >= this.maxLinks) throw new RangeError('traceability link limit exceeded');
    const relation = text(input.relation, 'relation', 128);
    if (this.links.some((item) => item.fromKey === fromKey && item.toKey === toKey && item.relation === relation)) throw new TypeError('duplicate traceability link');
    const link = signed({ schema: 'forge.traceability-link.v1', fromKey, toKey, relation, sourceHash: input.sourceHash ? String(input.sourceHash) : null, receiptId: input.receiptId ? String(input.receiptId) : null });
    this.links.push(link);
    return link;
  }

  criterionCompletion(criterionId, { currentSourceHashes = {} } = {}) {
    const key = stableId('criterion', criterionId);
    const criterion = this.nodes.get(key);
    if (!criterion) throw new RangeError(`unknown criterion: ${criterionId}`);
    const required = criterion.verificationIds;
    const reachable = this.#reachable(key);
    const completeIds = [];
    const missing = [];
    for (const verificationId of required) {
      const verificationKey = stableId('verification', verificationId);
      const node = this.nodes.get(verificationKey);
      const currentHash = currentSourceHashes[verificationId];
      const stale = Boolean(currentHash && node?.sourceHash && currentHash !== node.sourceHash);
      if (reachable.has(verificationKey) && node?.status === 'passed' && node.receiptId && !stale) completeIds.push(verificationId);
      else missing.push(verificationId);
    }
    return signed({ schema: 'forge.criterion-completion.v1', criterionId: String(criterionId), complete: required.length > 0 && missing.length === 0, verificationIds: completeIds, missing });
  }

  snapshot() {
    return signed({ schema: 'forge.requirement-traceability-ledger.v1', specificationId: this.specificationId, specificationReceiptSha256: this.specificationReceiptSha256, nodes: [...this.nodes.values()], links: [...this.links] });
  }

  #reachable(startKey) {
    const seen = new Set([startKey]);
    const queue = [startKey];
    while (queue.length) {
      const current = queue.shift();
      for (const link of this.links) if (link.fromKey === current && !seen.has(link.toKey)) { seen.add(link.toKey); queue.push(link.toKey); }
    }
    return seen;
  }
}
