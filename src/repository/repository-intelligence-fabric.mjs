import { AdaptiveRepositoryIntelligence } from './adaptive-repository-intelligence.mjs';
import { CodebaseKnowledgeGraphService } from './codebase-knowledge-graph-service.mjs';
import { CodebaseKnowledgeWatcher } from './codebase-knowledge-watcher.mjs';
import { EmbeddingProviderRegistry, FeatureHashEmbeddingProvider } from './embedding-provider.mjs';
import { RepositoryDigitalTwinService } from './repository-digital-twin-service.mjs';
import { RepositoryIndex } from './repository-index.mjs';
import { RepositoryIntelligenceScheduler } from './repository-intelligence-scheduler.mjs';
import { RepositoryMapService } from './repository-map-service.mjs';
import { SecureSemanticIndex } from './secure-semantic-index.mjs';
import { PolyglotIntelligencePlane } from './polyglot-intelligence-plane.mjs';
import { ContextLearningKernel } from '../intelligence-completion/context-learning-kernel.mjs';
import { CounterfactualPatchAblator } from '../intelligence-completion/counterfactual-patch-ablator.mjs';
import { PagedVectorStore } from '../intelligence-completion/paged-vector-store.mjs';
import { ProgramAnalysisKernel } from '../intelligence-completion/program-analysis-kernel.mjs';
import { RepositoryIntelligenceCompletionService } from '../intelligence-completion/repository-intelligence-completion-service.mjs';
import { VariableLineageService } from '../intelligence-completion/variable-lineage-service.mjs';

function frozen(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) value.forEach(frozen); else Object.values(value).forEach(frozen);
  return Object.freeze(value);
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function clean(value, max = 1_000) { return String(value ?? '').trim().slice(0, max); }
function bounded(value, fallback, maximum = 200) { return Math.max(1, Math.min(maximum, Number(value) || fallback)); }
function normalizePath(value) { return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, ''); }

function publicProvider(provider = {}) {
  return frozen({
    id: String(provider.id ?? ''), kind: String(provider.kind ?? 'unknown'), dimensions: Math.max(0, Number(provider.dimensions) || 0),
    degraded: provider.degraded === true, modelSha256: provider.modelSha256 == null ? null : String(provider.modelSha256), available: provider.available === true,
  });
}

function lexicalOnlySearch(runtime, projectId, query, options = {}) {
  const limit = bounded(options.limit, 20);
  const pathPrefix = options.pathPrefix ? normalizePath(options.pathPrefix) : null;
  const language = options.language == null ? null : String(options.language);
  const rows = runtime.lexicalIndex.search(String(projectId), String(query), { limit: Math.min(200, Math.max(limit * 3, 20)), changedPaths: options.changedPaths ?? [] });
  const items = rows
    .filter((item) => (!pathPrefix || normalizePath(item.path).startsWith(pathPrefix)) && (!language || item.language === language))
    .slice(0, limit)
    .map((item) => frozen({
      path: normalizePath(item.path), language: item.language, kind: 'file', symbol: null, startLine: 1, endLine: Number(item.lineCount) || 1,
      preview: String(item.content ?? '').slice(0, 4_000), text: String(item.content ?? '').slice(0, 4_000), sha256: item.sha256,
      contentSha256: item.sha256, score: Math.min(1, Math.max(0, Number(item.score) || 0) / 100),
      scoreBreakdown: { lexicalFile: Math.min(1, Math.max(0, Number(item.score) || 0) / 100), semantic: 0 }, sources: ['lexical'],
    }));
  return frozen({ schema: 'forge.adaptive-repository-search.v1', query: String(query), semanticState: 'suspended', indexState: runtime.repository.state?.(projectId)?.semantic ?? null, graphSha256: null, items });
}

export class RepositoryIntelligenceFabric {
  constructor({ runtimeFactory, embeddingRegistry, governor = null, polyglotPlane = null, clock = Date.now, completionFactories = {} } = {}) {
    if (typeof runtimeFactory !== 'function') throw new TypeError('RepositoryIntelligenceFabric requires runtimeFactory');
    if (!embeddingRegistry?.status || !embeddingRegistry?.close) throw new TypeError('RepositoryIntelligenceFabric requires embeddingRegistry');
    this.runtimeFactory = runtimeFactory;
    this.embeddingRegistry = embeddingRegistry;
    this.governor = governor;
    this.polyglotPlane = polyglotPlane ?? new PolyglotIntelligencePlane({ governor });
    this.clock = clock;
    this.runtime = null;
    this.lifecycle = 'inactive';
    this.suspendReason = null;
    this.activatedAt = null;
    this.closedAt = null;
    this.completionFactories = frozen({
      context: completionFactories.context ?? (() => new ContextLearningKernel()),
      vectors: completionFactories.vectors ?? (() => new PagedVectorStore()),
      repository: completionFactories.repository ?? (() => new RepositoryIntelligenceCompletionService()),
      program: completionFactories.program ?? (() => new ProgramAnalysisKernel()),
      variables: completionFactories.variables ?? (() => new VariableLineageService()),
      ablator: completionFactories.ablator ?? (() => new CounterfactualPatchAblator()),
    });
    this.completionServices = { context: null, vectors: null, repository: null, program: null, variables: null, ablator: null };
  }

  #ensure() {
    if (this.lifecycle === 'closed') throw fail('REPOSITORY_INTELLIGENCE_CLOSED', 'Repository intelligence fabric is closed');
    if (!this.runtime) {
      this.runtime = this.runtimeFactory();
      if (!this.runtime?.repository || !this.runtime?.lexicalIndex || !this.runtime?.digitalTwin) throw new TypeError('repository intelligence runtime is incomplete');
      this.activatedAt = new Date(Number(this.clock())).toISOString();
      if (this.lifecycle !== 'suspended') this.lifecycle = 'active';
    }
    return this.runtime;
  }

  #semanticPolicy() {
    if (this.lifecycle === 'suspended') return 'suspended';
    return clean(this.governor?.policy?.()?.semanticIndexing ?? this.governor?.snapshot?.()?.policy?.semanticIndexing ?? 'incremental', 64) || 'incremental';
  }


  #completionService(name) {
    if (this.lifecycle === 'closed') throw fail('REPOSITORY_INTELLIGENCE_CLOSED', 'Repository intelligence fabric is closed');
    if (!this.completionServices[name]) {
      const service = this.completionFactories[name]();
      if (!service || typeof service !== 'object') throw new TypeError(`completion factory ${name} returned an invalid service`);
      this.completionServices[name] = service;
    }
    return this.completionServices[name];
  }

  index(project, options = {}) { return this.#ensure().repository.index(project, options); }
  completeEmbeddings(projectId) {
    if (this.#semanticPolicy() === 'suspended') return Promise.reject(fail('SEMANTIC_INDEXING_SUSPENDED', 'Semantic indexing is suspended'));
    return this.#ensure().repository.completeEmbeddings(projectId);
  }
  lexicalSearch(projectId, query, options = {}) { return lexicalOnlySearch(this.#ensure(), projectId, query, options); }
  async search(projectId, query, options = {}) {
    const runtime = this.#ensure();
    return this.#semanticPolicy() === 'suspended' ? lexicalOnlySearch(runtime, projectId, query, options) : runtime.repository.search(projectId, query, options);
  }
  contextForTask(projectId, input = {}) { return this.#ensure().repository.contextForTask(projectId, input); }
  state(projectId) { return this.#ensure().repository.state(projectId); }
  map(projectId, options = {}) { return this.#ensure().repository.map(projectId, options); }
  symbols(projectId, options = {}) { return this.#ensure().repository.symbols(projectId, options); }
  recordFeedback(projectId, query, chunkSha256, outcome = {}) { return this.#ensure().repository.recordFeedback(projectId, query, chunkSha256, outcome); }
  exportSnapshot(projectId) { return this.#ensure().repository.exportSnapshot(projectId); }
  reuseSnapshot(project, snapshot, proofs = {}, options = {}) { return this.#ensure().repository.reuseSnapshot(project, snapshot, proofs, options); }
  digitalTwin(projectId, options = {}) { return this.#ensure().digitalTwin.build(projectId, options); }
  repositoryTruth(projectId, options = {}) { return this.#ensure().digitalTwin.build(projectId, options); }
  queryRepositoryTruth(projectId, request = {}) { return this.#ensure().digitalTwin.query(projectId, request); }
  zoomRepositoryTruth(projectId, request = {}) { return this.#ensure().digitalTwin.zoom(projectId, request); }
  validateRepositoryTruth(projectId, branchContext) { return this.#ensure().digitalTwin.validateFacts(projectId, branchContext); }
  repositoryTruthStatus() { return this.runtime?.digitalTwin?.status?.() ?? frozen({ schema: 'forge.repository-truth-plane-status.v1', loaded: false, cachedProjectCount: 0, factCount: 0 }); }

  graphSnapshot(projectId, options = {}) { return this.#ensure().graphService.snapshot(String(projectId), options); }
  graphIndex(project) { return this.#ensure().graphService.index(project); }
  graphSearchRegex(projectId, pattern, options = {}) { return this.#ensure().graphService.searchRegex(String(projectId), pattern, options); }
  graphRank(projectId, query, options = {}) { return this.#ensure().graphService.rank(String(projectId), query, options); }
  graphSignature(project) { return this.#ensure().graphService.signature(project); }
  watchStart(project) { return this.#ensure().watcher.start(project); }
  watchStop(projectId) { return this.#ensure().watcher.stop(String(projectId)); }
  watchStatus(projectId) { return this.runtime?.watcher?.status(String(projectId)) ?? frozen({ schema: 'forge.codebase-watcher.v1', projectId: String(projectId), state: 'stopped', mode: 'portable-polling', indexing: false }); }
  polyglotStatus() { return this.polyglotPlane.status(); }
  classifySource(filePath, options = {}) { return this.polyglotPlane.classifySource(filePath, options); }
  observeRuntime(input = {}) { return this.polyglotPlane.observeRuntime(input); }
  fusePolyglotEvidence(input = {}) { return this.polyglotPlane.fuse(input); }
  polyglotGraph() { return this.polyglotPlane.graph(); }
  architectureDrift(input = {}) { return this.polyglotPlane.evaluateDrift(input); }

  async expandCompletionQueries(input = {}) { return this.#completionService('context').expandQueries(input); }
  recordCompletionContextOutcome(input = {}) { return this.#completionService('context').recordVerifiedOutcome(input); }
  async runCompletionContextAblation(input = {}) { return this.#completionService('context').runAblationReplay(input); }
  completionContextSnapshot() { return this.#completionService('context').snapshot(); }
  async completionVectorBuild(input = {}) { return this.#completionService('vectors').build(input); }
  async completionVectorSearch(input = {}) { return this.#completionService('vectors').search(input); }
  recordCompletionCommitArchitecture(input = {}) { return this.#completionService('repository').recordCommitArchitecture(input); }
  recordCompletionIssueReference(input = {}) { return this.#completionService('repository').recordIssueCodeReference(input); }
  completionModuleMap(input = {}) { return this.#completionService('repository').buildModuleMap(input); }
  completionArchitectureZones(input = {}) { return this.#completionService('repository').detectArchitectureZones(input); }
  completionGitRisk(input = {}) { return this.#completionService('repository').buildGitRiskProfile(input); }
  completionControlFlow(input = {}) { return this.#completionService('program').buildControlFlow(input); }
  completionDataFlow(input = {}) { return this.#completionService('program').buildDataFlow(input); }
  registerCompletionVariable(input = {}) { return this.#completionService('variables').registerBinding(input); }
  transitionCompletionVariable(bindingId, input = {}) { return this.#completionService('variables').transitionBinding(bindingId, input); }
  resolveCompletionVariable(input = {}) { return this.#completionService('variables').resolve(input); }
  async runCompletionPatchAblation(input = {}) { return this.#completionService('ablator').run(input); }

  completionSnapshot() {
    const loaded = Object.fromEntries(Object.entries(this.completionServices).map(([name, service]) => [name, service != null]));
    const services = Object.fromEntries(Object.entries(this.completionServices).map(([name, service]) => [name, typeof service?.snapshot === 'function' ? service.snapshot() : null]));
    return frozen({ schema: 'forge.repository-intelligence-completion-snapshot.v1', loaded, services, claims: { servicesLoadedBySnapshot: false, applicationBootstrapModified: false } });
  }

  schedulerSnapshot(projectId = null) { return this.runtime?.scheduler?.snapshot(projectId) ?? frozen({ schema: 'forge.repository-intelligence-scheduler-snapshot.v1', state: 'inactive', semanticIndexing: this.#semanticPolicy(), workers: 0, active: 0, queued: 0, activeJobs: [], queuedJobs: [], journal: [], closed: this.lifecycle === 'closed' }); }

  async suspend(reason = 'manual') {
    if (this.lifecycle === 'closed') return this.status();
    this.lifecycle = 'suspended'; this.suspendReason = clean(reason, 512) || 'manual';
    if (this.runtime?.semanticIndex?.embeddingProvider?.close) await this.runtime.semanticIndex.embeddingProvider.close();
    return this.status();
  }

  resume() {
    if (this.lifecycle === 'closed') throw fail('REPOSITORY_INTELLIGENCE_CLOSED', 'Repository intelligence fabric is closed');
    this.lifecycle = this.runtime ? 'active' : 'inactive'; this.suspendReason = null;
    return frozen({ schema: 'forge.repository-intelligence-resume.v1', lifecycle: this.lifecycle });
  }

  async status() {
    const registry = await this.embeddingRegistry.status();
    const providers = (registry?.providers ?? []).slice(0, 32).map(publicProvider);
    return frozen({
      schema: 'forge.repository-intelligence-fabric-status.v1', lifecycle: this.lifecycle, suspendReason: this.suspendReason,
      activatedAt: this.activatedAt, closedAt: this.closedAt, semanticPolicy: this.#semanticPolicy(),
      governor: this.governor?.snapshot?.() ? { state: this.governor.snapshot().state } : null,
      embedding: { schema: registry?.schema ?? 'forge.embedding-provider-registry.v1', providers }, scheduler: this.schedulerSnapshot(), polyglot: await this.polyglotStatus(), completion: this.completionSnapshot(), repositoryTruth: this.repositoryTruthStatus(),
    });
  }

  async close() {
    if (this.lifecycle === 'closed') return this.status();
    this.lifecycle = 'closed'; this.closedAt = new Date(Number(this.clock())).toISOString();
    const runtime = this.runtime; this.runtime = null;
    if (runtime?.close) await runtime.close();
    const vectorStore = this.completionServices.vectors;
    if (vectorStore?.close) await vectorStore.close();
    await this.embeddingRegistry.close();
    await this.polyglotPlane.close();
    return this.status();
  }
}

export function createRepositoryIntelligenceFabric({ store, governor, journal = null, maxWorkers = 2, eventSink = () => {}, embeddingProvider = null, toolSchemaRevision = 'forge-tools-v1' } = {}) {
  if (!store?.db) throw new TypeError('createRepositoryIntelligenceFabric requires a StudioStore');
  if (!governor?.snapshot) throw new TypeError('createRepositoryIntelligenceFabric requires a ResourceGovernor');
  const fallback = embeddingProvider ?? new FeatureHashEmbeddingProvider();
  const embeddingRegistry = new EmbeddingProviderRegistry({ providers: [fallback] });
  return new RepositoryIntelligenceFabric({
    embeddingRegistry, governor, polyglotPlane: new PolyglotIntelligencePlane({ governor }),
    runtimeFactory: () => {
      const lexicalIndex = new RepositoryIndex({ store });
      const semanticIndex = new SecureSemanticIndex({ store, embeddingProvider: fallback, toolSchemaRevision });
      const mapService = new RepositoryMapService({ store });
      const graphService = new CodebaseKnowledgeGraphService({ store });
      const scheduler = new RepositoryIntelligenceScheduler({
        governor, journal, maxWorkers,
        runners: {
          lexical: (project) => lexicalIndex.index(project),
          semantic: (project, options) => semanticIndex.index(project, { deferEmbeddings: options.deferEmbeddings, branchContext: options.branchContext }),
          graph: (project) => graphService.index(project),
        },
        eventSink,
      });
      const watcher = new CodebaseKnowledgeWatcher({ service: graphService, scheduler });
      const repository = new AdaptiveRepositoryIntelligence({ lexicalIndex, semanticIndex, mapService, graphService, scheduler });
      const digitalTwin = new RepositoryDigitalTwinService({ store });
      return {
        repository, lexicalIndex, semanticIndex, mapService, graphService, scheduler, watcher, digitalTwin,
        async close() { watcher.close(); scheduler.close(); },
      };
    },
  });
}
