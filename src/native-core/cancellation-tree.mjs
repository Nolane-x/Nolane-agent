const freeze = (value) => Object.freeze(value);

export class CancellationTree {
  constructor({ clock = () => Date.now() } = {}) {
    this.clock = clock;
    this.nodes = new Map();
  }

  create({ id, parentId = null } = {}) {
    if (!id) throw new TypeError('cancellation node id is required');
    const key = String(id);
    if (this.nodes.has(key)) throw new Error(`cancellation node already exists: ${key}`);
    if (parentId !== null && !this.nodes.has(String(parentId))) throw new Error(`cancellation parent missing: ${parentId}`);
    const controller = new AbortController();
    const node = { id: key, parentId: parentId === null ? null : String(parentId), controller, createdAt: Number(this.clock()), cancelledAt: null, reason: null };
    this.nodes.set(key, node);
    const parent = parentId === null ? null : this.nodes.get(String(parentId));
    if (parent?.controller.signal.aborted) this.#cancelNode(node, parent.reason);
    return freeze({ id: key, parentId: node.parentId, signal: controller.signal });
  }

  signal(id) {
    const node = this.nodes.get(String(id));
    if (!node) throw new Error(`cancellation node missing: ${id}`);
    return node.controller.signal;
  }

  cancel(id, reason = 'cancelled') {
    const node = this.nodes.get(String(id));
    if (!node) throw new Error(`cancellation node missing: ${id}`);
    if (node.controller.signal.aborted) return false;
    const queue = [node];
    while (queue.length) {
      const current = queue.shift();
      if (!current.controller.signal.aborted) this.#cancelNode(current, reason);
      for (const candidate of this.nodes.values()) if (candidate.parentId === current.id) queue.push(candidate);
    }
    return true;
  }

  #cancelNode(node, reason) {
    node.reason = String(reason ?? 'cancelled');
    node.cancelledAt = Number(this.clock());
    node.controller.abort(node.reason);
  }

  snapshot() {
    return freeze({
      schema: 'nolane.native-core.cancellation-tree.v1',
      nodes: freeze([...this.nodes.values()].map((node) => freeze({
        id: node.id,
        parentId: node.parentId,
        createdAt: node.createdAt,
        cancelled: node.controller.signal.aborted,
        cancelledAt: node.cancelledAt,
        reason: node.reason,
      })).sort((a, b) => a.id.localeCompare(b.id))),
    });
  }
}
