const clampLimit = (value, fallback = 20, maximum = 200) => Math.max(1, Math.min(maximum, Number(value) || fallback));
const normalize = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
const CONCEPT_ALIASES = new Map([
  ['login', ['auth', 'authenticate', 'authentication', 'session', 'token', 'signin']],
  ['authentication', ['auth', 'authenticate', 'login', 'session', 'token', 'credential']],
  ['payment', ['billing', 'charge', 'card', 'invoice']],
  ['database', ['db', 'sql', 'repository', 'storage']],
  ['error', ['exception', 'failure', 'stack', 'diagnostic']],
]);

function expandQuery(query) {
  const raw = String(query ?? '').trim();
  const tokens = raw.toLowerCase().match(/[\p{L}\p{N}_$.-]{2,}/gu) ?? [];
  const additions = new Set();
  for (const token of tokens) for (const alias of CONCEPT_ALIASES.get(token) ?? []) additions.add(alias);
  return additions.size ? `${raw} ${[...additions].join(' ')}` : raw;
}

function lexicalPreview(content, maximum = 4_000) {
  const text = String(content ?? '');
  return text.length <= maximum ? text : text.slice(0, maximum);
}

function mergeHybridResults(semanticItems, lexicalItems, limit) {
  const merged = new Map();

  for (const item of semanticItems) {
    const key = `${item.path}:${item.startLine ?? 1}:${item.endLine ?? 1}:${item.contentSha256}`;
    merged.set(key, {
      ...item,
      sha256: item.contentSha256,
      text: item.preview,
      sources: ['semantic'],
      score: Number(item.score) || 0,
      scoreBreakdown: { ...item.scoreBreakdown, lexicalFile: 0 },
    });
  }

  for (const item of lexicalItems) {
    const semanticForPath = [...merged.values()].filter((candidate) => candidate.path === item.path);
    if (semanticForPath.length) {
      const fileBoost = Math.min(0.35, Math.max(0, Number(item.score) || 0) / 250);
      for (const candidate of semanticForPath) {
        candidate.score += fileBoost;
        candidate.scoreBreakdown = { ...candidate.scoreBreakdown, lexicalFile: fileBoost };
        candidate.sources = [...new Set([...candidate.sources, 'lexical'])];
      }
      continue;
    }

    const key = `${item.path}:1:${item.lineCount ?? 1}:${item.sha256}`;
    merged.set(key, {
      path: item.path,
      language: item.language,
      kind: 'file',
      symbol: null,
      startLine: 1,
      endLine: item.lineCount ?? 1,
      preview: lexicalPreview(item.content),
      text: lexicalPreview(item.content),
      sha256: item.sha256,
      contentSha256: item.sha256,
      score: Math.min(0.8, Math.max(0, Number(item.score) || 0) / 100),
      scoreBreakdown: { semantic: 0, lexical: 0, path: 0, graph: 0, feedback: 0, test: 0, lexicalFile: Math.min(0.8, Math.max(0, Number(item.score) || 0) / 100) },
      sources: ['lexical'],
    });
  }

  return [...merged.values()]
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || (a.startLine ?? 1) - (b.startLine ?? 1))
    .slice(0, limit)
    .map((item) => Object.freeze({ ...item, sources: Object.freeze([...item.sources]), scoreBreakdown: Object.freeze({ ...item.scoreBreakdown }) }));
}

export class AdaptiveRepositoryIntelligence {
  constructor({ lexicalIndex, semanticIndex, mapService = null, graphService = null, scheduler = null } = {}) {
    if (!lexicalIndex || typeof lexicalIndex.index !== 'function' || typeof lexicalIndex.search !== 'function') throw new TypeError('lexicalIndex is required');
    if (!semanticIndex || typeof semanticIndex.index !== 'function' || typeof semanticIndex.search !== 'function') throw new TypeError('semanticIndex is required');
    this.lexicalIndex = lexicalIndex;
    this.semanticIndex = semanticIndex;
    this.mapService = mapService;
    this.graphService = graphService;
    this.scheduler = scheduler;
  }

  async index(project, options = {}) {
    if (this.scheduler) {
      const generation = String(options.generation ?? (this.graphService?.signature ? await this.graphService.signature(project) : 'current'));
      const stages = ['lexical', 'semantic', ...(this.graphService ? ['graph'] : [])];
      const scheduled = await this.scheduler.enqueue({
        project,
        generation,
        priority: options.priority ?? 'mission',
        stages,
        reason: options.reason ?? 'adaptive-repository-index',
        signal: options.signal ?? null,
        deferEmbeddings: Boolean(options.deferEmbeddings),
        branchContext: options.branchContext ?? null,
        changes: Array.isArray(options.changes) ? options.changes : [],
      });
      return Object.freeze({
        schema: 'forge.adaptive-repository-index.v1', projectId: project.id,
        lexical: scheduled.outputs.lexical ?? null,
        semantic: scheduled.outputs.semantic ?? null,
        graph: scheduled.outputs.graph ?? null,
        scheduler: Object.freeze({ jobId: scheduled.jobId, generation: scheduled.generation, priority: scheduled.priority, skippedStages: scheduled.skippedStages, receiptSha256: scheduled.receiptSha256 }),
      });
    }
    const [lexical, semantic, graph] = await Promise.all([
      this.lexicalIndex.index(project),
      this.semanticIndex.index(project, { deferEmbeddings: Boolean(options.deferEmbeddings) }),
      this.graphService ? this.graphService.index(project) : Promise.resolve(null),
    ]);
    return Object.freeze({ schema: 'forge.adaptive-repository-index.v1', projectId: project.id, lexical, semantic, graph });
  }

  async completeEmbeddings(projectId) {
    return this.semanticIndex.completeEmbeddings(projectId);
  }

  state(projectId) {
    return Object.freeze({ schema: 'forge.adaptive-repository-state.v1', semantic: this.semanticIndex.state(projectId) });
  }

  async search(projectId, query, { limit = 20, changedPaths = [], pathPrefix = null, language = null } = {}) {
    const resultLimit = clampLimit(limit);
    const expandedQuery = expandQuery(query);
    const semanticLimit = Math.min(200, Math.max(resultLimit * 3, 20));
    const [semantic, lexical] = await Promise.all([
      this.semanticIndex.search(projectId, expandedQuery, { limit: semanticLimit, pathPrefix, language }),
      Promise.resolve(this.lexicalIndex.search(projectId, expandedQuery, { limit: semanticLimit, changedPaths })),
    ]);
    const lexicalFiltered = lexical.filter((item) => (!pathPrefix || normalize(item.path).startsWith(normalize(pathPrefix))) && (!language || item.language === language));
    const graphRank = this.graphService ? this.graphService.rank(projectId, expandedQuery, { seedPaths: changedPaths, limit: semanticLimit }) : { items: [] };
    const graphByPath = new Map((graphRank.items ?? []).map((item) => [item.path, item]));
    const merged = mergeHybridResults(semantic.items, lexicalFiltered, semanticLimit).map((item) => {
      const graph = graphByPath.get(item.path);
      if (!graph) return item;
      const graphBoost = Math.min(0.4, Math.max(0, Number(graph.score) || 0) / 100);
      return Object.freeze({
        ...item,
        score: item.score + graphBoost,
        sources: Object.freeze([...new Set([...(item.sources ?? []), 'knowledge-graph'])]),
        scoreBreakdown: Object.freeze({ ...item.scoreBreakdown, graph: graphBoost, dependencyDistance: graph.scoreBreakdown.dependencyDistance, gitRecency: graph.scoreBreakdown.gitRecency, testRelation: graph.scoreBreakdown.testRelation }),
      });
    }).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, resultLimit);
    return Object.freeze({
      schema: 'forge.adaptive-repository-search.v1',
      query: String(query),
      indexState: semantic.indexState,
      semanticState: 'active',
      retrieval: semantic.retrieval ?? null,
      graphSha256: graphRank.graphSha256 ?? null,
      items: Object.freeze(merged),
    });
  }

  async contextForTask(projectId, { objective, changedPaths = [], maxChars = 24_000, maxFiles = 12 } = {}) {
    const fileLimit = clampLimit(maxFiles, 12, 100);
    const characterLimit = Math.max(512, Number(maxChars) || 24_000);
    const result = await this.search(projectId, objective, { limit: Math.max(fileLimit * 4, 20), changedPaths });
    const items = []; const omissions = []; const seenPaths = new Set(); let totalChars = 0;

    for (const candidate of result.items) {
      if (seenPaths.has(candidate.path)) continue;
      if (items.length >= fileLimit) { omissions.push({ path: candidate.path, reason: 'file-limit', score: candidate.score }); continue; }
      const header = `// repository:${candidate.path}:${candidate.startLine ?? 1}-${candidate.endLine ?? 1} sha256=${candidate.contentSha256}\n`;
      const available = Math.max(0, characterLimit - totalChars - header.length);
      if (available < 80) { omissions.push({ path: candidate.path, reason: 'character-budget', score: candidate.score }); continue; }
      const sourceText = String(candidate.preview ?? candidate.text ?? '');
      const content = sourceText.slice(0, available);
      items.push(Object.freeze({
        path: candidate.path,
        sha256: candidate.contentSha256,
        language: candidate.language,
        startLine: candidate.startLine ?? 1,
        endLine: candidate.endLine ?? 1,
        score: candidate.score,
        scoreBreakdown: candidate.scoreBreakdown,
        sources: candidate.sources,
        text: `${header}${content}`,
        truncated: content.length < sourceText.length,
      }));
      seenPaths.add(candidate.path);
      totalChars += header.length + content.length;
    }

    return Object.freeze({ schema: 'forge.adaptive-repository-context.v1', items: Object.freeze(items), omissions: Object.freeze(omissions), totalChars, maxChars: characterLimit, maxFiles: fileLimit, indexState: result.indexState });
  }


  map(projectId, options = {}) {
    if (!this.mapService) throw new Error('Repository map service is not configured');
    return this.mapService.build(projectId, options);
  }

  symbols(projectId, options = {}) {
    return this.lexicalIndex.symbols(projectId, options);
  }

  recordFeedback(projectId, query, chunkSha256, outcome = {}) {
    return this.semanticIndex.recordFeedback(projectId, expandQuery(query), chunkSha256, outcome);
  }

  exportSnapshot(projectId) {
    return this.semanticIndex.exportSnapshot(projectId);
  }

  reuseSnapshot(project, snapshot, proofs = {}) {
    return this.semanticIndex.reuseSnapshot(project, snapshot, proofs);
  }
}
