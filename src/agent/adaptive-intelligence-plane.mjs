const CAPABILITIES = Object.freeze([
  'secure-semantic-index',
  'incremental-merkle-index',
  'hybrid-code-search',
  'dynamic-context-artifacts',
  'durable-context-history',
  'progressive-tool-discovery',
  'outcome-aware-model-routing',
  'cited-project-memory',
  'independent-incremental-review',
  'durable-local-automations',
  'design-context',
  'human-takeover-leases',
  'structured-diagnostic-delta',
  'environment-self-healing',
]);

function requirePrincipal(principal) {
  const subject = String(principal?.subject ?? '').trim();
  if (!subject) throw Object.assign(new Error('An authenticated principal is required'), { statusCode: 401, code: 'ADAPTIVE_PRINCIPAL_REQUIRED' });
  return subject;
}

function requireProject(projectResolver, projectId) {
  const project = projectResolver(String(projectId ?? ''));
  if (!project) throw Object.assign(new Error(`Unknown project: ${projectId}`), { statusCode: 404, code: 'PROJECT_NOT_FOUND' });
  return project;
}

export class AdaptiveIntelligencePlane {
  constructor({ version, projectResolver, repository, toolCatalog, contextStore, history, memory, reviewer, automations, design, diagnostics, outcomes, router, environment } = {}) {
    if (typeof projectResolver !== 'function') throw new TypeError('AdaptiveIntelligencePlane projectResolver is required');
    this.version = String(version ?? '0.0.0');
    this.projectResolver = projectResolver;
    this.repositoryService = repository;
    this.toolCatalog = toolCatalog;
    this.contextStore = contextStore;
    this.historyArchive = history;
    this.memorySidecar = memory;
    this.reviewer = reviewer;
    this.automations = automations;
    this.designService = design;
    this.diagnosticService = diagnostics;
    this.outcomeFeedback = outcomes;
    this.router = router;
    this.environmentService = environment;
  }

  async status() {
    return Object.freeze({
      schema: 'forge.adaptive-intelligence-status.v1',
      version: this.version,
      capabilities: CAPABILITIES,
      services: Object.freeze({
        repository: Boolean(this.repositoryService), tools: Boolean(this.toolCatalog), context: Boolean(this.contextStore), history: Boolean(this.historyArchive), memory: Boolean(this.memorySidecar), review: Boolean(this.reviewer), automations: Boolean(this.automations), design: Boolean(this.designService), diagnostics: Boolean(this.diagnosticService), outcomes: Boolean(this.outcomeFeedback), routing: Boolean(this.router), environment: Boolean(this.environmentService),
      }),
      externalGates: Object.freeze([
        { id: 'cloud-agent-runtime', state: 'driver-only-until-live-infrastructure' },
        { id: 'independent-superiority-benchmark', state: 'requires-independent-attestation' },
      ]),
    });
  }

  async repository(operation, input = {}) {
    if (!this.repositoryService) throw Object.assign(new Error('Adaptive repository intelligence is not configured'), { statusCode: 503 });
    const projectId = String(input.projectId ?? '');
    if (operation === 'index') return this.repositoryService.index(requireProject(this.projectResolver, projectId), { deferEmbeddings: input.deferEmbeddings === true });
    if (operation === 'search') return this.repositoryService.search(projectId, String(input.query ?? ''), { limit: input.limit, changedPaths: input.changedPaths ?? [], pathPrefix: input.pathPrefix ?? null, language: input.language ?? null });
    if (operation === 'feedback') return Object.freeze({ recorded: true, projectId, contentSha256: String(input.contentSha256), outcome: this.repositoryService.recordFeedback(projectId, String(input.query ?? ''), String(input.contentSha256 ?? ''), { accepted: input.accepted !== false }) ?? null });
    if (operation === 'map') return this.repositoryService.map(projectId, { maxFiles: input.maxFiles, maxSymbolsPerFile: input.maxSymbolsPerFile, maxChars: input.maxChars });
    if (operation === 'state') return this.repositoryService.state(projectId);
    throw Object.assign(new Error(`Unsupported adaptive repository operation: ${operation}`), { statusCode: 400 });
  }

  tools(operation, input = {}) {
    if (!this.toolCatalog) throw Object.assign(new Error('Dynamic tool catalog is not configured'), { statusCode: 503 });
    if (operation === 'list') return this.toolCatalog.summaries();
    if (operation === 'search') return this.toolCatalog.search(String(input.query ?? ''), { limit: input.limit });
    if (operation === 'schema') return this.toolCatalog.loadSchema(String(input.name ?? ''));
    throw Object.assign(new Error(`Unsupported dynamic-tool operation: ${operation}`), { statusCode: 400 });
  }

  async context(operation, input = {}) {
    if (!this.contextStore) throw Object.assign(new Error('Dynamic context store is not configured'), { statusCode: 503 });
    if (operation === 'get') return this.contextStore.get(input.id);
    if (operation === 'read') return this.contextStore.read(input.id, { startByte: input.startByte, maxBytes: input.maxBytes });
    if (operation === 'search') return this.contextStore.search(input.id, String(input.query ?? ''), { limit: input.limit, caseSensitive: input.caseSensitive === true, regex: input.regex === true });
    throw Object.assign(new Error(`Unsupported context-artifact operation: ${operation}`), { statusCode: 400 });
  }

  async history(operation, input = {}) {
    if (!this.historyArchive) throw Object.assign(new Error('Durable context history is not configured'), { statusCode: 503 });
    const projectId = String(input.projectId ?? '');
    requireProject(this.projectResolver, projectId);
    if (operation === 'list') return this.historyArchive.list({ projectId, missionId: input.missionId, sessionId: input.sessionId, kind: input.kind ?? null, limit: input.limit });
    if (operation === 'get') return this.historyArchive.get(input.id, { projectId });
    if (operation === 'search') return this.historyArchive.search({ projectId, missionId: input.missionId, sessionId: input.sessionId, kind: input.kind ?? null, query: input.query, limit: input.limit, regex: input.regex === true, caseSensitive: input.caseSensitive === true });
    if (operation === 'archive-conversation') return this.historyArchive.archiveConversation({ projectId, missionId: input.missionId ?? null, sessionId: input.sessionId ?? null, messages: input.messages ?? null, secretValues: input.secretValues ?? [] });
    if (operation === 'compact-conversation') return this.historyArchive.compactConversation({ projectId, missionId: input.missionId ?? null, sessionId: input.sessionId ?? null, messages: input.messages ?? null, summary: input.summary, secretValues: input.secretValues ?? [] });
    throw Object.assign(new Error(`Unsupported context-history operation: ${operation}`), { statusCode: 400 });
  }

  async memory(operation, input = {}, principal = null) {
    if (!this.memorySidecar) throw Object.assign(new Error('Project memory sidecar is not configured'), { statusCode: 503 });
    if (operation === 'get') return this.memorySidecar.get(input.id);
    const actor = requirePrincipal(principal);
    if (operation === 'propose') return this.memorySidecar.propose({ ...input, actor });
    if (operation === 'approve') return this.memorySidecar.approve(input.id, { actor, evidenceReceiptSha256: input.evidenceReceiptSha256 });
    if (operation === 'edit') return this.memorySidecar.edit(input.id, { actor, title: input.title, content: input.content, confidence: input.confidence });
    if (operation === 'revoke') return this.memorySidecar.revoke(input.id, { actor });
    if (operation === 'purge') return this.memorySidecar.purge(input.id, { actor });
    throw Object.assign(new Error(`Unsupported project-memory operation: ${operation}`), { statusCode: 400 });
  }

  async review(operation, input = {}) {
    if (!this.reviewer) throw Object.assign(new Error('Independent reviewer is not configured'), { statusCode: 503 });
    if (operation === 'run') return this.reviewer.review(input);
    if (operation === 'get') return this.reviewer.get(input.id);
    if (operation === 'handoff') return this.reviewer.createRepairHandoff(input.id, { targetAgentProfile: input.targetAgentProfile });
    throw Object.assign(new Error(`Unsupported independent-review operation: ${operation}`), { statusCode: 400 });
  }

  async automation(operation, input = {}) {
    if (!this.automations) throw Object.assign(new Error('Durable automation service is not configured'), { statusCode: 503 });
    if (operation === 'create') return this.automations.create(input);
    if (operation === 'list') return this.automations.list({ projectId: input.projectId ?? null });
    if (operation === 'get') return this.automations.get(input.id);
    if (operation === 'event') return this.automations.ingestEvent(input);
    if (operation === 'enqueue') return this.automations.enqueue(input.id, input.event);
    if (operation === 'tick') return this.automations.tick();
    if (operation === 'runs') return this.automations.listRuns(input.id, { limit: input.limit });
    throw Object.assign(new Error(`Unsupported automation operation: ${operation}`), { statusCode: 400 });
  }

  async design(operation, input = {}, principal = null) {
    if (!this.designService) throw Object.assign(new Error('Design context service is not configured'), { statusCode: 503 });
    if (operation === 'capture') return this.designService.capture(input, { secretValues: input.secretValues ?? [] });
    if (operation === 'get') return this.designService.get(input.id);
    if (operation === 'edit') return this.designService.enqueueEdit(input.id, { selector: input.selector, instruction: input.instruction });
    if (operation === 'edits') return this.designService.listEdits(input.id);
    const actor = requirePrincipal(principal);
    if (operation === 'takeover') return this.designService.requestTakeover({ sessionId: input.sessionId, actor, ttlMs: input.ttlMs });
    if (operation === 'release') return this.designService.releaseTakeover(input.id, { actor });
    if (operation === 'hot-reload') return this.designService.recordHotReload(input);
    throw Object.assign(new Error(`Unsupported design-context operation: ${operation}`), { statusCode: 400 });
  }

  diagnostics(operation, input = {}) {
    if (!this.diagnosticService) throw Object.assign(new Error('Structured diagnostic service is not configured'), { statusCode: 503 });
    if (operation === 'compare') return this.diagnosticService.compare(input);
    throw Object.assign(new Error(`Unsupported structured-diagnostic operation: ${operation}`), { statusCode: 400 });
  }


  async environment(operation, input = {}) {
    if (!this.environmentService) throw Object.assign(new Error('Environment supervision is not configured'), { statusCode: 503 });
    const projectId = String(input.projectId ?? '');
    requireProject(this.projectResolver, projectId);
    if (operation === 'list') return this.environmentService.list({ projectId });
    if (operation === 'status') return this.environmentService.status(input.id, { projectId });
    if (operation === 'snapshot') return this.environmentService.snapshot(input.id, { projectId });
    throw Object.assign(new Error(`Unsupported environment operation: ${operation}`), { statusCode: 400 });
  }

  providers(operation, input = {}, principal = null) {
    if (!this.router) throw Object.assign(new Error('Outcome-aware provider router is not configured'), { statusCode: 503 });
    if (operation === 'outcome') {
      if (!this.outcomeFeedback) throw Object.assign(new Error('Provider outcome feedback is not configured'), { statusCode: 503 });
      return this.outcomeFeedback.recordUserFeedback(input, principal);
    }
    if (operation === 'route') {
      const decision = typeof this.router.decide === 'function' ? this.router.decide(input) : { provider: this.router.select(input), ranked: this.router.rank(input) };
      if (!decision?.provider) return decision;
      const { provider, ranked, ...publicDecision } = decision;
      return Object.freeze({ ...publicDecision, selectedProviderId: publicDecision.selectedProviderId ?? provider.id, ranked: publicDecision.ranked ?? ranked?.map((entry) => ({ providerId: entry.provider.id, eligible: entry.eligible, reason: entry.reason, score: Number.isFinite(entry.score) ? entry.score : null })) });
    }
    throw Object.assign(new Error(`Unsupported provider-routing operation: ${operation}`), { statusCode: 400 });
  }
}
