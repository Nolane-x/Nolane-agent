import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { RepositoryEvidenceQueryPlanner } from './repository-evidence-query-planner.mjs';
import { RepositoryFactLedger } from './repository-fact-ledger.mjs';
import { RepositoryTruthMapBuilder } from './repository-truth-map-builder.mjs';
import { RepositoryTruthViewer } from './repository-truth-viewer.mjs';
import { RepositoryWorkspaceStateAdapter } from './repository-workspace-state-adapter.mjs';

const TEST_PATH = /(?:^|\/)(?:test|tests|spec|specs)(?:\/|\.|$)|\.(?:test|spec)\.[^/]+$/i;
const CONFIG_PATH = /(?:^|\/)(?:config|configs)(?:\/|$)|(?:^|\/)(?:package\.json|tsconfig[^/]*\.json|vite\.config\.[^/]+|webpack\.config\.[^/]+|[^/]+\.(?:ya?ml|toml))$/i;
const normalize = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');

function frozen(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(frozen));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, frozen(child)])));
}

function bounded(value, fallback, min, max) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? Math.floor(number) : fallback));
}

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(String(name)));
}

function nodeId(projectId, kind, identity) {
  return `${kind}_${canonicalSha256({ projectId: String(projectId), kind, identity: String(identity) }).slice(0, 24)}`;
}

function edgeId(projectId, kind, from, to, citation) {
  return `edge_${canonicalSha256({ projectId: String(projectId), kind, from, to, sourceHash: citation?.sourceHash ?? null, line: citation?.line ?? null }).slice(0, 24)}`;
}

function citation(row, line = 1) {
  return frozen({ path: normalize(row.path), line: Math.max(1, Number(line) || 1), start: 0, end: 0, sourceHash: String(row.sha256), overlayId: null });
}

function safePackage(content) {
  try {
    const value = JSON.parse(String(content));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

function hashFile(absolutePath) {
  try { return createHash('sha256').update(readFileSync(absolutePath)).digest('hex'); }
  catch { return null; }
}

function matchNodeResult(stage, query, node, score) {
  return frozen({
    id: `${stage}:${node.id}`,
    stage,
    status: 'fact',
    score,
    kind: node.kind,
    name: node.name,
    path: node.path,
    citation: node.citation,
  });
}

export class RepositoryDigitalTwinService {
  constructor({ store, workspaceStateAdapter = null } = {}) {
    if (!store?.db || typeof store.getProject !== 'function') throw new TypeError('RepositoryDigitalTwinService requires a StudioStore');
    this.store = store;
    this.workspaceStateAdapter = workspaceStateAdapter ?? new RepositoryWorkspaceStateAdapter();
    this.truth = null;
    this.latestTwins = new Map();
    this.latestOverlays = new Map();
  }

  #ensureTruth() {
    if (!this.truth) {
      const ledger = new RepositoryFactLedger();
      this.truth = {
        ledger,
        mapBuilder: new RepositoryTruthMapBuilder({ ledger }),
        planner: new RepositoryEvidenceQueryPlanner(),
        viewer: new RepositoryTruthViewer(),
      };
    }
    return this.truth;
  }

  status() {
    return frozen({
      schema: 'forge.repository-truth-plane-status.v1',
      loaded: this.truth != null,
      cachedProjectCount: this.latestTwins.size,
      factCount: this.truth?.ledger?.size ?? 0,
    });
  }

  build(projectId, {
    maxNodes = 2_000,
    maxEdges = 4_000,
    branchContext = null,
    relationshipProvider = null,
    runtimeProvider = null,
    editorOverlays = [],
  } = {}) {
    const project = this.store.getProject(String(projectId));
    if (!project) throw new Error(`Unknown project: ${projectId}`);
    const truth = this.#ensureTruth();
    const inspected = this.workspaceStateAdapter.inspect(project.workspaceRoot, { editorOverlays });
    const effectiveBranch = branchContext
      ? frozen({
        available: branchContext.available ?? inspected.available,
        branch: branchContext.branch ?? inspected.branch,
        worktree: normalize(branchContext.worktree ?? inspected.worktree ?? project.workspaceRoot),
        headSha: branchContext.headSha ?? inspected.headSha,
        dirtyHash: branchContext.dirtyHash ?? inspected.dirtyHash,
        editorOverlayHash: branchContext.editorOverlayHash ?? inspected.editorOverlayHash,
        uncommittedChanges: branchContext.uncommittedChanges ?? inspected.uncommittedChanges,
        editorOverlays: inspected.editorOverlays,
      })
      : inspected;
    const nodeLimit = bounded(maxNodes, 2_000, 1, 20_000);
    const edgeLimit = bounded(maxEdges, 4_000, 0, 50_000);
    const fileRows = this.store.db.prepare('SELECT path,sha256,language,size_bytes,line_count,content,indexed_at FROM repository_files WHERE project_id=? ORDER BY path').all(String(projectId));
    const symbolRows = this.store.db.prepare('SELECT path,kind,name,line,signature FROM repository_symbols WHERE project_id=? ORDER BY path,line,kind,name').all(String(projectId));
    const fileByPath = new Map(fileRows.map((row) => [normalize(row.path), row]));
    const nodes = [];
    const edges = [];
    const unknowns = new Set();
    const addNode = (node) => { nodes.push(frozen(node)); return node.id; };
    const addEdge = ({ kind, from, to, citation: sourceCitation, confidence = 'exact', metadata = {} }) => {
      edges.push(frozen({ id: edgeId(projectId, kind, from, to, sourceCitation), kind, from, to, confidence, citation: sourceCitation ?? null, metadata }));
    };

    const workspaceId = addNode({
      id: nodeId(projectId, 'workspace', project.id), kind: 'workspace', name: project.name, path: '.',
      citation: null, metadata: { workspaceRoot: project.workspaceRoot },
    });
    const fileNodeByPath = new Map();
    for (const row of fileRows) {
      const filePath = normalize(row.path);
      const kind = TEST_PATH.test(filePath) ? 'test' : CONFIG_PATH.test(filePath) ? 'config' : 'file';
      const id = addNode({
        id: nodeId(projectId, kind, filePath), kind, name: path.posix.basename(filePath), path: filePath,
        citation: citation(row), metadata: { language: row.language, sizeBytes: Number(row.size_bytes), lineCount: Number(row.line_count), indexedAt: row.indexed_at },
      });
      fileNodeByPath.set(filePath, id);
      addEdge({ kind: 'contains', from: workspaceId, to: id, citation: citation(row) });
      if (path.posix.basename(filePath) === 'package.json') {
        const packageJson = safePackage(row.content);
        if (packageJson) {
          const packageName = String(packageJson.name ?? (path.posix.dirname(filePath) || project.name));
          const packageId = addNode({ id: nodeId(projectId, 'package', `${filePath}:${packageName}`), kind: 'package', name: packageName, path: path.posix.dirname(filePath) || '.', citation: citation(row), metadata: { private: packageJson.private === true } });
          addEdge({ kind: 'describes', from: id, to: packageId, citation: citation(row) });
          for (const [scriptName, command] of Object.entries(packageJson.scripts ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
            const targetId = addNode({ id: nodeId(projectId, 'build-target', `${filePath}:${scriptName}`), kind: 'build-target', name: scriptName, path: filePath, citation: citation(row), metadata: { command: String(command).slice(0, 1_000) } });
            addEdge({ kind: 'configures', from: id, to: targetId, citation: citation(row), metadata: { field: `scripts.${scriptName}` } });
            addEdge({ kind: 'owns', from: packageId, to: targetId, citation: citation(row) });
          }
          const dependencyGroups = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
          for (const group of dependencyGroups) for (const [dependencyName, version] of Object.entries(packageJson[group] ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
            const dependencyId = addNode({ id: nodeId(projectId, 'external-dependency', dependencyName), kind: 'external-dependency', name: dependencyName, path: null, citation: citation(row), metadata: { version: String(version), group } });
            addEdge({ kind: 'declares', from: packageId, to: dependencyId, citation: citation(row), metadata: { group, version: String(version) } });
          }
        }
      }
    }

    const symbolsByPath = new Map();
    for (const symbol of symbolRows) {
      const filePath = normalize(symbol.path);
      const source = fileByPath.get(filePath);
      if (!source) continue;
      const key = `${filePath}:${symbol.kind}:${symbol.name}:${symbol.line}`;
      const id = addNode({ id: nodeId(projectId, 'symbol', key), kind: 'symbol', name: symbol.name, path: filePath, citation: citation(source, symbol.line), metadata: { symbolKind: symbol.kind, signature: symbol.signature } });
      if (!symbolsByPath.has(filePath)) symbolsByPath.set(filePath, []);
      symbolsByPath.get(filePath).push({ ...symbol, id });
      const fileId = fileNodeByPath.get(filePath);
      if (fileId) addEdge({ kind: 'defines', from: fileId, to: id, citation: citation(source, symbol.line) });
    }

    const importRows = tableExists(this.store.db, 'semantic_imports')
      ? this.store.db.prepare('SELECT source_path,target_path FROM semantic_imports WHERE project_id=? ORDER BY source_path,target_path').all(String(projectId))
      : [];
    for (const item of importRows) {
      const sourcePath = normalize(item.source_path); const targetPath = normalize(item.target_path);
      const sourceRow = fileByPath.get(sourcePath);
      const sourceId = fileNodeByPath.get(sourcePath); const targetId = fileNodeByPath.get(targetPath);
      if (!sourceRow || !sourceId || !targetId) continue;
      addEdge({ kind: 'imports', from: sourceId, to: targetId, citation: citation(sourceRow) });
      if (TEST_PATH.test(sourcePath)) {
        const content = String(sourceRow.content);
        for (const symbol of symbolsByPath.get(targetPath) ?? []) {
          const escaped = String(symbol.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (!new RegExp(`\\b${escaped}\\b`).test(content)) continue;
          addEdge({ kind: 'verifies', from: sourceId, to: symbol.id, citation: citation(sourceRow), confidence: 'exact-import-and-symbol-reference' });
        }
      }
    }

    const relationshipEdges = relationshipProvider && typeof relationshipProvider.edges === 'function'
      ? [...(relationshipProvider.edges(String(projectId)) ?? [])]
      : [];
    for (const relation of relationshipEdges) {
      if (!relation?.from || !relation?.to || !relation?.kind || !relation?.citation?.sourceHash) continue;
      addEdge({ kind: String(relation.kind), from: String(relation.from), to: String(relation.to), citation: frozen(relation.citation), confidence: String(relation.confidence ?? 'provider'), metadata: relation.metadata ?? {} });
    }

    const runtimeSnapshot = runtimeProvider && typeof runtimeProvider.snapshot === 'function' ? runtimeProvider.snapshot(String(projectId)) : null;
    const runtimeEdges = runtimeSnapshot?.edges?.length ? [...runtimeSnapshot.edges] : null;
    if (!runtimeEdges) unknowns.add('runtime-observation-unavailable');
    else for (const relation of runtimeEdges) {
      if (!relation?.from || !relation?.to || !relation?.kind || !relation?.citation?.sourceHash) continue;
      addEdge({ kind: String(relation.kind), from: String(relation.from), to: String(relation.to), citation: frozen(relation.citation), confidence: String(relation.confidence ?? 'runtime-observed'), metadata: relation.metadata ?? {} });
    }

    const allNodeCount = nodes.length; const allEdgeCount = edges.length;
    const selectedNodes = nodes.slice(0, nodeLimit);
    const selectedIds = new Set(selectedNodes.map((node) => node.id));
    const selectedEdges = edges.filter((edge) => selectedIds.has(edge.from) && selectedIds.has(edge.to)).slice(0, edgeLimit);
    const branchBase = {
      available: effectiveBranch.available === true,
      branch: effectiveBranch.branch == null ? null : String(effectiveBranch.branch),
      worktree: effectiveBranch.worktree == null ? normalize(project.workspaceRoot) : normalize(effectiveBranch.worktree),
      headSha: effectiveBranch.headSha == null ? null : String(effectiveBranch.headSha),
      dirtyHash: effectiveBranch.dirtyHash == null ? null : String(effectiveBranch.dirtyHash),
      editorOverlayHash: effectiveBranch.editorOverlayHash == null ? null : String(effectiveBranch.editorOverlayHash),
      uncommittedChanges: [...(effectiveBranch.uncommittedChanges ?? [])],
    };
    const branch = frozen({ ...branchBase, fingerprint: canonicalSha256(branchBase) });
    const layerCounts = {};
    for (const node of selectedNodes) layerCounts[node.kind] = (layerCounts[node.kind] ?? 0) + 1;
    const architectureSummary = frozen({ layerCounts, packageCount: selectedNodes.filter((node) => node.kind === 'package').length, symbolCount: selectedNodes.filter((node) => node.kind === 'symbol').length });
    const maps = truth.mapBuilder.build({
      project,
      files: fileRows,
      symbols: symbolRows,
      imports: importRows.map((item) => ({ sourcePath: item.source_path, targetPath: item.target_path })),
      relationshipEdges,
      runtimeEdges,
      branchContext: branch,
      editorOverlays: effectiveBranch.editorOverlays ?? [],
      limits: { maxNodesPerMap: nodeLimit, maxEdgesPerMap: edgeLimit },
    });
    for (const item of maps.unknowns) unknowns.add(item);
    const base = {
      schema: 'forge.repository-digital-twin.v2',
      legacySchema: 'forge.repository-digital-twin.v1',
      projectId: String(projectId),
      branch,
      nodes: selectedNodes,
      edges: selectedEdges,
      unknowns: [...unknowns].sort(),
      architectureSummary,
      architecture: maps.architecture,
      symbols: maps.symbols,
      runtime: maps.runtime,
      truthContext: maps.context,
      truthReceiptSha256: maps.receiptSha256,
      totalNodes: allNodeCount,
      totalEdges: allEdgeCount,
      truthTotalNodes: maps.architecture.totalNodes + maps.symbols.totalNodes + maps.runtime.totalNodes,
      truthTotalEdges: maps.architecture.totalEdges + maps.symbols.totalEdges + maps.runtime.totalEdges,
      truncated: selectedNodes.length < allNodeCount || selectedEdges.length < allEdgeCount || maps.truncated,
    };
    const twin = frozen({ ...base, twinSha256: canonicalSha256(base) });
    this.latestTwins.set(String(projectId), twin);
    this.latestOverlays.set(String(projectId), new Map((effectiveBranch.editorOverlays ?? []).map((overlay) => [overlay.overlayId, overlay.sha256])));
    return twin;
  }

  async query(projectId, request = {}) {
    const twin = request.twin ?? this.latestTwins.get(String(projectId)) ?? this.build(projectId, request.buildOptions ?? {});
    const allNodes = [...twin.architecture.nodes, ...twin.symbols.nodes, ...twin.runtime.nodes];
    const allEdges = [...twin.architecture.edges, ...twin.symbols.edges, ...twin.runtime.edges];
    const needle = String(request.query ?? '').toLowerCase();
    const nodesWithCitation = allNodes.filter((node) => node.citation?.sourceHash);
    const internalProviders = {
      exact: async () => ({
        cost: 1,
        results: nodesWithCitation.filter((node) => String(node.name ?? '').toLowerCase() === needle || String(node.path ?? '').toLowerCase() === needle).map((node) => matchNodeResult('exact', needle, node, 1)),
      }),
      lexical: async () => ({
        cost: 2,
        results: nodesWithCitation.filter((node) => `${node.name ?? ''} ${node.path ?? ''}`.toLowerCase().includes(needle)).map((node) => matchNodeResult('lexical', needle, node, 0.85)),
      }),
      'ast-lsp': async () => ({
        cost: 2,
        results: twin.symbols.nodes.filter((node) => node.citation?.sourceHash && String(node.name ?? '').toLowerCase().includes(needle)).map((node) => matchNodeResult('ast-lsp', needle, node, 0.9)),
      }),
      graph: async () => ({
        cost: 2,
        results: allEdges.filter((edge) => edge.citation?.sourceHash && `${edge.kind} ${edge.from} ${edge.to}`.toLowerCase().includes(needle)).map((edge) => frozen({ id: `graph:${edge.id}`, stage: 'graph', status: 'fact', score: 0.8, kind: edge.kind, citation: edge.citation })),
      }),
      test: async () => ({
        cost: 2,
        results: twin.symbols.edges.filter((edge) => edge.kind === 'verifies' && edge.citation?.sourceHash).map((edge) => frozen({ id: `test:${edge.id}`, stage: 'test', status: 'fact', score: 0.8, kind: 'verifies', citation: edge.citation })),
      }),
      runtime: async () => ({
        cost: 3,
        results: twin.runtime.edges.filter((edge) => edge.confidence === 'runtime-observed' && edge.citation?.sourceHash).map((edge) => frozen({ id: `runtime:${edge.id}`, stage: 'runtime', status: 'fact', score: 0.95, kind: edge.kind, citation: edge.citation })),
        unknowns: twin.unknowns.filter((item) => item.includes('runtime')),
      }),
    };
    return this.#ensureTruth().planner.execute(request, { ...internalProviders, ...(request.providers ?? {}) });
  }

  zoom(projectId, request = {}) {
    const twin = request.twin ?? this.latestTwins.get(String(projectId)) ?? this.build(projectId, request.buildOptions ?? {});
    return this.#ensureTruth().viewer.open(twin, request);
  }

  validateFacts(projectId, branchContext) {
    const project = this.store.getProject(String(projectId));
    if (!project) throw new Error(`Unknown project: ${projectId}`);
    const overlays = this.latestOverlays.get(String(projectId)) ?? new Map();
    return this.#ensureTruth().ledger.validate({
      projectId: String(projectId),
      branchContext,
      resolveSourceHash: (relativePath, overlayId) => overlayId ? overlays.get(overlayId) ?? null : hashFile(path.join(project.workspaceRoot, relativePath)),
    });
  }
}
