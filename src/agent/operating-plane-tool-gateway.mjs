import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const ADAPTIVE_JOB_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['id', 'profileId', 'objective'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 256 }, profileId: { type: 'string', minLength: 1, maxLength: 256 }, objective: { type: 'string', minLength: 1, maxLength: 20000 },
    dependencies: { type: 'array', maxItems: 64, items: { type: 'string', minLength: 1, maxLength: 256 } },
    ownedPaths: { type: 'array', maxItems: 200, items: { type: 'string', minLength: 1, maxLength: 2000 } },
    ownedSymbols: { type: 'array', maxItems: 200, items: { type: 'string', minLength: 1, maxLength: 1000 } },
    confidence: { type: 'number', minimum: 0, maximum: 1 }, expectedInformationGain: { type: 'number', minimum: 0, maximum: 1 },
    maxAttempts: { type: 'integer', minimum: 1, maximum: 8 }, stopConditions: { type: 'array', maxItems: 32, items: { type: 'string', maxLength: 1000 } },
  },
});
const ADAPTIVE_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, properties: {
    minConfidence: { type: 'number', minimum: 0, maximum: 1 }, minInformationGain: { type: 'number', minimum: 0, maximum: 1 },
    maxJobs: { type: 'integer', minimum: 1, maximum: 256 }, maxWaves: { type: 'integer', minimum: 1, maximum: 512 }, maxMutations: { type: 'integer', minimum: 0, maximum: 2048 },
  },
});

const DEFINITIONS = Object.freeze({
  'agent.profiles': Object.freeze({ description: 'List validated project-scoped custom agent profiles.', parameters: { type: 'object', additionalProperties: false, properties: {} } }),
  'agent.spawn': Object.freeze({ description: 'Run a scoped custom subagent using parent-intersected permissions.', parameters: { type: 'object', additionalProperties: false, required: ['profileId', 'objective'], properties: { profileId: { type: 'string' }, objective: { type: 'string' }, jobId: { type: 'string' } } } }),
  'agent.runGraph': Object.freeze({ description: 'Run an explicitly authorized adaptive subagent graph with bounded jobs, ownership serialization, uncertainty stops, and resource-aware concurrency.', parameters: { type: 'object', additionalProperties: false, required: ['jobs'], properties: { jobs: { type: 'array', minItems: 1, maxItems: 64, items: ADAPTIVE_JOB_SCHEMA }, policy: ADAPTIVE_POLICY_SCHEMA } } }),
  'code.symbols': Object.freeze({ description: 'Query workspace symbols using a language server with repository-index fallback.', parameters: { type: 'object', additionalProperties: false, required: ['languageId'], properties: { languageId: { type: 'string' }, query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 2000 } } } }),
  'code.definition': Object.freeze({ description: 'Find a symbol definition through the configured language server.', parameters: { type: 'object', additionalProperties: false, required: ['languageId', 'uri', 'line', 'character'], properties: { languageId: { type: 'string' }, uri: { type: 'string' }, line: { type: 'integer', minimum: 0 }, character: { type: 'integer', minimum: 0 } } } }),
  'code.references': Object.freeze({ description: 'Find symbol references through the configured language server.', parameters: { type: 'object', additionalProperties: false, required: ['languageId', 'uri', 'line', 'character'], properties: { languageId: { type: 'string' }, uri: { type: 'string' }, line: { type: 'integer', minimum: 0 }, character: { type: 'integer', minimum: 0 }, includeDeclaration: { type: 'boolean' } } } }),
  'code.callHierarchy': Object.freeze({ description: 'Inspect incoming and outgoing calls through the configured language server.', parameters: { type: 'object', additionalProperties: false, required: ['languageId', 'uri', 'line', 'character'], properties: { languageId: { type: 'string' }, uri: { type: 'string' }, line: { type: 'integer', minimum: 0 }, character: { type: 'integer', minimum: 0 } } } }),
  'code.searchAdvanced': Object.freeze({ description: 'Search imports, TODOs, compiler output, Git commits, timestamps, diffs, logs, or content with bounded combined filters.', parameters: { type: 'object', additionalProperties: false, required: ['query'], properties: { kinds: { type: 'array', items: { type: 'string', enum: ['import', 'todo', 'compiler', 'commit', 'time', 'diff', 'log', 'content'] } }, query: { type: 'string', minLength: 1, maxLength: 2000 }, regex: { type: 'boolean' }, extensions: { type: 'array', items: { type: 'string' } }, directories: { type: 'array', items: { type: 'string' } }, language: { type: 'string' }, since: { type: 'string' }, until: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 1000 } } } }),
  'code.astQuery': Object.freeze({ description: 'Query bounded JavaScript or TypeScript compiler AST nodes with file and node hash evidence.', parameters: { type: 'object', additionalProperties: false, required: ['path', 'nodeType'], properties: { path: { type: 'string' }, nodeType: { type: 'string' }, name: { type: 'string' }, textContains: { type: 'string' }, ancestorType: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 200 } } } }),
  'code.astPatch': Object.freeze({ description: 'Dry-run or atomically replace exactly one JavaScript or TypeScript AST node using stale-file and optional stale-node hash guards.', parameters: { type: 'object', additionalProperties: false, required: ['path', 'nodeType', 'replacement', 'expectedSha256'], properties: { path: { type: 'string' }, nodeType: { type: 'string' }, name: { type: 'string' }, textContains: { type: 'string' }, ancestorType: { type: 'string' }, replacement: { type: 'string', maxLength: 262144 }, expectedSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, expectedNodeSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, dryRun: { type: 'boolean' } } } }),
  'code.readSymbol': Object.freeze({ description: 'Read one exact authorized symbol from a workspace text file.', parameters: { type: 'object', additionalProperties: false, required: ['path', 'symbol'], properties: { path: { type: 'string' }, symbol: { type: 'string' }, kind: { type: 'string', enum: ['function', 'class', 'interface', 'type', 'enum'] } } } }),
  'code.replaceSymbol': Object.freeze({ description: 'Atomically replace one exact authorized symbol with an optional stale-file hash guard.', parameters: { type: 'object', additionalProperties: false, required: ['path', 'symbol', 'content'], properties: { path: { type: 'string' }, symbol: { type: 'string' }, kind: { type: 'string', enum: ['function', 'class', 'interface', 'type', 'enum'] }, content: { type: 'string' }, expectedSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' } } } }),
  'code.insertBeforeSymbol': Object.freeze({ description: 'Atomically insert content immediately before one exact authorized symbol.', parameters: { type: 'object', additionalProperties: false, required: ['path', 'symbol', 'content'], properties: { path: { type: 'string' }, symbol: { type: 'string' }, kind: { type: 'string', enum: ['function', 'class', 'interface', 'type', 'enum'] }, content: { type: 'string' }, expectedSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' } } } }),
  'code.insertAfterSymbol': Object.freeze({ description: 'Atomically insert content immediately after one exact authorized symbol.', parameters: { type: 'object', additionalProperties: false, required: ['path', 'symbol', 'content'], properties: { path: { type: 'string' }, symbol: { type: 'string' }, kind: { type: 'string', enum: ['function', 'class', 'interface', 'type', 'enum'] }, content: { type: 'string' }, expectedSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' } } } }),
  'git.status': Object.freeze({ description: 'Read typed Git status for the task workspace.', parameters: { type: 'object', additionalProperties: false, properties: {} } }),
  'git.diff': Object.freeze({ description: 'Read a bounded typed Git diff for the task workspace.', parameters: { type: 'object', additionalProperties: false, properties: { staged: { type: 'boolean' }, paths: { type: 'array', items: { type: 'string' } } } } }),
  'git.stage': Object.freeze({ description: 'Stage secret-scanned files at an expected Git HEAD.', parameters: { type: 'object', additionalProperties: false, required: ['paths', 'expectedHead'], properties: { paths: { type: 'array', minItems: 1, items: { type: 'string' } }, expectedHead: { type: 'string' } } } }),
  'git.commit': Object.freeze({ description: 'Commit secret-scanned staged files at an expected Git HEAD.', parameters: { type: 'object', additionalProperties: false, required: ['message', 'expectedHead'], properties: { message: { type: 'string' }, paths: { type: 'array', items: { type: 'string' } }, expectedHead: { type: 'string' } } } }),
  'visual.compare': Object.freeze({ description: 'Compare two authorized screenshots and produce a governed PNG diff artifact.', parameters: { type: 'object', additionalProperties: false, required: ['baselinePath', 'actualPath'], properties: { baselinePath: { type: 'string' }, actualPath: { type: 'string' }, threshold: { type: 'integer', minimum: 0, maximum: 255 }, outputName: { type: 'string' } } } }),
  'session.verify': Object.freeze({ description: 'Verify the current append-only session ledger hash chain.', parameters: { type: 'object', additionalProperties: false, properties: { sessionId: { type: 'string' } } } }),
  'session.checkpoint': Object.freeze({ description: 'Create a content-addressed session checkpoint.', parameters: { type: 'object', additionalProperties: false, properties: { sessionId: { type: 'string' }, repository: { type: 'object' }, plan: { type: 'object' }, context: { type: 'object' }, receipts: { type: 'array', items: { type: 'string' } } } } }),
  'test.detect': Object.freeze({ description: 'Detect the project test framework without executing project code.', parameters: { type: 'object', additionalProperties: false, properties: {} } }),
  'test.run': Object.freeze({ description: 'Run a governed test file, module, package, unit, integration, or full suite and return a verification receipt.', parameters: { type: 'object', additionalProperties: false, required: ['scope'], properties: { scope: { type: 'string', enum: ['file', 'module', 'package', 'unit', 'integration', 'full'] }, path: { type: 'string' }, name: { type: 'string' }, timeoutMs: { type: 'integer', minimum: 100, maximum: 86400000 } } } }),
  'security.scanArtifacts': Object.freeze({ description: 'Scan bounded task-owned artifacts for suspicious scripts, denied hashes, and unexpected executables.', parameters: { type: 'object', additionalProperties: false, required: ['paths'], properties: { paths: { type: 'array', minItems: 1, maxItems: 200, items: { type: 'string' } }, allowExecutables: { type: 'boolean' } } } }),
  'security.scanDependencies': Object.freeze({ description: 'Inspect an npm lockfile for insecure dependency transport, missing integrity, unapproved registries, and install scripts.', parameters: { type: 'object', additionalProperties: false, properties: { lockfilePath: { type: 'string' } } } }),
});

const DEFAULT_READ_ONLY = Object.freeze(['agent.profiles', 'code.symbols', 'code.definition', 'code.references', 'code.callHierarchy', 'code.searchAdvanced', 'code.astQuery', 'code.readSymbol', 'git.status', 'git.diff', 'visual.compare', 'session.verify', 'test.detect', 'security.scanArtifacts', 'security.scanDependencies']);

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function frozen(value) { if (!value || typeof value !== 'object') return value; if (Array.isArray(value)) { value.forEach(frozen); return Object.freeze(value); } Object.values(value).forEach(frozen); return Object.freeze(value); }

export class OperatingPlaneToolGateway {
  constructor({ projectResolver, codeIntelligence = null, advancedSearchFactory = null, astIntelligenceFactory = null, gitGatewayFactory = null, imageComparisonFactory = null, profileLoader = null, sessionLedgerFactory = null, subagentFactory = null, symbolEditFactory = null, testEngineFactory = null, artifactSecurityFactory = null, workspaceTrust = null } = {}) {
    if (typeof projectResolver !== 'function') throw new TypeError('projectResolver is required');
    this.projectResolver = projectResolver;
    this.codeIntelligence = codeIntelligence;
    this.advancedSearchFactory = advancedSearchFactory;
    this.astIntelligenceFactory = astIntelligenceFactory;
    this.gitGatewayFactory = gitGatewayFactory;
    this.imageComparisonFactory = imageComparisonFactory;
    this.profileLoader = profileLoader;
    this.sessionLedgerFactory = sessionLedgerFactory;
    this.subagentFactory = subagentFactory;
    this.symbolEditFactory = symbolEditFactory;
    this.testEngineFactory = testEngineFactory;
    this.artifactSecurityFactory = artifactSecurityFactory;
    this.workspaceTrust = workspaceTrust;
  }

  allowedNames(task) {
    const requested = Array.isArray(task?.metadata?.operatingPlaneAllowedTools) ? task.metadata.operatingPlaneAllowedTools.map(String) : DEFAULT_READ_ONLY;
    return [...new Set(requested)].filter((name) => Object.hasOwn(DEFINITIONS, name));
  }

  schemasForTask(task) {
    return Object.freeze(this.allowedNames(task).map((name) => Object.freeze({ type: 'function', function: Object.freeze({ name, ...DEFINITIONS[name] }) })));
  }

  async execute(task, name, args = {}, context = {}) {
    const tool = String(name);
    if (!this.allowedNames(task).includes(tool)) fail('OPERATING_PLANE_TOOL_DENIED', `Operating-plane tool is not authorized: ${tool}`);
    const project = this.projectResolver(String(task?.projectId ?? ''));
    if (!project) fail('OPERATING_PLANE_PROJECT_NOT_FOUND', `Unknown project: ${task?.projectId ?? ''}`);
    const projectRoot = task?.metadata?.executionWorkspace ?? project.workspaceRoot;
    const startedAt = new Date().toISOString();
    let output;
    if (tool === 'agent.profiles') {
      if (!this.profileLoader) fail('OPERATING_PLANE_UNAVAILABLE', 'Agent profile loader is unavailable');
      if (this.workspaceTrust) await this.workspaceTrust.requireTrusted(project.id, 'skills');
      output = await this.profileLoader.loadProjectProfiles(projectRoot);
    } else if (tool === 'agent.spawn' || tool === 'agent.runGraph') {
      if (!this.subagentFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Subagent runtime is unavailable');
      if (this.workspaceTrust) await this.workspaceTrust.requireTrusted(project.id, 'skills');
      const runtime = await this.subagentFactory({ task, project, projectRoot });
      output = tool === 'agent.spawn'
        ? await runtime.run({ parentTask: task, profileId: args.profileId, objective: args.objective, jobId: args.jobId, signal: context.signal })
        : await runtime.runAdaptiveGraph({ jobs: args.jobs, policy: args.policy, signal: context.signal });
    } else if (tool === 'code.searchAdvanced') {
      if (!this.advancedSearchFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Advanced repository search is unavailable');
      output = await this.advancedSearchFactory({ task, project, projectRoot }).search(args);
    } else if (tool === 'code.astQuery' || tool === 'code.astPatch') {
      if (!this.astIntelligenceFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'AST intelligence is unavailable');
      const service = this.astIntelligenceFactory({ task, project, projectRoot });
      output = tool === 'code.astQuery' ? await service.query(args) : await service.patch(args);
    } else if (['code.readSymbol', 'code.replaceSymbol', 'code.insertBeforeSymbol', 'code.insertAfterSymbol'].includes(tool)) {
      if (!this.symbolEditFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Symbol edit service is unavailable');
      const service = this.symbolEditFactory({ task, project, projectRoot });
      if (tool === 'code.readSymbol') output = await service.read(args);
      else if (tool === 'code.replaceSymbol') output = await service.replace(args);
      else if (tool === 'code.insertBeforeSymbol') output = await service.insertBefore(args);
      else output = await service.insertAfter(args);
    } else if (tool.startsWith('code.')) {
      if (!this.codeIntelligence) fail('OPERATING_PLANE_UNAVAILABLE', 'Code intelligence is unavailable');
      const input = { ...args, projectId: project.id, projectRoot };
      if (tool === 'code.symbols') output = await this.codeIntelligence.workspaceSymbols(input);
      else if (tool === 'code.definition') output = await this.codeIntelligence.definition(input);
      else if (tool === 'code.references') output = await this.codeIntelligence.references(input);
      else output = await this.codeIntelligence.callHierarchy(input);
    } else if (tool.startsWith('git.')) {
      if (!this.gitGatewayFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Git gateway is unavailable');
      const gateway = this.gitGatewayFactory({ task, project, projectRoot });
      if (tool === 'git.status') output = await gateway.status();
      else if (tool === 'git.diff') output = await gateway.diff(args);
      else if (tool === 'git.stage') output = await gateway.stage(args);
      else output = await gateway.commit(args);
    } else if (tool.startsWith('test.')) {
      if (!this.testEngineFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Test engine is unavailable');
      const engine = this.testEngineFactory({ task, project, projectRoot });
      output = tool === 'test.detect' ? await engine.detect() : await engine.run({ ...args, signal: context.signal });
    } else if (tool.startsWith('security.')) {
      if (!this.artifactSecurityFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Artifact security scanner is unavailable');
      const scanner = this.artifactSecurityFactory({ task, project, projectRoot });
      output = tool === 'security.scanArtifacts' ? await scanner.scanArtifacts(args) : await scanner.scanDependencies(args);
    } else if (tool === 'visual.compare') {
      if (!this.imageComparisonFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Image comparison is unavailable');
      output = await this.imageComparisonFactory({ task, project, projectRoot }).compare(args);
    } else if (tool.startsWith('session.')) {
      if (!this.sessionLedgerFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Session ledger is unavailable');
      const ledger = await this.sessionLedgerFactory({ task, project, projectRoot, sessionId: args.sessionId ?? task.id });
      output = tool === 'session.verify' ? await ledger.verify() : await ledger.checkpoint({ repository: args.repository, task: { id: task.id, objective: task.objective }, plan: args.plan, context: args.context, receipts: args.receipts });
    } else fail('OPERATING_PLANE_TOOL_UNKNOWN', `Unknown operating-plane tool: ${tool}`);
    const safeOutput = structuredClone(output);
    const base = { schema: 'forge.operating-plane.tool-receipt.v1', tool, status: 'pass', startedAt, finishedAt: new Date().toISOString(), taskId: String(task.id), projectId: String(project.id), requestSha256: canonicalSha256(args), outputSha256: canonicalSha256(safeOutput), refs: context.refs ?? {} };
    return frozen({ status: 'pass', output: safeOutput, receipt: { ...base, receiptSha256: canonicalSha256(base) } });
  }
}
