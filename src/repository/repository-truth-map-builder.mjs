import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const TEST_PATH = /(?:^|\/)(?:test|tests|spec|specs)(?:\/|\.|$)|\.(?:test|spec)\.[^/]+$/i;
const CONFIG_PATH = /(?:^|\/)(?:config|configs)(?:\/|$)|(?:^|\/)(?:package\.json|tsconfig[^/]*\.json|vite\.config\.[^/]+|webpack\.config\.[^/]+|[^/]+\.(?:ya?ml|toml))$/i;
const DATABASE_PATH = /(?:^|\/)(?:db|database|migrations?|schema)(?:\/|$)|\.(?:sql|prisma)$/i;
const PUBLIC_API_PATH = /(?:^|\/)(?:api|public|routes?|controllers?)(?:\/|$)/i;
const INTERNAL_API_PATH = /(?:^|\/)(?:internal|private)(?:\/|$)/i;

const normalizePath = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');

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

function citation(row, line = 1, overlayId = null) {
  const sourceHash = String(row?.sha256 ?? row?.sourceHash ?? '').toLowerCase();
  if (!SHA256.test(sourceHash)) return null;
  return frozen({
    path: normalizePath(row.path),
    line: Math.max(1, Number(line) || 1),
    start: Math.max(0, Number(row.start) || 0),
    end: Math.max(0, Number(row.end) || 0),
    sourceHash,
    overlayId: overlayId ?? row.overlayId ?? null,
  });
}

function nodeId(projectId, map, kind, identity) {
  return `${kind}_${canonicalSha256({ projectId, map, kind, identity }).slice(0, 24)}`;
}

function edgeId(projectId, map, kind, from, to, sourceCitation) {
  return `edge_${canonicalSha256({ projectId, map, kind, from, to, citation: sourceCitation }).slice(0, 24)}`;
}

function safeJson(content) {
  try {
    const value = JSON.parse(String(content));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function inferPathModel(filePath) {
  const parts = normalizePath(filePath).split('/').filter(Boolean);
  const fileName = path.posix.basename(filePath).replace(/\.[^.]+$/, '');
  const root = parts[0] ?? 'workspace';
  const boundary = parts.length > 2 ? parts[1] : root;
  return {
    layer: root,
    domain: boundary,
    service: fileName.replace(/(?:-service|-controller|-route|-handler)$/i, '') || fileName,
  };
}

function exported(signature, content, name) {
  if (/\bexport\b/.test(String(signature ?? ''))) return true;
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\bexport\\s+(?:default\\s+)?(?:async\\s+)?(?:function|class|const|let|var)?\\s*${escaped}\\b`).test(String(content ?? ''));
}

function normalizeProviderCitation(input) {
  if (!input || typeof input !== 'object') return null;
  const sourceHash = String(input.sourceHash ?? '').toLowerCase();
  const sourcePath = normalizePath(input.path);
  if (!sourcePath || !SHA256.test(sourceHash)) return null;
  return frozen({
    path: sourcePath,
    line: Math.max(1, Number(input.line) || 1),
    start: Math.max(0, Number(input.start) || 0),
    end: Math.max(0, Number(input.end) || 0),
    sourceHash,
    overlayId: input.overlayId == null ? null : String(input.overlayId),
  });
}

function createMap(projectId, name) {
  const nodeByKey = new Map();
  const edgeByKey = new Map();
  return {
    addNode({ kind, name: nodeName, identity, path: nodePath = null, citation: sourceCitation = null, metadata = {} }) {
      const id = nodeId(projectId, name, kind, identity);
      if (!nodeByKey.has(id)) nodeByKey.set(id, frozen({ id, kind, name: String(nodeName), path: nodePath == null ? null : normalizePath(nodePath), citation: sourceCitation, metadata }));
      return id;
    },
    addEdge({ kind, from, to, citation: sourceCitation, confidence = 'exact', metadata = {} }) {
      const id = edgeId(projectId, name, kind, from, to, sourceCitation);
      if (!edgeByKey.has(id)) edgeByKey.set(id, frozen({ id, kind, from, to, citation: sourceCitation, confidence, metadata }));
      return id;
    },
    raw() { return { nodes: [...nodeByKey.values()], edges: [...edgeByKey.values()] }; },
  };
}

export class RepositoryTruthMapBuilder {
  constructor({ ledger } = {}) {
    if (!ledger || typeof ledger.record !== 'function') throw new TypeError('RepositoryTruthMapBuilder requires a RepositoryFactLedger');
    this.ledger = ledger;
  }

  build({ project, files = [], symbols = [], imports = [], relationshipEdges = [], runtimeEdges = [], branchContext = {}, editorOverlays = [], limits = {} } = {}) {
    if (!project?.id) throw new TypeError('RepositoryTruthMapBuilder requires a project');
    const projectId = String(project.id);
    const maxNodesPerMap = bounded(limits.maxNodesPerMap, 5_000, 1, 50_000);
    const maxEdgesPerMap = bounded(limits.maxEdgesPerMap, 10_000, 0, 100_000);
    const architecture = createMap(projectId, 'architecture');
    const symbolMap = createMap(projectId, 'symbols');
    const runtime = createMap(projectId, 'runtime');
    const unknowns = new Set();
    const fileByPath = new Map(files.map((row) => [normalizePath(row.path), { ...row, path: normalizePath(row.path) }]));
    const diskBranchContext = { ...branchContext, editorOverlayHash: null };

    const workspaceId = architecture.addNode({ kind: 'workspace', name: project.name ?? projectId, identity: projectId, path: '.', citation: null, metadata: { workspaceRoot: project.workspaceRoot ?? null } });
    const architectureFileIds = new Map();
    const symbolFileIds = new Map();

    const recordNode = (mapName, node, context = diskBranchContext) => {
      if (!node.citation) return;
      this.ledger.record({
        projectId,
        kind: mapName,
        subject: node.id,
        predicate: 'node',
        object: node.kind,
        provider: 'repository-truth-map-builder',
        confidence: 'exact',
        branchContext: context,
        citation: node.citation,
        metadata: { name: node.name, path: node.path, ...node.metadata },
      });
    };
    const recordEdge = (mapName, edge, context = diskBranchContext) => {
      if (!edge.citation) return;
      this.ledger.record({
        projectId,
        kind: mapName,
        subject: edge.from,
        predicate: edge.kind,
        object: edge.to,
        provider: 'repository-truth-map-builder',
        confidence: edge.confidence,
        branchContext: context,
        citation: edge.citation,
        metadata: edge.metadata,
      });
    };

    for (const row of fileByPath.values()) {
      const filePath = row.path;
      const sourceCitation = citation(row);
      if (!sourceCitation) {
        unknowns.add(`file-rejected:missing-citation:${filePath}`);
        continue;
      }
      const model = inferPathModel(filePath);
      const archFileId = architecture.addNode({ kind: 'file', name: path.posix.basename(filePath), identity: filePath, path: filePath, citation: sourceCitation, metadata: { language: row.language ?? null } });
      architectureFileIds.set(filePath, archFileId);
      architecture.addEdge({ kind: 'contains', from: workspaceId, to: archFileId, citation: sourceCitation });
      const symFileKind = TEST_PATH.test(filePath) ? 'test' : 'file';
      const symFileId = symbolMap.addNode({ kind: symFileKind, name: path.posix.basename(filePath), identity: filePath, path: filePath, citation: sourceCitation, metadata: { language: row.language ?? null } });
      symbolFileIds.set(filePath, symFileId);

      const layerId = architecture.addNode({ kind: 'layer', name: model.layer, identity: `layer:${model.layer}`, path: model.layer, citation: sourceCitation });
      const domainId = architecture.addNode({ kind: 'domain', name: model.domain, identity: `domain:${model.domain}`, path: filePath, citation: sourceCitation });
      const serviceId = architecture.addNode({ kind: 'service', name: model.service, identity: `service:${model.service}`, path: filePath, citation: sourceCitation });
      architecture.addEdge({ kind: 'contains', from: layerId, to: domainId, citation: sourceCitation });
      architecture.addEdge({ kind: 'contains', from: domainId, to: serviceId, citation: sourceCitation });
      architecture.addEdge({ kind: 'implemented-by', from: serviceId, to: archFileId, citation: sourceCitation });

      if (PUBLIC_API_PATH.test(filePath)) {
        const apiId = architecture.addNode({ kind: 'public-api', name: model.service, identity: `public-api:${filePath}`, path: filePath, citation: sourceCitation, metadata: { surface: 'public' } });
        architecture.addEdge({ kind: 'exposes', from: serviceId, to: apiId, citation: sourceCitation });
      }
      if (INTERNAL_API_PATH.test(filePath)) {
        const apiId = architecture.addNode({ kind: 'internal-api', name: model.service, identity: `internal-api:${filePath}`, path: filePath, citation: sourceCitation, metadata: { surface: 'internal' } });
        architecture.addEdge({ kind: 'exposes', from: serviceId, to: apiId, citation: sourceCitation });
      }
      if (CONFIG_PATH.test(filePath)) {
        const configId = architecture.addNode({ kind: 'configuration', name: path.posix.basename(filePath), identity: `config:${filePath}`, path: filePath, citation: sourceCitation });
        architecture.addEdge({ kind: 'describes', from: archFileId, to: configId, citation: sourceCitation });
      }
      if (DATABASE_PATH.test(filePath)) {
        const tables = [...String(row.content ?? '').matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([A-Za-z_][\w.]*)/gi)].map((match) => match[1]);
        for (const table of tables.length ? tables : [path.posix.basename(filePath)]) {
          const schemaId = architecture.addNode({ kind: 'database-schema', name: table, identity: `schema:${filePath}:${table}`, path: filePath, citation: sourceCitation, metadata: { schemaType: path.posix.extname(filePath).slice(1) || 'database' } });
          architecture.addEdge({ kind: 'defines', from: archFileId, to: schemaId, citation: sourceCitation });
        }
      }
      if (path.posix.basename(filePath) === 'package.json') {
        const metadata = safeJson(row.content);
        if (metadata) {
          const packageId = architecture.addNode({ kind: 'package', name: String(metadata.name ?? project.name ?? projectId), identity: `package:${filePath}`, path: filePath, citation: sourceCitation });
          architecture.addEdge({ kind: 'describes', from: archFileId, to: packageId, citation: sourceCitation });
          for (const [scriptName, command] of Object.entries(metadata.scripts ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
            const targetId = architecture.addNode({ kind: 'build-target', name: scriptName, identity: `build-target:${filePath}:${scriptName}`, path: filePath, citation: sourceCitation, metadata: { command: String(command) } });
            architecture.addEdge({ kind: 'builds', from: packageId, to: targetId, citation: sourceCitation });
          }
          for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
            for (const [dependencyName, version] of Object.entries(metadata[group] ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
              const dependencyId = architecture.addNode({ kind: 'external-dependency', name: dependencyName, identity: `dependency:${dependencyName}`, path: filePath, citation: sourceCitation, metadata: { version: String(version), group } });
              architecture.addEdge({ kind: 'declares', from: packageId, to: dependencyId, citation: sourceCitation });
            }
          }
        }
      }
    }

    const symbolNodesByPath = new Map();
    const symbolByAlias = new Map();
    for (const item of symbols) {
      const filePath = normalizePath(item.path);
      const source = fileByPath.get(filePath);
      const sourceCitation = citation(source, item.line);
      const fileId = symbolFileIds.get(filePath);
      if (!sourceCitation || !fileId) continue;
      const isExported = exported(item.signature, source.content, item.name);
      const id = symbolMap.addNode({
        kind: 'symbol', name: item.name, identity: `${filePath}:${item.kind}:${item.name}:${item.line}`, path: filePath, citation: sourceCitation,
        metadata: { type: item.kind ?? 'unknown', signature: item.signature ?? null, exported: isExported, implementation: filePath },
      });
      const node = symbolMap.raw().nodes.find((candidate) => candidate.id === id);
      if (!symbolNodesByPath.has(filePath)) symbolNodesByPath.set(filePath, []);
      symbolNodesByPath.get(filePath).push(node);
      symbolByAlias.set(`symbol:${item.name}`, id);
      symbolMap.addEdge({ kind: 'defines', from: fileId, to: id, citation: sourceCitation });
      symbolMap.addEdge({ kind: 'implements', from: fileId, to: id, citation: sourceCitation, metadata: { symbolType: item.kind ?? 'unknown' } });
    }

    for (const item of imports) {
      const sourcePath = normalizePath(item.sourcePath ?? item.source_path);
      const targetPath = normalizePath(item.targetPath ?? item.target_path);
      const source = fileByPath.get(sourcePath);
      const sourceCitation = citation(source);
      const sourceId = symbolFileIds.get(sourcePath);
      const targetId = symbolFileIds.get(targetPath);
      if (!sourceCitation || !sourceId || !targetId) continue;
      symbolMap.addEdge({ kind: 'references', from: sourceId, to: targetId, citation: sourceCitation, metadata: { import: true } });
      const content = String(source.content ?? '');
      for (const targetSymbol of symbolNodesByPath.get(targetPath) ?? []) {
        const escaped = String(targetSymbol.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`\\b${escaped}\\b`).test(content)) continue;
        symbolMap.addEdge({ kind: 'references', from: sourceId, to: targetSymbol.id, citation: sourceCitation, confidence: 'exact-import-and-symbol-reference' });
        if (TEST_PATH.test(sourcePath)) symbolMap.addEdge({ kind: 'verifies', from: sourceId, to: targetSymbol.id, citation: sourceCitation, confidence: 'exact-import-and-symbol-reference' });
      }
    }

    const addProviderEdge = (relation, source, mapName) => {
      const sourceCitation = normalizeProviderCitation(relation?.citation);
      if (!sourceCitation) {
        unknowns.add(`${source}-edge-rejected:missing-citation`);
        return;
      }
      const targetMap = mapName === 'runtime' ? runtime : mapName === 'architecture' ? architecture : symbolMap;
      const resolveAlias = (value) => symbolByAlias.get(String(value)) ?? String(value);
      const edge = {
        kind: String(relation.kind), from: resolveAlias(relation.from), to: resolveAlias(relation.to), citation: sourceCitation,
        confidence: String(relation.confidence ?? source), metadata: relation.metadata ?? {},
      };
      targetMap.addEdge(edge);
    };

    for (const relation of relationshipEdges ?? []) {
      const kind = String(relation?.kind ?? '');
      const mapName = kind === 'controls' ? 'architecture' : 'symbols';
      addProviderEdge(relation, 'relationship', mapName);
      if (['reads', 'writes', 'controls'].includes(kind)) addProviderEdge(relation, 'relationship', 'runtime');
    }

    if (!Array.isArray(runtimeEdges) || runtimeEdges.length === 0) unknowns.add('runtime-observation-unavailable');
    else for (const relation of runtimeEdges) addProviderEdge(relation, 'runtime', 'runtime');

    for (const overlay of editorOverlays ?? []) {
      const overlayCitation = citation(overlay, 1, overlay.overlayId);
      if (!overlayCitation) {
        unknowns.add(`editor-overlay-rejected:missing-citation:${normalizePath(overlay.path)}`);
        continue;
      }
      const overlayContext = { ...branchContext, editorOverlayHash: String(branchContext.editorOverlayHash ?? overlay.sha256) };
      const overlayFileId = symbolMap.addNode({ kind: 'editor-overlay', name: path.posix.basename(overlay.path), identity: `overlay:${overlay.overlayId}`, path: overlay.path, citation: overlayCitation, metadata: { unsaved: true } });
      const exportedNames = [...String(overlay.content ?? '').matchAll(/\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map((match) => match[1]);
      for (const name of exportedNames) {
        const symbolId = symbolMap.addNode({ kind: 'symbol', name, identity: `overlay:${overlay.overlayId}:${name}`, path: overlay.path, citation: overlayCitation, metadata: { type: 'overlay-symbol', exported: true, unsaved: true } });
        const edgeId = symbolMap.addEdge({ kind: 'defines', from: overlayFileId, to: symbolId, citation: overlayCitation, confidence: 'editor-overlay' });
        const raw = symbolMap.raw();
        recordNode('symbols', raw.nodes.find((node) => node.id === overlayFileId), overlayContext);
        recordNode('symbols', raw.nodes.find((node) => node.id === symbolId), overlayContext);
        recordEdge('symbols', raw.edges.find((edge) => edge.id === edgeId), overlayContext);
      }
    }

    const rawMaps = { architecture: architecture.raw(), symbols: symbolMap.raw(), runtime: runtime.raw() };
    const contextForCitation = (sourceCitation) => sourceCitation?.overlayId
      ? { ...branchContext, editorOverlayHash: String(branchContext.editorOverlayHash ?? sourceCitation.sourceHash) }
      : diskBranchContext;
    for (const [mapName, map] of Object.entries(rawMaps)) {
      for (const node of map.nodes) recordNode(mapName, node, contextForCitation(node.citation));
      for (const edge of map.edges) recordEdge(mapName, edge, contextForCitation(edge.citation));
    }

    const totals = Object.fromEntries(Object.entries(rawMaps).map(([name, map]) => [name, { nodes: map.nodes.length, edges: map.edges.length }]));
    const boundedMaps = Object.fromEntries(Object.entries(rawMaps).map(([name, map]) => [name, frozen({
      nodes: map.nodes.slice(0, maxNodesPerMap),
      edges: map.edges.slice(0, maxEdgesPerMap),
      totalNodes: map.nodes.length,
      totalEdges: map.edges.length,
      truncated: map.nodes.length > maxNodesPerMap || map.edges.length > maxEdgesPerMap,
    })]));
    const base = {
      schema: 'forge.repository-truth-maps.v1',
      projectId,
      context: frozen({
        branch: branchContext.branch ?? null,
        worktree: branchContext.worktree ?? null,
        headSha: branchContext.headSha ?? null,
        dirtyHash: branchContext.dirtyHash ?? null,
        editorOverlayHash: branchContext.editorOverlayHash ?? null,
        editorOverlayCount: editorOverlays?.length ?? 0,
      }),
      ...boundedMaps,
      totals,
      unknowns: [...unknowns].sort(),
      truncated: Object.values(boundedMaps).some((map) => map.truncated),
    };
    return frozen({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
