import { createHash } from 'node:crypto';
import path from 'node:path';

import { NolaneDurableScheduler } from './durable-scheduler.mjs';
import { NolaneGatewayRegistry } from './gateway-registry.mjs';
import { NolanePluginHost } from './plugin-host.mjs';
import { NolaneSkillRegistry } from './skill-registry.mjs';
import { ForgeOsSkillCatalog } from './forgeos-skill-catalog.mjs';
import { NolaneSubagentManager } from './subagent-manager.mjs';
import { NolaneTrajectoryStore } from './trajectory-store.mjs';
import { NolaneSessionStore } from './session-store.mjs';
import { CrossSessionMemory } from './cross-session-memory.mjs';
import { SessionMemoryLearningFabric } from '../native-core/session-memory-learning-fabric.mjs';
import { ExtensionAutomationFabric } from '../native-core/extension-automation-fabric.mjs';
import { McpRegistry } from '../mcp/mcp-registry.mjs';
import { MediaProviderRegistry } from './media-provider-registry.mjs';
import { AudioProviderRegistry } from './audio-provider-registry.mjs';
import { GatewayApiSurface } from '../native-core/gateway-api-surface.mjs';
import { OperationsSecurityFabric } from '../native-core/operations-security-fabric.mjs';
import { NativeAdapterTck } from '../native-core/native-adapter-tck.mjs';
import { MixtureOfAgentsCoordinator } from '../native-core/mixture-of-agents-coordinator.mjs';
import { AcpStreamingRuntime } from '../native-core/acp-streaming-runtime.mjs';
import { ProviderProtocolRuntime } from '../native-core/provider-protocol-runtime.mjs';
import { RepositoryIntelligenceFabric } from '../native-core/repository-intelligence-fabric.mjs';
import { DelegationContextRuntime } from '../native-core/delegation-context-runtime.mjs';
import { BrowserComputerUseFabric } from '../native-core/browser-computer-use-fabric.mjs';
import { GatewayAdapterRuntime } from '../native-core/gateway-adapter-runtime.mjs';
import { CommandSurfaceRuntime } from '../native-core/command-surface-runtime.mjs';
import { UsageObservabilityRuntime } from '../native-core/usage-observability-runtime.mjs';
import { AgentBehaviorRuntime } from '../native-core/agent-behavior-runtime.mjs';
import { SessionLifecycleRuntime } from '../native-core/session-lifecycle-runtime.mjs';
import { ToolGovernanceRuntime } from '../native-core/tool-governance-runtime.mjs';
import { ProfileConfigurationRuntime } from '../native-core/profile-configuration-runtime.mjs';
import { OAuthSecurityRuntime } from '../native-core/oauth-security-runtime.mjs';
import { KanbanRuntime } from '../native-core/kanban-runtime.mjs';
import { LocalObservabilityRuntime } from '../native-core/local-observability-runtime.mjs';
import { SkillBundleRuntime } from '../native-core/skill-bundle-runtime.mjs';
import { DashboardAuthRuntime } from '../native-core/dashboard-auth-runtime.mjs';
import { SessionSearchRuntime } from '../native-core/session-search-runtime.mjs';
import { CronProviderRuntime } from '../native-core/cron-provider-runtime.mjs';
import { JsonFastPathRuntime } from '../native-core/json-fast-path-runtime.mjs';
import { RuntimeWave6Fabric } from '../native-core/runtime-wave6-fabric.mjs';
import { EntitlementPolicy } from '../native-core/entitlement-policy.mjs';
import { ExecutionRuntimeWave7 } from '../native-core/execution-runtime-wave7.mjs';
import { SessionProductRuntimeWave8 } from '../native-core/session-product-runtime-wave8.mjs';
import { ProviderTransportRuntimeWave9 } from '../native-core/provider-transport-runtime-wave9.mjs';
import { GatewayMessagingRuntimeWave10 } from '../native-core/gateway-messaging-runtime-wave10.mjs';
import { BrowserEngineWave11 } from '../native-core/browser-engine-wave11.mjs';
import { AdapterEcosystemRuntimeWave12 } from '../native-core/adapter-ecosystem-wave12.mjs';
import { TrustCoreRuntimeWave13 } from '../native-core/trust-core-wave13.mjs';
import { MediaCoreRuntimeWave14 } from '../native-core/media-core-wave14.mjs';
import { ProductConfigurationRuntimeWave15 } from '../native-core/product-configuration-runtime-wave15.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const inside = (root, candidate) => { const relative = path.relative(root, candidate); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); };

export class NolaneNativeOrchestrationService {
  constructor({ dataDir, workspaceRoot = null, egressHosts = [], skillRoots = [], forgeOsRoots = [], clock = () => Date.now(), eventSink = () => {}, jobHandlers = {}, usagePricing = {}, maxUsageCostUsd = Infinity, nativePtyBackend = null, wave12ObservabilityExporter = null, wave13RedirectAllowlist = ['http://127.0.0.1:49152/callback'] } = {}) {
    if (!dataDir) throw new TypeError('dataDir is required');
    this.dataDir = path.resolve(dataDir);
    this.clock = clock;
    this.workspaceRoot = path.resolve(workspaceRoot ?? dataDir);
    this.eventSink = eventSink;
    this.skills = new NolaneSkillRegistry({ roots: skillRoots });
    this.forgeOsSkills = new ForgeOsSkillCatalog({ roots: forgeOsRoots });
    this.subagents = new NolaneSubagentManager({ clock });
    this.gateways = new NolaneGatewayRegistry();
    this.plugins = new NolanePluginHost({ allowedCapabilities: ['message:send', 'event:read'] });
    this.mcp = new McpRegistry();
    this.scheduler = new NolaneDurableScheduler({ file: path.join(this.dataDir, 'native-orchestration-jobs.json'), clock });
    this.trajectories = new NolaneTrajectoryStore({ file: path.join(this.dataDir, 'native-trajectories.jsonl') });
    this.sessions = new NolaneSessionStore({ root: path.join(this.dataDir, 'native-sessions') });
    this.memory = new CrossSessionMemory({ file: path.join(this.dataDir, 'native-memory.json'), clock });
    this.stateLearning = new SessionMemoryLearningFabric({ sessions: this.sessions, memory: this.memory, skills: this.skills });
    this.stateLearningReady = false;
    this.extensions = new ExtensionAutomationFabric({ plugins: this.plugins, mcp: this.mcp, scheduler: this.scheduler, subagents: this.subagents });
    this.media = new MediaProviderRegistry();
    this.audio = new AudioProviderRegistry();
    this.operations = new OperationsSecurityFabric({ dataDir: path.join(this.dataDir, 'native-operations'), workspaceRoot: this.workspaceRoot, allowedHosts: egressHosts, clock });
    this.adapters = new NativeAdapterTck({ allowedPermissions: ['network:https', 'storage:read', 'storage:write', 'media:capture'], clock });
    this.mixture = new MixtureOfAgentsCoordinator({ clock });
    this.delegationContext = new DelegationContextRuntime();
    this.providerProtocols = new ProviderProtocolRuntime({ clock });
    this.repositoryIntelligence = null;
    this.browserComputerUse = null;
    this.gatewayAdapters = new GatewayAdapterRuntime({ clock });
    this.commands = new CommandSurfaceRuntime({ clock });
    this.usage = new UsageObservabilityRuntime({ pricing: usagePricing, maxCostUsd: maxUsageCostUsd, clock });
    this.agentBehavior = new AgentBehaviorRuntime({ clock });
    this.sessionLifecycle = new SessionLifecycleRuntime({ store: this.sessions, file: path.join(this.dataDir, 'native-session-lifecycle.json'), clock });
    this.toolGovernance = new ToolGovernanceRuntime({ workspaceRoot: this.workspaceRoot, spillRoot: path.join(this.dataDir, 'native-tool-output') });
    this.profiles = new ProfileConfigurationRuntime({ file: path.join(this.dataDir, 'native-profiles.json'), clock });
    this.oauth = new OAuthSecurityRuntime({ clock });
    this.kanban = new KanbanRuntime({ file: path.join(this.dataDir, 'native-kanban.json'), clock });
    this.observability = new LocalObservabilityRuntime({ directory: path.join(this.dataDir, 'native-observability'), clock });
    this.skillBundles = new SkillBundleRuntime();
    this.dashboardAuth = new DashboardAuthRuntime({ secret: sha256(`nolane-dashboard:${this.dataDir}`), clock });
    this.sessionSearch = new SessionSearchRuntime();
    this.cronProviders = new CronProviderRuntime({ clock, handler: async (job) => this.eventSink(Object.freeze({ type: 'nolane.orchestration.cron', job })) });
    this.jsonFastPath = new JsonFastPathRuntime();
    this.runtimeWave6 = new RuntimeWave6Fabric({ dataDir: this.dataDir, clock, ptyBackend: nativePtyBackend ?? undefined });
    this.entitlements = new EntitlementPolicy({ tier: 'community' });
    this.executionWave7 = new ExecutionRuntimeWave7({ workspaceRoot: this.workspaceRoot, dataDir: path.join(this.dataDir, 'native-execution-wave7') });
    this.sessionWave8 = new SessionProductRuntimeWave8({ dataDir: path.join(this.dataDir, 'native-session-wave8'), clock });
    this.providerWave9 = new ProviderTransportRuntimeWave9({ clock });
    this.gatewayWave10 = new GatewayMessagingRuntimeWave10({ clock });
    this.browserWave11 = null;
    this.trustWave13 = new TrustCoreRuntimeWave13({ file: path.join(this.dataDir, 'native-trust-wave13.json'), redirectAllowlist: wave13RedirectAllowlist, clock });
    this.mediaWave14 = new MediaCoreRuntimeWave14({ root: path.join(this.dataDir, 'native-media-wave14') });
    this.productWave15 = new ProductConfigurationRuntimeWave15({ file: path.join(this.dataDir, 'native-product-wave15.json'), entitlementTier: 'community' });
    this.adapterWave12 = new AdapterEcosystemRuntimeWave12({
      dataDir: path.join(this.dataDir, 'native-adapter-wave12'),
      clock,
      schedulerHandler: async (job) => this.eventSink(Object.freeze({ type: 'nolane.adapter-wave12.job', job })),
      observabilityExporter: wave12ObservabilityExporter ?? undefined,
    });
    this.acp = new AcpStreamingRuntime({ clock, handlers: {
      'runtime/status': async () => this.status(),
      'command/execute': async ({ params, emit, signal }) => { emit('command.started', { command: params.command }); const result = await this.executeNativeCommand({ ...params, signal }); emit('command.completed', { command: params.command, receiptSha256: result.receiptSha256 }); return result; },
      'repository/search': async ({ params, emit }) => { emit('repository.search.started', { query: params.query }); const result = await this.searchNativeRepository(params); emit('repository.search.completed', { results: result.results.length }); return result; },
      'browser/execute': async ({ params, emit }) => { emit('browser.action.started', { action: params.action }); const result = await this.executeNativeBrowser(params); emit('browser.action.completed', { action: params.action, receiptSha256: result.receiptSha256 }); return result; },
    } });
    this.commands.register({ id: 'status', description: 'Show the shared Nolane native runtime status', handler: async () => this.status() });
    this.jobHandlers = new Map(Object.entries(jobHandlers));
    this.jobHandlers.set('noop', async (job) => ({ receiptSha256: sha256(JSON.stringify({ schema: 'nolane.agent.noop-job.v1', id: job.id, task: job.task })) }));
    let gatewayRunning = false;
    this.gateways.register({
      id: 'local', platform: 'local', capabilities: ['message:send'],
      async probe() { return { ready: true, transport: 'in-process' }; },
      async start() { gatewayRunning = true; }, async stop() { gatewayRunning = false; },
      status() { return gatewayRunning; },
    });
    const localMessages = this.plugins.install({
      id: 'local-messages', kind: 'messaging', capabilities: ['message:send'], hooks: [],
      adapter: { send: async (message) => {
        const externalId = `local-${sha256(JSON.stringify(message)).slice(0, 16)}`;
        const result = Object.freeze({ externalId, delivered: true, channel: message.channel });
        this.eventSink(Object.freeze({ type: 'nolane.orchestration.message', message, result }));
        return result;
      } },
    });
    if (localMessages.status !== 'installed') throw new Error('built-in local messaging plugin was quarantined');
    this.plugins.activate('local-messages');
    this.gatewayApi = new GatewayApiSurface({
      gateways: this.gateways,
      clock,
      deliveryHandler: async (event) => this.sendMessage({
        channel: event.gatewayId,
        principalId: event.principalId,
        sessionId: event.sessionId,
        type: event.type,
        text: event.text,
        attachments: event.attachments,
        eventId: event.eventId,
      }),
      runtimeSnapshot: () => ({
        schema: 'nolane.agent.shared-runtime-snapshot.v1',
        stateLearning: this.stateLearningReady ? this.stateLearning.snapshot() : { ready: false, sessions: 0, activeMemories: 0 },
        extensions: this.extensions.status(),
        subagents: this.subagents.snapshot?.() ?? null,
      }),
    }).attachMedia({ media: this.media, audio: this.audio });
  }

  async open() {
    await Promise.all([this.scheduler.open(), this.stateLearning.open(), this.operations.open(), this.profiles.open(), this.kanban.open(), this.observability.open(), this.runtimeWave6.open(), this.sessionWave8.open(), this.adapterWave12.open(), this.trustWave13.open(), this.mediaWave14.open(), this.productWave15.open()]);
    await this.sessionLifecycle.open();
    this.stateLearningReady = true;
    return this.status();
  }
  normalizeNativeMessage(input) { return this.agentBehavior.normalizeMessage(input); }
  generateNativeTitle(messages) { return this.agentBehavior.generateTitle(messages); }
  classifyNativeAgentError(input) { return this.agentBehavior.classifyError(input); }
  cleanupNativeReplay(events) { return this.agentBehavior.cleanupReplay(events); }
  threadNativeOutput(input) { return this.agentBehavior.threadOutput(input); }
  runNativeOneShot(input) { return this.agentBehavior.runOneShot(input); }
  reviewNativeEffects(input) { return this.agentBehavior.reviewEffects(input); }
  updateNativeSessionMetadata(sessionId, input) { return this.sessionLifecycle.updateMetadata(sessionId, input); }
  listNativeSessions(input) { return this.sessionLifecycle.list(input); }
  branchNativeSession(input) { return this.sessionLifecycle.branch(input); }
  rewindNativeSession(input) { return this.sessionLifecycle.rewind(input); }
  pushNativeInputHistory(input) { return this.sessionLifecycle.pushInputHistory(input); }
  nativeInputHistory(input) { return this.sessionLifecycle.inputHistory(input); }
  enqueueNativePrompt(input) { return this.sessionLifecycle.enqueuePrompt(input); }
  drainNativePromptQueue(input) { return this.sessionLifecycle.drainPromptQueue(input); }
  exportNativeSession(input) { return this.sessionLifecycle.exportSession(input); }
  governNativeToolSchema(schema) { return this.toolGovernance.sanitizeSchema(schema); }
  authorizeNativeToolUrl(url) { return this.toolGovernance.authorizeUrl(url); }
  prepareNativeWorkingDiff(changes) { return this.toolGovernance.prepareWorkingDiff(changes); }
  createNativeToolCheckpoint(input) { return this.toolGovernance.createCheckpoint(input); }
  captureNativeToolOutput(input) { return this.toolGovernance.captureOutput(input); }
  classifyNativeToolResult(input) { return this.toolGovernance.classifyResult(input); }
  normalizeNativeToolBudget(input) { return this.toolGovernance.normalizeBudget(input); }
  createNativeProfile(input) { return this.profiles.createProfile(input); }
  updateNativeProfile(id, input) { return this.profiles.updateProfile(id, input); }
  renameNativeProfile(id, input) { return this.profiles.renameProfile(id, input); }
  deleteNativeProfile(id, input) { return this.profiles.deleteProfile(id, input); }
  getNativeProfile(id) { return this.profiles.getProfile(id); }
  listNativeProfiles() { return this.profiles.listProfiles(); }
  exportNativeProfile(id) { return this.profiles.exportProfile(id); }
  beginNativeOAuth(input) { return this.oauth.begin(input); }
  completeNativeOAuth(input) { return this.oauth.complete(input); }
  revokeNativeOAuth(input) { return this.oauth.revoke(input); }
  createNativeKanbanCard(input) { return this.kanban.createCard(input); }
  moveNativeKanbanCard(id, input) { return this.kanban.moveCard(id, input); }
  nativeKanbanStatus() { return this.kanban.snapshot(); }
  recordNativeObservation(input) { return this.observability.record(input); }
  exportNativeObservations() { return this.observability.export(); }
  cleanupNativeObservations(input) { return this.observability.cleanup(input); }
  createNativeSkillBundle(input) { return this.skillBundles.createBundle(input); }
  verifyNativeSkillBundle(input) { return this.skillBundles.verifyBundle(input); }
  registerNativeDashboardUser(input) { return this.dashboardAuth.registerUser(input); }
  loginNativeDashboard(input) { return this.dashboardAuth.login(input); }
  authorizeNativeDashboard(input) { return this.dashboardAuth.authorize(input); }
  setNativeDashboardDrain(value) { return this.dashboardAuth.setDrainMode(value); }
  indexNativeSession(input) { return this.sessionSearch.index(input); }
  searchNativeSessions(input) { return this.sessionSearch.search(input); }
  registerNativeCron(input) { return this.cronProviders.register(input); }
  runNativeCronDue() { return this.cronProviders.runDue(); }
  recoverNativeCronLeases() { return this.cronProviders.recoverStaleLeases(); }
  parseNativeJson(input) { return this.jsonFastPath.parse(input); }
  tryParseNativeJson(input) { return this.jsonFastPath.tryParse(input); }
  beginNativeMcpOAuth(input) { return this.runtimeWave6.mcpOAuth.begin(input); }
  completeNativeMcpOAuth(input) { return this.runtimeWave6.mcpOAuth.complete(input); }
  revokeNativeMcpOAuth(input) { return this.runtimeWave6.mcpOAuth.revoke(input); }
  registerNativeBrowserContext(input) { return this.runtimeWave6.browserSupervisor.registerContext(input); }
  startNativeBrowserContext(id) { return this.runtimeWave6.browserSupervisor.start(id); }
  executeNativeSupervisedBrowser(id, action) { return this.runtimeWave6.browserSupervisor.execute(id, action); }
  enqueueNativeBrowserDialog(id, input) { return this.runtimeWave6.browserSupervisor.enqueueDialog(id, input); }
  resolveNativeBrowserDialog(id, input) { return this.runtimeWave6.browserSupervisor.resolveDialog(id, input); }
  recoverNativeBrowserContext(id) { return this.runtimeWave6.browserSupervisor.recover(id); }
  spawnNativeDelegation(input) { return this.runtimeWave6.delegation.spawn(input); }
  appendNativeDelegationLog(id, input) { return this.runtimeWave6.delegation.appendLog(id, input); }
  heartbeatNativeDelegation(id, input) { return this.runtimeWave6.delegation.heartbeat(id, input); }
  recoverNativeDelegations(input) { return this.runtimeWave6.delegation.recoverStale(input); }
  completeNativeDelegation(id, input) { return this.runtimeWave6.delegation.complete(id, input); }
  startNativePtySession(input) { return this.runtimeWave6.pty.start(input); }
  writeNativePtySession(id, data) { return this.runtimeWave6.pty.write(id, data); }
  resizeNativePtySession(id, input) { return this.runtimeWave6.pty.resize(id, input); }
  replayNativePtySession(id, input) { return this.runtimeWave6.pty.replay(id, input); }
  stopNativePtySession(id) { return this.runtimeWave6.pty.stop(id); }
  nextNativeTurnRetry(input) { return this.runtimeWave6.pty.nextRetry(input); }
  registerNativeGatewayHost(input) { return this.runtimeWave6.gatewayRecovery.registerHost(input); }
  heartbeatNativeGatewayHost(id, input) { return this.runtimeWave6.gatewayRecovery.heartbeat(id, input); }
  sampleNativeGatewayMemory(id, input) { return this.runtimeWave6.gatewayRecovery.sampleMemory(id, input); }
  shutdownNativeGatewayHost(id, input) { return this.runtimeWave6.gatewayRecovery.shutdown(id, input); }
  putNativeLocalMedia(input) { return this.runtimeWave6.media.put(input); }
  getNativeLocalMedia(id) { return this.runtimeWave6.media.get(id); }
  enqueueNativePlayback(input) { return this.runtimeWave6.media.enqueuePlayback(input); }
  startNativePlayback() { return this.runtimeWave6.media.startPlayback(); }
  pauseNativePlayback() { return this.runtimeWave6.media.pausePlayback(); }
  bargeInNativePlayback(input) { return this.runtimeWave6.media.bargeIn(input); }
  runtimeWave6Status() { return this.runtimeWave6.snapshot(); }
  nativeEntitlementStatus() { return this.entitlements.snapshot(); }
  executeNativeBackend(input) { return this.executionWave7.execute(input); }
  transferNativeExecutionArtifact({ source, target } = {}) { return this.executionWave7.artifacts.copy(source, target); }
  executionWave7Status() { return this.executionWave7.snapshot(); }
  appendNativeSessionStream(sessionId, message) { return this.sessionWave8.stream.append(sessionId, message); }
  appendManyNativeSessionStream(sessionId, messages) { return this.sessionWave8.stream.appendMany(sessionId, messages); }
  resumeNativeSessionStream(sessionId, options) { return this.sessionWave8.stream.resume(sessionId, options); }
  stopNativeSessionStream(sessionId, reason) { return this.sessionWave8.stream.stop(sessionId, reason); }
  acquireNativeSessionWindow(input) { return this.sessionWave8.leases.acquire(input); }
  heartbeatNativeSessionWindow(input) { return this.sessionWave8.leases.heartbeat(input); }
  releaseNativeSessionWindow(input) { return this.sessionWave8.leases.release(input); }
  compressNativeSession(input) { return this.sessionWave8.compression.compress(input); }
  detectNativeSessionContextDrift(input) { return this.sessionWave8.drift.compare(input); }
  bindNativeSessionTerminal(input) { return this.sessionWave8.terminals.bind(input); }
  unbindNativeSessionTerminal(input) { return this.sessionWave8.terminals.unbind(input); }
  nativeSessionVirtualList(profileId, items) { return this.sessionWave8.virtualList(profileId, items); }
  sessionWave8Status() { return this.sessionWave8.snapshot(); }
  registerNativeProviderTransport(input) { return this.providerWave9.register(input); }
  completeNativeProviderTransport(input) { return this.providerWave9.complete(input); }
  providerWave9Status() { return this.providerWave9.snapshot(); }
  registerNativeMessagingAdapter(input) { return this.gatewayWave10.register(input); }
  startNativeMessagingAdapter(id) { return this.gatewayWave10.start(id); }
  stopNativeMessagingAdapter(id) { return this.gatewayWave10.stop(id); }
  normalizeNativeMessagingInbound(id, raw) { return this.gatewayWave10.normalizeInbound(id, raw); }
  deliverNativeMessaging(id, message) { return this.gatewayWave10.deliver(id, message); }
  gatewayWave10Status() { return this.gatewayWave10.snapshot(); }
  async attachNativeBrowserEngineWave11({ backend, approval } = {}) { this.browserWave11 = new BrowserEngineWave11({ backend, approval, profileRoot: path.join(this.dataDir, 'native-browser-wave11', 'profiles'), uploadRoot: path.join(this.dataDir, 'native-browser-wave11', 'uploads'), quarantineRoot: path.join(this.dataDir, 'native-browser-wave11', 'quarantine') }); await this.browserWave11.open(); return this.browserWave11Status(); }
  createNativeBrowserProfile(input) { return this.#requireBrowserWave11().createProfile(input); }
  navigateNativeBrowserWave11(input) { return this.#requireBrowserWave11().navigate(input); }
  snapshotNativeBrowserWave11(input) { return this.#requireBrowserWave11().snapshot(input); }
  executeNativeBrowserWave11(input) { return this.#requireBrowserWave11().execute(input); }
  runNativeBrowserJourneyWave11(input) { return this.#requireBrowserWave11().runJourney(input); }
  browserWave11Status() { return this.browserWave11 ? Object.freeze({ attached: true, engine: this.browserWave11.status() }) : Object.freeze({ attached: false, engine: null }); }
  #requireBrowserWave11() { if (!this.browserWave11) throw Object.assign(new Error('Native browser engine wave11 is not attached'), { code: 'BROWSER_ENGINE_UNAVAILABLE', statusCode: 503 }); return this.browserWave11; }
  putNativeAdapterMemory(input) { return this.adapterWave12.memory.put(input); }
  getNativeAdapterMemory(id) { return this.adapterWave12.memory.get(id); }
  queryNativeAdapterMemory(query, options) { return this.adapterWave12.memory.query(query, options); }
  deleteNativeAdapterMemory(input) { return this.adapterWave12.memory.delete(input); }
  scheduleNativeAdapterJob(input) { return this.adapterWave12.scheduler.schedule(input); }
  runNativeAdapterJobs() { return this.adapterWave12.scheduler.runDue(); }
  applyNativeAdapterKanban(input) { return this.adapterWave12.kanban.apply(input); }
  recordNativeAdapterObservation(input) { return this.adapterWave12.observability.record(input); }
  flushNativeAdapterObservations() { return this.adapterWave12.observability.flush(); }
  cleanupNativeAdapterOperations(input) { return this.adapterWave12.operations.cleanup(input); }
  adapterWave12Status() { return this.adapterWave12.snapshot(); }
  registerNativeTrustOAuthProvider(input) { return this.trustWave13.oauth.registerProvider(input); }
  beginNativeTrustOAuth(input) { return this.trustWave13.oauth.begin(input); }
  completeNativeTrustOAuth(input) { return this.trustWave13.oauth.complete(input); }
  refreshNativeTrustOAuth(input) { return this.trustWave13.oauth.refresh(input); }
  revokeNativeTrustOAuth(input) { return this.trustWave13.oauth.revoke(input); }
  grantNativeTrustProfile(input) { return this.trustWave13.auth.grant(input); }
  requireNativeTrustReauthentication(input) { return this.trustWave13.auth.requireReauthentication(input); }
  revokeNativeTrustProfile(input) { return this.trustWave13.auth.revoke(input); }
  nativeTrustProfileStatus(profileId) { return this.trustWave13.auth.status(profileId); }
  issueNativeTrustPairing(input) { return this.trustWave13.pairing.issue(input); }
  enrollNativeTrustPairing(input) { return this.trustWave13.pairing.enroll(input); }
  revokeNativeTrustPairing(input) { return this.trustWave13.pairing.revoke(input); }
  trustWave13Status() { return this.trustWave13.snapshot(); }
  registerNativeMediaProviderWave14(input) { return this.mediaWave14.providers.register(input); }
  generateNativeMediaWave14(input) { return this.mediaWave14.generate(input); }
  transcribeNativeMediaWave14(input) { return this.mediaWave14.transcribe(input); }
  speakNativeMediaWave14(input) { return this.mediaWave14.speak(input); }
  startNativeVoiceRecordingWave14(input) { return this.mediaWave14.voice.startRecording(input); }
  appendNativeVoiceRecordingWave14(bytes) { return this.mediaWave14.voice.appendRecording(bytes); }
  stopNativeVoiceRecordingWave14() { return this.mediaWave14.voice.stopRecording(); }
  startNativeVoicePlaybackWave14(assetId) { return this.mediaWave14.voice.startPlayback(assetId); }
  bargeInNativeVoiceWave14(input) { return this.mediaWave14.voice.bargeIn(input); }
  mediaWave14Status() { return this.mediaWave14.snapshot(); }
  applyNativeProductEventWave15(input) { return this.productWave15.product.apply(input); }
  projectNativeProductWave15(surface) { return this.productWave15.project(surface); }
  createNativeProductProfileWave15(input) { return this.productWave15.config.createProfile(input); }
  updateNativeProductProfileWave15(input) { return this.productWave15.config.updateProfile(input); }
  deleteNativeProductProfileWave15(input) { return this.productWave15.config.deleteProfile(input); }
  nativeProductProfileWave15(id) { return this.productWave15.config.getProfile(id); }
  listNativeProductProfilesWave15() { return this.productWave15.config.listProfiles(); }
  planNativeBootstrapWave15(input) { return this.productWave15.bootstrap.plan(input); }
  registerNativeProductModelWave15(input) { return this.productWave15.models.register(input); }
  searchNativeProductModelsWave15(input) { return this.productWave15.models.search(input); }
  selectNativeProductModelWave15(input) { return this.productWave15.models.select(input); }
  defineNativeToolsetWave15(input) { return this.productWave15.toolsets.define(input); }
  stageNativeUpdateWave15(input) { return this.productWave15.updates.stage(input); }
  productWave15Status() { return this.productWave15.snapshot(); }
  requireNativeEntitlement(capability) { return this.entitlements.require(capability); }
  createSession(input) { return this.stateLearning.createSession(input); }
  appendSessionMessage(sessionId, message, options) { return this.stateLearning.appendMessage(sessionId, message, options); }
  learnExperience(input) { return this.stateLearning.learn(input); }
  recallExperience(input) { return this.stateLearning.recall(input); }
  gradeSkill(input) { return this.stateLearning.gradeSkill(input); }
  rollbackSkill(input) { return this.stateLearning.rollbackSkill(input); }
  async listSkills({ source = null, catalog = null, query = null, limit = null } = {}) {
    const nativeSkills = await this.skills.discover();
    const forgeOsSkills = await this.forgeOsSkills.discover();
    let skills = [...nativeSkills, ...forgeOsSkills];
    if (source) skills = skills.filter((skill) => skill.source === String(source));
    if (catalog) skills = skills.filter((skill) => skill.catalog === String(catalog));
    if (query) {
      const needle = String(query).trim().toLowerCase();
      if (needle) skills = skills.filter((skill) => [skill.id, skill.sourceId, skill.title, skill.description, skill.pack, skill.domain, ...(skill.capabilityIds ?? [])].filter(Boolean).join(' ').toLowerCase().includes(needle));
    }
    const sourceRank = (skill) => skill.source === 'forge-os' ? (skill.catalog === 'v2' ? 1 : 2) : 0;
    skills.sort((a, b) => sourceRank(a) - sourceRank(b) || String(a.id).localeCompare(String(b.id)));
    return limit == null ? skills : skills.slice(0, Math.max(0, Number(limit) || 0));
  }
  async skillCatalog({ source = null, catalog = null, query = null, limit = null } = {}) {
    const skills = await this.listSkills({ source, catalog, query, limit });
    const bySource = Object.create(null);
    const byCatalog = Object.create(null);
    for (const skill of skills) {
      const sourceKey = String(skill.source ?? 'unknown');
      const catalogKey = String(skill.catalog ?? 'uncategorized');
      bySource[sourceKey] = (bySource[sourceKey] ?? 0) + 1;
      byCatalog[catalogKey] = (byCatalog[catalogKey] ?? 0) + 1;
    }
    return Object.freeze({
      schema: 'nolane.agent.skill-hub-catalog.v1',
      readOnly: true,
      source: 'nolane+forge-os',
      filters: Object.freeze({ source, catalog, query, limit }),
      counts: Object.freeze({ total: skills.length, bySource: Object.freeze(bySource), byCatalog: Object.freeze(byCatalog) }),
      skills: Object.freeze(skills),
    });
  }
  loadSkill(id, options) { return String(id).startsWith('forgeos:') ? this.forgeOsSkills.load(id, options) : this.skills.load(id, options); }
  spawnSubagent(input) { return this.subagents.spawn(input); }
  completeSubagent(id, input) { return this.subagents.complete(id, input); }
  cancelMission(missionId, input) { return this.subagents.cancelMission(missionId, input); }
  getSubagent(id) { return this.subagents.get(id); }
  startGateway(id = 'local') { return this.gateways.start(id); }
  stopGateway(id = 'local') { return this.gateways.stop(id); }
  gatewayStatus(id = 'local') { return this.gateways.status(id); }
  sendMessage(message) { return this.plugins.send('local-messages', message); }
  nativeCoreStatus() { return this.gatewayApi.snapshot(); }
  issueGatewayPairing(input) { return this.gatewayApi.issuePairing(input); }
  acceptGatewayPairing(input) { return this.gatewayApi.acceptPairing(input); }
  enqueueGatewayEvent(input) { return this.gatewayApi.enqueueEvent(input); }
  deliverGatewayEvent(eventId) { return this.gatewayApi.deliver(eventId); }
  streamGatewayEvents(options) { return this.gatewayApi.stream(options); }
  registerMediaProvider(provider) { this.media.register(provider); return this.media.describe(); }
  registerAudioProvider(provider) { this.audio.register(provider); return this.audio.describe(); }
  executeNativeMedia(input) { return this.gatewayApi.executeMedia(input); }
  registerNativeAdapter(input) { return this.adapters.register(input); }
  probeNativeAdapter(id) { return this.adapters.probe(id); }
  startNativeAdapter(id) { return this.adapters.start(id); }
  executeNativeAdapter(id, input, options) { return this.adapters.execute(id, input, options); }
  stopNativeAdapter(id) { return this.adapters.stop(id); }
  runMixtureOfAgents(input) { return this.mixture.run(input); }
  createNativeBackup(input) { return this.operations.createBackup(input); }
  restoreNativeBackup(input) { return this.operations.restoreBackup(input); }
  authorizeNativeEgress(input) { return this.operations.authorizeEgress(input); }
  recordNativeAudit(input) { return this.operations.recordAudit(input); }
  recordNativeDependency(input) { return this.operations.recordDependency(input); }
  diagnoseNativeDevice(input) { return this.operations.diagnoseDevice(input); }
  attachRuntimeWave3({ browser = null, approval = null, repositorySearch = null, codeIntelligence = null } = {}) {
    if (browser) this.browserComputerUse = new BrowserComputerUseFabric({ browser, approval: approval ?? (async () => ({ approved: false })), clock: this.clock });
    if (repositorySearch) this.repositoryIntelligence = new RepositoryIntelligenceFabric({ search: repositorySearch, codeIntelligence });
    return this.runtimeWave3Status();
  }
  handleAcp(request) { return this.acp.handle(request); }
  cancelAcp(requestId, reason) { return this.acp.cancel(requestId, reason); }
  registerProviderProtocol(input) { return this.providerProtocols.register(input); }
  completeProviderProtocol(input) { return this.providerProtocols.complete(input); }
  buildDelegationContext(input) { return this.delegationContext.build(input); }
  searchNativeRepository(input) { if (!this.repositoryIntelligence) throw new Error('native repository intelligence is not attached'); return this.repositoryIntelligence.search(input); }
  symbolsNativeRepository(input) { if (!this.repositoryIntelligence) throw new Error('native repository intelligence is not attached'); return this.repositoryIntelligence.symbols(input); }
  planNativeFileSync(input) { if (!this.repositoryIntelligence) throw new Error('native repository intelligence is not attached'); return this.repositoryIntelligence.planFileSync(input); }
  executeNativeBrowser(input) { if (!this.browserComputerUse) throw new Error('native browser computer-use is not attached'); return this.browserComputerUse.execute(input); }
  registerGatewayAdapter(input) { return this.gatewayAdapters.register(input); }
  startGatewayAdapter(id) { return this.gatewayAdapters.start(id); }
  stopGatewayAdapter(id) { return this.gatewayAdapters.stop(id); }
  normalizeGatewayInbound(id, raw) { return this.gatewayAdapters.normalizeInbound(id, raw); }
  deliverGatewayAdapter(id, message) { return this.gatewayAdapters.deliver(id, message); }
  registerNativeCommand(input) { return this.commands.register(input); }
  listNativeCommands() { return this.commands.list(); }
  executeNativeCommand(input) { return this.commands.execute(input); }
  recordNativeUsage(input) { return this.usage.record(input); }
  nativeUsageStatus() { return this.usage.snapshot(); }
  runtimeWave3Status() { return Object.freeze({ schema: 'nolane.agent.runtime-wave3.v1', acp: this.acp.snapshot(), providers: this.providerProtocols.snapshot(), repository: Object.freeze({ attached: Boolean(this.repositoryIntelligence) }), browser: this.browserComputerUse ? this.browserComputerUse.snapshot() : Object.freeze({ attached: false }), gatewayAdapters: this.gatewayAdapters.snapshot(), commands: this.commands.snapshot(), usage: this.usage.snapshot() }); }
  runtimeWave4Status() { return Object.freeze({ schema: 'nolane.agent.runtime-wave4.v1', agentBehavior: this.agentBehavior.snapshot(), sessions: this.sessionLifecycle.snapshot(), tools: this.toolGovernance.snapshot(), profiles: this.profiles.snapshot(), oauth: this.oauth.snapshot() }); }
  runtimeWave5Status() { return Object.freeze({ schema: 'nolane.agent.runtime-wave5.v1', kanban: this.kanban.snapshot(), observability: this.observability.snapshot(), dashboardAuth: this.dashboardAuth.snapshot(), sessionSearch: this.sessionSearch.snapshot(), cron: this.cronProviders.snapshot(), json: this.jsonFastPath.snapshot() }); }
  pluginStatus() { return this.plugins.view('local-messages'); }
  async schedule(job) {
    if (!this.jobHandlers.has(String(job?.task?.type ?? ''))) throw new Error(`unsupported scheduled task type: ${job?.task?.type ?? ''}`);
    return this.scheduler.schedule(job);
  }
  runDue() {
    return this.scheduler.runDue(async (job) => {
      const handler = this.jobHandlers.get(String(job.task.type));
      if (!handler) throw new Error(`unsupported scheduled task type: ${job.task.type}`);
      return handler(job);
    });
  }
  appendTrajectory(input) { return this.trajectories.append(input); }
  exportTrajectories({ outputFile = path.join(this.dataDir, 'native-trajectories-export.jsonl') } = {}) {
    const resolved = path.resolve(outputFile);
    if (!inside(this.dataDir, resolved)) throw new Error('trajectory export path is outside orchestration data directory');
    return this.trajectories.export({ outputFile: resolved });
  }
  status() { const adapterSnapshot = this.adapters.snapshot(); return Object.freeze({ schema: 'nolane.agent.native-orchestration.v8', gateway: this.gatewayStatus('local'), plugin: this.pluginStatus(), stateLearning: this.stateLearningReady ? this.stateLearning.snapshot() : Object.freeze({ ready: false, sessions: 0, activeMemories: 0 }), extensions: this.extensions.status(), nativeCore: this.nativeCoreStatus(), operations: this.operations.status(), adapters: Object.freeze({ schema: adapterSnapshot.schema, adapters: adapterSnapshot.adapters.length, running: adapterSnapshot.adapters.filter((entry) => entry.state === 'running').length, failed: adapterSnapshot.adapters.filter((entry) => entry.state === 'failed').length, headSha256: adapterSnapshot.headSha256, receiptSha256: adapterSnapshot.receiptSha256 }), mixture: this.mixture.snapshot(), runtimeWave3: this.runtimeWave3Status(), runtimeWave4: this.runtimeWave4Status(), runtimeWave5: this.runtimeWave5Status(), runtimeWave6: this.runtimeWave6Status(), executionWave7: this.executionWave7Status(), sessionWave8: this.sessionWave8Status(), providerWave9: this.providerWave9Status(), gatewayWave10: this.gatewayWave10Status(), browserWave11: this.browserWave11Status(), adapterWave12: this.adapterWave12Status(), trustWave13: this.trustWave13Status(), mediaWave14: this.mediaWave14Status(), productWave15: this.productWave15Status(), entitlements: this.nativeEntitlementStatus() }); }
}
