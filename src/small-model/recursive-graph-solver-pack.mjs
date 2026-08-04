import { canonicalSha256, deepFreeze } from './shared.mjs';

function makeAdjacency(nodes, edges) {
  const adjacency = new Map(nodes.map((node) => [node, []]));
  for (const edge of edges) {
    if (!Array.isArray(edge) || edge.length !== 2 || !adjacency.has(edge[0]) || !adjacency.has(edge[1])) throw new TypeError('Graph edge references an unknown node');
    adjacency.get(edge[0]).push(edge[1]);
  }
  for (const list of adjacency.values()) list.sort();
  return adjacency;
}

export class RecursiveGraphSolverPack {
  #graphs = new Map();
  #maxNodes;

  constructor({ maxNodes = 10_000 } = {}) {
    if (!Number.isInteger(maxNodes) || maxNodes < 1) throw new TypeError('maxNodes must be positive');
    this.#maxNodes = maxNodes;
  }

  register({ id, nodes, edges = [] } = {}) {
    if (!id || !Array.isArray(nodes)) throw new TypeError('Graph id and nodes are required');
    const uniqueNodes = [...new Set(nodes.map(String))].sort();
    if (uniqueNodes.length > this.#maxNodes) throw new Error('Graph node budget exceeded');
    const normalizedEdges = edges.map(([from, to]) => [String(from), String(to)]);
    const adjacency = makeAdjacency(uniqueNodes, normalizedEdges);
    const record = { id: String(id), nodes: uniqueNodes, edges: normalizedEdges, adjacency };
    this.#graphs.set(record.id, record);
    return deepFreeze({ id: record.id, nodes: record.nodes.length, edges: record.edges.length, graphSha256: canonicalSha256({ nodes: record.nodes, edges: record.edges }) });
  }

  #graph(id) {
    const graph = this.#graphs.get(id);
    if (!graph) throw new Error(`Unknown graph: ${id}`);
    return graph;
  }

  reachability({ graphId, from, to } = {}) {
    const graph = this.#graph(graphId);
    if (!graph.adjacency.has(from) || !graph.adjacency.has(to)) throw new Error('Unknown graph endpoint');
    const queue = [from];
    const previous = new Map([[from, null]]);
    while (queue.length > 0) {
      const node = queue.shift();
      if (node === to) break;
      for (const next of graph.adjacency.get(node)) if (!previous.has(next)) {
        previous.set(next, node);
        queue.push(next);
      }
    }
    const reachable = previous.has(to);
    const path = [];
    if (reachable) for (let node = to; node !== null; node = previous.get(node)) path.unshift(node);
    const base = { schema: 'nolane.small-model.graph-reachability.v1', graphId, from, to, reachable, path };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  topologicalOrder({ graphId } = {}) {
    const graph = this.#graph(graphId);
    const indegree = new Map(graph.nodes.map((node) => [node, 0]));
    for (const [, to] of graph.edges) indegree.set(to, indegree.get(to) + 1);
    const queue = graph.nodes.filter((node) => indegree.get(node) === 0).sort();
    const order = [];
    while (queue.length > 0) {
      const node = queue.shift();
      order.push(node);
      for (const next of graph.adjacency.get(node)) {
        indegree.set(next, indegree.get(next) - 1);
        if (indegree.get(next) === 0) {
          queue.push(next);
          queue.sort();
        }
      }
    }
    const cyclic = order.length !== graph.nodes.length;
    const finalOrder = cyclic ? [] : order;
    const base = { schema: 'nolane.small-model.graph-topology.v1', graphId, cyclic, order: finalOrder };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  snapshot() {
    return deepFreeze({ schema: 'nolane.small-model.recursive-graph-solver-pack.v1', graphs: this.#graphs.size, maxNodes: this.#maxNodes });
  }
}
