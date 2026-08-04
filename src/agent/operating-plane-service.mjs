function fail(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
}

function frozen(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) frozen(child, seen);
  return Object.freeze(value);
}

const CODE_OPERATIONS = new Set(['symbols', 'definition', 'references', 'callHierarchy', 'readSymbol', 'replaceSymbol', 'insertBeforeSymbol', 'insertAfterSymbol', 'searchAdvanced', 'astQuery', 'astPatch']);
const GIT_OPERATIONS = new Set(['status', 'diff']);
const SESSION_OPERATIONS = new Set(['verify', 'checkpoint', 'rewind', 'fork']);
const TEST_OPERATIONS = new Set(['detect', 'run']);
const SECURITY_OPERATIONS = new Set(['scanArtifacts', 'scanDependencies']);

export class OperatingPlaneService {
  constructor({
    version,
    projectResolver,
    profileLoader = null,
    codeIntelligence = null,
    imageComparisonFactory = null,
    gitGatewayFactory = null,
    sessionLedgerFactory = null,
    symbolEditFactory = null,
    advancedSearchFactory = null,
    astIntelligenceFactory = null,
    testEngineFactory = null,
    artifactSecurityFactory = null,
    workspaceTrust = null,
    capabilities = [],
    externalGates = [],
  } = {}) {
    if (typeof projectResolver !== 'function') throw new TypeError('projectResolver is required');
    this.version = String(version ?? '0.0.0');
    this.projectResolver = projectResolver;
    this.profileLoader = profileLoader;
    this.codeIntelligence = codeIntelligence;
    this.imageComparisonFactory = imageComparisonFactory;
    this.gitGatewayFactory = gitGatewayFactory;
    this.sessionLedgerFactory = sessionLedgerFactory;
    this.symbolEditFactory = symbolEditFactory;
    this.advancedSearchFactory = advancedSearchFactory;
    this.astIntelligenceFactory = astIntelligenceFactory;
    this.testEngineFactory = testEngineFactory;
    this.artifactSecurityFactory = artifactSecurityFactory;
    this.workspaceTrust = workspaceTrust;
    this.capabilities = Object.freeze([...new Set(capabilities.map(String))]);
    this.externalGates = frozen(structuredClone(externalGates));
  }

  #project(projectId) {
    const id = String(projectId ?? '').trim();
    if (!id) fail('OPERATING_PLANE_INPUT_INVALID', 'projectId is required');
    const project = this.projectResolver(id);
    if (!project) fail('OPERATING_PLANE_PROJECT_NOT_FOUND', `Unknown project: ${id}`, 404);
    return project;
  }

  async status() {
    return frozen({
      schema: 'forge.operating-plane.status.v1',
      version: this.version,
      capabilities: [...this.capabilities],
      externalGates: structuredClone(this.externalGates),
    });
  }

  async listProfiles(projectId) {
    const project = this.#project(projectId);
    if (!this.profileLoader) fail('OPERATING_PLANE_UNAVAILABLE', 'Agent profile loader is unavailable', 503);
    if (this.workspaceTrust) await this.workspaceTrust.requireTrusted(project.id, 'skills');
    return await this.profileLoader.loadProjectProfiles(project.workspaceRoot);
  }

  async code(operation, input = {}) {
    const name = String(operation);
    if (!CODE_OPERATIONS.has(name)) fail('OPERATING_PLANE_OPERATION_INVALID', `Unsupported code operation: ${name}`);
    const project = this.#project(input.projectId);
    const request = { ...input };
    delete request.projectId;
    delete request.projectIdFromPath;
    if (name === 'searchAdvanced') {
      if (!this.advancedSearchFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Advanced repository search is unavailable', 503);
      return await this.advancedSearchFactory({ project, projectRoot: project.workspaceRoot }).search(request);
    }
    if (name === 'astQuery' || name === 'astPatch') {
      if (!this.astIntelligenceFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'AST intelligence is unavailable', 503);
      const service = this.astIntelligenceFactory({ project, projectRoot: project.workspaceRoot });
      return name === 'astQuery' ? await service.query(request) : await service.patch(request);
    }
    if (['readSymbol', 'replaceSymbol', 'insertBeforeSymbol', 'insertAfterSymbol'].includes(name)) {
      if (!this.symbolEditFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Symbol edit service is unavailable', 503);
      const service = this.symbolEditFactory({ project, projectRoot: project.workspaceRoot });
      if (name === 'readSymbol') return await service.read(request);
      if (name === 'replaceSymbol') return await service.replace(request);
      if (name === 'insertBeforeSymbol') return await service.insertBefore(request);
      return await service.insertAfter(request);
    }
    if (!this.codeIntelligence) fail('OPERATING_PLANE_UNAVAILABLE', 'Code intelligence is unavailable', 503);
    const intelligenceRequest = { ...request, projectId: project.id, projectRoot: project.workspaceRoot };
    if (name === 'symbols') return await this.codeIntelligence.workspaceSymbols(intelligenceRequest);
    return await this.codeIntelligence[name](intelligenceRequest);
  }

  async tests(operation, input = {}) {
    const name = String(operation);
    if (!TEST_OPERATIONS.has(name)) fail('OPERATING_PLANE_OPERATION_INVALID', `Unsupported test operation: ${name}`);
    const project = this.#project(input.projectId);
    if (!this.testEngineFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Test engine is unavailable', 503);
    const engine = this.testEngineFactory({ project, projectRoot: project.workspaceRoot });
    if (name === 'detect') return await engine.detect();
    const request = { ...input };
    delete request.projectId;
    return await engine.run(request);
  }

  async security(operation, input = {}) {
    const name = String(operation);
    if (!SECURITY_OPERATIONS.has(name)) fail('OPERATING_PLANE_OPERATION_INVALID', `Unsupported security operation: ${name}`);
    const project = this.#project(input.projectId);
    if (!this.artifactSecurityFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Artifact security scanner is unavailable', 503);
    const scanner = this.artifactSecurityFactory({ project, projectRoot: project.workspaceRoot });
    const request = { ...input };
    delete request.projectId;
    return name === 'scanArtifacts' ? await scanner.scanArtifacts(request) : await scanner.scanDependencies(request);
  }

  async compareImages(input = {}) {
    const project = this.#project(input.projectId);
    if (!this.imageComparisonFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Image comparison is unavailable', 503);
    const service = this.imageComparisonFactory({ project, projectRoot: project.workspaceRoot });
    const request = { ...input };
    delete request.projectId;
    return await service.compare(request);
  }

  async git(operation, input = {}) {
    const name = String(operation);
    if (!GIT_OPERATIONS.has(name)) fail('OPERATING_PLANE_OPERATION_INVALID', `Unsupported Git operation: ${name}`);
    const project = this.#project(input.projectId);
    if (!this.gitGatewayFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Git gateway is unavailable', 503);
    const gateway = this.gitGatewayFactory({ project, projectRoot: project.workspaceRoot });
    if (name === 'status') return await gateway.status();
    const request = { ...input };
    delete request.projectId;
    return await gateway.diff(request);
  }

  async session(operation, input = {}) {
    const name = String(operation);
    if (!SESSION_OPERATIONS.has(name)) fail('OPERATING_PLANE_OPERATION_INVALID', `Unsupported session operation: ${name}`);
    const sessionId = String(input.sessionId ?? '').trim();
    if (!sessionId) fail('OPERATING_PLANE_INPUT_INVALID', 'sessionId is required');
    if (name === 'rewind' && !Number.isInteger(Number(input.targetSeq))) fail('OPERATING_PLANE_INPUT_INVALID', 'targetSeq is required for rewind');
    if (name === 'fork' && !String(input.newSessionId ?? '').trim()) fail('OPERATING_PLANE_INPUT_INVALID', 'newSessionId is required for fork');
    if (!this.sessionLedgerFactory) fail('OPERATING_PLANE_UNAVAILABLE', 'Session ledger is unavailable', 503);
    const project = input.projectId ? this.#project(input.projectId) : null;
    const ledger = await this.sessionLedgerFactory({ sessionId, project, projectRoot: project?.workspaceRoot ?? null });
    if (name === 'verify') return await ledger.verify();
    if (name === 'checkpoint') {
      return await ledger.checkpoint({ repository: input.repository, task: input.task, plan: input.plan, context: input.context, receipts: input.receipts });
    }
    if (name === 'rewind') return await ledger.rewind(Number(input.targetSeq), { reason: input.reason });
    const fork = await ledger.fork({ newSessionId: String(input.newSessionId), targetSeq: input.targetSeq });
    return frozen({ schema: 'forge.session-fork-result.v1', sessionId: fork.sessionId, sourceSessionId: sessionId, targetSeq: input.targetSeq ?? null });
  }
}
