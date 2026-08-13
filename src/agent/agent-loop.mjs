import { RunBudget } from './budget.mjs';
import { createEvent } from '../protocol/events.mjs';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { RunActivityTracker } from './run-activity-tracker.mjs';
import { assertTaskActionAllowed } from '../orchestration/task-contract.mjs';
import { VerificationClaimGuard } from '../security/verification-claim-guard.mjs';

export const CORE_TOOL_SCHEMAS = Object.freeze([
  {
    type: 'function',
    function: {
      name: 'fs.read',
      description: 'Read a bounded UTF-8 file or exact 1-based line range in the authorized workspace.',
      parameters: {
        type: 'object', additionalProperties: false, required: ['path'],
        properties: {
          path: { type: 'string' },
          startLine: { type: 'integer', minimum: 1 },
          endLine: { type: 'integer', minimum: 1 },
          headLines: { type: 'integer', minimum: 1 },
          tailLines: { type: 'integer', minimum: 1 },
          pageSizeLines: { type: 'integer', minimum: 1, maximum: 10000 },
          pageToken: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fs.readMany',
      description: 'Read up to 64 authorized UTF-8 files concurrently with bounded output.',
      parameters: { type: 'object', additionalProperties: false, required: ['paths'], properties: { paths: { type: 'array', minItems: 1, maxItems: 64, items: { type: 'string' } }, concurrency: { type: 'integer', minimum: 1, maximum: 32 }, pageSizeLines: { type: 'integer', minimum: 1, maximum: 10000 } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fs.search',
      description: 'Search authorized UTF-8 files with bounded literal or regular-expression matching and exact line metadata.',
      parameters: {
        type: 'object', additionalProperties: false, required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1, maxLength: 4000 },
          regex: { type: 'boolean' },
          caseSensitive: { type: 'boolean' },
          paths: { type: 'array', minItems: 1, maxItems: 32, items: { type: 'string' } },
          maxResults: { type: 'integer', minimum: 1, maximum: 500 },
          maxFiles: { type: 'integer', minimum: 1, maximum: 100000 },
        },
      },
    },
  },
  { type: 'function', function: { name: 'fs.write', description: 'Atomically write a file in the authorized workspace.', parameters: { type: 'object', additionalProperties: false, required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' }, expectedSha256: { type: ['string', 'null'] } } } } },
  { type: 'function', function: { name: 'fs.patch', description: 'Apply or dry-run one exact unified diff, including rename-only patches, with optional hash precondition.', parameters: { type: 'object', additionalProperties: false, required: ['patch'], properties: { patch: { type: 'string' }, expectedSha256: { type: ['string', 'null'] }, dryRun: { type: 'boolean' } } } } },
  { type: 'function', function: { name: 'fs.patchSet', description: 'Apply or dry-run a bounded all-or-rollback set of unified diffs with file/line budgets, generated/comment/conflict guards, touched-file formatting, minimal diffs, and metrics.', parameters: { type: 'object', additionalProperties: false, required: ['patches'], properties: { patches: { type: 'array', minItems: 1, maxItems: 32, items: { type: 'object', additionalProperties: false, required: ['patch'], properties: { patch: { type: 'string' }, expectedSha256: { type: ['string', 'null'] } } } }, maxFiles: { type: 'integer', minimum: 1, maximum: 32 }, maxChangedLines: { type: 'integer', minimum: 1, maximum: 20000 }, conflictPolicy: { type: 'string', enum: ['reject', 'preserve', 'resolve'] }, formatter: { type: 'object', additionalProperties: false, required: ['command', 'args'], properties: { command: { type: 'string' }, args: { type: 'array', minItems: 1, maxItems: 32, items: { type: 'string' } } } }, dryRun: { type: 'boolean' } } } } },
  { type: 'function', function: { name: 'fs.delete', description: 'Delete one authorized regular file.', parameters: { type: 'object', additionalProperties: false, required: ['path'], properties: { path: { type: 'string' } } } } },
  { type: 'function', function: { name: 'fs.rename', description: 'Atomically rename or move one authorized path without overwriting.', parameters: { type: 'object', additionalProperties: false, required: ['from', 'to'], properties: { from: { type: 'string' }, to: { type: 'string' } } } } },
  { type: 'function', function: { name: 'fs.mkdir', description: 'Create an authorized directory.', parameters: { type: 'object', additionalProperties: false, required: ['path'], properties: { path: { type: 'string' }, recursive: { type: 'boolean' } } } } },
  { type: 'function', function: { name: 'fs.rmdir', description: 'Remove one authorized empty directory.', parameters: { type: 'object', additionalProperties: false, required: ['path'], properties: { path: { type: 'string' } } } } },
  {
    type: 'function',
    function: {
      name: 'process.run',
      description: 'Run an allowlisted executable using argv and bounded stdin, never a shell string.',
      parameters: {
        type: 'object', additionalProperties: false, required: ['command', 'args'],
        properties: {
          command: { type: 'string' },
          args: { type: 'array', items: { type: 'string' } },
          cwd: { type: 'string' },
          timeoutMs: { type: 'integer' },
          stdin: { type: 'string' },
          env: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'process.startManaged',
      description: 'Start one governed development server with a stable ID, positive PID, bounded output, and broker-owned cleanup.',
      parameters: {
        type: 'object', additionalProperties: false, required: ['id', 'command', 'args'],
        properties: {
          id: { type: 'string', minLength: 1, maxLength: 120, pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$' },
          command: { type: 'string', minLength: 1, maxLength: 4096 },
          args: { type: 'array', maxItems: 128, items: { type: 'string', maxLength: 8192 } },
          cwd: { type: 'string' },
          stdin: { type: 'string' },
          env: { type: 'object', additionalProperties: { type: 'string' } },
          commandClass: { const: 'dev-server' },
          startupDelayMs: { type: 'integer', minimum: 0, maximum: 5000 },
        },
      },
    },
  },
  { type: 'function', function: { name: 'process.stopManaged', description: 'Stop one broker-owned managed process by stable ID and terminate its process group.', parameters: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 120 } } } } },
  { type: 'function', function: { name: 'process.listManaged', description: 'List managed processes visible to the current task principal.', parameters: { type: 'object', additionalProperties: false, properties: {} } } },
]);

const DYNAMIC_TOOL_DISCOVERY_SCHEMAS = Object.freeze([
  Object.freeze({ type: 'function', function: Object.freeze({
    name: 'tool.catalog.search',
    description: 'Search summaries of authorized tools without loading their full schemas into the model context.',
    parameters: Object.freeze({ type: 'object', additionalProperties: false, required: ['query'], properties: { query: { type: 'string', minLength: 1, maxLength: 1000 }, limit: { type: 'integer', minimum: 1, maximum: 50 } } }),
  }) }),
  Object.freeze({ type: 'function', function: Object.freeze({
    name: 'tool.catalog.load',
    description: 'Load one exact authorized tool schema for use on subsequent turns.',
    parameters: Object.freeze({ type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string', minLength: 1, maxLength: 128 } } }),
  }) }),
]);

function catalogReceipt({ tool, input, output, refs }) {
  const base = {
    schema: 'forge.dynamic-tool-catalog-receipt.v1',
    tool,
    status: 'pass',
    requestSha256: canonicalSha256(input),
    outputSha256: canonicalSha256(output),
    refs,
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

function transient(error) {
  return /\b(408|409|425|429|500|502|503|504)\b|timed out|timeout|temporar|rate limit|ECONNRESET|EAI_AGAIN/i.test(String(error?.message ?? error));
}

function toolTarget(name, args) {
  const input = args && typeof args === 'object' ? args : {};
  if (['fs.read', 'fs.write', 'fs.delete', 'fs.mkdir', 'fs.rmdir'].includes(name)) return String(input.path ?? '').slice(0, 240) || null;
  if (name === 'fs.readMany') return (Array.isArray(input.paths) ? input.paths.join(', ') : '').slice(0, 240) || null;
  if (name === 'fs.rename') return `${String(input.from ?? '')} → ${String(input.to ?? '')}`.slice(0, 240) || null;
  if (name === 'fs.search') return (Array.isArray(input.paths) ? input.paths.join(', ') : '.').slice(0, 240) || null;
  if (name === 'fs.patchSet') {
    const headers = (Array.isArray(input.patches) ? input.patches : []).map((entry) => String(entry?.patch ?? '').split(/\r?\n/).find((line) => line.startsWith('+++ '))).filter(Boolean).map((line) => line.slice(4).replace(/^b\//, '').trim());
    return headers.join(', ').slice(0, 240) || null;
  }
  if (name === 'fs.patch') {
    const patch = String(input.patch ?? '');
    const header = patch.split(/\r?\n/).find((line) => line.startsWith('+++ '));
    const parsed = header ? header.slice(4).replace(/^b\//, '').trim() : '';
    return parsed.slice(0, 240) || String(input.path ?? '').slice(0, 240) || null;
  }
  if (name === 'process.run') return [String(input.command ?? ''), String(input.cwd ?? '.')].filter(Boolean).join(' · ').slice(0, 240) || null;
  return String(input.target ?? input.url ?? '').slice(0, 240) || null;
}

function toolResultMeta(result) {
  const output = result?.output && typeof result.output === 'object' ? result.output : {};
  return {
    durationMs: Number(result?.receipt?.durationMs ?? 0),
    exitCode: Number.isInteger(output.exitCode) ? output.exitCode : null,
    bytes: Number(output.bytes ?? 0),
    appliedHunks: Number(output.appliedHunks ?? output.metrics?.hunks ?? 0),
    matchCount: Array.isArray(output.matches) ? output.matches.length : 0,
    searchedFiles: Number(output.searchedFiles ?? 0),
    truncated: output.truncated === true,
  };
}

function providerRoutable(error) {
  return transient(error) || /ENOENT|not[- ]found|executable|command not found|not logged in|authentication|unauthorized|exited with 127/i.test(String(error?.message ?? error));
}

function cognitiveModeRequested(task) {
  const metadata = task?.metadata ?? {};
  const contexts = Array.isArray(metadata.cognitiveContexts) ? metadata.cognitiveContexts : [];
  const hypotheses = Array.isArray(metadata.cognitiveHypotheses) ? metadata.cognitiveHypotheses : [];
  const trigger = metadata.cognitiveMode === true
    || ['high', 'critical'].includes(String(metadata.riskLevel ?? '').toLowerCase())
    || (Array.isArray(metadata.recentFailures) && metadata.recentFailures.length >= 2)
    || (Array.isArray(metadata.unresolvedHypotheses) && metadata.unresolvedHypotheses.length >= 2);
  return trigger && contexts.length >= 1 && hypotheses.length >= 1;
}

function constructionModeRequested(task) {
  const metadata = task?.metadata ?? {};
  return metadata.constructionMode === true
    && metadata.constructionSpecification
    && typeof metadata.constructionSpecification === 'object';
}

function cognitiveErrorCategory(error, classification = null) {
  const code = String(error?.code ?? '');
  const failureClass = String(classification?.class ?? '');
  const message = String(error?.message ?? error);
  if (code === 'ENOENT' || /missing[- ]binary|command not found|exited with 127/i.test(`${failureClass} ${message}`)) return 'missing-binary';
  if (/stale.*symbol|symbol.*missing/i.test(`${failureClass} ${message}`)) return 'stale-symbol-memory';
  if (/criteria.*unmet|verification.*incomplete/i.test(`${failureClass} ${message}`)) return 'criteria-unmet';
  if (/timeout|timed out|ETIMEDOUT/i.test(`${code} ${failureClass} ${message}`)) return 'timeout';
  return 'environment-failure';
}


const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  const abort = () => { clearTimeout(timer); reject(new Error('Run cancelled')); };
  if (signal?.aborted) abort(); else signal?.addEventListener?.('abort', abort, { once: true });
});

export class AgentLoop {
  constructor({ forge, providers, router = null, repositoryIndex = null, instructionDiscovery = null, instructionPolicy = null, memoryService = null, evidenceContextRuntime = null, pluginService = null, contentIngress = null, skillContextResolver = null, mcpGateway = null, browserGateway = null, goalGateway = null, forgeGateway = null, operatingPlaneGateway = null, adaptiveIntelligenceGateway = null, dynamicToolCatalog = null, hookEngineFactory = null, verificationClaimGuard = new VerificationClaimGuard(), harnessComposer = null, harnessFailureStore = null, harnessFailureClassifier = null, contextEscalationController = null, decisionPlane = null, modelObservationSink = null, broker, store, contextBuilder } = {}) {
    if (!forge || !providers || !broker || !store || !contextBuilder) throw new TypeError('AgentLoop dependencies are required');
    this.forge = forge;
    this.providers = providers;
    this.router = router;
    this.repositoryIndex = repositoryIndex;
    this.instructionDiscovery = instructionDiscovery;
    this.instructionPolicy = instructionPolicy;
    this.memoryService = memoryService;
    this.evidenceContextRuntime = evidenceContextRuntime;
    this.pluginService = pluginService;
    if (contentIngress !== null && typeof contentIngress?.screen !== 'function') throw new TypeError('contentIngress must expose screen()');
    this.contentIngress = contentIngress;
    if (skillContextResolver !== null && typeof skillContextResolver !== 'function') throw new TypeError('skillContextResolver must be a function');
    this.skillContextResolver = skillContextResolver;
    this.mcpGateway = mcpGateway;
    this.browserGateway = browserGateway;
    this.goalGateway = goalGateway;
    this.forgeGateway = forgeGateway;
    this.operatingPlaneGateway = operatingPlaneGateway;
    this.adaptiveIntelligenceGateway = adaptiveIntelligenceGateway;
    this.dynamicToolCatalog = dynamicToolCatalog;
    this.hookEngineFactory = hookEngineFactory;
    this.verificationClaimGuard = verificationClaimGuard;
    if (harnessComposer !== null && typeof harnessComposer?.compose !== 'function') throw new TypeError('harnessComposer must expose compose()');
    if (harnessFailureStore !== null && typeof harnessFailureStore?.record !== 'function') throw new TypeError('harnessFailureStore must expose record()');
    if (harnessFailureClassifier !== null && typeof harnessFailureClassifier !== 'function') throw new TypeError('harnessFailureClassifier must be a function');
    if (contextEscalationController !== null && (typeof contextEscalationController?.start !== 'function' || typeof contextEscalationController?.evaluate !== 'function')) throw new TypeError('contextEscalationController must expose start() and evaluate()');
    if (decisionPlane !== null && (typeof decisionPlane?.startCognitiveTask !== 'function' || typeof decisionPlane?.observeCognitiveEvent !== 'function' || typeof decisionPlane?.proposeCognitiveAction !== 'function')) throw new TypeError('decisionPlane must expose cognitive task operations');
    if (modelObservationSink !== null && typeof modelObservationSink !== 'function') throw new TypeError('modelObservationSink must be a function');
    this.harnessComposer = harnessComposer;
    this.harnessFailureStore = harnessFailureStore;
    this.harnessFailureClassifier = harnessFailureClassifier;
    this.contextEscalationController = contextEscalationController;
    this.decisionPlane = decisionPlane;
    this.modelObservationSink = modelObservationSink;
    this.broker = broker;
    this.store = store;
    this.contextBuilder = contextBuilder;
  }

  #event(type, payload, refs) { return this.store.appendEvent(createEvent(type, payload, refs)); }

  async run(task, { providerId, signal = null, budgets = {}, retryDelaysMs = [250, 1_000], tools = CORE_TOOL_SCHEMAS, model = undefined, effort = undefined } = {}) {
    const budget = new RunBudget({ ...budgets, signal });
    budget.assertActive();
    const providerOptions = {
      providerId: providerId ?? 'auto',
      requiredCapabilities: task.metadata?.providerConstraints?.requiredCapabilities ?? ['coding', 'governed-actions'],
      localOnly: task.metadata?.providerConstraints?.localOnly === true,
      maxCostTier: task.metadata?.providerConstraints?.maxCostTier ?? Number.POSITIVE_INFINITY,
      prefer: task.metadata?.providerConstraints?.prefer ?? [],
    };
    const candidates = this.router
      ? this.router.rank(providerOptions).filter((entry) => entry.eligible).map((entry) => entry.provider)
      : [this.providers.get(providerId)];
    if (!candidates.length) this.router?.select(providerOptions);
    let provider = candidates[0];
    let providerIndex = 0;
    const run = this.store.createRun({ taskId: task.id, providerId: provider.id, state: 'routing', checkpoint: { turn: 0, receipts: [] } });
    const refs = { projectId: task.projectId, taskId: task.id, runId: run.id };
    const screenContent = (sourceKind, sourceId, content) => {
      if (!this.contentIngress) {
        const raw = String(content ?? '');
        return Object.freeze({ status: 'pass', safeText: raw, contentIncluded: true, contentSha256: canonicalSha256(raw), receiptSha256: null, findings: Object.freeze([]) });
      }
      const result = this.contentIngress.screen({ sourceKind, sourceId, content });
      this.#event('security.content-ingress', {
        sourceKind: result.sourceKind,
        sourceId: result.sourceId,
        status: result.status,
        findings: result.findings,
        contentSha256: result.contentSha256,
        receiptSha256: result.receiptSha256,
        contentIncluded: result.contentIncluded,
      }, refs);
      return result;
    };
    const screenItem = (item, sourceKind, fallbackId, index = 0) => {
      const original = typeof item === 'string' ? { id: `${fallbackId}:${index}`, text: item } : (item ?? {});
      const rawText = original.text ?? original.content;
      if (rawText === undefined || rawText === null) return original;
      const sourceId = original.id ?? original.path ?? original.sourcePath ?? original.name ?? `${fallbackId}:${index}`;
      const screened = screenContent(sourceKind, sourceId, rawText);
      if (screened.status === 'pass') {
        return {
          ...original,
          text: screened.safeText,
          sha256: original.sha256 ?? screened.contentSha256,
        };
      }
      return {
        ...original,
        text: screened.safeText,
        sha256: screened.contentSha256,
        metadata: {
          ...(original.metadata ?? {}),
          contentIngress: {
            status: screened.status,
            receiptSha256: screened.receiptSha256,
            contentIncluded: screened.contentIncluded,
          },
        },
      };
    };
    const screenItems = (items, sourceKind, fallbackId) => (Array.isArray(items) ? items : []).map((item, index) => screenItem(item, sourceKind, fallbackId, index));
    const project = this.store.getProject(task.projectId);
    if (!project) throw new Error(`Unknown project: ${task.projectId}`);
    const projectRoot = task.metadata?.executionWorkspace ?? project.workspaceRoot;
    const hookEngine = this.hookEngineFactory
      ? await this.hookEngineFactory({ task, project, projectRoot })
      : null;
    const receipts = [];
    const activity = new RunActivityTracker({ duplicateLimit: task.metadata?.duplicateActionLimit ?? 3, maxEntries: task.metadata?.activityMaxEntries ?? 1000 });
    let messages = [];
    let output = '';
    let turn = 0;
    const baseToolAllowlist = Array.isArray(task.metadata?.allowedToolNames)
      ? new Set(task.metadata.allowedToolNames.map(String))
      : null;
    const baseTools = baseToolAllowlist
      ? tools.filter((schema) => baseToolAllowlist.has(schema.function.name))
      : tools;
    let activeTools = baseTools;
    const dynamicToolDiscovery = task.metadata?.dynamicToolDiscovery === true && this.dynamicToolCatalog;
    let authorizedToolSchemas = new Map(baseTools.map((schema) => [schema.function.name, schema]));
    let mcpToolNames = new Set();
    let browserToolNames = new Set();
    let goalToolNames = new Set();
    let forgeToolNames = new Set();
    let operatingPlaneToolNames = new Set();
    let adaptiveIntelligenceToolNames = new Set();
    let sessionEnded = false;
    let contextEscalationState = this.contextEscalationController?.start({ budgetTokens: task.metadata?.initialContextBudgetTokens });
    const repositoryEvidenceKeys = new Set();
    const cognitiveActive = Boolean(this.decisionPlane && cognitiveModeRequested(task));
    const constructionActive = Boolean(this.decisionPlane && constructionModeRequested(task));
    let constructionSpecification = null;
    const cognitiveTaskId = cognitiveActive ? `${task.id}:${run.id}` : null;
    let recentCognitiveRecommendation = null;
    if (cognitiveActive) {
      this.decisionPlane.startCognitiveTask({
        taskId: cognitiveTaskId,
        goal: task.objective,
        recoveryLeaseId: `recovery:${run.id}`,
        contexts: task.metadata.cognitiveContexts,
        hypotheses: task.metadata.cognitiveHypotheses,
      });
      this.#event('agent.cognition.activated', { cognitiveTaskId, contextCount: task.metadata.cognitiveContexts.length, hypothesisCount: task.metadata.cognitiveHypotheses.length }, refs);
    }

    if (constructionActive) {
      constructionSpecification = this.decisionPlane.compileConstructionSpecification(task.metadata.constructionSpecification);
      if (constructionSpecification.status !== 'ready' || constructionSpecification.editAuthorized !== true) {
        this.#event('agent.construction.blocked', {
          specificationId: constructionSpecification.specificationId,
          status: constructionSpecification.status,
          conflictCount: constructionSpecification.conflicts.length,
          specificationReceiptSha256: constructionSpecification.receiptSha256,
        }, refs);
        throw new Error('Construction specification is blocked');
      }
      this.#event('agent.construction.activated', {
        specificationId: constructionSpecification.specificationId,
        criterionCount: constructionSpecification.criteria.length,
        specificationReceiptSha256: constructionSpecification.receiptSha256,
      }, refs);
    }

    const hookContext = () => ({
      taskId: task.id,
      projectId: task.projectId,
      profileId: task.metadata?.agentProfileId ?? task.role ?? '',
      availableTools: activeTools.map((schema) => schema.function.name),
    });
    const runHook = async (eventName, payload = {}) => {
      if (!hookEngine) return null;
      const result = await hookEngine.run(eventName, payload, hookContext());
      this.#event('agent.hook.completed', {
        eventName,
        decision: result?.decision ?? 'allow',
        reason: result?.reason ?? '',
        audit: result?.audit ?? [],
      }, refs);
      if (result?.decision === 'deny') {
        const error = new Error(result.reason || `Lifecycle hook denied ${eventName}`);
        error.code = 'HOOK_POLICY_DENIED';
        error.details = Object.freeze({ eventName, audit: result.audit ?? [] });
        throw error;
      }
      return result;
    };
    const endHookSession = async (state, details = {}) => {
      if (!hookEngine || sessionEnded) return;
      sessionEnded = true;
      await runHook('SessionEnd', { state, turn, receiptCount: receipts.length, ...details });
    };
    try {
      this.#event('agent.routing.started', { objective: task.objective }, refs);
      if (this.mcpGateway) {
        const mcpSchemas = await this.mcpGateway.schemasForTask(task);
        activeTools = Object.freeze([...baseTools, ...mcpSchemas]);
        mcpToolNames = new Set(mcpSchemas.map((schema) => schema.function.name));
        if (mcpSchemas.length) this.#event('agent.mcp.tools-authorized', { tools: [...mcpToolNames] }, refs);
      }
      if (this.browserGateway) {
        const browserSchemas = this.browserGateway.schemasForTask(task);
        activeTools = Object.freeze([...activeTools, ...browserSchemas]);
        browserToolNames = new Set(browserSchemas.map((schema) => schema.function.name));
        if (browserSchemas.length) this.#event('agent.browser.tools-authorized', { tools: [...browserToolNames] }, refs);
      }
      if (this.goalGateway) {
        const goalSchemas = this.goalGateway.schemasForTask(task);
        activeTools = Object.freeze([...activeTools, ...goalSchemas]);
        goalToolNames = new Set(goalSchemas.map((schema) => schema.function.name));
        if (goalSchemas.length) this.#event('agent.goal.tools-authorized', { tools: [...goalToolNames], goalId: task.metadata?.goalId ?? null }, refs);
      }
      if (this.forgeGateway) {
        const forgeSchemas = this.forgeGateway.schemasForTask(task);
        activeTools = Object.freeze([...activeTools, ...forgeSchemas]);
        forgeToolNames = new Set(forgeSchemas.map((schema) => schema.function.name));
        if (forgeSchemas.length) this.#event('agent.forgeos.tools-authorized', { tools: [...forgeToolNames] }, refs);
      }
      if (this.operatingPlaneGateway) {
        const operatingPlaneSchemas = this.operatingPlaneGateway.schemasForTask(task);
        activeTools = Object.freeze([...activeTools, ...operatingPlaneSchemas]);
        operatingPlaneToolNames = new Set(operatingPlaneSchemas.map((schema) => schema.function.name));
        if (operatingPlaneSchemas.length) this.#event('agent.operating-plane.tools-authorized', { tools: [...operatingPlaneToolNames] }, refs);
      }
      if (this.adaptiveIntelligenceGateway) {
        const adaptiveSchemas = this.adaptiveIntelligenceGateway.schemasForTask(task);
        activeTools = Object.freeze([...activeTools, ...adaptiveSchemas]);
        adaptiveIntelligenceToolNames = new Set(adaptiveSchemas.map((schema) => schema.function.name));
        if (adaptiveSchemas.length) this.#event('agent.adaptive-intelligence.tools-authorized', { tools: [...adaptiveIntelligenceToolNames] }, refs);
      }
      authorizedToolSchemas = new Map(activeTools.map((schema) => [schema.function.name, schema]));
      if (dynamicToolDiscovery) {
        const pinned = new Set(this.dynamicToolCatalog.baseSchemas().map((schema) => schema.function.name));
        activeTools = Object.freeze([
          ...[...authorizedToolSchemas.values()].filter((schema) => pinned.has(schema.function.name)),
          ...DYNAMIC_TOOL_DISCOVERY_SCHEMAS,
        ]);
        this.#event('agent.tool-catalog.enabled', { authorizedToolCount: authorizedToolSchemas.size, initiallyLoaded: activeTools.map((schema) => schema.function.name) }, refs);
      }
      const sessionStartHook = await runHook('SessionStart', {
        objective: task.objective,
        toolNames: activeTools.map((schema) => schema.function.name),
        projectRoot,
      });
      const hookReferences = (sessionStartHook?.additionalContext ?? []).map((text, index) => ({
        id: `hook:${index}:${canonicalSha256(text).slice(0, 16)}`,
        text: `[governed-lifecycle-hook]\n${text}`,
        sha256: canonicalSha256(text),
        priority: 990,
        metadata: { trust: 'governed-hook', eventName: 'SessionStart' },
      }));
      let repositoryContext = { items: [], omissions: [] };
      if (this.repositoryIndex) {
        const indexedProject = task.metadata?.executionWorkspace ? { ...project, workspaceRoot: task.metadata.executionWorkspace } : project;
        const indexResult = await this.repositoryIndex.index(indexedProject);
        const configuredMaxChars = task.metadata?.repositoryContextMaxChars ?? 24_000;
        repositoryContext = await this.repositoryIndex.contextForTask(project.id, {
          objective: task.objective,
          changedPaths: task.metadata?.changedPaths ?? [],
          maxChars: contextEscalationState ? Math.min(configuredMaxChars, contextEscalationState.budgetTokens * 4) : configuredMaxChars,
          maxFiles: task.metadata?.repositoryContextMaxFiles ?? 12,
        });
        for (const item of repositoryContext.items) repositoryEvidenceKeys.add(`${item.path}:${item.sha256}`);
        this.#event('agent.repository.context-selected', { index: indexResult, selected: repositoryContext.items.map((item) => ({ path: item.path, sha256: item.sha256, score: item.score })), omissions: repositoryContext.omissions }, refs);
      }
      const repositoryCode = repositoryContext.items.map((item) => screenItem({ id: `repo:${item.path}`, text: item.text, sha256: item.sha256, priority: Math.max(1, Math.min(1_000, Number(item.score) || 1)), metadata: { path: item.path, language: item.language ?? 'text', truncated: item.truncated === true } }, 'repository', `repo:${item.path}`));
      let instructionReferences = [];
      let instructionOmissions = [];
      if (this.instructionDiscovery) {
        const instructionRoot = task.metadata?.executionWorkspace ?? project.workspaceRoot;
        const records = await this.instructionDiscovery.discover(instructionRoot, { projectId: task.projectId, taskId: task.id });
        const selected = this.instructionDiscovery.select(records, { paths: task.metadata?.changedPaths ?? [], maxChars: task.metadata?.instructionContextMaxChars ?? 16_000, includeWorkflows: false });
        instructionReferences = selected.items.map((item) => screenItem({ id: `project-instruction:${item.sourcePath}`, text: item.text, sha256: item.sha256, priority: 950, metadata: { sourcePath: item.sourcePath, source: item.source, trust: item.trust, globs: item.globs ?? [] } }, 'instruction', `project-instruction:${item.sourcePath}`));
        instructionOmissions = selected.omissions ?? [];
        this.#event('agent.instructions.selected', { selected: instructionReferences.map((item) => ({ id: item.id, sourcePath: item.metadata.sourcePath, sha256: item.sha256 })), omissions: instructionOmissions }, refs);
      }
      let instructionPolicyReferences = [];
      if (this.instructionPolicy?.resolve) {
        const policy = await this.instructionPolicy.resolve({
          projectId: task.projectId,
          principalId: `agent:${task.id}`,
          paths: task.metadata?.changedPaths ?? [],
          language: task.metadata?.language ?? null,
          taskType: task.role ?? task.metadata?.taskType ?? null,
          includeWorkflows: false,
        });
        const summary = {
          effectiveRules: policy.effectiveRules,
          unresolvedConflicts: policy.conflicts.filter((item) => item.resolved !== true),
          invalidRecords: policy.invalidRecords.map((item) => ({ sourcePath: item.sourcePath, issues: item.issues })),
          receiptSha256: policy.receiptSha256,
        };
        if (Object.keys(policy.effectiveRules).length || summary.unresolvedConflicts.length || summary.invalidRecords.length) {
          instructionPolicyReferences = [{
            id: `instruction-policy:${policy.receiptSha256 ?? task.id}`,
            text: `[governed-instruction-policy]
${JSON.stringify(summary)}`,
            sha256: policy.receiptSha256 ?? canonicalSha256(summary),
            priority: 960,
            metadata: { trust: 'governed-instruction-policy', selectedCount: policy.selected.length, conflictCount: policy.conflicts.length },
          }];
        }
        this.#event('agent.instruction-policy.resolved', { receiptSha256: policy.receiptSha256, selectedCount: policy.selected.length, effectiveRuleCount: Object.keys(policy.effectiveRules).length, conflicts: policy.conflicts.length, invalidRecords: policy.invalidRecords.length, omissions: policy.omissions }, refs);
      }
      let pluginReferences = [];
      let pluginOmissions = [];
      if (this.pluginService?.contextForProject) {
        const pluginContext = await this.pluginService.contextForProject(task.projectId, {
          maxItems: task.metadata?.pluginContextMaxItems ?? 24,
          maxChars: task.metadata?.pluginContextMaxChars ?? 24_000,
        });
        pluginReferences = pluginContext.items.map((item) => screenItem({
          id: `plugin:${item.pluginId}:${item.kind}:${item.name}`,
          text: `[untrusted-community-plugin plugin=${item.pluginName} kind=${item.kind} name=${item.name}]
${item.text}`,
          sha256: item.contentSha256,
          priority: item.kind === 'skill' ? 880 : item.kind === 'agent' ? 820 : 760,
          metadata: { pluginId: item.pluginId, pluginName: item.pluginName, pluginVersion: item.pluginVersion, kind: item.kind, name: item.name, sourcePath: item.sourcePath, contentSha256: item.contentSha256, trust: item.trust, truncated: item.truncated },
        }, 'plugin', `plugin:${item.pluginId}:${item.kind}:${item.name}`));
        pluginOmissions = pluginContext.omissions ?? [];
        if (pluginReferences.length) this.#event('agent.plugins.selected', { plugins: [...new Set(pluginReferences.map((item) => item.metadata.pluginId))], selected: pluginReferences.map((item) => ({ id: item.id, sourcePath: item.metadata.sourcePath, contentSha256: item.metadata.contentSha256 })), omissions: pluginOmissions }, refs);
      }
      const selectedSkillReferences = [];
      const selectedSkillRecords = Array.isArray(task.metadata?.selectedSkills) ? task.metadata.selectedSkills.slice(0, 8) : [];
      if (selectedSkillRecords.length) {
        if (!this.skillContextResolver) throw new Error('selected skill context resolver is unavailable');
        for (const selected of selectedSkillRecords) {
          const id = String(selected?.id ?? '').trim();
          if (!id) throw new Error('selected skill id is required');
          const loaded = await this.skillContextResolver(id);
          if (String(loaded?.id ?? '') !== id || typeof loaded?.content !== 'string' || !String(loaded?.contentSha256 ?? '')) throw new Error(`selected skill could not be loaded: ${id}`);
          const expectedHash = String(selected?.contentSha256 ?? '').trim();
          if (expectedHash && expectedHash !== loaded.contentSha256) throw new Error(`selected skill content changed since mission planning: ${id}`);
          const content = loaded.content.slice(0, 20_000);
          selectedSkillReferences.push(screenItem({
            id: `selected-skill:${id}`,
            text: `[user-selected-skill id=${id} source=${String(loaded.source ?? 'unknown')} catalog=${String(loaded.catalog ?? 'unknown')} provenance=${String(loaded.provenanceStatus ?? 'unknown')}]\n${content}`,
            sha256: loaded.contentSha256,
            priority: 930,
            metadata: { skillId: id, source: loaded.source ?? null, catalog: loaded.catalog ?? null, provenanceStatus: loaded.provenanceStatus ?? null, contentSha256: loaded.contentSha256, receiptSha256: loaded.receiptSha256 ?? null, trust: 'user-selected-skill-untrusted', truncated: loaded.content.length > content.length },
          }, 'selected-skill', `selected-skill:${id}`));
        }
        this.#event('agent.skills.selected', { selected: selectedSkillReferences.map((item) => ({ id: item.metadata.skillId, contentSha256: item.metadata.contentSha256, receiptSha256: item.metadata.receiptSha256, provenanceStatus: item.metadata.provenanceStatus })), count: selectedSkillReferences.length }, refs);
      }
      const dependencyReferences = task.dependencies
        .map((dependencyId) => this.store.getTask(dependencyId))
        .filter((dependency) => dependency?.metadata?.handoff)
        .slice(0, 16)
        .map((dependency) => screenItem({
          id: `handoff:${dependency.id}`,
          text: `[untrusted-agent-handoff]
${JSON.stringify(dependency.metadata.handoff).slice(0, 12_000)}`,
          sha256: dependency.metadata.handoff.handoffSha256,
          priority: 900,
          metadata: { sourceTaskId: dependency.id, sourceRole: dependency.role, trust: 'untrusted-until-verified' },
        }, 'handoff', `handoff:${dependency.id}`));
      const activeMemoryRaw = this.memoryService ? await this.memoryService.context(task.projectId, task.objective, {
        maxItems: task.metadata?.memoryMaxItems ?? 8,
        maxChars: task.metadata?.memoryMaxChars ?? 12_000,
      }) : [];
      const activeMemory = screenItems(activeMemoryRaw, 'memory', 'active-memory');
      const evidenceReferences = [];
      if (this.evidenceContextRuntime?.agentReference) {
        const role = ['planner', 'executor', 'reviewer', 'debugger', 'subagent'].includes(task.role) ? task.role : (task.metadata?.parentTaskId ? 'subagent' : 'executor');
        const reference = await this.evidenceContextRuntime.agentReference({
          projectId: task.projectId,
          principalId: `agent:${task.id}`,
          taskId: task.id,
          planId: task.metadata?.planId ?? task.missionId ?? task.id,
          role,
          goal: { objective: task.objective },
          currentState: { status: task.status, changedPaths: task.metadata?.changedPaths ?? [], turn: 0 },
          constraints: task.metadata?.constraints ?? [],
          planStep: task.metadata?.currentPlanStep ?? {},
          hypothesis: task.metadata?.hypothesis ?? null,
          relevantSymbols: task.metadata?.relevantSymbols ?? [],
          recentFailures: task.metadata?.recentFailures ?? [],
          availableTools: activeTools.map((schema) => schema.function.name),
          completionCriteria: task.metadata?.completionCriteria ?? task.metadata?.taskContract?.completionCriteria ?? [],
          budgetTokens: task.metadata?.evidenceContextBudgetTokens,
        });
        evidenceReferences.push(reference);
        this.#event('agent.evidence-context.selected', { id: reference.id, sha256: reference.sha256, metadata: reference.metadata ?? {} }, refs);
      }
      const contextModel = model ?? provider.model ?? 'gpt-5.6';
      const contextPack = await this.forge.buildContextPack({
        query: task.objective,
        task: task.objective,
        domains: task.metadata?.domains ?? ['ai-agent-engineering'],
        taskClass: task.metadata?.taskClass ?? 'implementation',
        tools: ['filesystem', 'shell', 'git', 'node', 'planning', ...(mcpToolNames.size ? ['mcp'] : []), ...(browserToolNames.size ? ['browser'] : []), ...(goalToolNames.size ? ['goal-management'] : []), ...(forgeToolNames.size ? ['forgeos'] : []), ...(operatingPlaneToolNames.size ? ['agent-operating-plane'] : []), ...(adaptiveIntelligenceToolNames.size ? ['adaptive-intelligence'] : [])],
        model: contextModel,
        code: [...screenItems(task.metadata?.code, 'repository', 'task-code'), ...repositoryCode],
        memory: [...screenItems(task.metadata?.memory, 'memory', 'task-memory'), ...activeMemory],
        references: [...screenItems(task.metadata?.references, 'reference', 'task-reference'), ...hookReferences, ...instructionReferences, ...instructionPolicyReferences, ...selectedSkillReferences, ...pluginReferences, ...dependencyReferences, ...evidenceReferences],
      });
      const built = this.contextBuilder.build(contextPack, { task, extraOmissions: [...repositoryContext.omissions, ...instructionOmissions, ...pluginOmissions] });
      messages = [...built.messages];
      this.store.updateRun(run.id, { state: 'running', checkpoint: { turn, contextPackSha256: contextPack.contextPackSha256, routePlanSha256: contextPack.routePlan.routePlanSha256, receipts } });
      this.#event('agent.routing.completed', { routePlanSha256: contextPack.routePlan.routePlanSha256, contextPackSha256: contextPack.contextPackSha256, omissions: built.omissions }, refs);
      await runHook('BeforeAgent', { objective: task.objective, contextPackSha256: contextPack.contextPackSha256 });

      let activeHarness = null;
      let lastHarnessFailure = null;
      while (true) {
        budget.consumeTurn();
        turn += 1;
        let response;
        for (let attempt = 0; ; attempt += 1) {
          const composed = this.harnessComposer
            ? this.harnessComposer.compose({ provider, messages, tools: activeTools, task, failure: lastHarnessFailure })
            : Object.freeze({ messages, tools: activeTools, profileId: null, profileRevision: null, profileSha256: null, harnessFamily: provider.harnessFamily ?? null, receiptSha256: null });
          activeHarness = composed;
          if (attempt === 0) this.#event('agent.model.requested', { turn, providerId: provider.id, ...(model ? { model } : {}), ...(effort ? { effort } : {}), harnessFamily: composed.harnessFamily, harnessProfileId: composed.profileId, harnessRevision: composed.profileRevision, harnessProfileSha256: composed.profileSha256, harnessReceiptSha256: composed.receiptSha256 }, refs);
          await runHook('BeforeModel', { turn, providerId: provider.id, messageCount: composed.messages.length, harnessProfileId: composed.profileId, harnessRevision: composed.profileRevision });
          const requestStartedAt = performance.now();
          try {
            response = await provider.complete({ messages: composed.messages, tools: composed.tools, cwd: projectRoot, ...(model ? { model } : {}), ...(effort ? { effort } : {}), signal, leaseContext: { missionId: task.missionId, taskId: task.id, role: task.role ?? 'executor', harnessProfileId: composed.profileId, harnessRevision: composed.profileRevision } });
            this.router?.recordSuccess(provider.id);
            try {
              const usage = response?.usage ?? {};
              this.modelObservationSink?.({
                providerId: provider.id,
                modelId: response?.model ?? model ?? provider.id,
                observation: {
                  success: true,
                  latencyMs: Math.max(0, Math.round(performance.now() - requestStartedAt)),
                  inputTokens: Number(usage.promptTokens ?? usage.inputTokens ?? 0) || 0,
                  outputTokens: Number(usage.completionTokens ?? usage.outputTokens ?? 0) || 0,
                  toolSuccess: Array.isArray(response?.toolCalls),
                  at: new Date().toISOString(),
                  scope: { missionId: task.missionId ?? null, taskId: task.id, providerId: provider.id, returnedProviderId: response?.providerId ?? null, finishReason: response?.finishReason ?? null, harnessProfileId: composed.profileId ?? null, harnessRevision: composed.profileRevision ?? null },
                },
              });
            } catch (observationError) {
              this.#event('agent.model.observation-failed', { providerId: provider.id, code: String(observationError?.code ?? 'observation-failed').slice(0, 128) }, refs);
            }
            lastHarnessFailure = null;
            break;
          } catch (error) {
            try {
              this.modelObservationSink?.({ providerId: provider.id, modelId: model ?? provider.id, observation: { success: false, latencyMs: Math.max(0, Math.round(performance.now() - requestStartedAt)), errorCode: String(error?.code ?? error?.name ?? 'provider-error').slice(0, 128), at: new Date().toISOString(), scope: { missionId: task.missionId ?? null, taskId: task.id, providerId: provider.id, harnessProfileId: composed.profileId ?? null, harnessRevision: composed.profileRevision ?? null } } });
            } catch (observationError) {
              this.#event('agent.model.observation-failed', { providerId: provider.id, code: String(observationError?.code ?? 'observation-failed').slice(0, 128) }, refs);
            }
            let classification = null;
            if (this.harnessFailureClassifier) {
              classification = this.harnessFailureClassifier(error, { providerId: provider.id, profileId: composed.profileId ?? 'none' });
              lastHarnessFailure = classification;
              this.#event('agent.harness.failure-classified', { turn, attempt: attempt + 1, providerId: provider.id, harnessProfileId: composed.profileId, failureClass: classification.class, retryable: classification.retryable, fingerprint: classification.fingerprint }, refs);
              if (this.harnessFailureStore && composed.profileId) {
                try {
                  this.harnessFailureStore.record({ providerId: provider.id, harnessFamily: composed.harnessFamily ?? 'generic-local', profileId: composed.profileId, profileRevision: composed.profileRevision ?? 1, taskKind: task.metadata?.taskKind ?? task.role ?? 'general', failureClass: classification.class, retryable: classification.retryable, fingerprint: classification.fingerprint, missionId: task.missionId ?? null, taskId: task.id, evidenceReceiptSha256: composed.receiptSha256, occurredAt: Date.now() });
                } catch (telemetryError) {
                  this.#event('agent.harness.telemetry-failed', { turn, providerId: provider.id, harnessProfileId: composed.profileId, reason: String(telemetryError?.message ?? telemetryError).slice(0, 240) }, refs);
                }
              }
            }
            if (cognitiveActive) {
              try {
                const errorObservation = this.decisionPlane.observeCognitiveEvent(cognitiveTaskId, {
                  eventId: `provider-error:${turn}:${attempt + 1}`,
                  type: 'error',
                  error: { category: cognitiveErrorCategory(error, classification), code: String(error?.code ?? '').slice(0, 128), operation: 'provider.complete' },
                });
                const proposal = this.decisionPlane.proposeCognitiveAction(cognitiveTaskId, {
                  uncertainty: Math.min(1, 0.55 + (attempt * 0.1)),
                  irreversibilityLimit: 0.3,
                  actions: task.metadata.cognitiveActions,
                });
                recentCognitiveRecommendation = Object.freeze({
                  selectedActionId: proposal.selectedActionId,
                  proposalId: proposal.proposalId,
                  receiptSha256: proposal.receiptSha256,
                  observationReceiptSha256: errorObservation.receiptSha256,
                });
                this.#event('agent.cognition.recommendation', recentCognitiveRecommendation, refs);
              } catch (cognitiveError) {
                this.#event('agent.cognition.failed', { reason: String(cognitiveError?.message ?? cognitiveError).slice(0, 240) }, refs);
              }
            }
            this.router?.recordFailure(provider.id, error);
            if (transient(error) && attempt < retryDelaysMs.length) {
              this.#event('agent.model.retrying', { turn, attempt: attempt + 1, providerId: provider.id, reason: String(error.message).slice(0, 300), harnessProfileId: composed.profileId, failureClass: classification?.class ?? null }, refs);
              await sleep(retryDelaysMs[attempt], signal);
              budget.assertActive();
              continue;
            }
            if (providerRoutable(error) && providerIndex + 1 < candidates.length) {
              const previous = provider;
              providerIndex += 1;
              provider = candidates[providerIndex];
              this.#event('agent.provider.fallback', { turn, from: previous.id, to: provider.id, reason: String(error.message).slice(0, 300), failureClass: classification?.class ?? null }, refs);
              attempt = -1;
              continue;
            }
            throw error;
          }
        }
        budget.consumeTokens(response.usage?.totalTokens ?? Math.ceil((response.text?.length ?? 0) / 4));
        activity.recordModel(response.usage ?? {});
        output = String(response.text ?? '');
        await runHook('AfterModel', { turn, providerId: provider.id, output, toolCalls: response.toolCalls ?? [], usage: response.usage ?? {} });
        messages.push({ role: 'assistant', content: output, ...(response.toolCalls?.length ? { tool_calls: response.toolCalls.map((call) => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.rawArguments ?? JSON.stringify(call.arguments) } })) } : {}) });
        this.#event('agent.model.completed', { turn, finishReason: response.finishReason ?? null, toolCallCount: response.toolCalls?.length ?? 0, usage: response.usage ?? {}, harnessProfileId: activeHarness?.profileId ?? null, harnessRevision: activeHarness?.profileRevision ?? null }, refs);

        if (!response.toolCalls?.length && contextEscalationState && this.repositoryIndex) {
          const escalation = this.contextEscalationController.evaluate(contextEscalationState, { confidence: response.confidence ?? response.metadata?.confidence, unresolvedHypotheses: response.unresolvedHypotheses ?? response.metadata?.unresolvedHypotheses ?? [], needsMoreContext: response.needsMoreContext === true || response.metadata?.needsMoreContext === true, signal });
          if (escalation.action === 'expand') {
            const configuredMaxChars = task.metadata?.repositoryContextMaxChars ?? 24_000;
            const expanded = await this.repositoryIndex.contextForTask(project.id, {
              objective: task.objective,
              changedPaths: task.metadata?.changedPaths ?? [],
              maxChars: Math.min(configuredMaxChars, escalation.nextState.budgetTokens * 4),
              maxFiles: task.metadata?.repositoryContextMaxFiles ?? 12,
            });
            const additional = expanded.items.filter((item) => !repositoryEvidenceKeys.has(`${item.path}:${item.sha256}`));
            if (additional.length) {
              for (const item of additional) repositoryEvidenceKeys.add(`${item.path}:${item.sha256}`);
              messages.push({ role: 'user', content: `[context-escalation:${escalation.nextState.stage}]\n${additional.map((item) => item.text).join('\n\n')}` });
              contextEscalationState = escalation.nextState;
              this.#event('agent.context.expanded', { stage: contextEscalationState.stage, budgetTokens: contextEscalationState.budgetTokens, reason: escalation.reason, added: additional.map((item) => ({ path: item.path, sha256: item.sha256 })) }, refs);
              continue;
            }
            this.#event('agent.context.expansion-empty', { stage: escalation.nextState.stage, reason: escalation.reason }, refs);
          }
        }

        if (!response.toolCalls?.length) {
          const activitySnapshot = activity.snapshot();
          const claimAssessment = this.verificationClaimGuard.assess({ output, receipts, activity: activitySnapshot, requiredCriterionIds: (task.metadata?.taskContract?.successCriteria ?? []).map((criterion) => String(criterion.id)) });
          output = claimAssessment.safeOutput;
          const proofStatus = claimAssessment.status === 'blocked-unverified-claims' ? 'blocked-unverified-claims' : 'unverified';
          this.#event('agent.completion.claims-assessed', { status: claimAssessment.status, assessmentSha256: claimAssessment.assessmentSha256, unsupportedClaims: claimAssessment.unsupportedClaims, undisclosedErrorCount: claimAssessment.undisclosedErrorCount }, refs);
          await runHook('AfterAgent', { output, turn, receiptCount: receipts.length, proofStatus, claimAssessmentSha256: claimAssessment.assessmentSha256 });
          const checkpoint = { turn, output, activeProviderId: provider.id, harness: activeHarness ? { profileId: activeHarness.profileId, revision: activeHarness.profileRevision, profileSha256: activeHarness.profileSha256, receiptSha256: activeHarness.receiptSha256 } : null, contextPackSha256: contextPack.contextPackSha256, routePlanSha256: contextPack.routePlan.routePlanSha256, receipts, budget: budget.snapshot(), activity: activitySnapshot, claimAssessment };
          this.store.updateRun(run.id, { state: 'awaiting-verification', checkpoint });
          this.#event('agent.completion.requested', { output, proofStatus, receiptCount: receipts.length, claimAssessmentSha256: claimAssessment.assessmentSha256 }, refs);
          await endHookSession('awaiting-verification', { output, proofStatus, claimAssessmentSha256: claimAssessment.assessmentSha256 });
          return Object.freeze({ runId: run.id, providerId: provider.id, harness: activeHarness ? Object.freeze({ profileId: activeHarness.profileId, revision: activeHarness.profileRevision, profileSha256: activeHarness.profileSha256, receiptSha256: activeHarness.receiptSha256 }) : null, state: 'awaiting-verification', output, receipts: Object.freeze([...receipts]), budget: budget.snapshot(), activity: activitySnapshot, claimAssessment, cognition: cognitiveActive ? Object.freeze({ active: true, cognitiveTaskId, recentRecommendation: recentCognitiveRecommendation, snapshotReceiptSha256: this.decisionPlane.cognitiveSnapshot(cognitiveTaskId)?.receiptSha256 ?? null }) : null, construction: constructionActive ? Object.freeze({ active: true, specificationId: constructionSpecification.specificationId, status: constructionSpecification.status, specificationReceiptSha256: constructionSpecification.receiptSha256, snapshotReceiptSha256: this.decisionPlane.constructionSnapshot()?.receiptSha256 ?? null }) : null, contextPackSha256: contextPack.contextPackSha256 });
        }

        budget.consumeToolCalls(response.toolCalls.length);
        const selectionHook = await runHook('BeforeToolSelection', { turn, toolCalls: response.toolCalls });
        const selectedCalls = Array.isArray(selectionHook?.payload?.toolCalls) ? selectionHook.payload.toolCalls : response.toolCalls;
        for (const call of selectedCalls) {
          const beforeTool = await runHook('BeforeTool', { toolName: call.name, arguments: call.arguments ?? {} });
          const effectiveName = String(beforeTool?.payload?.toolName ?? call.name);
          const effectiveArguments = beforeTool?.payload?.arguments && typeof beforeTool.payload.arguments === 'object'
            ? beforeTool.payload.arguments
            : (call.arguments ?? {});
          if (beforeTool?.allowedTools && !beforeTool.allowedTools.includes(effectiveName)) {
            const error = new Error(`Lifecycle hook removed authorization for tool: ${effectiveName}`);
            error.code = 'HOOK_POLICY_DENIED';
            throw error;
          }
          if (!activeTools.some((schema) => schema.function.name === effectiveName)) {
            const error = new Error(`Lifecycle hook selected an unauthorized tool: ${effectiveName}`);
            error.code = 'HOOK_TOOL_REWRITE_DENIED';
            throw error;
          }
          activity.assertActionAllowed({ tool: effectiveName, input: effectiveArguments });
          if (task.metadata?.taskContract) {
            if (effectiveName.startsWith('fs.')) {
              const pathValue = effectiveArguments.path ?? effectiveArguments.to ?? effectiveArguments.from;
              const kind = ['fs.read', 'fs.readMany', 'fs.search'].includes(effectiveName) ? 'file.read' : 'file.write';
              if (effectiveName === 'fs.readMany') for (const candidate of effectiveArguments.paths ?? []) assertTaskActionAllowed(task.metadata.taskContract, { kind, path: candidate });
              else if (pathValue) assertTaskActionAllowed(task.metadata.taskContract, { kind, path: pathValue });
            } else if (effectiveName === 'process.run' || effectiveName === 'process.startManaged') assertTaskActionAllowed(task.metadata.taskContract, { kind: 'process.run', command: effectiveArguments.command });
            else if (effectiveName === 'git.commit') assertTaskActionAllowed(task.metadata.taskContract, { kind: 'git.commit' });
          }
          const broker = typeof this.broker === 'function' ? this.broker(task) : this.broker;
          const target = toolTarget(effectiveName, effectiveArguments);
          this.#event('agent.tool.started', { turn, tool: effectiveName, target }, refs);
          let result;
          if (effectiveName === 'tool.catalog.search') {
            const authorizedNames = new Set(authorizedToolSchemas.keys());
            const items = this.dynamicToolCatalog.search(String(effectiveArguments.query ?? ''), { limit: effectiveArguments.limit ?? 20 })
              .filter((item) => authorizedNames.has(item.name));
            const output = Object.freeze({ schema: 'forge.dynamic-tool-search.v1', items: Object.freeze(items) });
            result = Object.freeze({ status: 'pass', output, receipt: catalogReceipt({ tool: effectiveName, input: effectiveArguments, output, refs }) });
          } else if (effectiveName === 'tool.catalog.load') {
            const requestedName = String(effectiveArguments.name ?? '');
            const schema = authorizedToolSchemas.get(requestedName);
            if (!schema) {
              const error = new Error(`Tool is not authorized for this task: ${requestedName}`);
              error.code = 'DYNAMIC_TOOL_NOT_AUTHORIZED';
              throw error;
            }
            if (!activeTools.some((item) => item.function.name === requestedName)) activeTools = Object.freeze([...activeTools, schema]);
            const summary = this.dynamicToolCatalog.summary(requestedName);
            const output = Object.freeze({ schema: 'forge.dynamic-tool-load.v1', tool: summary, loaded: true });
            result = Object.freeze({ status: 'pass', output, receipt: catalogReceipt({ tool: effectiveName, input: effectiveArguments, output, refs }) });
            this.#event('agent.tool-schema.loaded', { tool: requestedName, source: summary.source, capability: summary.capability }, refs);
          } else result = mcpToolNames.has(effectiveName)
            ? await this.mcpGateway.execute(task, effectiveName, effectiveArguments, { signal, refs })
            : browserToolNames.has(effectiveName)
              ? await this.browserGateway.execute(task, effectiveName, effectiveArguments, { signal, refs })
              : goalToolNames.has(effectiveName)
                ? await this.goalGateway.execute(task, effectiveName, effectiveArguments, { signal, refs })
                : forgeToolNames.has(effectiveName)
                  ? await this.forgeGateway.execute(task, effectiveName, effectiveArguments, { signal, refs })
                  : operatingPlaneToolNames.has(effectiveName)
                    ? await this.operatingPlaneGateway.execute(task, effectiveName, effectiveArguments, { signal, refs })
                    : adaptiveIntelligenceToolNames.has(effectiveName)
                      ? await this.adaptiveIntelligenceGateway.execute(task, effectiveName, effectiveArguments, { signal, refs })
                      : await broker.execute({ tool: effectiveName, input: effectiveArguments }, { signal, refs, principalId: `agent:${task.id}`, projectId: task.projectId, taskId: task.id, sessionId: run.id, origin: 'agent' });
          receipts.push(result.receipt);
          activity.recordTool({ tool: effectiveName, input: effectiveArguments, status: result.status, output: result.output, receiptSha256: result.receipt?.receiptSha256 ?? null });
          await this.forge.recordEvidence(task.projectId, {
            type: 'tool-receipt',
            title: `${effectiveName} execution receipt`,
            summary: `Tool ${effectiveName} returned ${result.status}.`,
            metadata: { taskId: task.id, runId: run.id, toolCallId: call.id, receiptSha256: result.receipt.receiptSha256 },
          });
          const renderedToolResult = JSON.stringify({ status: result.status, output: result.output, receipt: result.receipt });
          const screenedToolResult = screenContent('tool', `${effectiveName}:${call.id}`, renderedToolResult);
          messages.push({ role: 'tool', tool_call_id: call.id, content: screenedToolResult.safeText });
          this.#event('agent.tool.completed', { turn, tool: effectiveName, target, status: result.status, ...toolResultMeta(result), receiptSha256: result.receipt.receiptSha256 }, refs);
          await runHook('AfterTool', { toolName: effectiveName, arguments: effectiveArguments, status: result.status, receiptSha256: result.receipt.receiptSha256 });
        }
        this.store.updateRun(run.id, { state: 'running', checkpoint: { turn, output, activeProviderId: provider.id, contextPackSha256: contextPack.contextPackSha256, routePlanSha256: contextPack.routePlan.routePlanSha256, receipts, budget: budget.snapshot(), activity: activity.snapshot() } });
      }
    } catch (error) {
      activity.recordError(error, { turn });
      try { await endHookSession('failed', { error: String(error.message ?? error) }); } catch { /* preserve the primary error */ }
      this.store.updateRun(run.id, { state: 'failed', checkpoint: { turn, output, activeProviderId: provider?.id ?? null, receipts, budget: budget.snapshot(), activity: activity.snapshot(), error: String(error.message ?? error) } });
      this.#event('agent.failed', { turn, error: String(error.message ?? error), budget: budget.snapshot() }, refs);
      throw error;
    }
  }
}
