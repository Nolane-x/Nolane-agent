import { signed, text } from '../construction/construction-utils.mjs';

const SINKS = new Set(['shell', 'sql', 'network', 'filesystem', 'template', 'dynamic-code', 'prompt', 'memory', 'trace', 'log', 'artifact']);
const IMPACT = Object.freeze({ low: 1, medium: 2, high: 3, critical: 4 });

function list(value, label, max = 5000) {
  if (!Array.isArray(value) || value.length > max) throw new TypeError(`${label} must be an array with at most ${max} items`);
  return value;
}

function shortestPath(start, target, adjacency) {
  const queue = [[start]];
  const seen = new Set([start]);
  while (queue.length) {
    const path = queue.shift();
    const current = path.at(-1);
    if (current === target) return path;
    for (const edge of adjacency.get(current) ?? []) {
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      queue.push([...path, edge.to]);
    }
  }
  return null;
}

export class TaintAnalysisEngine {
  analyze(input = {}) {
    const nodes = list(input.nodes ?? [], 'nodes');
    const edges = list(input.edges ?? [], 'edges', 10_000);
    const sources = list(input.sources ?? [], 'sources');
    const sinks = list(input.sinks ?? [], 'sinks');
    const sanitizers = list(input.sanitizers ?? [], 'sanitizers');
    const nodeMap = new Map();
    for (const raw of nodes) {
      const id = text(raw?.id, 'node.id', 512);
      if (nodeMap.has(id)) throw new TypeError(`duplicate node id: ${id}`);
      nodeMap.set(id, Object.freeze({ id, sourceHash: raw.sourceHash ? String(raw.sourceHash) : null }));
    }
    const adjacency = new Map();
    const edgeMap = new Map();
    for (const raw of edges) {
      const from = text(raw?.from, 'edge.from', 512);
      const to = text(raw?.to, 'edge.to', 512);
      if (!nodeMap.has(from) || !nodeMap.has(to)) throw new TypeError(`edge references unknown node: ${from}->${to}`);
      const edge = Object.freeze({ from, to, kind: String(raw.kind ?? 'data'), ambiguous: raw.ambiguous === true });
      const outgoing = adjacency.get(from) ?? [];
      outgoing.push(edge);
      adjacency.set(from, outgoing);
      edgeMap.set(`${from}\0${to}`, edge);
    }
    const sanitizerMap = new Map();
    for (const raw of sanitizers) {
      const nodeId = text(raw?.nodeId, 'sanitizer.nodeId', 512);
      if (!nodeMap.has(nodeId)) throw new TypeError(`sanitizer references unknown node: ${nodeId}`);
      const forSink = text(raw?.forSink, 'sanitizer.forSink', 128);
      if (!SINKS.has(forSink)) throw new TypeError(`unsupported sanitizer sink: ${forSink}`);
      const kinds = sanitizerMap.get(nodeId) ?? new Set();
      kinds.add(forSink);
      sanitizerMap.set(nodeId, kinds);
    }
    const findings = [];
    for (const rawSource of sources) {
      const sourceNodeId = text(rawSource?.nodeId, 'source.nodeId', 512);
      if (!nodeMap.has(sourceNodeId)) throw new TypeError(`source references unknown node: ${sourceNodeId}`);
      for (const rawSink of sinks) {
        const sinkNodeId = text(rawSink?.nodeId, 'sink.nodeId', 512);
        const sinkKind = text(rawSink?.kind, 'sink.kind', 128);
        if (!SINKS.has(sinkKind)) throw new TypeError(`unsupported sink: ${sinkKind}`);
        const pathIds = shortestPath(sourceNodeId, sinkNodeId, adjacency);
        if (!pathIds) continue;
        const matchingSanitizer = pathIds.some((id) => sanitizerMap.get(id)?.has(sinkKind));
        if (matchingSanitizer) continue;
        const mismatched = pathIds.some((id) => (sanitizerMap.get(id)?.size ?? 0) > 0);
        const path = pathIds.map((nodeId, index) => ({
          nodeId,
          sourceHash: nodeMap.get(nodeId).sourceHash,
          edgeKind: index === 0 ? null : edgeMap.get(`${pathIds[index - 1]}\0${nodeId}`)?.kind ?? null,
          ambiguous: index === 0 ? false : edgeMap.get(`${pathIds[index - 1]}\0${nodeId}`)?.ambiguous === true,
        }));
        const ambiguous = path.some((step) => step.ambiguous);
        const impact = String(rawSink.impact ?? 'high').toLowerCase();
        findings.push(Object.freeze({
          source: { nodeId: sourceNodeId, label: String(rawSource.label ?? 'untrusted'), provenance: String(rawSource.provenance ?? 'unknown') },
          sink: { nodeId: sinkNodeId, kind: sinkKind, impact: IMPACT[impact] ? impact : 'high' },
          path: Object.freeze(path),
          sanitizerMismatch: mismatched,
          ambiguous,
          severity: IMPACT[impact] >= 4 ? 'critical' : IMPACT[impact] >= 3 ? 'high' : impact,
          reason: mismatched ? 'typed-sanitizer-mismatch' : ambiguous ? 'ambiguous-unsanitized-path' : 'unsanitized-source-to-sink-path',
        }));
      }
    }
    const blockers = findings.filter((finding) => ['high', 'critical'].includes(finding.severity));
    return signed({
      schema: 'forge.taint-analysis.v1',
      status: blockers.length ? 'block' : findings.length ? 'review' : 'pass',
      findings,
      blockers: blockers.map((finding) => ({ sourceNodeId: finding.source.nodeId, sinkNodeId: finding.sink.nodeId, sinkKind: finding.sink.kind, reason: finding.reason })),
      claims: { completeDataFlowAnalysis: false, ambiguousEdgesProveSafety: false, typedSanitizersRequired: true },
    });
  }
}
