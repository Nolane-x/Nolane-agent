import { invalidateArtifact } from './artifacts.mjs';
const sort = (items) => [...items].sort((a, b) => a.localeCompare(b));

export function buildArtifactGraph(artifacts) {
  const byId = new Map();
  for (const artifact of artifacts) {
    if (!artifact?.id) throw new TypeError('Every artifact needs an id');
    if (byId.has(artifact.id)) throw new TypeError(`Duplicate artifact id: ${artifact.id}`);
    byId.set(artifact.id, artifact);
  }
  const outgoing = new Map([...byId.keys()].map((id) => [id, new Set()]));
  const incoming = new Map([...byId.keys()].map((id) => [id, new Set()]));
  for (const artifact of artifacts) {
    for (const dependency of artifact.consumes ?? []) {
      if (!byId.has(dependency)) throw new TypeError(`Artifact ${artifact.id} has missing dependency: ${dependency}`);
      outgoing.get(dependency).add(artifact.id);
      incoming.get(artifact.id).add(dependency);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) throw new Error(`Artifact dependency cycle detected at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of outgoing.get(id)) visit(child);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of byId.keys()) visit(id);

  const traverse = (start, edges) => {
    const found = new Set();
    const queue = [...(edges.get(start) ?? [])];
    while (queue.length) {
      const id = queue.shift();
      if (found.has(id)) continue;
      found.add(id);
      queue.push(...(edges.get(id) ?? []));
    }
    return sort(found);
  };
  return {
    byId,
    descendants: (id) => traverse(id, outgoing),
    ancestors: (id) => traverse(id, incoming),
    outgoing,
    incoming,
  };
}

export function invalidateDownstream(artifacts, changedIds, reason, now = new Date().toISOString()) {
  const graph = buildArtifactGraph(artifacts);
  const targets = new Set(changedIds.flatMap((id) => graph.descendants(id)));
  return artifacts.map((artifact) => {
    if (!targets.has(artifact.id)) return structuredClone(artifact);
    if (artifact.envelopeHash && artifact.contentHash) return invalidateArtifact(artifact, reason, sort(changedIds), now);
    return { ...structuredClone(artifact), state: 'invalidated', updatedAt: now, invalidation: { reason, upstream: sort(changedIds), invalidatedAt: now } };
  });
}
