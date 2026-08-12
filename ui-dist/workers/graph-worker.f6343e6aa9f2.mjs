export function layoutRepositoryGraph({ nodes = [], edges = [] } = {}) {
  const sortedNodes = nodes.map((node) => Object.freeze({ ...node, id: String(node.id) })).sort((a, b) => a.id.localeCompare(b.id));
  const positions = sortedNodes.map((node, index) => Object.freeze({ ...node, x: (index % 10) * 120, y: Math.floor(index / 10) * 80 }));
  const known = new Set(sortedNodes.map((node) => node.id));
  const sortedEdges = edges.filter((edge) => known.has(String(edge.from)) && known.has(String(edge.to))).map((edge) => Object.freeze({ from: String(edge.from), to: String(edge.to), kind: String(edge.kind ?? 'related') })).sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`));
  return Object.freeze({ nodes: Object.freeze(positions), edges: Object.freeze(sortedEdges), animation: 'interaction-only', backgroundAnimation: false });
}
