import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const DEFINITIONS = Object.freeze({
  'repository.map': { description: 'Build a compact dependency-ranked repository map with important symbols and import relationships.', parameters: { type: 'object', additionalProperties: false, properties: { maxFiles: { type: 'integer', minimum: 1, maximum: 2000 }, maxSymbolsPerFile: { type: 'integer', minimum: 0, maximum: 100 }, maxChars: { type: 'integer', minimum: 1000, maximum: 1000000 } } } },
  'repository.semanticSearch': { description: 'Search the authorized project using hybrid lexical and semantic code intelligence.', parameters: { type: 'object', additionalProperties: false, required: ['query'], properties: { query: { type: 'string', minLength: 1, maxLength: 4000 }, limit: { type: 'integer', minimum: 1, maximum: 100 }, pathPrefix: { type: 'string' }, language: { type: 'string' } } } },
  'context.artifactRead': { description: 'Read one bounded page from a project-owned context artifact.', parameters: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' }, startByte: { type: 'integer', minimum: 0 }, maxBytes: { type: 'integer', minimum: 1, maximum: 1000000 } } } },
  'context.artifactSearch': { description: 'Search a project-owned context artifact without loading the full content.', parameters: { type: 'object', additionalProperties: false, required: ['id', 'query'], properties: { id: { type: 'string' }, query: { type: 'string', minLength: 1, maxLength: 4000 }, limit: { type: 'integer', minimum: 1, maximum: 1000 }, regex: { type: 'boolean' }, caseSensitive: { type: 'boolean' } } } },
  'context.historyList': { description: 'List immutable conversation, terminal, and summary archives owned by the current project.', parameters: { type: 'object', additionalProperties: false, properties: { missionId: { type: 'string' }, sessionId: { type: 'string' }, kind: { type: 'string', enum: ['conversation', 'conversation-summary', 'terminal'] }, limit: { type: 'integer', minimum: 1, maximum: 500 } } } },
  'context.historySearch': { description: 'Search project-owned durable conversation and terminal history without loading every artifact.', parameters: { type: 'object', additionalProperties: false, required: ['query'], properties: { query: { type: 'string', minLength: 1, maxLength: 4000 }, missionId: { type: 'string' }, sessionId: { type: 'string' }, kind: { type: 'string', enum: ['conversation', 'conversation-summary', 'terminal'] }, limit: { type: 'integer', minimum: 1, maximum: 1000 }, regex: { type: 'boolean' }, caseSensitive: { type: 'boolean' } } } },
  'memory.propose': { description: 'Propose a cited project memory candidate. It remains inactive until a human approves it.', parameters: { type: 'object', additionalProperties: false, required: ['title', 'content', 'citations'], properties: { title: { type: 'string', minLength: 1, maxLength: 500 }, content: { type: 'string', minLength: 1, maxLength: 20000 }, citations: { type: 'array', maxItems: 50, items: { type: 'object' } }, confidence: { type: 'number', minimum: 0, maximum: 1 }, ttlMs: { type: 'integer', minimum: 1000 } } } },
  'review.independent': { description: 'Request an independent diff review using a reviewer identity different from the executor.', parameters: { type: 'object', additionalProperties: false, required: ['diff'], properties: { diff: { type: 'string', minLength: 1, maxLength: 2000000 }, reviewerId: { type: 'string' }, rules: { type: 'array', maxItems: 100, items: { type: 'string' } }, baseSha: { type: ['string', 'null'] }, headSha: { type: ['string', 'null'] }, priorReviewId: { type: ['string', 'null'] } } } },
  'automation.list': { description: 'List durable local automations for the current project.', parameters: { type: 'object', additionalProperties: false, properties: {} } },
  'automation.createDraft': { description: 'Create a local automation that can only produce a report, patch, branch, or pull-request draft.', parameters: { type: 'object', additionalProperties: false, required: ['name', 'objective'], properties: { name: { type: 'string' }, objective: { type: 'string' }, trigger: { type: 'object' }, outputPolicy: { type: 'string', enum: ['report', 'patch-draft', 'branch', 'pull-request-draft'] }, capabilities: { type: 'array', items: { type: 'string' } }, skills: { type: 'array', items: { type: 'string' } }, mcpServers: { type: 'array', items: { type: 'string' } } } } },
  'design.get': { description: 'Read one sanitized design context owned by the current project.', parameters: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' } } } },
  'design.edits': { description: 'List queued edits for one sanitized design context owned by the current project.', parameters: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' } } } },
  'diagnostics.compare': { description: 'Compare bounded baseline and current diagnostic output, separating new regressions from pre-existing and resolved diagnostics.', parameters: { type: 'object', additionalProperties: false, required: ['baseline', 'current'], properties: { baseline: { type: 'string', maxLength: 5000000 }, current: { type: 'string', maxLength: 5000000 } } } },
  'provider.routeExplain': { description: 'Explain which eligible model provider would be selected for a task without sending source code or prompts.', parameters: { type: 'object', additionalProperties: false, properties: { mode: { type: 'string', enum: ['intelligence', 'balance', 'cost'] }, task: { type: 'object' }, requiredCapabilities: { type: 'array', items: { type: 'string' } }, localOnly: { type: 'boolean' }, maxCostTier: { type: 'number' } } } },
  'environment.status': { description: 'Read the current state of one project-owned managed development environment without starting, stopping, or healing it.', parameters: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 240 } } } },
});

const DEFAULT_ALLOWED = Object.freeze(['repository.map', 'repository.semanticSearch', 'context.artifactRead', 'context.artifactSearch', 'context.historyList', 'context.historySearch', 'memory.propose', 'review.independent', 'automation.list', 'design.get', 'design.edits', 'diagnostics.compare', 'provider.routeExplain', 'environment.status']);

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function freeze(value) { if (!value || typeof value !== 'object') return value; if (Array.isArray(value)) { value.forEach(freeze); return Object.freeze(value); } Object.values(value).forEach(freeze); return Object.freeze(value); }

export class AdaptiveIntelligenceToolGateway {
  constructor({ planeResolver } = {}) {
    if (typeof planeResolver !== 'function') throw new TypeError('planeResolver is required');
    this.planeResolver = planeResolver;
  }

  allowedNames(task) {
    const requested = Array.isArray(task?.metadata?.adaptiveIntelligenceAllowedTools) ? task.metadata.adaptiveIntelligenceAllowedTools.map(String) : DEFAULT_ALLOWED;
    return [...new Set(requested)].filter((name) => Object.hasOwn(DEFINITIONS, name));
  }

  schemasForTask(task) {
    return Object.freeze(this.allowedNames(task).map((name) => freeze({ type: 'function', function: { name, ...DEFINITIONS[name] } })));
  }

  async execute(task, name, args = {}, context = {}) {
    const tool = String(name);
    if (!this.allowedNames(task).includes(tool)) fail('ADAPTIVE_TOOL_DENIED', `Adaptive intelligence tool is not authorized: ${tool}`);
    const plane = this.planeResolver();
    if (!plane) fail('ADAPTIVE_INTELLIGENCE_UNAVAILABLE', 'Adaptive intelligence plane is not available');
    const projectId = String(task?.projectId ?? '');
    const assertOwnedContext = async (id) => {
      const descriptor = await plane.context('get', { id });
      if (String(descriptor?.refs?.projectId ?? '') !== projectId) fail('ADAPTIVE_CONTEXT_SCOPE_DENIED', 'Context artifact is not owned by this project');
      return descriptor;
    };
    let output;
    if (tool === 'repository.map') output = await plane.repository('map', { ...args, projectId });
    else if (tool === 'repository.semanticSearch') output = await plane.repository('search', { ...args, projectId });
    else if (tool === 'context.artifactRead') { await assertOwnedContext(args.id); output = await plane.context('read', args); }
    else if (tool === 'context.artifactSearch') { await assertOwnedContext(args.id); output = await plane.context('search', args); }
    else if (tool === 'context.historyList') output = await plane.history('list', { ...args, projectId });
    else if (tool === 'context.historySearch') output = await plane.history('search', { ...args, projectId });
    else if (tool === 'memory.propose') output = await plane.memory('propose', { ...args, projectId }, { subject: `agent:${task.id}` });
    else if (tool === 'review.independent') output = await plane.review('run', { ...args, projectId, executorId: String(task.metadata?.agentProfileId ?? task.id), reviewerId: String(args.reviewerId ?? 'independent-reviewer') });
    else if (tool === 'automation.list') output = await plane.automation('list', { projectId });
    else if (tool === 'automation.createDraft') output = await plane.automation('create', { ...args, projectId, outputPolicy: args.outputPolicy ?? 'report' });
    else if (tool === 'design.get' || tool === 'design.edits') {
      const design = await plane.design('get', { id: args.id });
      if (String(design?.projectId ?? '') !== projectId) fail('ADAPTIVE_DESIGN_SCOPE_DENIED', 'Design context is not owned by this project');
      output = tool === 'design.get' ? design : await plane.design('edits', { id: args.id });
    } else if (tool === 'diagnostics.compare') output = plane.diagnostics('compare', args);
    else if (tool === 'provider.routeExplain') output = plane.providers('route', args);
    else if (tool === 'environment.status') output = await plane.environment('status', { id: args.id, projectId });
    else fail('ADAPTIVE_TOOL_UNKNOWN', `Unknown adaptive intelligence tool: ${tool}`);
    const safeOutput = structuredClone(output);
    const base = { schema: 'forge.adaptive-intelligence-tool-receipt.v1', tool, status: 'pass', taskId: String(task.id), projectId, requestSha256: canonicalSha256(args), outputSha256: canonicalSha256(safeOutput), refs: context.refs ?? {} };
    return freeze({ status: 'pass', output: safeOutput, receipt: { ...base, receiptSha256: canonicalSha256(base) } });
  }
}
