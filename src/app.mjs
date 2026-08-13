import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from './config.mjs';
import { createNolaneEnvironment } from './config/nolane-environment.mjs';
import { migrateLegacyDataDirectory } from './config/nolane-data-migration.mjs';
import { StudioStore } from './storage/studio-store.mjs';
import { DurableEventHub } from './events/durable-event-hub.mjs';
import { ForgeOsBridge } from './forge/forgeos-bridge.mjs';
import { ForgeOsToolGateway } from './forge/forgeos-tool-gateway.mjs';
import { ProviderRegistry, createBuiltInCliProviders } from './providers/provider-registry.mjs';
import { CodexAppServerClient } from './providers/codex-app-server.mjs';
import { CliAuthAdapter, createAvailabilityOnlyCliAuthAdapter } from './providers/cli-auth-adapter.mjs';
import { ProviderConnectionService } from './providers/provider-connection-service.mjs';
import { OutcomeAwareProviderRouter, OutcomeMetricsStore } from './providers/outcome-aware-router.mjs';
import { ProviderOutcomeFeedbackService } from './providers/provider-outcome-feedback-service.mjs';
import { createAdaptiveHarnessLab } from './providers/adaptive-harness-lab.mjs';
import { ToolBroker } from './execution/tool-broker.mjs';
import { AutonomyPolicy } from './security/autonomy-policy.mjs';
import { AutonomyGuardedBroker, createTaskEnvironmentAttester } from './security/autonomy-guarded-broker.mjs';
import { TaskWorkspaceService } from './execution/task-workspace.mjs';
import { LocalTaskHandoffService } from './execution/local-task-handoff-service.mjs';
import { ContextBuilder } from './agent/context-builder.mjs';
import { AgentLoop, CORE_TOOL_SCHEMAS } from './agent/agent-loop.mjs';
import { AdaptiveIntelligencePlane } from './agent/adaptive-intelligence-plane.mjs';
import { AdaptiveIntelligenceToolGateway } from './agent/adaptive-intelligence-tool-gateway.mjs';
import { DynamicContextStore } from './agent/dynamic-context-store.mjs';
import { ContextHistoryArchive, TerminalHistoryRecorder } from './agent/context-history-archive.mjs';
import { DynamicToolCatalog } from './agent/dynamic-tool-catalog.mjs';
import { OperatingPlaneToolGateway } from './agent/operating-plane-tool-gateway.mjs';
import { OperatingPlaneService } from './agent/operating-plane-service.mjs';
import { AgentProfileLoader } from './agents/agent-profile-loader.mjs';
import { AgentModeService } from './agents/agent-mode-service.mjs';
import { SubagentOrchestrator } from './agents/subagent-orchestrator.mjs';
import { HookEngine } from './hooks/hook-engine.mjs';
import { loadHookConfiguration } from './hooks/hook-config-loader.mjs';
import { TaskScheduler } from './orchestration/task-graph.mjs';
import { MissionRunner } from './orchestration/mission-runner.mjs';
import { MissionPlanner } from './orchestration/mission-planner.mjs';
import { ArchitectureStageGate } from './orchestration/architecture-stage-gate.mjs';
import { MissionCompletionOrchestrator } from './orchestration/mission-completion-orchestrator.mjs';
import { PlanningEvidenceGovernanceService } from './orchestration/planning-evidence-governance-service.mjs';
import { VerificationRunner } from './orchestration/verification-runner.mjs';
import { MissionAutopilot } from './orchestration/mission-autopilot.mjs';
import { InterruptManager } from './orchestration/interrupts.mjs';
import { ActivityProjection } from './orchestration/activity-projection.mjs';
import { RunCoordinator } from './orchestration/run-coordinator.mjs';
import { ReviewSummary } from './orchestration/review-summary.mjs';
import { DiffReviewService } from './review/diff-review-service.mjs';
import { AgentOperationsService } from './operations/agent-operations-service.mjs';
import { TraceEvidenceCenterService } from './operations/trace-evidence-center-service.mjs';
import { MissionStateProgressService } from './operations/mission-state-progress-service.mjs';
import { LocalOperationsCenterService } from './operations/local-operations-center-service.mjs';
import { ControlledLocalCache } from './operations/controlled-local-cache.mjs';
import { ContextMemoryCenterService } from './context/context-memory-center-service.mjs';
import { ContextOrchestrationService } from './context/context-orchestration-service.mjs';
import { EvidenceGraphRuntimeService } from './context/evidence-graph-runtime-service.mjs';
import { HybridEvidenceRetrievalService } from './context/hybrid-evidence-retrieval-service.mjs';
import { ContextPacketRuntimeService } from './context/context-packet-runtime-service.mjs';
import { EvidenceContextRuntime } from './context/evidence-context-runtime.mjs';
import { createRepositoryIntelligenceFabric } from './repository/repository-intelligence-fabric.mjs';
import { RepositoryDiscoveryService } from './repository/repository-discovery-service.mjs';
import { SemanticDependencyIntelligenceService } from './repository/semantic-dependency-intelligence-service.mjs';
import { CodeRelationshipIntelligenceService } from './repository/code-relationship-intelligence-service.mjs';
import { TreeSitterRuntimeService } from './repository/tree-sitter-runtime-service.mjs';
import { GitInspector } from './repository/git-inspector.mjs';
import { GitGateway } from './repository/git-gateway.mjs';
import { GitCompletionGovernanceService } from './repository/git-completion-governance-service.mjs';
import { LanguageServerRegistry } from './repository/language-server-registry.mjs';
import { CodeIntelligenceService } from './repository/code-intelligence-service.mjs';
import { SymbolEditService } from './repository/symbol-edit-service.mjs';
import { AdvancedSearchService } from './repository/advanced-search-service.mjs';
import { AstIntelligenceService } from './repository/ast-intelligence-service.mjs';
import { TestEngine } from './testing/test-engine.mjs';
import { DiagnosticDeltaService } from './testing/diagnostic-delta-service.mjs';
import { SelfFixController } from './testing/self-fix-controller.mjs';
import { McpRegistry } from './mcp/mcp-registry.mjs';
import { StdioMcpClient } from './mcp/stdio-mcp-client.mjs';
import { McpToolGateway } from './mcp/mcp-tool-gateway.mjs';
import { EvalRunner } from './eval/eval-runner.mjs';
import { MemoryService } from './memory/memory-service.mjs';
import { ProjectMemorySidecar } from './memory/project-memory-sidecar.mjs';
import { IndependentReviewService } from './review/independent-review-service.mjs';
import { DurableAutomationService } from './automations/durable-automation-service.mjs';
import { DesignContextService } from './design/design-context-service.mjs';
import { createHttpServer } from './server/http-server.mjs';
import { SovereignAgentKernel } from './kernel/sovereign-agent-kernel.mjs';
import { resolveUiRoot } from './ui/ui-root-resolver.mjs';
import { FileService } from './workroom/file-service.mjs';
import { CredentialVault, MemoryCredentialBackend } from './security/credential-vault.mjs';
import { SecretScanner } from './security/secret-scanner.mjs';
import { ContentIngressPipeline } from './security/content-ingress-pipeline.mjs';
import { RouteSecurityTelemetry } from './security/route-security-telemetry.mjs';
import { ArtifactSecurityScanner } from './security/artifact-security-scanner.mjs';
import { CapabilityGrantLedger, CapabilityRegistry } from './security/capability-registry.mjs';
import { SqliteCapabilityStore } from './security/sqlite-capability-store.mjs';
import { SqliteWorkspaceTrustStore } from './security/sqlite-workspace-trust-store.mjs';
import { WorkspaceTrustService } from './security/workspace-trust-service.mjs';
import { TrustAwareInstructionDiscovery, TrustAwareInstructionPolicy, TrustAwareMcpGateway, TrustAwarePluginContext } from './security/workspace-trust-gates.mjs';
import { ActionGuardrailPipeline } from './security/action-guardrail-pipeline.mjs';
import { ApprovalBundleService } from './security/approval-bundle-service.mjs';
import { CommandExecutionGovernanceService } from './security/command-execution-governance-service.mjs';
import { ShellCommandCodec } from './security/shell-command-codec.mjs';
import { SecretAccessService } from './security/secret-access-service.mjs';
import { VaultKvV2Provider, RemoteSecretManagerProvider } from './security/secret-provider-adapters.mjs';
import { CredentialHelperClient } from './security/credential-helper-client.mjs';
import { UiAssetInstaller } from './assets/ui-asset-installer.mjs';
import { UpdateService } from './update/update-service.mjs';
import { InstructionDiscovery } from './repository/instruction-discovery.mjs';
import { InstructionPolicyService } from './repository/instruction-policy-service.mjs';
import { ResourceGovernor } from './runtime/resource-governor.mjs';
import { SystemResourceSampler } from './runtime/system-resource-sampler.mjs';
import { RuntimeLeasePool, createMissionResourceFabric } from './runtime/mission-resource-fabric.mjs';
import { RuntimeModuleManager } from './runtime/runtime-module-manager.mjs';
import { createOptionalEnterpriseCloudModuleDescriptor } from './runtime/optional-enterprise-cloud-module.mjs';
import { createLazyEnterpriseCloudAdapters } from './runtime/lazy-enterprise-cloud-adapters.mjs';
import { EnvironmentSupervisor } from './runtime/environment-supervisor.mjs';
import { EnvironmentControlService } from './runtime/environment-control-service.mjs';
import { NolaneNativeAgentService, NolaneNativeOrchestrationService, NolaneNativeRuntimeService, NolaneSessionStore, NolaneOperationalBoundaryService } from './nolane-native/index.mjs';
import { SmallModelFoundationService } from './small-model/foundation-service.mjs';
import { PtyHostClient } from './terminal/pty-host-client.mjs';
import { TerminalManager } from './terminal/terminal-manager.mjs';
import { LocalResourceSandboxService } from './sandbox/local-resource-sandbox-service.mjs';
import { LocalContainerPreflightService } from './sandbox/local-container-preflight-service.mjs';
import { PodmanSandboxDriver } from './sandbox/podman-sandbox-driver.mjs';
import { WindowsJobObjectDriver } from './sandbox/windows-job-object-driver.mjs';
import { MacOsSandboxDriver } from './sandbox/macos-sandbox-driver.mjs';
import { createEvent } from './protocol/events.mjs';
import { PRODUCT_NAME, VERSION, LAUNCHER_VERSION } from './version.mjs';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { HttpCache } from './web/cache.mjs';
import { WebIntelligence } from './web/intelligence.mjs';
import { BraveSearchProvider, TavilySearchProvider } from './web/search-providers.mjs';
import { GoalService } from './goals/goal-service.mjs';
import { AdaptiveReplanner } from './goals/adaptive-replanner.mjs';
import { GoalToolGateway } from './goals/goal-tool-gateway.mjs';
import { GoalRunService } from './goals/goal-run-service.mjs';
import { GoalScheduler } from './goals/goal-scheduler.mjs';
import { CommandRegistry } from './commands/command-registry.mjs';
import { registerCoreCommands } from './commands/core-commands.mjs';
import { PlaywrightCliDriver } from './browser/playwright-cli-driver.mjs';
import { PlaywrightRuntimeInstaller } from './browser/playwright-runtime-installer.mjs';
import { BrowserAgentService } from './browser/browser-agent-service.mjs';
import { BrowserToolGateway } from './browser/browser-tool-gateway.mjs';
import { ImageComparisonService } from './browser/image-comparison-service.mjs';
import { PluginScanner } from './plugins/plugin-scanner.mjs';
import { PluginService } from './plugins/plugin-service.mjs';
import { PluginTransparencyLog } from './plugins/plugin-transparency-log.mjs';
import { SqlitePluginTransparencyStore } from './plugins/sqlite-plugin-transparency-store.mjs';
import { loadPluginTrustConfiguration } from './plugins/plugin-trust-bootstrap.mjs';
import { RemotePluginSourceResolver } from './plugins/remote-plugin-source-resolver.mjs';
import { MissionGraphProjection } from './orchestration/mission-graph-projection.mjs';
import { BrowserPermissionService } from './security/browser-permission-service.mjs';
import { OAuthResourceServer, createOAuthIntrospectionVerifier } from './mcp/oauth-resource-server.mjs';
import { StreamableHttpSessionStore } from './mcp/streamable-http-session.mjs';
import { RemoteMcpServer } from './mcp/remote-mcp-server.mjs';
import { RemoteMcpHttpAdapter } from './mcp/remote-mcp-http-adapter.mjs';
import { SessionLedger } from './sessions/session-ledger.mjs';
import { createExecutionStoryFoundation, createTimeTravelFoundation, createTrustAdoptionFoundation } from './adoption/trust-adoption-foundation.mjs';

const environmentMigrationEvents = [];
const nolaneEnvironment = createNolaneEnvironment(process.env, { eventSink: (event) => environmentMigrationEvents.push(event) });
const compatibilityEnvironment = nolaneEnvironment.compatibilityView();

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectoryResolution = await migrateLegacyDataDirectory({ explicitDataDir: nolaneEnvironment.get('DATA_DIR') });
const config = loadConfig({
  host: nolaneEnvironment.get('HOST'),
  port: nolaneEnvironment.get('PORT'),
  dataDir: dataDirectoryResolution.dataDir,
  workspaceRoot: nolaneEnvironment.get('WORKSPACE'),
  forgeOsRoot: path.join(appRoot, 'vendor', 'forge-os'),
  authToken: nolaneEnvironment.get('TOKEN'),
});
await mkdir(config.dataDir, { recursive: true });
const eventHub = new DurableEventHub({ maxSubscribers: 256 });
const store = new StudioStore(path.join(config.dataDir, 'nolane-agent.db'), { eventHub });
if (dataDirectoryResolution.status === 'migrated') store.appendEvent(createEvent('configuration.data-directory-migration', dataDirectoryResolution));
for (const migrationEvent of environmentMigrationEvents.splice(0)) store.appendEvent(createEvent('configuration.environment-migration', migrationEvent));
const dynamicContextStore = new DynamicContextStore({ root: path.join(config.dataDir, 'context-artifacts'), previewBytes: 4_096, maxArtifactBytes: Number(nolaneEnvironment.get('CONTEXT_ARTIFACT_MAX_BYTES')) || 50_000_000 });
const contextHistoryArchive = new ContextHistoryArchive({
  file: path.join(config.dataDir, 'context-history.db'),
  contextStore: dynamicContextStore,
  conversationLoader: ({ projectId, missionId }) => store.listMessages({ projectId, missionId, limit: 5_000 }),
});
const forgeBridge = new ForgeOsBridge({ forgeOsRoot: config.forgeOsRoot, dataDir: path.join(config.dataDir, 'forgeos') });
const forgeGateway = new ForgeOsToolGateway({ bridge: forgeBridge });

const runtimeModuleManager = new RuntimeModuleManager({
  profile: config.performance.profile,
  eventSink: (event) => store.appendEvent(createEvent('runtime.module-transition', event)),
});
runtimeModuleManager.register(createOptionalEnterpriseCloudModuleDescriptor({
  dataDir: config.dataDir,
  environment: compatibilityEnvironment,
  eventSink: (event) => store.appendEvent(createEvent(event.type ?? 'enterprise.audit', event)),
}));
const lazyEnterpriseCloud = createLazyEnterpriseCloudAdapters({
  moduleManager: runtimeModuleManager,
  oidcConfigured: Boolean(nolaneEnvironment.get('OIDC_PROVIDERS_JSON')),
  scimConfigured: Boolean(nolaneEnvironment.get('SCIM_INTROSPECTION_URL')),
});
const { enterpriseCloudRoutes, requestAuthorizer: enterpriseRequestAuthorizer, oidcHttp, scimHttp } = lazyEnterpriseCloud;


const instructionDiscovery = new InstructionDiscovery();
const instructionGlobalRoots = String(nolaneEnvironment.get('GLOBAL_INSTRUCTION_ROOTS') ?? '').split(path.delimiter).map((item) => item.trim()).filter(Boolean);
const instructionPolicy = new InstructionPolicyService({ discovery: instructionDiscovery, store, globalRoots: instructionGlobalRoots, version: VERSION });
const systemResourceSampler = new SystemResourceSampler();
let missionResourceFabric = null;
const resourceGovernor = new ResourceGovernor({
  limits: {
    maxActiveAgents: config.performance.maxActiveAgents,
    maxActiveTerminals: config.performance.maxVisibleTerminals,
    maxEditorModels: config.performance.maxEditorModels ?? 12,
    maxBrowserSessions: config.performance.maxBrowserSessions,
    maxToolOutputBytes: config.performance.maxToolOutputBytes,
    maxEventHistory: config.performance.maxEventHistory,
    semanticIndexing: config.performance.semanticIndexing,
    backgroundRefresh: config.performance.backgroundRefresh,
  },
  onTransition(event) {
    store.appendEvent(createEvent('runtime.resource-transition', event));
    void runtimeModuleManager.applyPolicy({ state: event.to, ...event.policy });
    void missionResourceFabric?.onGovernorSnapshot(event);
  },
});
let eventLoopProbeAt = performance.now();
const resourceTimer = setInterval(() => {
  const now = performance.now(); const delay = Math.max(0, now - eventLoopProbeAt - 2_000); eventLoopProbeAt = now;
  resourceGovernor.sample(systemResourceSampler.sample({ eventLoopDelayMs: delay }));
}, 2_000);
resourceTimer.unref?.();

const providerRuntimePool = new RuntimeLeasePool({
  kind: 'provider',
  governor: resourceGovernor,
  policyKey: 'maxActiveAgents',
  maxPerKey: Math.max(1, Math.min(2, config.performance.maxActiveAgents)),
  idleTtlMs: 60_000,
  eventSink: (event) => store.appendEvent(createEvent(event.type, event)),
});
const browserRuntimePool = new RuntimeLeasePool({
  kind: 'browser',
  governor: resourceGovernor,
  policyKey: 'maxBrowserSessions',
  maxPerKey: 1,
  idleTtlMs: 30_000,
  eventSink: (event) => store.appendEvent(createEvent(event.type, event)),
});

const adaptiveHarness = createAdaptiveHarnessLab({
  dataDir: config.dataDir,
  eventSink: (event) => store.appendEvent(createEvent(event.type, event)),
  minImprovement: 0.01,
});
missionResourceFabric = createMissionResourceFabric({
  governor: resourceGovernor,
  canary: adaptiveHarness.canary,
  projectRootResolver: async (projectId) => {
    const project = store.getProject(String(projectId ?? ''));
    if (!project?.workspaceRoot) throw Error(`Unknown project: ${projectId}`);
    return project.workspaceRoot;
  },
  eventSink: (event) => store.appendEvent(createEvent(event.type ?? 'mission-resource-fabric.event', event, { projectId: event.projectId, missionId: event.missionId, taskId: event.taskId })),
});

const podmanDriver = new PodmanSandboxDriver();
const windowsJobObjectDriver = new WindowsJobObjectDriver({ helperPath: path.resolve(nolaneEnvironment.get('JOB_OBJECT_HELPER') ?? path.join(appRoot, 'native', 'ForgeJobObject.exe')) });
const macOsSandboxDriver = new MacOsSandboxDriver({ profileRoot: path.join(config.dataDir, 'macos-sandbox-profiles') });
const localResourceSandbox = new LocalResourceSandboxService({
  podmanDriver, windowsJobObjectDriver, macOsSandboxDriver,
  file: path.join(config.dataDir, 'local-resource-sandboxes.db'),
  projectResolver: (projectId) => store.getProject(projectId),
  eventSink: (event) => store.appendEvent(createEvent(event.type, event)),
});
const architectureStageGate = new ArchitectureStageGate({ root: appRoot });
const localContainerPreflight = new LocalContainerPreflightService();

let commandExecutionGovernance = null;
const shellCommandCodec = new ShellCommandCodec();

const ptyHostPath = path.resolve(nolaneEnvironment.get('PTY_HOST') ?? path.join(appRoot, 'native', process.platform === 'win32' ? 'ForgePty.exe' : 'ForgePty'));
const credentialHelperPath = path.resolve(nolaneEnvironment.get('CREDENTIAL_HELPER') ?? path.join(appRoot, 'native', process.platform === 'win32' ? 'ForgeCredential.exe' : 'ForgeCredential'));
const candidateShells = process.platform === 'win32'
  ? [process.env.ComSpec, path.join(process.env.SystemRoot ?? 'C:\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), path.join(process.env.ProgramFiles ?? 'C:\Program Files', 'PowerShell', '7', 'pwsh.exe')]
  : [process.env.SHELL, '/bin/bash', '/bin/sh'];
const allowedShells = [...new Set((nolaneEnvironment.get('ALLOWED_SHELLS') ? nolaneEnvironment.get('ALLOWED_SHELLS').split(path.delimiter) : candidateShells).filter(Boolean).map((item) => path.resolve(item)).filter((item) => existsSync(item)))];
const { createUxFoundationRuntime } = await import('./ui/ux-foundation-runtime.mjs');
const uxFoundation = await createUxFoundationRuntime({ appRoot, dataDir: config.dataDir, maxOutputBytes: config.performance.maxToolOutputBytes });
const { managedProcesses } = uxFoundation;
const terminalManager = new TerminalManager({
  projectResolver: (projectId) => store.getProject(projectId),
  clientFactory: () => new PtyHostClient({ command: ptyHostPath, requestTimeoutMs: 10_000, maxFrameBytes: 1024 * 1024 }),
  allowedShells,
  maxSessionsPerProject: config.performance.maxVisibleTerminals,
  governor: resourceGovernor,
  resourceSandbox: localResourceSandbox,
  shellCodec: shellCommandCodec,
  commandGovernance: commandExecutionGovernance,
});
const terminalHistoryRecorder = new TerminalHistoryRecorder({ terminalManager, archive: contextHistoryArchive, root: path.join(config.dataDir, 'terminal-history-spool') }).start();
const credentialBackend = process.platform === 'win32'
  ? new CredentialHelperClient({ command: credentialHelperPath, requestTimeoutMs: 10_000 })
  : new MemoryCredentialBackend();
const credentialVault = new CredentialVault({ backend: credentialBackend });
const uiAssetsRoot = path.join(config.dataDir, 'ui-assets');
const uiAssets = new UiAssetInstaller({ root: uiAssetsRoot });
const fileService = new FileService({
  store,
  brokerFactory: (workspaceRoot) => new ToolBroker({ workspaceRoot, allowedPaths: ['**'], deniedPaths: ['.env', '.env.*', '**/.env', '**/.env.*', '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx'], allowedCommands: [], maxOutputBytes: config.performance.maxToolOutputBytes, dynamicContextStore, artifactThresholdBytes: 64_000, managedProcessRegistry: managedProcesses }),
});
let updateService;
let packagedUpdate = Object.freeze({ enabled: false, reason: 'not-loaded' });
try {
  const { loadPackagedUpdateConfiguration } = await import('./update/update-configuration.mjs');
  packagedUpdate = await loadPackagedUpdateConfiguration({ appRoot, environment: process.env });
} catch (error) {
  packagedUpdate = Object.freeze({ enabled: false, reason: 'invalid-packaged-update-config', message: error.message });
}
const updateEndpoint = nolaneEnvironment.get('UPDATE_ENDPOINT') ?? packagedUpdate.endpoint ?? '';
const updateRepository = nolaneEnvironment.get('UPDATE_REPOSITORY') ?? packagedUpdate.repository ?? '';
const updateChannel = nolaneEnvironment.get('UPDATE_CHANNEL') ?? packagedUpdate.channel ?? 'stable';
const updatePublicKeyFile = nolaneEnvironment.get('UPDATE_PUBLIC_KEY_FILE') ?? '';
const updatePublicKey = updatePublicKeyFile ? await readFile(path.resolve(updatePublicKeyFile), 'utf8') : packagedUpdate.publicKey;
if (updateEndpoint && updatePublicKey) {
  updateService = new UpdateService({ currentVersion: VERSION, launcherVersion: LAUNCHER_VERSION, channel: updateChannel, repository: updateRepository || null, endpoint: updateEndpoint, publicKey: updatePublicKey, dataDir: config.dataDir });
} else {
  updateService = Object.freeze({
    async check() { return Object.freeze({ available: false, reason: 'signed-update-feed-not-configured' }); },
    async stage() { throw Object.assign(new Error('Signed update feed is not configured'), { statusCode: 503 }); },
  });
}
const instructionApi = {
  async discover(project) {
    const trust = await workspaceTrust.status(project.id);
    const records = await governedInstructionDiscovery.discover(project.workspaceRoot, { projectId: project.id });
    return Object.freeze({ projectId: project.id, trust, instructions: records.filter((item) => item.kind === 'instruction'), workflows: records.filter((item) => item.kind === 'workflow') });
  },
};
const instructionPolicyApi = {
  resolve(input) { return governedInstructionPolicy.resolve(input); },
  clear(projectId = null) { return governedInstructionPolicy.clear(projectId); },
};
const runtimeStatus = {
  async snapshot() {
    return Object.freeze({
      version: VERSION,
      platform: process.platform,
      arch: process.arch,
      allowedShells,
      ptyHost: { configured: existsSync(ptyHostPath), path: ptyHostPath },
      credentialVault: { backend: process.platform === 'win32' ? 'windows-credential-manager' : 'memory-session', configured: process.platform !== 'win32' || existsSync(credentialHelperPath) },
      profile: Object.freeze({
        requested: config.performance.requestedProfile,
        resolved: config.performance.profile,
        reason: config.performance.profileReason,
        reducedEffects: config.performance.reducedEffects,
        semanticIndexing: config.performance.semanticIndexing,
        backgroundRefresh: config.performance.backgroundRefresh,
      }),
      resources: resourceGovernor.snapshot(),
      runtimeModules: runtimeModuleManager.snapshot(),
      workFabric: Object.freeze({
        providers: providerRuntimePool.snapshot(),
        browser: browserRuntimePool.snapshot(),
        repository: repositoryIntelligenceFabric.schedulerSnapshot(),
      }),
      adaptiveHarness: adaptiveHarness.publicView(),
      missionResourceFabric: missionResourceFabric.publicView(),
      repositoryIntelligence: await repositoryIntelligenceFabric.status(),
      uiAssets: await uiAssets.status(),
      updates: { configured: Boolean(updateEndpoint && updatePublicKey), channel: updateChannel, repository: updateRepository || null, reason: packagedUpdate.reason ?? null },
    });
  },
};

const projectService = {
  async create(input) {
    const forgeProject = await forgeBridge.createProject({ name: input.name, domain: 'developer-tools', assurance: 'A1' });
    return store.createProject({ ...input, metadata: { ...(input.metadata ?? {}), forgeProjectId: forgeProject.id } });
  },
};
const governedForge = {
  buildContextPack: (input) => forgeBridge.buildContextPack(input),
  async recordEvidence(studioProjectId, input) {
    const project = store.getProject(studioProjectId);
    const forgeProjectId = project?.metadata?.forgeProjectId;
    if (!forgeProjectId) throw new Error(`Studio project ${studioProjectId} is not linked to ForgeOS`);
    return forgeBridge.recordEvidence(forgeProjectId, input);
  },
};

const providers = new ProviderRegistry({ executionPool: providerRuntimePool, sessionHost: missionResourceFabric.sessionHost });
const providerSandboxRoot = path.join(config.dataDir, 'provider-sandboxes');
await mkdir(providerSandboxRoot, { recursive: true });
const providerOverrides = {};
for (const id of ['codex', 'claude', 'gemini', 'opencode', 'github-copilot', 'cursor-agent', 'kiro-cli', 'factory-droid', 'auggie', 'amp', 'amazon-q', 'crush', 'roo-code', 'qwen-code', 'continue-cli', 'cline', 'mistral-vibe-code', 'aider', 'goose']) {
  const cwd = path.join(providerSandboxRoot, id); await mkdir(cwd, { recursive: true }); providerOverrides[id] = { cwd };
}
for (const provider of createBuiltInCliProviders(providerOverrides)) providers.register(provider);
const codexAppServer = providers.register(new CodexAppServerClient({ cwd: path.join(providerSandboxRoot, 'codex-app-server'), approvalHandler: async () => ({ decision: 'decline' }) }));
await mkdir(codexAppServer.cwd, { recursive: true });
const { modelProfiles, modelDiscovery, modelProbes, modelManager } = uxFoundation.bindProviders(providers);
const providerConnections = new ProviderConnectionService({
  store,
  registry: providers,
  credentialVault,
  codexAppServer,
  modelProfiles,
  modelDiscovery,
  modelProbes,
  cliAuthAdapters: {
    claude: new CliAuthAdapter({
      id: 'claude',
      label: 'Claude Code',
      executable: 'claude',
      statusArgs: ['auth', 'status'],
      loginArgs: { claudeai: ['auth', 'login', '--claudeai'], console: ['auth', 'login', '--console'] },
      logoutArgs: ['auth', 'logout'],
      cwd: path.join(providerSandboxRoot, 'claude'),
    }),
    'github-copilot': createAvailabilityOnlyCliAuthAdapter({
      id: 'github-copilot',
      label: 'GitHub Copilot CLI',
      executable: 'copilot',
      statusArgs: ['--version'],
      loginArgs: { github: ['login'] },
      cwd: path.join(providerSandboxRoot, 'github-copilot'),
    }),
    cline: createAvailabilityOnlyCliAuthAdapter({
      id: 'cline',
      label: 'Cline CLI',
      executable: 'cline',
      statusArgs: ['--version'],
      loginArgs: { provider: ['auth'] },
      cwd: path.join(providerSandboxRoot, 'cline'),
    }),
    'cursor-agent': createAvailabilityOnlyCliAuthAdapter({
      id: 'cursor-agent',
      label: 'Cursor Agent CLI',
      executable: 'agent',
      statusArgs: ['--version'],
      loginArgs: { cursor: ['login'] },
      cwd: path.join(providerSandboxRoot, 'cursor-agent'),
    }),
    'kiro-cli': createAvailabilityOnlyCliAuthAdapter({
      id: 'kiro-cli',
      label: 'Kiro CLI',
      executable: 'kiro-cli',
      statusArgs: ['--version'],
      loginArgs: { kiro: ['login'] },
      cwd: path.join(providerSandboxRoot, 'kiro-cli'),
    }),
    auggie: createAvailabilityOnlyCliAuthAdapter({
      id: 'auggie',
      label: 'Augment Auggie CLI',
      executable: 'auggie',
      statusArgs: ['--version'],
      loginArgs: { augment: ['login'] },
      cwd: path.join(providerSandboxRoot, 'auggie'),
    }),
  },
});
await providerConnections.load();
const providerProfiles = modelProfiles.publicView().models;
for (const connection of providerConnections.list()) {
  const hasExactModel = providerProfiles.some((profile) => profile.providerId === connection.id);
  const modelId = connection.config?.model ?? (!hasExactModel && (connection.kind === 'cli' || connection.kind === 'codex-app-server') ? 'cli-selected' : null);
  if (!modelId) continue;
  const capabilityKeys = new Map([
    ['structured-output', 'structuredOutput'], ['subscription-auth', 'subscriptionAuth'], ['long-context', 'longContext'],
    ['governed-actions', 'governedActions'], ['structured-events', 'structuredEvents'], ['tool-calling', 'tools'],
  ]);
  const capabilityPatch = Object.fromEntries((connection.capabilities ?? []).map((item) => {
    const raw = String(item); return [capabilityKeys.get(raw) ?? raw.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase()), true];
  }));
  modelProfiles.upsert({
    providerId: connection.id, modelId, displayName: connection.config?.model ?? `${connection.label ?? connection.id} selected model`,
    family: connection.harnessFamily ?? null, capabilities: capabilityPatch,
    local: { runtime: connection.kind === 'cli' ? 'official-cli' : undefined }, metadata: { providerKind: connection.kind, configured: connection.configured === true },
  });
}
if (nolaneEnvironment.get('OPENAI_BASE_URL') && nolaneEnvironment.get('OPENAI_MODEL') && nolaneEnvironment.get('OPENAI_API_KEY')) {
  try {
    await providerConnections.configureApi({
      id: nolaneEnvironment.get('OPENAI_PROVIDER_ID') ?? 'openai-compatible',
      kind: 'openai-compatible',
      baseUrl: nolaneEnvironment.get('OPENAI_BASE_URL'),
      apiKey: nolaneEnvironment.get('OPENAI_API_KEY'),
      account: nolaneEnvironment.get('OPENAI_SECRET_ACCOUNT') ?? 'environment',
      model: nolaneEnvironment.get('OPENAI_MODEL'),
      testConnection: true,
    });
  } catch (error) {
    console.error(JSON.stringify({ type: 'provider.environment-configuration.failed', error: String(error?.message ?? error).slice(0, 300) }));
  }
}

const nativeOrchestration = new NolaneNativeOrchestrationService({
  dataDir: path.join(config.dataDir, 'nolane-native-orchestration'),
  skillRoots: [path.join(config.dataDir, 'nolane-skills')],
  forgeOsRoots: [config.forgeOsRoot],
  eventSink: (event) => store.appendEvent(createEvent(event.type, event)),
});
await nativeOrchestration.open();
const sessionStore = new NolaneSessionStore({ root: path.join(config.dataDir, 'nolane-sessions') });
await sessionStore.open();

const nativeAgent = new NolaneNativeAgentService({
  store,
  sessionStore,
  providerSource: providers,
  allowedCommands: config.allowedCommands,
  eventSink: (event) => store.appendEvent(createEvent(event.type, event, { projectId: event.projectId, missionId: event.missionId })),
});

const agentModes = new AgentModeService();
const autonomyPolicy = new AutonomyPolicy();
const brokerForTask = (task, { verification = false } = {}) => {
  const project = store.getProject(task.projectId);
  if (!project) throw new Error(`Unknown project: ${task.projectId}`);
  const environmentAttester = createTaskEnvironmentAttester({
    projectResolver: (projectId) => store.getProject(projectId),
    taskResolver: (taskId) => store.getTask(taskId) ?? (String(task.id ?? '') === taskId ? task : null),
    worktreesRoot: path.join(config.dataDir, 'worktrees'),
  });
  const broker = new ToolBroker({
    workspaceRoot: task.metadata?.executionWorkspace ?? project.workspaceRoot,
    allowedPaths: verification ? ['**'] : (task.allowedPaths?.length ? task.allowedPaths : ['**']),
    deniedPaths: task.deniedPaths ?? [],
    allowedCommands: config.allowedCommands,
    maxOutputBytes: config.performance.maxToolOutputBytes,
    dynamicContextStore,
    artifactThresholdBytes: 64_000,
    commandGovernance: commandExecutionGovernance,
    managedProcessRegistry: managedProcesses,
  });
  return new AutonomyGuardedBroker({ broker, policy: autonomyPolicy, store, task, environmentAttester });
};
const outcomeMetricsStore = new OutcomeMetricsStore({ file: path.join(config.dataDir, 'provider-outcomes.db') });
const providerOutcomeFeedback = new ProviderOutcomeFeedbackService({ metrics: outcomeMetricsStore, taskResolver: (taskId) => store.getTask(taskId) });
const router = new OutcomeAwareProviderRouter({ registry: providers, outcomeStore: outcomeMetricsStore, failureThreshold: 2, cooldownMs: 60_000 });
const repositoryIntelligenceFabric = createRepositoryIntelligenceFabric({
  store,
  governor: resourceGovernor,
  journal: missionResourceFabric.journal,
  maxWorkers: Math.max(1, Math.min(2, config.performance.maxActiveAgents)),
  eventSink: (event) => store.appendEvent(createEvent(event.type, event, { projectId: event.projectId })),
});
const repositoryIntelligence = repositoryIntelligenceFabric;
const repositoryIndex = repositoryIntelligenceFabric;
const repositoryDiscovery = new RepositoryDiscoveryService({ version: VERSION, store });
const codebaseKnowledgeGraph = Object.freeze({
  snapshot: (projectId, options = {}) => repositoryIntelligenceFabric.graphSnapshot(String(projectId), options),
  index: (project) => repositoryIntelligenceFabric.graphIndex(project),
  searchRegex: (projectId, pattern, options = {}) => repositoryIntelligenceFabric.graphSearchRegex(String(projectId), pattern, options),
  rank: (projectId, query, options = {}) => repositoryIntelligenceFabric.graphRank(String(projectId), query, options),
  signature: (project) => repositoryIntelligenceFabric.graphSignature(project),
});
const codebaseKnowledge = Object.freeze({
  snapshot: (projectId, options = {}) => repositoryIntelligenceFabric.graphSnapshot(String(projectId), options),
  digitalTwin: (projectId, options = {}) => repositoryIntelligenceFabric.digitalTwin(String(projectId), options),
  indexProject: async ({ projectId, principalId = null } = {}) => {
    const project = store.getProject(String(projectId ?? ''));
    if (!project) throw Object.assign(new Error('Unknown project'), { statusCode: 404 });
    const result = await repositoryIntelligenceFabric.graphIndex(project);
    return Object.freeze({ ...result, principalId: principalId ? String(principalId) : null });
  },
  searchRegex: (projectId, pattern, options = {}) => repositoryIntelligenceFabric.graphSearchRegex(String(projectId), pattern, options),
  rank: (projectId, query, options = {}) => repositoryIntelligenceFabric.graphRank(String(projectId), query, options),
  watchStart: async ({ projectId, principalId = null } = {}) => {
    const project = store.getProject(String(projectId ?? ''));
    if (!project) throw Object.assign(new Error('Unknown project'), { statusCode: 404 });
    await workspaceTrust.requireTrusted(project.id, 'background');
    return Object.freeze({ ...(await repositoryIntelligenceFabric.watchStart(project)), principalId: principalId ? String(principalId) : null });
  },
  watchStop: async ({ projectId, principalId = null } = {}) => Object.freeze({ ...(await repositoryIntelligenceFabric.watchStop(String(projectId))), principalId: principalId ? String(principalId) : null }),
  watchStatus: (projectId) => repositoryIntelligenceFabric.watchStatus(String(projectId)),
});
const semanticDependency = new SemanticDependencyIntelligenceService({ store, repositoryIntelligence, codebaseKnowledge: codebaseKnowledgeGraph });
const codeRelationships = new CodeRelationshipIntelligenceService({ store, codebaseKnowledge: codebaseKnowledgeGraph });
const treeSitterRuntime = new TreeSitterRuntimeService({ projectResolver: (projectId) => store.getProject(projectId), expectedVersion: nolaneEnvironment.get('TREE_SITTER_VERSION') ?? null, configPath: nolaneEnvironment.get('TREE_SITTER_CONFIG_PATH') ?? null });
let languageServerDefinitions = [];
if (nolaneEnvironment.get('LANGUAGE_SERVERS_JSON')) {
  languageServerDefinitions = JSON.parse(nolaneEnvironment.get('LANGUAGE_SERVERS_JSON'));
  if (!Array.isArray(languageServerDefinitions)) throw new TypeError('FORGE_STUDIO_LANGUAGE_SERVERS_JSON must be an array');
}
const languageServerRegistry = new LanguageServerRegistry({ servers: languageServerDefinitions });
const codeIntelligence = CodeIntelligenceService.pooled({ registry: languageServerRegistry, repositoryIndex });
const agentProfileLoader = new AgentProfileLoader();
const secretScanner = new SecretScanner();
const contentIngress = new ContentIngressPipeline({ secretScanner });
const routeSecurityTelemetry = new RouteSecurityTelemetry({ eventSink: (event) => store.appendEvent(createEvent(event.type, event)) });
const sessionDirectory = path.join(config.dataDir, 'sessions');
await mkdir(sessionDirectory, { recursive: true, mode: 0o700 });
const sessionLedgerFactory = ({ sessionId }) => SessionLedger.open({ directory: sessionDirectory, sessionId });
const gitGatewayFactory = ({ projectRoot }) => new GitGateway({ repositoryRoot: projectRoot, secretScanner });
const gitGovernance = new GitCompletionGovernanceService({ store, gatewayFactory: gitGatewayFactory });
const imageComparisonFactory = ({ projectRoot }) => new ImageComparisonService({
  workspaceRoot: projectRoot,
  artifactRoot: path.join(projectRoot, '.nolane-agent', 'visual-diffs'),
  maxImageBytes: Number(nolaneEnvironment.get('MAX_IMAGE_BYTES')) || 20_000_000,
  maxPixels: Number(nolaneEnvironment.get('MAX_IMAGE_PIXELS')) || 25_000_000,
});
const symbolEditFactory = ({ task = null, projectRoot }) => new SymbolEditService({
  workspaceRoot: projectRoot,
  allowedPaths: task?.allowedPaths?.length ? task.allowedPaths : ['**'],
  deniedPaths: task?.deniedPaths ?? ['.env', '.env.*', '**/*.pem', '**/*.key', '**/node_modules/**'],
});
const advancedSearchFactory = ({ task = null, projectRoot }) => new AdvancedSearchService({
  workspaceRoot: projectRoot,
  allowedPaths: task?.allowedPaths?.length ? task.allowedPaths : ['**'],
  deniedPaths: task?.deniedPaths ?? ['.env', '.env.*', '**/*.pem', '**/*.key', '**/node_modules/**'],
  maxFileBytes: Number(nolaneEnvironment.get('SEARCH_MAX_FILE_BYTES')) || 2_000_000,
  maxFiles: Number(nolaneEnvironment.get('SEARCH_MAX_FILES')) || 20_000,
});
const astIntelligenceFactory = ({ task = null, projectRoot }) => new AstIntelligenceService({
  workspaceRoot: projectRoot,
  allowedPaths: task?.allowedPaths?.length ? task.allowedPaths : ['**'],
  deniedPaths: task?.deniedPaths ?? ['.env', '.env.*', '**/*.pem', '**/*.key', '**/node_modules/**'],
});
const testEngineFactory = ({ task = null, projectRoot }) => new TestEngine({
  workspaceRoot: projectRoot,
  timeoutMs: Number(nolaneEnvironment.get('TEST_TIMEOUT_MS')) || 120_000,
  ...(task ? { runner: async ({ command, args, timeoutMs, signal }) => {
    const result = await brokerForTask(task, { verification: true }).execute({ tool: 'process.run', input: { command, args, cwd: '.', timeoutMs } }, { signal });
    return result.output;
  } } : {}),
});
const diagnosticDeltaService = new DiagnosticDeltaService({
  maxLogBytes: Math.max(64_000, Number(nolaneEnvironment.get('MAX_DIAGNOSTIC_LOG_BYTES')) || 5_000_000),
  maxDiagnostics: Math.max(10, Number(nolaneEnvironment.get('MAX_DIAGNOSTICS')) || 10_000),
});
const captureTaskTestBaseline = async (task, { signal = null } = {}) => {
  const projectRoot = task.metadata?.executionWorkspace ?? store.getProject(task.projectId)?.workspaceRoot;
  if (!projectRoot) throw new Error(`Baseline project is unavailable: ${task.projectId}`);
  const matrix = task.metadata?.testMatrix ?? {};
  const relatedTest = matrix.relatedTests?.[0] ?? null;
  const scope = relatedTest ? 'file' : 'package';
  const input = { scope, timeoutMs: matrix.timeoutMs, signal };
  if (relatedTest) input.path = relatedTest;
  const result = await testEngineFactory({ task, projectRoot }).run(input);
  const output = [String(result.output?.stdout ?? ''), String(result.output?.stderr ?? '')].filter(Boolean).join('\n');
  const base = {
    schema: 'forge.test-baseline.v1',
    taskId: task.id,
    scope,
    path: relatedTest,
    status: result.status,
    output,
    sourceReceiptSha256: result.receipt?.receiptSha256 ?? null,
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
};
const artifactSecurityFactory = ({ task = null, projectRoot }) => new ArtifactSecurityScanner({
  workspaceRoot: projectRoot,
  allowedPaths: task?.allowedPaths?.length ? task.allowedPaths : ['**'],
  deniedPaths: task?.deniedPaths ?? ['.env', '.env.*', '**/*.pem', '**/*.key', '**/node_modules/**'],
  maxFiles: Number(nolaneEnvironment.get('SECURITY_SCAN_MAX_FILES')) || 10_000,
  maxTotalBytes: Number(nolaneEnvironment.get('SECURITY_SCAN_MAX_BYTES')) || 1_000_000_000,
});
const capabilityStateStore = new SqliteCapabilityStore(path.join(config.dataDir, 'capabilities.db'));
const capabilityRegistry = new CapabilityRegistry();
const capabilityGrantLedger = new CapabilityGrantLedger({ registry: capabilityRegistry, storage: capabilityStateStore, eventSink: (event) => store.appendEvent(createEvent(event.type, event)) });
const approvalBundles = new ApprovalBundleService({ eventSink: (receipt) => store.appendEvent(createEvent('security.command-approval-bundle', receipt)) });
commandExecutionGovernance = new CommandExecutionGovernanceService({ capabilityLedger: capabilityGrantLedger, approvalBundles, eventSink: (receipt) => store.appendEvent(createEvent('security.command-governance', receipt)) });
terminalManager.commandGovernance = commandExecutionGovernance;
const workspaceTrustStateStore = new SqliteWorkspaceTrustStore(path.join(config.dataDir, 'workspace-trust.db'));
const workspaceTrust = new WorkspaceTrustService({
  storage: workspaceTrustStateStore,
  projectResolver: (projectId) => store.getProject(projectId),
  eventSink: (event) => store.appendEvent(createEvent(event.type, event, { projectId: event.projectId })),
});
const governedInstructionDiscovery = new TrustAwareInstructionDiscovery({
  base: instructionDiscovery,
  trust: workspaceTrust,
  eventSink: (event) => store.appendEvent(createEvent(event.type, event, { projectId: event.projectId, taskId: event.taskId ?? null })),
});
const governedInstructionPolicy = new TrustAwareInstructionPolicy({
  base: instructionPolicy,
  trust: workspaceTrust,
  eventSink: (event) => store.appendEvent(createEvent(event.type, event, { projectId: event.projectId, taskId: event.taskId ?? null })),
});
const actionGuardrail = new ActionGuardrailPipeline({ capabilityLedger: capabilityGrantLedger, eventSink: (event) => store.appendEvent(createEvent('security.action-guardrail', event)) });
const environmentSupervisor = new EnvironmentSupervisor({ file: path.join(config.dataDir, 'environments.db'), root: path.join(config.dataDir, 'environments') });
const environmentControl = new EnvironmentControlService({ supervisor: environmentSupervisor, capabilityLedger: capabilityGrantLedger, projectResolver: (projectId) => store.getProject(projectId), eventSink: (event) => store.appendEvent(createEvent('environment.operation', event, { projectId: event.projectId })) });
const nativeRuntime = new NolaneNativeRuntimeService({ projectRoot: appRoot });
const operationalBoundary = new NolaneOperationalBoundaryService();
const { DependencyPreflightService } = await import('./release/dependency-preflight-service.mjs');
const dependencyPreflight = new DependencyPreflightService({ projectRoot: appRoot });
const smallModelFoundation = new SmallModelFoundationService();
const { createNolaneNativeCapabilityPack } = await import('./nolane-native/capability-pack.mjs');
const nativeCapabilities = await createNolaneNativeCapabilityPack({
  memoryFile: path.join(config.dataDir, 'native-cross-session-memory.json'),
  allowHosts: String(nolaneEnvironment.get('NATIVE_WEB_ALLOW_HOSTS') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
});
smallModelFoundation.verifiers.register({ id: 'contract-verifier', soundnessScope: ['typed-contracts'], readOnly: true, independent: true, evaluate: ({ expectedEffect }) => ({ pass: true, criterionDelta: Number(expectedEffect?.criterionDelta ?? 0) }) });
const secretProviders = {};
const parseCredentialRef = (suffix) => {
  const value = nolaneEnvironment.get(suffix);
  if (!value) return null;
  const parsed = JSON.parse(value);
  const canonicalName = `NOLANE_AGENT_${suffix}`;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object' || !parsed.service || !parsed.account) throw new TypeError(`${canonicalName} must be a JSON credential reference`);
  return { service: String(parsed.service), account: String(parsed.account) };
};
const vaultTokenRef = parseCredentialRef('VAULT_TOKEN_REF');
if (nolaneEnvironment.get('VAULT_URL') && vaultTokenRef) secretProviders.vault = new VaultKvV2Provider({
  baseUrl: nolaneEnvironment.get('VAULT_URL'),
  namespace: nolaneEnvironment.get('VAULT_NAMESPACE') ?? null,
  getToken: async () => { const token = await credentialVault.resolve(vaultTokenRef); if (!token) throw new Error('Vault credential is unavailable'); return token; },
});
const remoteSecretTokenRef = parseCredentialRef('REMOTE_SECRET_TOKEN_REF');
if (nolaneEnvironment.get('REMOTE_SECRET_ENDPOINT') && remoteSecretTokenRef) secretProviders.remote = new RemoteSecretManagerProvider({
  endpoint: nolaneEnvironment.get('REMOTE_SECRET_ENDPOINT'),
  getAccessToken: async () => { const token = await credentialVault.resolve(remoteSecretTokenRef); if (!token) throw new Error('Remote secret-manager credential is unavailable'); return token; },
});
const secretAccessService = new SecretAccessService({ guardrail: actionGuardrail, providers: secretProviders, eventSink: (event) => store.appendEvent(createEvent('security.secret-access', event)) });
const hookExecutables = Object.freeze((nolaneEnvironment.get('HOOK_EXECUTABLES') ?? '')
  .split(path.delimiter).map((item) => item.trim()).filter(Boolean).map((item) => path.resolve(item)));
const hookEngineFactory = async ({ task, projectRoot }) => {
  const hookFile = path.join(projectRoot, '.forge', 'hooks.json');
  if (!existsSync(hookFile)) return null;
  const trust = await workspaceTrust.status(task.projectId);
  if (trust.state !== 'trusted') {
    store.appendEvent(createEvent('workspace.trust.feature-blocked', { feature: 'hooks', reason: trust.reason }, { projectId: task.projectId, taskId: task.id }));
    return null;
  }
  const configuration = await loadHookConfiguration({ projectRoot, files: [hookFile] });
  return new HookEngine({
    projectRoot,
    hooks: configuration.hooks,
    allowedExecutables: hookExecutables,
    maxOutputBytes: Number(nolaneEnvironment.get('HOOK_MAX_OUTPUT_BYTES')) || 64 * 1024,
    maxErrorBytes: Number(nolaneEnvironment.get('HOOK_MAX_ERROR_BYTES')) || 16 * 1024,
  });
};
const memoryService = new MemoryService({ store, memoryRoot: path.join(config.dataDir, 'memory') });
const projectMemorySidecar = new ProjectMemorySidecar({ store, memoryService });
const interrupts = new InterruptManager({ store });
const workspaceService = new TaskWorkspaceService({ store, worktreesRoot: path.join(config.dataDir, 'worktrees') });
const localTaskHandoff = new LocalTaskHandoffService({ store, workspaceService });
const mcpRegistry = new McpRegistry();
if (nolaneEnvironment.get('MCP_SERVERS_JSON')) {
  const definitions = JSON.parse(nolaneEnvironment.get('MCP_SERVERS_JSON'));
  if (!Array.isArray(definitions)) throw new TypeError('FORGE_STUDIO_MCP_SERVERS_JSON must be an array');
  for (const definition of definitions) mcpRegistry.register(new StdioMcpClient(definition));
}
const baseMcpGateway = new McpToolGateway({ registry: mcpRegistry });
const mcpGateway = new TrustAwareMcpGateway({
  base: baseMcpGateway,
  trust: workspaceTrust,
  eventSink: (event) => store.appendEvent(createEvent(event.type, event, { projectId: event.projectId, taskId: event.taskId ?? null })),
});
let remoteMcpHttp = null;
if (nolaneEnvironment.get('REMOTE_MCP_INTROSPECTION_URL')) {
  const required = ['REMOTE_MCP_ISSUER', 'REMOTE_MCP_AUDIENCE', 'REMOTE_MCP_CLIENT_ID', 'REMOTE_MCP_CLIENT_SECRET', 'REMOTE_MCP_RESOURCE_URL'];
  const missing = required.filter((suffix) => !nolaneEnvironment.get(suffix)).map((suffix) => `NOLANE_AGENT_${suffix}`);
  if (missing.length) throw new TypeError(`Remote MCP OAuth configuration is incomplete: ${missing.join(', ')}`);
  const verifier = createOAuthIntrospectionVerifier({
    endpoint: nolaneEnvironment.get('REMOTE_MCP_INTROSPECTION_URL'),
    clientId: nolaneEnvironment.get('REMOTE_MCP_CLIENT_ID'),
    clientSecret: nolaneEnvironment.get('REMOTE_MCP_CLIENT_SECRET'),
  });
  const oauth = new OAuthResourceServer({ issuer: nolaneEnvironment.get('REMOTE_MCP_ISSUER'), audience: nolaneEnvironment.get('REMOTE_MCP_AUDIENCE'), verifier });
  const sessions = new StreamableHttpSessionStore({ maxEvents: 2_000, ttlMs: 30 * 60_000 });
  const remoteServer = new RemoteMcpServer({
    sessions,
    gateway: {
      listTools: async ({ principal } = {}) => {
        const tools = await mcpRegistry.listTools();
        const enterpriseService = (await lazyEnterpriseCloud.activate()).enterpriseService;
        return tools.filter((tool) => enterpriseService.authorize({ organizationId: principal.organizationId, principalId: principal.subject, action: 'mcp.read', resource: `mcp-tool:${tool.name}`, context: { workspaceId: principal.workspaceId } }).decision === 'allow');
      },
      callTool: async ({ name, arguments: args = {}, principal }) => {
        const enterpriseService = (await lazyEnterpriseCloud.activate()).enterpriseService;
        const decision = enterpriseService.authorize({ organizationId: principal.organizationId, principalId: principal.subject, action: 'mcp.invoke', resource: `mcp-tool:${name}`, context: { workspaceId: principal.workspaceId } });
        if (decision.decision !== 'allow') throw Object.assign(new Error('MCP tool invocation is not authorized'), { statusCode: 403, code: decision.code });
        const task = { id: `remote-mcp:${principal.subject}`, metadata: { mcpAllowedTools: [String(name)] } };
        return baseMcpGateway.execute(task, String(name), args, { refs: { organizationId: principal.organizationId, workspaceId: principal.workspaceId, principalId: principal.subject } });
      },
    },
  });
  remoteMcpHttp = new RemoteMcpHttpAdapter({
    resourceUrl: nolaneEnvironment.get('REMOTE_MCP_RESOURCE_URL'),
    authorizationServers: [nolaneEnvironment.get('REMOTE_MCP_ISSUER')],
    oauth,
    server: remoteServer,
    sessions,
  });
}
const goalService = new GoalService({ store });
const replanner = new AdaptiveReplanner({ store, goalService });
const goalGateway = new GoalToolGateway({ goalService, replanner });
const browserPermissionService = new BrowserPermissionService({ store, goalService });
const browserRuntimeInstaller = new PlaywrightRuntimeInstaller({ runtimeRoot: path.join(config.dataDir, 'playwright-runtime'), version: '0.1.17' });
const browserDriver = new PlaywrightCliDriver({ runtimeInstaller: browserRuntimeInstaller, timeoutMs: 60_000, maxOutputBytes: config.performance.maxToolOutputBytes });
const browserService = new BrowserAgentService({ driver: browserDriver, leasePool: browserRuntimePool, journeyRecorder: missionResourceFabric.journeys, browserRoot: path.join(config.dataDir, 'browser'), getProject: (projectId) => store.getProject(projectId), maxOutputBytes: config.performance.maxToolOutputBytes, timeoutMs: 60_000 });
nativeOrchestration.attachRuntimeWave3({
  browser: browserService,
  codeIntelligence,
  repositorySearch: async ({ projectId, query, limit = 50, hints = [] }) => {
    if (!projectId) throw new TypeError('projectId is required for native repository search');
    const response = await repositoryIndex.search(String(projectId), String(query), { limit, pathPrefix: hints[0] ?? null });
    return (response?.items ?? response ?? []).map((item) => ({
      path: item.path,
      line: item.startLine ?? item.line ?? 1,
      preview: item.preview ?? item.text ?? '',
      score: item.score ?? 0,
    }));
  },
  approval: async ({ action, goalId }) => {
    if (!goalId) return { approved: false, reason: 'goal-id-required' };
    const permission = browserPermissionService.inspect({ goalId });
    return { approved: permission.allowedActions.includes(action), approver: `goal:${goalId}` };
  },
});
const browserGateway = new BrowserToolGateway({ service: browserService });
const remotePluginResolver = new RemotePluginSourceResolver({ cacheRoot: path.join(config.dataDir, 'plugins', 'remote-sources') });
const pluginTransparencyStore = new SqlitePluginTransparencyStore(path.join(config.dataDir, 'plugin-transparency.db'));
const pluginTransparencyLog = new PluginTransparencyLog({ storage: pluginTransparencyStore });
const pluginTrust = loadPluginTrustConfiguration({
  trustMode: nolaneEnvironment.get('PLUGIN_TRUST_MODE') ?? 'development',
  trustJson: nolaneEnvironment.get('PLUGIN_TRUST_JSON') ?? '',
});
const pluginService = new PluginService({
  cacheRoot: path.join(config.dataDir, 'plugins'),
  scanner: new PluginScanner(),
  sourceResolver: (source, context) => remotePluginResolver.resolve(source, context),
  trustStore: pluginTrust.trustStore,
  trustMode: pluginTrust.trustMode,
  transparencyLog: pluginTransparencyLog,
});
await pluginService.ready();
const governedPluginContext = new TrustAwarePluginContext({
  base: pluginService,
  trust: workspaceTrust,
  eventSink: (event) => store.appendEvent(createEvent(event.type, event, { projectId: event.projectId })),
});
const settingsDefaults = {
    experience: { level: 'everyday' },
    general: { language: 'system', defaultIntent: 'build', notifications: true, fileOpenDestination: 'integrated' },
    appearance: { theme: 'system', density: 'comfortable', motion: 'system', codeFontSize: 14, zoom: 100 },
    accessibility: { highContrast: false, alwaysShowFocus: false, screenReaderAnnouncements: true, keyboardResizeStep: 16 },
    notifications: { desktop: true, taskCompletion: true, approvals: true, errors: true, sound: 'important', quietHours: false },
    shortcuts: { keymap: 'default', commandPalette: 'Ctrl+Shift+P', globalQuickOpen: false, chordTimeoutMs: 1000 },
    personalization: { explanationDepth: 'balanced', responseStyle: 'direct', askBeforeAmbiguousChanges: true, showReasoningSummary: true, preferredDocumentationLanguage: 'system' },
    security: { sandbox: true, redactSecrets: true, redactSensitiveData: true },
    permissions: { defaultMode: 'workspace' },
    agent: { model: 'auto', maxActiveAgents: config.performance.maxActiveAgents },
    terminal: { shell: 'auto', scrollbackLines: 10000, confirmPasteMultipleLines: true },
    files: { followActiveFile: true, autoRevealGenerated: true },
    git: { defaultBranchAction: 'worktree', autoFetch: true, requireCleanBeforeMission: true },
    worktrees: { location: 'data-directory', cleanupPolicy: 'ask' },
    browser: { headed: true, persistent: true, snapshotDepth: 4, downloadPolicy: 'workspace-only' },
    computerUse: { requireConfirmation: true },
    voice: { enabled: false, inputDevice: '', outputDevice: '', bargeIn: true },
    media: { saveGeneratedAssets: true },
    memory: { enabled: true, retentionDays: 365 },
    context: { strategy: 'auto', maxUtilizationPercent: 80 },
    models: { autoDiscover: true, preferLocal: false, maxCostPerMissionUsd: 5, fallbackPolicy: 'balanced', showRoutingReasons: false },
    integrations: { mcpAutoStart: true, pluginUpdates: 'notify', hooksEnabled: true, showSourceHealth: true },
    data: { telemetry: false, historyRetentionDays: 365, maxCacheGb: 10, autoBackup: true },
    updates: { channel: updateChannel, autoDownload: false, includeModelCatalog: true },
    diagnostics: { logLevel: 'info', keepReceiptsDays: 365, includeSystemInfo: true },
    research: { showRawReceipts: false, showProviderScores: false, enableExperimentalSystems: false, maxParallelAgents: config.performance.maxActiveAgents, evidenceStrictness: 'strict' },
    autopilot: { profile: 'workspace-autopilot', autoApplyPlanPatches: true },
  };
const { settingsService, personalizationProfile, onboardingService, sessionRestore, updatePreparation } = createTrustAdoptionFoundation({
  dataDir: config.dataDir,
  store,
  currentVersion: VERSION,
  settingsDefaults,
  settingsLockedKeys: ['security.sandbox', 'security.redactSecrets', 'security.redactSensitiveData', 'credentials', 'updates.publicKey'],
  getProject: (projectId) => store.getProject(projectId),
  onboardingDisabled: nolaneEnvironment.get('DISABLE_ONBOARDING') === 'true',
  postUpdateExistingInstallation: nolaneEnvironment.get('POST_UPDATE') === 'true',
});
let agentLoop;
let evidenceContextRuntime = null;
const subagentFactory = async ({ task, projectRoot }) => {
  const trust = await workspaceTrust.status(task.projectId);
  const profiles = trust.state === 'trusted' ? await agentProfileLoader.loadProjectProfiles(projectRoot) : [];
  if (trust.state !== 'trusted') store.appendEvent(createEvent('workspace.trust.feature-blocked', { feature: 'skills', reason: trust.reason }, { projectId: task.projectId, taskId: task.id }));
  const orchestrator = new SubagentOrchestrator({
    profiles,
    governor: resourceGovernor,
    resultValidator: async ({ child, result }) => {
      if (!evidenceContextRuntime) throw Object.assign(new Error('Evidence context runtime is unavailable'), { code: 'EVIDENCE_RUNTIME_UNAVAILABLE' });
      return evidenceContextRuntime.validateSubagentResult({ projectId: child.projectId, principalId: `agent:${child.parentTaskId}`, result });
    },
    maxConcurrency: Math.min(config.performance.maxActiveAgents, Number(task.metadata?.subagentMaxConcurrency) || 4),
    eventSink: (event) => store.appendEvent(createEvent(event.type, event, { projectId: task.projectId, taskId: task.id })),
    runner: async (child, { signal }) => {
      const parentMcpTools = Array.isArray(task.metadata?.subagentMcpAllowedTools) ? task.metadata.subagentMcpAllowedTools.map(String) : [];
      const childMcpTools = parentMcpTools.filter((tool) => child.mcpServers.some((serverId) => tool === serverId || tool.startsWith(`${serverId}.`) || tool.startsWith(`${serverId}/`)));
      const childTask = store.createTask({
        projectId: child.projectId,
        missionId: task.missionId,
        title: `Subagent ${child.profileId}: ${child.objective.slice(0, 120)}`,
        objective: [child.prompt, child.objective].filter(Boolean).join('\n\n'),
        status: 'running',
        role: child.profileId,
        dependencies: [],
        allowedPaths: task.allowedPaths,
        deniedPaths: task.deniedPaths,
        metadata: {
          executionWorkspace: projectRoot,
          parentTaskId: task.id,
          agentProfileId: child.profileId,
          allowedToolNames: child.allowedTools,
          operatingPlaneAllowedTools: child.allowedTools,
          mcpAllowedTools: childMcpTools,
          allowedSkills: child.skills,
          allowedMcpServers: child.mcpServers,
          sandboxProfile: child.sandboxProfile,
          providerConstraints: task.metadata?.providerConstraints ?? {},
        },
      });
      try {
        const result = await agentLoop.run(childTask, {
          providerId: task.metadata?.subagentProviderId ?? 'auto',
          signal,
          budgets: {
            maxTurns: child.maxTurns,
            maxToolCalls: Math.max(1, child.maxTurns * 8),
            maxEstimatedTokens: child.budgetTokens,
            maxElapsedMs: Number(task.metadata?.subagentMaxElapsedMs) || 20 * 60_000,
          },
        });
        store.updateTask(childTask.id, { status: 'review', metadata: { ...childTask.metadata, handoffPendingVerification: true } });
        return { summary: result.output, receipts: result.receipts.map((receipt) => receipt.receiptSha256), output: result };
      } catch (error) {
        store.updateTask(childTask.id, { status: 'failed', metadata: { ...childTask.metadata, errorCode: error.code ?? 'SUBAGENT_FAILED' } });
        throw error;
      }
    },
  });
  const authority = Object.freeze({
    ...task,
    permissions: Object.freeze([...(task.metadata?.subagentPermissions ?? [])].map(String)),
    allowedTools: Object.freeze([...(task.metadata?.subagentAllowedTools ?? [])].map(String)),
    allowedMcpServers: Object.freeze([...(task.metadata?.subagentAllowedMcpServers ?? [])].map(String)),
    allowedSkills: Object.freeze([...(task.metadata?.subagentAllowedSkills ?? [])].map(String)),
    maxTurns: Number(task.metadata?.subagentMaxTurns) || 24,
    budgetTokens: Number(task.metadata?.subagentBudgetTokens) || 120_000,
  });
  return Object.freeze({
    run: (input) => orchestrator.run({ ...input, parentTask: authority }),
    runGraph: (input) => orchestrator.runGraph({ ...input, parentTask: authority }),
    runAdaptiveGraph: (input) => orchestrator.runAdaptiveGraph({ ...input, parentTask: authority }),
    listProfiles: () => orchestrator.listProfiles(),
  });
};
const operatingPlaneGateway = new OperatingPlaneToolGateway({
  projectResolver: (projectId) => store.getProject(projectId),
  codeIntelligence,
  gitGatewayFactory,
  imageComparisonFactory,
  profileLoader: agentProfileLoader,
  sessionLedgerFactory,
  subagentFactory,
  symbolEditFactory,
  advancedSearchFactory,
  astIntelligenceFactory,
  testEngineFactory,
  artifactSecurityFactory,
  workspaceTrust,
});
let adaptiveIntelligence = null;
const adaptiveIntelligenceGateway = new AdaptiveIntelligenceToolGateway({ planeResolver: () => adaptiveIntelligence });
const dynamicToolCatalog = new DynamicToolCatalog({
  pinnedTools: ['fs.read', 'fs.readMany', 'fs.search', 'fs.write', 'fs.patch', 'fs.patchSet', 'process.run'],
});
for (const schema of CORE_TOOL_SCHEMAS) dynamicToolCatalog.register(schema, { source: 'core', tags: ['filesystem', 'terminal', 'always-available'] });
for (const schema of operatingPlaneGateway.schemasForTask({ metadata: {} })) dynamicToolCatalog.register(schema, { source: 'operating-plane', tags: ['code-intelligence', 'git', 'verification', 'security'] });
for (const schema of adaptiveIntelligenceGateway.schemasForTask({ metadata: {} })) dynamicToolCatalog.register(schema, { source: 'adaptive-intelligence', tags: ['semantic-search', 'context', 'memory', 'review', 'automation', 'design', 'routing'] });

const operatingPlane = new OperatingPlaneService({
  version: VERSION,
  projectResolver: (projectId) => store.getProject(projectId),
  profileLoader: agentProfileLoader,
  codeIntelligence,
  gitGatewayFactory,
  imageComparisonFactory,
  sessionLedgerFactory,
  symbolEditFactory,
  advancedSearchFactory,
  astIntelligenceFactory,
  testEngineFactory,
  artifactSecurityFactory,
  workspaceTrust,
  capabilities: ['governed-hooks', 'scoped-subagents', 'session-rewind-fork', 'lsp-intelligence', 'typed-git', 'visual-diff', 'cli', 'typescript-sdk', 'python-sdk', 'symbol-aware-edits', 'advanced-repository-search', 'local-ast-query-patch', 'governed-test-engine', 'external-secret-providers', 'artifact-dependency-security'],
  externalGates: [
    { id: 'authenticode', state: 'requires-external-certificate' },
    { id: 'apple-notarization', state: 'requires-external-credential' },
    { id: 'live-cloud-conformance', state: 'requires-live-cluster' },
    { id: 'independent-benchmark', state: 'requires-independent-attestation' },
  ],
});
const evidenceGraphRuntime = new EvidenceGraphRuntimeService({
  version: VERSION,
  file: path.join(config.dataDir, 'evidence-context-runtime.db'),
  projectResolver: (projectId) => store.getProject(String(projectId)),
  contextStore: dynamicContextStore,
  memorySidecar: projectMemorySidecar,
});
const evidenceRetrieval = new HybridEvidenceRetrievalService({
  version: VERSION,
  retrievers: {
    lexical: async ({ projectId, query, limit }) => repositoryIntelligenceFabric.lexicalSearch(projectId, query, { limit }).items.map((item) => ({ path: item.path, startLine: item.startLine, endLine: item.endLine, text: item.preview, sourceHash: item.contentSha256, currentHash: item.contentSha256, confidence: Math.min(1, Math.max(0.1, item.score)), reason: 'Lexical path, symbol, or content match.', metadata: { sources: item.sources, semanticState: 'not-requested' } })),
    semantic: async ({ projectId, query, limit }) => { const result = await repositoryIntelligenceFabric.search(projectId, query, { limit }); return result.items.map((item) => ({ path: item.path, symbol: item.symbol, startLine: item.startLine, endLine: item.endLine, text: item.preview, sourceHash: item.contentSha256, currentHash: item.contentSha256, branch: result.indexState?.provenance?.branch ?? null, confidence: Math.min(1, Math.max(0.1, item.score)), reason: 'Hybrid code similarity after lexical, symbol, graph, and semantic reranking.', metadata: { sources: item.sources, scoreBreakdown: item.scoreBreakdown, semanticState: result.semanticState ?? 'active', providerModelSha256: result.indexState?.provenance?.providerModelSha256 ?? null } })); },
    structural: async ({ projectId, query, limit }) => repositoryIntelligenceFabric.graphRank(projectId, query, { limit }).items.map((item) => ({ path: item.path, sourceHash: item.sha256, currentHash: item.sha256, graphDistance: item.scoreBreakdown?.dependencyDistance > 0 ? Math.max(0, Math.round((18 - item.scoreBreakdown.dependencyDistance) / 4)) : null, confidence: Math.min(1, Math.max(0.1, item.score / 50)), reason: 'Dependency, test, or graph-neighbor relationship.', metadata: { scoreBreakdown: item.scoreBreakdown } })),
    runtime: async ({ projectId, query, limit }) => {
      const needles = String(query).toLowerCase().split(/[^a-z0-9_$.-]+/).filter((item) => item.length > 2).slice(0, 16);
      const evidence = store.listEvidence({ projectId }).slice(-500).reverse().filter((item) => needles.some((needle) => JSON.stringify(item).toLowerCase().includes(needle))).slice(0, limit).map((item) => ({ id: item.id, text: `${item.kind}: ${JSON.stringify(item.payload)}`, sourceHash: item.receiptSha256, runtime: true, updatedAt: item.createdAt, sourceRef: `evidence:${item.id}`, validUntil: 'test_rerun', confidence: item.status === 'verified' ? 1 : 0.7, reason: 'Recorded runtime or verification evidence.' }));
      const events = store.listEvents({ afterSeq: 0, limit: 10_000 }).reverse().filter((item) => item.refs?.projectId === projectId && needles.some((needle) => JSON.stringify(item).toLowerCase().includes(needle))).slice(0, Math.max(0, limit - evidence.length)).map((item) => ({ id: item.id, text: `${item.type}: ${JSON.stringify(item.payload)}`, runtime: true, updatedAt: item.time, sourceRef: `event:${item.seq}`, validUntil: 'test_rerun', confidence: 0.65, reason: 'Recent runtime event.' }));
      return [...evidence, ...events];
    },
    historical: async ({ projectId, query, limit }) => memoryService.search(projectId, query, { statuses: ['active', 'stale'], limit }).map((item) => ({ id: item.id, text: `${item.title}
${item.content}`, sourceHash: item.evidenceReceiptSha256, updatedAt: item.updatedAt, sourceRef: `memory:${item.id}`, validUntil: 'source_changed', confidence: item.confidence, freshness: item.status === 'active' ? 'fresh' : 'stale', reason: 'Evidence-backed project or failure memory.', metadata: { kind: item.kind, status: item.status } })),
  },
});
const evidencePackets = new ContextPacketRuntimeService({ version: VERSION, retrieval: evidenceRetrieval, graph: evidenceGraphRuntime });
evidenceContextRuntime = new EvidenceContextRuntime({
  version: VERSION,
  graph: evidenceGraphRuntime,
  retrieval: evidenceRetrieval,
  packets: evidencePackets,
  eventSink: (event) => store.appendEvent(createEvent(event.type, event, { projectId: event.projectId, taskId: event.taskId ?? null })),
});
agentLoop = new AgentLoop({ forge: governedForge, providers, router, repositoryIndex: repositoryIntelligence, instructionDiscovery: governedInstructionDiscovery, instructionPolicy: governedInstructionPolicy, memoryService: projectMemorySidecar, evidenceContextRuntime, mcpGateway, browserGateway, goalGateway, forgeGateway, operatingPlaneGateway, adaptiveIntelligenceGateway, dynamicToolCatalog, hookEngineFactory, pluginService: governedPluginContext, contentIngress, decisionPlane: missionResourceFabric.decision, broker: brokerForTask, store, contextBuilder: new ContextBuilder(), harnessComposer: adaptiveHarness.composer, harnessFailureStore: adaptiveHarness.failureStore, harnessFailureClassifier: adaptiveHarness.failureClassifier, skillContextResolver: async (id) => nativeOrchestration.loadSkill(id, { grantedCapabilities: [] }), modelObservationSink: ({ providerId, modelId, observation }) => { const profile = modelProfiles.resolveIntelligence(providerId, modelId); modelManager.recordExecution(profile.canonicalId, observation); } });
const scheduler = new TaskScheduler({ store });
const missionRunner = new MissionRunner({ store, scheduler, agentLoop, forge: governedForge, interrupts, workspaceService, memoryService, baselineProvider: captureTaskTestBaseline, outcomeService: providerOutcomeFeedback });
const missionCompletion = new MissionCompletionOrchestrator({
  missionRunner,
  gitGovernance,
  capabilityChecker: async ({ capability, projectId = null, taskId = null, principalId }) => capabilityGrantLedger.authorize({
    principalId,
    capability,
    resource: { repository: projectId, projectId, taskId },
    consume: false,
  }).decision === 'allow',
});
const planningEvidenceGovernance = new PlanningEvidenceGovernanceService({ store, repositoryIndex });
const missionPlanner = new MissionPlanner({ router, evidenceGovernance: planningEvidenceGovernance });
const verificationRunner = new VerificationRunner({
  store,
  brokerFactory: (task) => brokerForTask(task, { verification: true }),
  testEngineFactory: (task) => {
    const projectRoot = task.metadata?.executionWorkspace ?? store.getProject(task.projectId)?.workspaceRoot;
    if (!projectRoot) throw new Error(`Verification project is unavailable: ${task.projectId}`);
    return testEngineFactory({ task, projectRoot });
  },
  environmentService: environmentControl,
});
const gitInspector = new GitInspector({ store, brokerFactory: (task) => brokerForTask(task, { verification: true }) });
const diffReview = new DiffReviewService({
  store,
  gitInspector,
  mutator: async ({ task, file, patch, expectedSnapshotSha256 }) => {
    const current = await gitInspector.snapshot({ projectId: task.projectId, taskId: task.id });
    if (current.snapshotSha256 !== expectedSnapshotSha256) throw Object.assign(new Error('Candidate diff changed before the review decision could be applied'), { statusCode: 409, code: 'DIFF_REVIEW_STALE' });
    const project = store.getProject(task.projectId);
    const workspaceRoot = task.metadata?.executionWorkspace ?? project?.workspaceRoot;
    if (!workspaceRoot) throw new Error(`Diff review workspace is unavailable for task ${task.id}`);
    const broker = new ToolBroker({ workspaceRoot, allowedPaths: [file.path], deniedPaths: ['.env', '.env.*', '**/.env', '**/.env.*', '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx'], allowedCommands: [], maxOutputBytes: config.performance.maxToolOutputBytes, managedProcessRegistry: managedProcesses });
    const read = await broker.execute({ tool: 'fs.read', input: { path: file.path } }, { refs: { projectId: task.projectId, missionId: task.missionId, taskId: task.id, operation: 'diff-review-read' } });
    const applied = await broker.execute({ tool: 'fs.patch', input: { patch, expectedSha256: read.output.sha256 } }, { refs: { projectId: task.projectId, missionId: task.missionId, taskId: task.id, operation: 'diff-review-reject-hunk' } });
    return applied.receipt;
  },
});
const selfFixFactory = async ({ task, providerId, workerId, execution, signal, budgets }) => {
  const projectRoot = task.metadata?.executionWorkspace ?? store.getProject(task.projectId)?.workspaceRoot;
  if (!projectRoot) throw new Error(`Self-fix project is unavailable: ${task.projectId}`);
  const broker = brokerForTask(task, { verification: true });
  return new SelfFixController({
    testEngine: testEngineFactory({ task, projectRoot }),
    diagnostics: diagnosticDeltaService,
    maxAttempts: Number(task.metadata?.selfFix?.maxAttempts) || 3,
    maxStagnantAttempts: Number(task.metadata?.selfFix?.maxStagnantAttempts) || 1,
    workspaceFingerprint: async () => {
      const [head, diff, status] = await Promise.all([
        broker.execute({ tool: 'process.run', input: { command: 'git', args: ['rev-parse', 'HEAD'], cwd: '.' } }, { signal }),
        broker.execute({ tool: 'process.run', input: { command: 'git', args: ['diff', '--binary', 'HEAD'], cwd: '.', maxOutputBytes: 2_000_000 } }, { signal }),
        broker.execute({ tool: 'process.run', input: { command: 'git', args: ['status', '--porcelain=v1'], cwd: '.' } }, { signal }),
      ]);
      return canonicalSha256({ head: head.output?.stdout ?? '', diff: diff.output?.stdout ?? '', status: status.output?.stdout ?? '' });
    },
    repair: async (repairRequest) => missionRunner.repairVerification({
      taskId: task.id,
      workerId: task.leaseOwner ?? workerId,
      fencingToken: task.fencingToken ?? execution.lease?.fencingToken,
      providerId,
      repairRequest,
      signal,
      budgets,
    }),
    eventSink: (event) => store.appendEvent(createEvent(event.type, event, { projectId: task.projectId, missionId: task.missionId, taskId: task.id })),
  });
};
const autopilot = new MissionAutopilot({ store, missionRunner, verificationRunner, selfFixFactory });
const activityProjection = new ActivityProjection({ store });
const executionStory = createExecutionStoryFoundation({ store, activityProjection });
const timeTravel = createTimeTravelFoundation({ dataDir: config.dataDir, store, executionStory });
const reviewSummary = new ReviewSummary({ store, gitInspector });
const runCoordinator = new RunCoordinator({ store, missionRunner, plannerService: missionPlanner, autopilot, activityProjection, reviewSummary, workspaceService, providerReadiness: providerConnections, contextHistoryArchive, agentModes, providerInventory: () => providers.publicView() });
const parseReviewResult = (text) => {
  const source = String(text ?? '').trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  let parsed;
  try { parsed = JSON.parse(fenced || source); }
  catch { throw Object.assign(new Error('Independent reviewer returned invalid JSON'), { code: 'REVIEWER_OUTPUT_INVALID' }); }
  if (!parsed || !Array.isArray(parsed.findings)) throw Object.assign(new Error('Independent reviewer response requires a findings array'), { code: 'REVIEWER_OUTPUT_INVALID' });
  return { findings: parsed.findings };
};
const independentReviewer = new IndependentReviewService({
  file: path.join(config.dataDir, 'independent-reviews.db'),
  reviewer: async (request) => {
    const provider = router.select({ mode: 'intelligence', task: { kind: 'code-review', complexity: 0.9 }, requiredCapabilities: ['coding'] });
    const completion = await provider.complete({
      messages: [
        { role: 'system', content: 'You are an independent code reviewer. Return strict JSON only: {"findings":[{"path":"...","line":1,"severity":"info|low|medium|high|critical","category":"...","message":"...","evidence":"...","suggestion":"..."}]}. Review only the supplied diff and rules. Do not claim to have run tests.' },
        { role: 'user', content: JSON.stringify(request) },
      ],
      tools: [],
    });
    return parseReviewResult(completion.text);
  },
});
const automationService = new DurableAutomationService({
  file: path.join(config.dataDir, 'automations.db'),
  runner: async (request) => {
    await workspaceTrust.requireTrusted(request.projectId, 'background');
    const snapshot = runCoordinator.createRun({
      projectId: request.projectId,
      objective: request.objective,
      autonomyProfile: 'workspace-autopilot',
      providerId: 'auto',
      maxTasks: 32,
      mcpAllowedTools: request.mcpServers,
    });
    return {
      status: 'pass',
      output: {
        schema: 'forge.automation-mission-output.v1',
        outputPolicy: request.outputPolicy,
        missionId: snapshot.mission.id,
        missionStatus: snapshot.mission.status,
        capabilities: request.capabilities,
        skills: request.skills,
      },
      memory: `mission:${snapshot.mission.id}:${snapshot.mission.status}`,
    };
  },
});
const designContextService = new DesignContextService({
  file: path.join(config.dataDir, 'design-context.db'),
  artifactRoot: path.join(config.dataDir, 'design-artifacts'),
});
adaptiveIntelligence = new AdaptiveIntelligencePlane({
  version: VERSION,
  projectResolver: (projectId) => store.getProject(projectId),
  repository: repositoryIntelligence,
  toolCatalog: dynamicToolCatalog,
  contextStore: dynamicContextStore,
  history: contextHistoryArchive,
  memory: projectMemorySidecar,
  reviewer: independentReviewer,
  automations: automationService,
  design: designContextService,
  diagnostics: diagnosticDeltaService,
  outcomes: providerOutcomeFeedback,
  router,
  environment: environmentControl,
});
const operationsCenter = new AgentOperationsService({
  version: VERSION, providers, adaptiveIntelligence, operatingPlane, toolCatalog: dynamicToolCatalog, mcpRegistry,
  capabilityRegistry, capabilityLedger: capabilityGrantLedger, store,
});
const contextMemoryCenter = new ContextMemoryCenterService({
  version: VERSION, store, historyArchive: contextHistoryArchive, contextStore: dynamicContextStore,
  memoryService, memorySidecar: projectMemorySidecar,
});
const contextOrchestration = new ContextOrchestrationService({
  file: path.join(config.dataDir, 'context-orchestration.db'),
});
const traceEvidenceCenter = new TraceEvidenceCenterService({
  version: VERSION, store, contextStore: dynamicContextStore,
});
const missionStateProgress = new MissionStateProgressService({
  store, environmentControl, capabilityLedger: capabilityGrantLedger,
});
const controlledLocalCache = new ControlledLocalCache({ file: path.join(config.dataDir, 'controlled-local-cache.db'), maxBytes: Number(nolaneEnvironment.get('CONTROLLED_CACHE_BYTES')) || 50_000_000 });
const localOperations = new LocalOperationsCenterService({
  projectResolver: (projectId) => store.getProject(String(projectId)),
  imageFactory: imageComparisonFactory,
  codeIntelligence,
  missionState: missionStateProgress,
  commandGovernance: commandExecutionGovernance,
  runCoordinator,
  sandbox: localResourceSandbox,
  cache: controlledLocalCache,
  eventSink: (event) => store.appendEvent(createEvent(event.type, event, { projectId: event.projectId, missionId: event.missionId ?? null })),
});
const goalRunService = new GoalRunService({ store, goalService, runCoordinator });
const missionGraph = new MissionGraphProjection({ store });
const commandRegistry = new CommandRegistry();
registerCoreCommands(commandRegistry, {
  goalService,
  goalRunService,
  store,
  replanner,
  runCoordinator,
  providerRegistry: providers,
  pluginService,
  browserService,
  browserPermissionService,
  settingsService,
  memoryService,
  diagnostics: {
    agents: () => missionGraph,
    permissions: (projectId) => ({ projectId, authority: 'ForgeOS', autonomyProfile: 'workspace-autopilot' }),
    async run() {
      const [providerState, browserState] = await Promise.all([providerConnections.readiness({ providerId: 'auto' }), browserService.detect()]);
      return { ok: providerState.ready === true, checks: [{ name: 'providers', ...providerState }, { name: 'browser', ...browserState }, { name: 'plugins', installed: pluginService.publicView().length }] };
    },
  },
});
const repositoryFingerprint = async (goal) => {
  const project = store.getProject(goal.projectId);
  if (!project) throw new Error(`Unknown project: ${goal.projectId}`);
  const broker = new ToolBroker({ workspaceRoot: project.workspaceRoot, allowedPaths: ['**'], deniedPaths: [], allowedCommands: ['git'], maxOutputBytes: 256_000, managedProcessRegistry: managedProcesses });
  const head = await broker.execute({ kind: 'process.run', executable: 'git', args: ['rev-parse', 'HEAD'], cwd: '.', timeoutMs: 10_000, networkPolicy: 'deny' }).catch(() => ({ stdout: 'no-head' }));
  const status = await broker.execute({ kind: 'process.run', executable: 'git', args: ['status', '--porcelain=v1', '-uno'], cwd: '.', timeoutMs: 10_000, networkPolicy: 'deny' }).catch(() => ({ stdout: 'no-status' }));
  return `${String(head.stdout ?? '').trim()}
${String(status.stdout ?? '').trim()}`;
};
const goalScheduler = new GoalScheduler({ store, goalService, runGoal: async (goal) => { await workspaceTrust.requireTrusted(goal.projectId, 'background'); const result = goalRunService.start(goal.id); return { runId: result.run?.id ?? result.run?.mission?.id ?? null, ...result }; }, repositoryFingerprint, tickEveryMs: 30_000 });
goalScheduler.start();
const evalRunner = new EvalRunner({ executor: async ({ evalCase, providerId, signal }) => {
  const provider = providers.get(providerId);
  const messages = [{ role: 'system', content: 'Return a concise answer for a reproducible Forge Studio evaluation. Do not perform side effects.' }, { role: 'user', content: String(evalCase.input?.objective ?? evalCase.input ?? evalCase.id) }];
  const composed = adaptiveHarness.composer.compose({ provider, messages, tools: [], task: { role: 'evaluation', metadata: { taskKind: 'evaluation' } } });
  const completion = await provider.complete({ messages: composed.messages, tools: composed.tools, signal });
  return { state: 'awaiting-verification', output: completion.text, toolCalls: completion.toolCalls?.length ?? 0, estimatedTokens: completion.usage?.totalTokens ?? 0, retries: 0, evidence: [{ kind: 'harness-profile', profileId: composed.profileId, profileRevision: composed.profileRevision, receiptSha256: composed.receiptSha256 }] };
} });
const webCache = HttpCache.open(path.join(config.dataDir, 'web-cache.db'));
const searchProviders = [];
if (nolaneEnvironment.get('BRAVE_API_KEY')) searchProviders.push(new BraveSearchProvider({ apiKey: nolaneEnvironment.get('BRAVE_API_KEY') }));
if (nolaneEnvironment.get('TAVILY_API_KEY')) searchProviders.push(new TavilySearchProvider({ apiKey: nolaneEnvironment.get('TAVILY_API_KEY') }));
const webIntelligence = new WebIntelligence({ cache: webCache, searchProviders, userAgent: 'NolaneAgentBot/5 (+local evidence research)' });
const uiSelection = resolveUiRoot({ appRoot, requestedVersion: nolaneEnvironment.get('UI_VERSION', 'v3'), production: process.env.NODE_ENV === 'production' });
const uiSummary = uxFoundation.createSummary({
  getWorkspace: (projectId) => projectId ? store.getProject(String(projectId)) : store.listProjects()[0] ?? null,
  terminalManager, mcpRegistry,
  getArtifacts: async (projectId) => projectId ? store.listEvidence({ projectId: String(projectId) }).slice(-20).reverse().map((item) => ({ id: item.id, kind: item.kind ?? 'evidence', label: item.title ?? item.kind ?? item.id, path: item.payload?.path ?? '' })) : [],
  maxItems: 60, maxText: Math.min(4_000, config.performance.maxToolOutputBytes),
});
const sovereignKernel = SovereignAgentKernel.create({
  dataDir: path.join(config.dataDir, 'sovereign-agent-kernel'),
  eventSink: (event) => store.appendEvent(createEvent(event.type ?? 'sovereign-kernel.event', event.payload ?? event, { projectId: event.projectId ?? null })),
  laneRunner: async ({ task: lane, plan, contextPacket, signal, attempt }) => {
    const project = store.getProject(String(plan.projectId ?? ''));
    if (!project) throw Object.assign(Error(`Unknown sovereign-kernel project: ${plan.projectId}`), { code: 'SOVEREIGN_PROJECT_NOT_FOUND', statusCode: 404 });
    let childTask = store.createTask({
      projectId: project.id,
      title: `[Kernel/${lane.role}] ${lane.title}`,
      objective: lane.objective,
      status: 'running',
      role: lane.role,
      dependencies: [],
      allowedPaths: lane.ownedPaths.length ? lane.ownedPaths : ['**'],
      deniedPaths: ['.env', '.env.*', '**/.env', '**/.env.*', '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx', '**/node_modules/**'],
      metadata: {
        sovereignThreadId: plan.threadId,
        sovereignPlanId: plan.id,
        sovereignLaneId: lane.id,
        sovereignAttempt: attempt,
        ownedSymbols: lane.ownedSymbols,
        acceptanceCriteria: lane.acceptanceCriteria,
        modelClass: lane.modelClass,
        contextReceiptSha256: contextPacket?.receiptSha256 ?? null,
        dynamicToolDiscovery: true,
        taskKind: 'sovereign-kernel-lane',
      },
    });
    childTask = await workspaceService.prepare(childTask);
    try {
      const result = await agentLoop.run(childTask, {
        providerId: 'auto', signal,
        budgets: { maxTurns: 24, maxToolCalls: 192, maxEstimatedTokens: 120_000, maxElapsedMs: 20 * 60_000 },
      });
      const workspaceRoot = childTask.metadata?.executionWorkspace ?? project.workspaceRoot;
      const diff = (await gitGatewayFactory({ projectRoot: workspaceRoot }).diff()).content;
      const outcomeBase = {
        schema: 'nolane.sovereign-agent-outcome-evidence.v1', taskId: childTask.id, runId: result.runId,
        threadId: plan.threadId, planId: plan.id, laneId: lane.id, outputSha256: canonicalSha256(String(result.output ?? '')),
        providerId: result.providerId, contextPackSha256: result.contextPackSha256 ?? null,
      };
      const outcomeEvidence = Object.freeze({ ...outcomeBase, receiptSha256: canonicalSha256(outcomeBase) });
      const evidence = [...new Set([...(result.receipts ?? []).map((receipt) => receipt.receiptSha256), outcomeEvidence.receiptSha256].filter(Boolean))];
      const tests = [];
      if (diff.trim()) {
        const check = await brokerForTask(childTask, { verification: true }).execute({ tool: 'process.run', input: { command: 'git', args: ['diff', '--check'], cwd: '.', timeoutMs: 30_000 } }, { signal, refs: { projectId: project.id, taskId: childTask.id, operation: 'sovereign-kernel-diff-check' } });
        tests.push({ name: 'git-diff-check', status: Number(check.output?.exitCode ?? 1) === 0 ? 'pass' : 'fail', receiptSha256: check.receipt?.receiptSha256 ?? null });
        if (check.receipt?.receiptSha256) evidence.push(check.receipt.receiptSha256);
      }
      store.updateTask(childTask.id, { status: 'review', metadata: { ...childTask.metadata, sovereignOutcomeReceiptSha256: outcomeEvidence.receiptSha256, handoffPendingVerification: true } });
      return { executorId: `agent:${childTask.id}`, output: result.output, diff, tests, evidence, childTaskId: childTask.id, runId: result.runId, providerId: result.providerId };
    } catch (error) {
      store.updateTask(childTask.id, { status: 'failed', metadata: { ...childTask.metadata, failureReason: String(error?.message ?? error), errorCode: error?.code ?? 'SOVEREIGN_LANE_FAILED' } });
      throw error;
    }
  },
});
const service = await createHttpServer({ config, store, providers, missionRunner, runCoordinator, projectService, webIntelligence, repositoryIndex, router, mcpRegistry, evalRunner, verificationRunner, plannerService: missionPlanner, memoryService, gitInspector, autopilot, terminalManager, fileService, credentialVault, providerConnections, uiAssets, updateService, updatePreparation, instructionDiscovery: instructionApi, instructionPolicy: instructionPolicyApi, runtimeStatus, goalService, goalRunService, replanner, commandRegistry, browserService, browserRuntimeInstaller, browserPermissionService, pluginService, settingsService, personalizationProfile, onboardingService, sessionRestore, missionGraph, goalScheduler, forgeBridge, enterpriseCloudRoutes, operatingPlane, adaptiveIntelligence, environmentControl, nativeRuntime, nativeAgent, nativeOrchestration, sessionStore, smallModelFoundation, nativeCapabilities, operationalBoundary, dependencyPreflight, workspaceTrust, diffReview, operationsCenter, contextMemoryCenter, contextOrchestration, traceEvidenceCenter, repositoryDiscovery, codebaseKnowledge, semanticDependency, codeRelationships, localResourceSandbox, localTaskHandoff, gitGovernance, treeSitterRuntime, agentModes, missionStateProgress, localOperations, architectureStageGate, missionCompletion, localContainerPreflight, evidenceContextRuntime, missionResourceFabric, modelProfiles, modelManager, executionStory, timeTravel, sovereignKernel, uiSummary, eventHub, capabilityLedger: capabilityGrantLedger, remoteMcpHttp, scimHttp, oidcHttp, requestAuthorizer: enterpriseRequestAuthorizer, routeSecurityTelemetry, allowRemoteBinding: nolaneEnvironment.get('ALLOW_REMOTE_BINDING') === 'true', uiRoot: uiSelection.root, uiAssetsRoot });
if (nolaneEnvironment.get('POST_UPDATE') === 'true') await updatePreparation.markPostUpdateRuntimeReady({ targetVersion: VERSION });

const runtimeFile = nolaneEnvironment.get('RUNTIME_FILE');
if (runtimeFile) {
  await mkdir(path.dirname(path.resolve(runtimeFile)), { recursive: true });
  const temporary = `${path.resolve(runtimeFile)}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify({ url: service.url, token: service.token, pid: process.pid, startedAt: new Date().toISOString() }), { mode: 0o600 });
  await rename(temporary, path.resolve(runtimeFile));
}
console.log(JSON.stringify({ product: PRODUCT_NAME, version: VERSION, url: service.url, tokenConfigured: Boolean(service.token), pid: process.pid }));

let closing = false;
async function shutdown(signal) {
  if (closing) return; closing = true;
  try { await service.close(); } finally {
    clearInterval(resourceTimer);
    providerRuntimePool.close();
    browserRuntimePool.close();
    await codeIntelligence.close();
    await repositoryIntelligenceFabric.close();
    goalScheduler.stop();
    runCoordinator.close();
    await terminalManager.close();
    await uxFoundation.close();
    localResourceSandbox.close();
    await terminalHistoryRecorder.close();
    await Promise.allSettled([credentialVault.close(), ...providers.list().map((provider) => provider.close?.())]);
    await mcpRegistry.close();
    webCache.close();
    controlledLocalCache.close();
    independentReviewer.close();
    automationService.close();
    designContextService.close();
    contextOrchestration.close();
    evidenceContextRuntime.close();
    environmentControl.close();
    await nativeRuntime.stop();
    await nativeCapabilities.close();
    contextHistoryArchive.close();
    outcomeMetricsStore.close();
    adaptiveHarness.close();
    await missionResourceFabric.close();
    pluginTransparencyStore.close();
    await runtimeModuleManager.close();
    workspaceTrustStateStore.close();
    capabilityStateStore.close();
    sovereignKernel.close();
    eventHub.close();
    store.close();
  }
  if (signal) process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
