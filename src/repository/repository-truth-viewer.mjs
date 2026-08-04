import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const LEVEL_KINDS = Object.freeze({
  workspace: new Set(['workspace']),
  domain: new Set(['domain', 'layer']),
  service: new Set(['service', 'package']),
  file: new Set(['file', 'configuration', 'database-schema', 'test', 'editor-overlay']),
  symbol: new Set(['symbol']),
});

function frozen(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) frozen(item);
    return Object.freeze(value);
  }
  for (const item of Object.values(value)) frozen(item);
  return Object.freeze(value);
}

function bounded(value, fallback, min, max) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? Math.floor(number) : fallback));
}

function flattenTwin(twin) {
  const nodeById = new Map();
  const edgeById = new Map();
  for (const mapName of ['architecture', 'symbols', 'runtime']) {
    for (const node of twin?.[mapName]?.nodes ?? []) if (node?.id && !nodeById.has(node.id)) nodeById.set(node.id, node);
    for (const edge of twin?.[mapName]?.edges ?? []) if (edge?.id && !edgeById.has(edge.id)) edgeById.set(edge.id, edge);
  }
  return { nodes: [...nodeById.values()], edges: [...edgeById.values()], nodeById };
}

function encodeCursor(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${canonicalSha256({ body })}`;
}

function decodeCursor(cursor, expected) {
  const [body, signature, extra] = String(cursor ?? '').split('.');
  if (!body || !signature || extra || canonicalSha256({ body }) !== signature) throw new Error('Invalid repository truth viewer cursor');
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); }
  catch { throw new Error('Invalid repository truth viewer cursor'); }
  for (const [key, value] of Object.entries(expected)) if ((payload?.[key] ?? null) !== (value ?? null)) throw new Error('Repository truth viewer cursor does not match this query');
  if (!Number.isInteger(payload.offset) || payload.offset < 0) throw new Error('Invalid repository truth viewer cursor offset');
  return payload;
}

export class RepositoryTruthViewer {
  open(twin, { level = 'workspace', parentId = null, nodeId = null, limit = 100, cursor = null, neighborhood = 0 } = {}) {
    const twinSha256 = String(twin?.twinSha256 ?? '');
    if (!/^[a-f0-9]{64}$/.test(twinSha256)) throw new TypeError('RepositoryTruthViewer requires a content-addressed twin');
    const graph = flattenTwin(twin);
    if (level === 'source-span') {
      const node = graph.nodeById.get(String(nodeId ?? ''));
      if (!node) throw new Error(`Unknown repository truth node: ${nodeId}`);
      if (!node.citation?.sourceHash) throw new Error(`Repository truth node has no source span: ${nodeId}`);
      return frozen({
        schema: 'forge.repository-truth-viewer.v1',
        level,
        nodeId: node.id,
        sourceSpan: { ...node.citation },
        loadedNodeCount: 1,
        totalNodeCount: 1,
        graphTotalNodeCount: graph.nodes.length,
        nodes: [node],
        edges: [],
        nextCursor: null,
        truncated: false,
      });
    }
    const acceptedKinds = LEVEL_KINDS[level];
    if (!acceptedKinds) throw new TypeError(`Unknown repository truth viewer level: ${level}`);
    const children = parentId == null
      ? null
      : new Set(graph.edges.filter((edge) => edge.from === String(parentId)).map((edge) => edge.to));
    const candidates = graph.nodes
      .filter((node) => acceptedKinds.has(node.kind))
      .filter((node) => !children || children.has(node.id))
      .sort((left, right) => left.id.localeCompare(right.id));
    const pageLimit = bounded(limit, 100, 1, 1_000);
    const cursorIdentity = { twinSha256, level, parentId: parentId == null ? null : String(parentId) };
    const offset = cursor ? decodeCursor(cursor, cursorIdentity).offset : 0;
    if (offset > candidates.length) throw new Error('Repository truth viewer cursor offset exceeds result set');
    const nodes = candidates.slice(offset, offset + pageLimit);
    const nextOffset = offset + nodes.length;
    const nextCursor = nextOffset < candidates.length ? encodeCursor({ ...cursorIdentity, offset: nextOffset }) : null;
    const loadedIds = new Set(nodes.map((node) => node.id));
    const edgeLimit = bounded(neighborhood, 0, 0, 100) * Math.max(1, nodes.length);
    const edges = edgeLimit === 0 ? [] : graph.edges
      .filter((edge) => loadedIds.has(edge.from) || loadedIds.has(edge.to))
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, edgeLimit);
    return frozen({
      schema: 'forge.repository-truth-viewer.v1',
      level,
      parentId: parentId == null ? null : String(parentId),
      nodes,
      edges,
      loadedNodeCount: nodes.length,
      totalNodeCount: candidates.length,
      graphTotalNodeCount: graph.nodes.length,
      nextCursor,
      truncated: nextCursor != null,
      pageOffset: offset,
      twinSha256,
    });
  }
}

export { encodeCursor as encodeRepositoryTruthCursor, decodeCursor as decodeRepositoryTruthCursor };
