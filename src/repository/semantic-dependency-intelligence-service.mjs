import { createHash } from 'node:crypto';

const DIRECTIONS = new Set(['incoming', 'outgoing', 'both']);
const normalize = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');

function coded(code, message, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function boundedInteger(value, fallback, minimum, maximum, code) {
  const number = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw coded(code, `Expected an integer from ${minimum} to ${maximum}`);
  return number;
}

function stronglyConnectedComponents(paths, edges) {
  const adjacency = new Map(paths.map((filePath) => [filePath, []]));
  for (const edge of edges) adjacency.get(edge.fromPath)?.push(edge.toPath);
  for (const values of adjacency.values()) values.sort();

  let cursor = 0;
  const index = new Map();
  const low = new Map();
  const stack = [];
  const active = new Set();
  const components = [];

  const visit = (node) => {
    index.set(node, cursor);
    low.set(node, cursor);
    cursor += 1;
    stack.push(node);
    active.add(node);

    for (const next of adjacency.get(node) ?? []) {
      if (!index.has(next)) {
        visit(next);
        low.set(node, Math.min(low.get(node), low.get(next)));
      } else if (active.has(next)) low.set(node, Math.min(low.get(node), index.get(next)));
    }

    if (low.get(node) !== index.get(node)) return;
    const component = [];
    while (stack.length) {
      const member = stack.pop();
      active.delete(member);
      component.push(member);
      if (member === node) break;
    }
    component.sort();
    const selfLoop = component.length === 1 && (adjacency.get(component[0]) ?? []).includes(component[0]);
    if (component.length > 1 || selfLoop) components.push(component);
  };

  for (const filePath of [...paths].sort()) if (!index.has(filePath)) visit(filePath);
  return components.sort((left, right) => left[0].localeCompare(right[0]));
}

export class SemanticDependencyIntelligenceService {
  constructor({ store, repositoryIntelligence, codebaseKnowledge } = {}) {
    if (!store?.db || typeof store.getProject !== 'function') throw new TypeError('SemanticDependencyIntelligenceService requires a StudioStore');
    if (!repositoryIntelligence || typeof repositoryIntelligence.index !== 'function' || typeof repositoryIntelligence.search !== 'function') throw new TypeError('repositoryIntelligence is required');
    if (!codebaseKnowledge || typeof codebaseKnowledge.snapshot !== 'function') throw new TypeError('codebaseKnowledge is required');
    this.store = store;
    this.repositoryIntelligence = repositoryIntelligence;
    this.codebaseKnowledge = codebaseKnowledge;
  }

  #context({ principalId, projectId } = {}) {
    const principal = String(principalId ?? '').trim();
    if (!principal) throw coded('SEMANTIC_DEPENDENCY_PRINCIPAL_REQUIRED', 'An authenticated principal is required', 401);
    const id = String(projectId ?? '').trim();
    const project = id ? this.store.getProject(id) : null;
    if (!project) throw coded('SEMANTIC_DEPENDENCY_PROJECT_NOT_FOUND', `Unknown project: ${id || '(empty)'}`, 404);
    return { principalId: principal, projectId: id, project };
  }

  async indexProject(input = {}) {
    const context = this.#context(input);
    const result = await this.repositoryIntelligence.index(context.project, { deferEmbeddings: false });
    const payload = {
      schema: 'forge.semantic-dependency-index.v1',
      principalId: context.principalId,
      projectId: context.projectId,
      lexical: result.lexical,
      semantic: result.semantic,
      graph: result.graph,
    };
    return Object.freeze({ ...payload, receiptSha256: sha256(payload) });
  }

  async search(input = {}) {
    const context = this.#context(input);
    const query = String(input.query ?? '').trim();
    if (!query) throw coded('SEMANTIC_DEPENDENCY_QUERY_REQUIRED', 'A non-empty semantic query is required');
    if (query.length > 4_000) throw coded('SEMANTIC_DEPENDENCY_QUERY_TOO_LARGE', 'Semantic query exceeds 4,000 characters');
    const limit = boundedInteger(input.limit, 20, 1, 100, 'SEMANTIC_DEPENDENCY_LIMIT_INVALID');
    const pathPrefix = input.pathPrefix == null ? null : normalize(input.pathPrefix);
    const language = input.language == null ? null : String(input.language).trim().toLowerCase();
    const result = await this.repositoryIntelligence.search(context.projectId, query, { limit, pathPrefix, language });
    const items = (result.items ?? []).slice(0, limit).map((item) => Object.freeze({
      path: normalize(item.path),
      language: String(item.language ?? 'text'),
      kind: String(item.kind ?? 'chunk'),
      symbol: item.symbol == null ? null : String(item.symbol),
      startLine: Math.max(1, Number(item.startLine) || 1),
      endLine: Math.max(1, Number(item.endLine) || Number(item.startLine) || 1),
      preview: String(item.preview ?? item.text ?? '').slice(0, 1_200),
      contentSha256: String(item.contentSha256 ?? item.sha256 ?? ''),
      score: Number(Number(item.score ?? 0).toFixed(6)),
      scoreBreakdown: Object.freeze(Object.fromEntries(Object.entries(item.scoreBreakdown ?? {}).map(([key, value]) => [key, Number(Number(value ?? 0).toFixed(6))]))),
      sources: Object.freeze([...(item.sources ?? [])].map(String).slice(0, 8)),
    }));
    const payload = {
      schema: 'forge.semantic-dependency-search.v1',
      principalId: context.principalId,
      projectId: context.projectId,
      querySha256: sha256({ query, pathPrefix, language }),
      indexState: result.indexState ?? null,
      graphSha256: result.graphSha256 ?? null,
      items: Object.freeze(items),
    };
    return Object.freeze({ ...payload, receiptSha256: sha256(payload) });
  }

  dependencies(input = {}) {
    const context = this.#context(input);
    const direction = String(input.direction ?? 'both');
    if (!DIRECTIONS.has(direction)) throw coded('SEMANTIC_DEPENDENCY_DIRECTION_INVALID', `Unsupported dependency direction: ${direction}`);
    const depth = boundedInteger(input.depth, 3, 0, 8, 'SEMANTIC_DEPENDENCY_DEPTH_INVALID');
    const limit = boundedInteger(input.limit, 500, 1, 500, 'SEMANTIC_DEPENDENCY_LIMIT_INVALID');
    const rootPath = input.rootPath == null || String(input.rootPath).trim() === '' ? null : normalize(input.rootPath);

    const files = this.store.db.prepare('SELECT path,sha256,language,line_count FROM codebase_knowledge_files WHERE project_id=? ORDER BY path').all(context.projectId);
    const allPaths = files.map((row) => row.path);
    const known = new Set(allPaths);
    if (rootPath && !known.has(rootPath)) throw coded('SEMANTIC_DEPENDENCY_ROOT_NOT_FOUND', `Unknown indexed dependency root: ${rootPath}`, 404);

    const snapshot = this.codebaseKnowledge.snapshot(context.projectId, { limit: 5_000 });
    const imports = (snapshot.edges ?? []).filter((edge) => edge.kind === 'import');
    const tests = (snapshot.edges ?? []).filter((edge) => edge.kind === 'test_relation');
    const outgoing = new Map(allPaths.map((filePath) => [filePath, new Set()]));
    const incoming = new Map(allPaths.map((filePath) => [filePath, new Set()]));
    for (const edge of imports) {
      outgoing.get(edge.fromPath)?.add(edge.toPath);
      incoming.get(edge.toPath)?.add(edge.fromPath);
    }

    let selectedPaths = new Set(allPaths);
    const distance = new Map();
    if (rootPath) {
      selectedPaths = new Set([rootPath]);
      distance.set(rootPath, 0);
      const queue = [rootPath];
      while (queue.length) {
        const current = queue.shift();
        const currentDepth = distance.get(current);
        if (currentDepth >= depth) continue;
        const neighbors = new Set();
        if (direction !== 'incoming') for (const next of outgoing.get(current) ?? []) neighbors.add(next);
        if (direction !== 'outgoing') for (const next of incoming.get(current) ?? []) neighbors.add(next);
        for (const next of [...neighbors].sort()) {
          if (!distance.has(next)) {
            distance.set(next, currentDepth + 1);
            selectedPaths.add(next);
            queue.push(next);
          }
        }
      }
    }

    const orderedPaths = [...selectedPaths].sort((left, right) => (distance.get(left) ?? 0) - (distance.get(right) ?? 0) || left.localeCompare(right)).slice(0, limit);
    selectedPaths = new Set(orderedPaths);
    const selectedEdges = imports.filter((edge) => selectedPaths.has(edge.fromPath) && selectedPaths.has(edge.toPath)).slice(0, 2_000).map((edge) => Object.freeze({
      id: edge.id,
      kind: 'import',
      fromPath: edge.fromPath,
      toPath: edge.toPath,
      line: edge.line,
      detector: edge.detector,
      confidence: edge.confidence,
    }));
    const testPaths = new Set();
    for (const edge of tests) { testPaths.add(edge.fromPath); testPaths.add(edge.toPath); }
    const fileByPath = new Map(files.map((row) => [row.path, row]));
    const nodes = orderedPaths.map((filePath) => {
      const row = fileByPath.get(filePath);
      return Object.freeze({
        path: filePath,
        language: row?.language ?? 'text',
        sourceSha256: row?.sha256 ?? '',
        lineCount: Number(row?.line_count ?? 0),
        incoming: incoming.get(filePath)?.size ?? 0,
        outgoing: outgoing.get(filePath)?.size ?? 0,
        distance: distance.has(filePath) ? distance.get(filePath) : null,
        testRelated: testPaths.has(filePath),
      });
    });
    const cycles = stronglyConnectedComponents(orderedPaths, selectedEdges).map((paths, index) => Object.freeze({ id: `cycle_${index + 1}`, paths: Object.freeze(paths) }));
    const roots = orderedPaths.filter((filePath) => (incoming.get(filePath)?.size ?? 0) === 0);
    const leaves = orderedPaths.filter((filePath) => (outgoing.get(filePath)?.size ?? 0) === 0);
    const focusNode = rootPath ? nodes.find((node) => node.path === rootPath) ?? null : null;
    const payload = {
      schema: 'forge.semantic-dependency-graph.v1',
      principalId: context.principalId,
      projectId: context.projectId,
      graphSha256: snapshot.graphSha256,
      direction,
      depth,
      focus: focusNode,
      nodes: Object.freeze(nodes),
      edges: Object.freeze(selectedEdges),
      roots: Object.freeze(roots),
      leaves: Object.freeze(leaves),
      cycles: Object.freeze(cycles),
      truncated: selectedPaths.size < (rootPath ? distance.size : allPaths.length) || selectedEdges.length >= 2_000,
    };
    return Object.freeze({ ...payload, receiptSha256: sha256(payload) });
  }
}
