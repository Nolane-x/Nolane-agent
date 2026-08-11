import path from 'node:path';
import { AUTONOMY_PROFILES } from '../security/autonomy-policy.mjs';
import { BROWSER_WRITE_ACTIONS } from '../security/browser-permission-service.mjs';

function json(res, status, value, headers = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), ...headers });
  res.end(body);
}

async function readJson(req, maxBytes = 1_000_000) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length; if (size > maxBytes) throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }); }
}

function defaultPlanner({ objective }) {
  return {
    summary: 'Inspect, implement, and independently verify the requested change.',
    tasks: [
      { id: 'scout', title: 'Inspect repository', objective: `Inspect the repository for: ${objective}`, role: 'scout', dependencies: [], allowedPaths: ['**'], deniedPaths: ['.env', '.env.*', '**/*.pem', '**/*.key'] },
      { id: 'builder', title: 'Implement change', objective: String(objective), role: 'builder', dependencies: ['scout'], allowedPaths: ['src/**', 'tests/**', 'package.json', 'package-lock.json'], deniedPaths: ['.env', '.env.*', '**/*.pem', '**/*.key'] },
      { id: 'reviewer', title: 'Independent verification', objective: `Independently review and verify: ${objective}`, role: 'reviewer', dependencies: ['builder'], allowedPaths: ['**'], deniedPaths: ['.env', '.env.*', '**/*.pem', '**/*.key'] },
    ],
  };
}

export function createRoutes({ store, providers, missionRunner, runCoordinator = null, projectService = null, webIntelligence = null, repositoryIndex = null, router = null, mcpRegistry = null, evalRunner = null, verificationRunner = null, plannerService = null, memoryService = null, gitInspector = null, autopilot = null, fileService = null, credentialVault = null, providerConnections = null, uiAssets = null, updateService = null, updatePreparation = null, instructionDiscovery = null, instructionPolicy = null, runtimeStatus = null, goalService = null, goalRunService = null, replanner = null, commandRegistry = null, browserService = null, browserRuntimeInstaller = null, browserPermissionService = null, pluginService = null, settingsService = null, personalizationProfile = null, onboardingService = null, sessionRestore = null, missionGraph = null, goalScheduler = null, forgeBridge = null, enterpriseCloudRoutes = null, operatingPlane = null, capabilityLedger = null, adaptiveIntelligence = null, environmentControl = null, nativeRuntime = null, nativeAgent = null, nativeOrchestration = null, sessionStore = null, smallModelFoundation = null, nativeCapabilities = null, operationalBoundary = null, dependencyPreflight = null, workspaceTrust = null, diffReview = null, operationsCenter = null, contextMemoryCenter = null, contextOrchestration = null, traceEvidenceCenter = null, repositoryDiscovery = null, codebaseKnowledge = null, semanticDependency = null, codeRelationships = null, localResourceSandbox = null, localTaskHandoff = null, gitGovernance = null, treeSitterRuntime = null, agentModes = null, missionStateProgress = null, localOperations = null, architectureStageGate = null, missionCompletion = null, localContainerPreflight = null, evidenceContextRuntime = null, missionResourceFabric = null, modelProfiles = null, modelManager = null, executionStory = null, timeTravel = null, sovereignKernel = null, uiSummary = null }) {
  return async function route(req, res, url) {
    const method = req.method ?? 'GET'; const pathname = url.pathname;
    if (enterpriseCloudRoutes && await enterpriseCloudRoutes(req, res, url)) return true;

    if (pathname === '/api/execution-story') {
      if (!executionStory) throw Object.assign(new Error('Execution Story is not configured'), { statusCode: 503, code: 'execution_story_unavailable' });
      if (method !== 'GET') return false;
      return json(res, 200, executionStory.snapshot({
        missionId: url.searchParams.get('missionId'),
        level: url.searchParams.get('level') ?? 'workspace',
        language: url.searchParams.get('language') ?? 'en',
        afterSeq: Number(url.searchParams.get('afterSeq')) || 0,
        limit: Number(url.searchParams.get('limit')) || 2_000,
      }));
    }
    if (pathname === '/api/execution-story/export') {
      if (!executionStory) throw Object.assign(new Error('Execution Story is not configured'), { statusCode: 503, code: 'execution_story_unavailable' });
      if (method !== 'GET') return false;
      return json(res, 200, executionStory.exportBundle({ missionId: url.searchParams.get('missionId'), language: url.searchParams.get('language') ?? 'en' }));
    }

    if (pathname === '/api/time-travel/checkpoints') {
      if (!timeTravel) throw Object.assign(new Error('Time Travel is not configured'), { statusCode: 503, code: 'time_travel_unavailable' });
      if (method === 'GET') return json(res, 200, await timeTravel.list({ missionId: url.searchParams.get('missionId'), projectId: url.searchParams.get('projectId') }));
      if (method === 'POST') {
        const body = await readJson(req, 128_000);
        const mission = store?.getMission?.(String(body.missionId ?? ''));
        if (!mission) throw Object.assign(new Error(`Unknown mission: ${body.missionId}`), { statusCode: 404, code: 'TIME_TRAVEL_MISSION_NOT_FOUND' });
        if (workspaceTrust) await workspaceTrust.requireTrusted(mission.projectId, 'background');
        return json(res, 201, await timeTravel.create(body));
      }
      return false;
    }
    const timeTravelCheckpoint = pathname.match(/^\/api\/time-travel\/checkpoints\/([^/]+)(?:\/(compare|restore-file|branch|replay|export))?$/);
    if (timeTravelCheckpoint) {
      if (!timeTravel) throw Object.assign(new Error('Time Travel is not configured'), { statusCode: 503, code: 'time_travel_unavailable' });
      const checkpointId = decodeURIComponent(timeTravelCheckpoint[1]);
      const action = timeTravelCheckpoint[2] ?? null;
      const checkpoint = await timeTravel.get(checkpointId);
      if (workspaceTrust) await workspaceTrust.requireTrusted(checkpoint.projectId, action ? 'background' : 'read');
      if (!action && method === 'GET') return json(res, 200, checkpoint);
      if (action === 'compare' && method === 'GET') return json(res, 200, await timeTravel.compare(checkpointId));
      if (action === 'export' && method === 'GET') return json(res, 200, await timeTravel.exportEvidence(checkpointId));
      if (action === 'restore-file' && method === 'POST') return json(res, 200, await timeTravel.restoreFile({ checkpointId, ...(await readJson(req, 128_000)) }));
      if (action === 'branch' && method === 'POST') return json(res, 201, await timeTravel.createBranch({ checkpointId, ...(await readJson(req, 128_000)) }));
      if (action === 'replay' && method === 'POST') return json(res, 201, await timeTravel.replayMission({ checkpointId, ...(await readJson(req, 128_000)) }));
      return false;
    }

    if (pathname === '/api/sovereign-kernel/health') {
      if (!sovereignKernel) throw Object.assign(new Error('Sovereign agent kernel is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, sovereignKernel.health());
    }
    if (pathname === '/api/sovereign-kernel/snapshot') {
      if (!sovereignKernel) throw Object.assign(new Error('Sovereign agent kernel is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, sovereignKernel.snapshot({ threadId: url.searchParams.get('threadId'), projectId: url.searchParams.get('projectId') }));
    }
    if (pathname === '/api/sovereign-kernel/threads') {
      if (!sovereignKernel) throw Object.assign(new Error('Sovereign agent kernel is not configured'), { statusCode: 503 });
      if (method === 'GET') return json(res, 200, { threads: sovereignKernel.listThreads({ projectId: url.searchParams.get('projectId'), state: url.searchParams.get('state'), limit: Number(url.searchParams.get('limit')) || 200 }) });
      if (method === 'POST') return json(res, 201, sovereignKernel.createThread(await readJson(req, 256_000)));
      return false;
    }
    const sovereignThreadMatch = pathname.match(/^\/api\/sovereign-kernel\/threads\/([^/]+)(?:\/(context|plans|capabilities|checkpoints|transition|timeline))?$/);
    if (sovereignThreadMatch) {
      if (!sovereignKernel) throw Object.assign(new Error('Sovereign agent kernel is not configured'), { statusCode: 503 });
      const threadId = decodeURIComponent(sovereignThreadMatch[1]); const action = sovereignThreadMatch[2] ?? null;
      if (!action && method === 'GET') return json(res, 200, sovereignKernel.getThread(threadId));
      if (action === 'timeline' && method === 'GET') return json(res, 200, { events: sovereignKernel.timeline(threadId, { afterSeq: Number(url.searchParams.get('afterSequence')) || 0, limit: Number(url.searchParams.get('limit')) || 500 }) });
      if (action === 'context' && method === 'POST') return json(res, 201, sovereignKernel.compileContext(threadId, await readJson(req, 2_000_000)));
      if (action === 'plans' && method === 'POST') return json(res, 201, sovereignKernel.compilePlan(threadId, await readJson(req, 1_000_000)));
      if (action === 'capabilities' && method === 'POST') return json(res, 201, await sovereignKernel.requestCapability(threadId, await readJson(req, 256_000)));
      if (action === 'checkpoints' && method === 'POST') return json(res, 201, sovereignKernel.checkpoint(threadId, await readJson(req, 1_000_000)));
      if (action === 'transition' && method === 'POST') { const body = await readJson(req, 128_000); return json(res, 200, sovereignKernel.transition(threadId, body.state, body)); }
      return false;
    }
    const sovereignPlanMatch = pathname.match(/^\/api\/sovereign-kernel\/plans\/([^/]+)\/execute$/);
    if (sovereignPlanMatch) {
      if (!sovereignKernel) throw Object.assign(new Error('Sovereign agent kernel is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 128_000);
      return json(res, 202, await sovereignKernel.executePlan(body.threadId, decodeURIComponent(sovereignPlanMatch[1]), body));
    }
    const sovereignCapabilityMatch = pathname.match(/^\/api\/sovereign-kernel\/capabilities\/([^/]+)\/(decision|revoke)$/);
    if (sovereignCapabilityMatch) {
      if (!sovereignKernel) throw Object.assign(new Error('Sovereign agent kernel is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 128_000); const leaseId = decodeURIComponent(sovereignCapabilityMatch[1]);
      return json(res, 200, sovereignCapabilityMatch[2] === 'decision' ? sovereignKernel.decideCapability(leaseId, body) : sovereignKernel.revokeCapability(leaseId, body));
    }
    const sovereignResumeMatch = pathname.match(/^\/api\/sovereign-kernel\/checkpoints\/([^/]+)\/resume$/);
    if (sovereignResumeMatch) {
      if (!sovereignKernel) throw Object.assign(new Error('Sovereign agent kernel is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 201, sovereignKernel.resumeFromCheckpoint(decodeURIComponent(sovereignResumeMatch[1]), await readJson(req, 256_000)));
    }

    if (pathname === '/api/nolane/native-core/product/wave15/status') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.productWave15Status());
    }
    if (pathname === '/api/nolane/native-core/product/wave15/project') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.projectNativeProductWave15(url.searchParams.get('surface') ?? 'web'));
    }
    if (pathname === '/api/nolane/native-core/product/wave15/events') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.applyNativeProductEventWave15(await readJson(req, 1_000_000)));
    }
    if (pathname === '/api/nolane/native-core/product/wave15/profiles') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method === 'GET') return json(res, 200, nativeOrchestration.listNativeProductProfilesWave15());
      if (method === 'POST') return json(res, 201, nativeOrchestration.createNativeProductProfileWave15(await readJson(req, 256_000)));
      if (method === 'PATCH') return json(res, 200, nativeOrchestration.updateNativeProductProfileWave15(await readJson(req, 256_000)));
      if (method === 'DELETE') return json(res, 200, nativeOrchestration.deleteNativeProductProfileWave15(await readJson(req, 64_000)));
      return false;
    }
    if (pathname === '/api/nolane/native-core/product/wave15/bootstrap') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.planNativeBootstrapWave15(await readJson(req, 256_000)));
    }
    if (pathname === '/api/nolane/native-core/product/wave15/models') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method === 'GET') return json(res, 200, nativeOrchestration.searchNativeProductModelsWave15({ query: url.searchParams.get('query') ?? '' }));
      if (method === 'POST') return json(res, 201, nativeOrchestration.registerNativeProductModelWave15(await readJson(req, 128_000)));
      return false;
    }

    if (pathname === '/api/nolane/native-core/media/wave14/status') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.mediaWave14Status());
    }
    if (pathname === '/api/nolane/native-core/media/wave14/generate') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 201, await nativeOrchestration.generateNativeMediaWave14(await readJson(req, 2_000_000)));
    }
    if (pathname === '/api/nolane/native-core/media/wave14/transcribe') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 20_000_000);
      return json(res, 200, await nativeOrchestration.transcribeNativeMediaWave14({ ...body, bytes: Buffer.from(body.bytesBase64 ?? '', 'base64') }));
    }
    if (pathname === '/api/nolane/native-core/media/wave14/speak') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 201, await nativeOrchestration.speakNativeMediaWave14(await readJson(req, 1_000_000)));
    }
    if (pathname === '/api/nolane/native-core/media/wave14/barge-in') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.bargeInNativeVoiceWave14(await readJson(req, 64_000)));
    }

    if (pathname === '/api/nolane/native-core/trust/wave13/status') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.trustWave13Status());
    }
    if (pathname === '/api/nolane/native-core/trust/wave13/pairing/issue') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 201, nativeOrchestration.issueNativeTrustPairing(await readJson(req, 64_000)));
    }
    if (pathname === '/api/nolane/native-core/trust/wave13/pairing/enroll') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.enrollNativeTrustPairing(await readJson(req, 64_000)));
    }
    if (pathname === '/api/nolane/native-core/trust/wave13/pairing/revoke') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.revokeNativeTrustPairing(await readJson(req, 64_000)));
    }
    if (pathname === '/api/nolane/native-core/trust/wave13/reauth') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.requireNativeTrustReauthentication(await readJson(req, 64_000)));
    }

    if (pathname === '/api/nolane/native-core/adapters/wave12/status') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.adapterWave12Status());
    }
    if (pathname === '/api/nolane/native-core/adapters/wave12/memory') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method === 'GET') return json(res, 200, nativeOrchestration.queryNativeAdapterMemory(url.searchParams.get('query') ?? '', { limit: Number(url.searchParams.get('limit')) || 20 }));
      if (method === 'POST') return json(res, 201, await nativeOrchestration.putNativeAdapterMemory(await readJson(req, 1_000_000)));
      if (method === 'DELETE') return json(res, 200, await nativeOrchestration.deleteNativeAdapterMemory(await readJson(req, 64_000)));
      return false;
    }
    if (pathname === '/api/nolane/native-core/adapters/wave12/kanban') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.applyNativeAdapterKanban(await readJson(req, 256_000)));
    }
    if (pathname === '/api/nolane/native-core/adapters/wave12/observability') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 202, nativeOrchestration.recordNativeAdapterObservation(await readJson(req, 256_000)));
    }
    if (pathname === '/api/nolane/native-core/adapters/wave12/observability/flush') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.flushNativeAdapterObservations());
    }
    if (pathname === '/api/nolane/native-core/adapters/wave12/scheduler') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method === 'POST') return json(res, 201, await nativeOrchestration.scheduleNativeAdapterJob(await readJson(req, 256_000)));
      if (method === 'PATCH') return json(res, 200, await nativeOrchestration.runNativeAdapterJobs());
      return false;
    }

    if (pathname === '/api/nolane/native-core/browser/wave11/status') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.browserWave11Status());
    }
    if (pathname === '/api/nolane/native-core/browser/wave11/journey') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.runNativeBrowserJourneyWave11(await readJson(req, 1_000_000)));
    }
    if (pathname === '/api/nolane/native-core/browser/wave11/navigate') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.navigateNativeBrowserWave11(await readJson(req, 256_000)));
    }
    if (pathname === '/api/nolane/native-core/browser/wave11/action') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.executeNativeBrowserWave11(await readJson(req, 256_000)));
    }

    if (pathname === '/api/nolane/native-core/gateway/wave10/status') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.gatewayWave10Status());
    }
    if (pathname === '/api/nolane/native-core/gateway/wave10/inbound') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 1_000_000);
      return json(res, 200, nativeOrchestration.normalizeNativeMessagingInbound(body.adapterId, body.raw));
    }
    if (pathname === '/api/nolane/native-core/gateway/wave10/deliver') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 1_000_000);
      return json(res, 200, await nativeOrchestration.deliverNativeMessaging(body.adapterId, body.message));
    }

    if (pathname === '/api/nolane/native-core/provider/wave9/status') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.providerWave9Status());
    }
    if (pathname === '/api/nolane/native-core/provider/wave9/complete') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.completeNativeProviderTransport(await readJson(req, 2_000_000)));
    }

    if (pathname === '/api/nolane/native-core/sessions/wave8/status') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.sessionWave8Status());
    }
    if (pathname === '/api/nolane/native-core/sessions/stream/append') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 1_000_000);
      return json(res, 201, await nativeOrchestration.appendNativeSessionStream(body.sessionId, body.message));
    }
    if (pathname === '/api/nolane/native-core/sessions/stream/resume') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.resumeNativeSessionStream(url.searchParams.get('sessionId'), { after: Number(url.searchParams.get('after')) || 0, limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : Infinity }));
    }
    if (pathname === '/api/nolane/native-core/sessions/stream/stop') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 64_000);
      return json(res, 200, await nativeOrchestration.stopNativeSessionStream(body.sessionId, body.reason));
    }
    if (pathname === '/api/nolane/native-core/sessions/window/acquire') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 201, nativeOrchestration.acquireNativeSessionWindow(await readJson(req, 64_000)));
    }
    if (pathname === '/api/nolane/native-core/sessions/window/release') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.releaseNativeSessionWindow(await readJson(req, 64_000)));
    }
    if (pathname === '/api/nolane/native-core/sessions/compress') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.compressNativeSession(await readJson(req, 2_000_000)));
    }
    if (pathname === '/api/nolane/native-core/sessions/context-drift') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.detectNativeSessionContextDrift(await readJson(req, 256_000)));
    }

    if (pathname === '/api/nolane/native-core/execution/status') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.executionWave7Status());
    }
    if (pathname === '/api/nolane/native-core/execution/run') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 256_000);
      return json(res, 200, await nativeOrchestration.executeNativeBackend({ backendId: body.backendId, action: body.action, timeoutMs: body.timeoutMs, policy: body.policy }));
    }
    if (pathname === '/api/nolane/native-core/execution/artifact') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 64_000);
      return json(res, 201, await nativeOrchestration.transferNativeExecutionArtifact({ source: body.source, target: body.target }));
    }

    if (pathname === '/api/nolane/native-core/wave6/status') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.runtimeWave6Status());
    }
    if (pathname === '/api/nolane/native-core/mcp/oauth/begin') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 201, await nativeOrchestration.beginNativeMcpOAuth(await readJson(req, 128_000)));
    }
    if (pathname === '/api/nolane/native-core/mcp/oauth/complete') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.completeNativeMcpOAuth(await readJson(req, 128_000)));
    }
    if (pathname === '/api/nolane/native-core/delegation/spawn') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 128_000);
      return json(res, 201, await nativeOrchestration.spawnNativeDelegation({ ...body, missionId: body.missionId ?? req.forgePrincipal?.subject }));
    }
    if (pathname === '/api/nolane/native-core/delegation/log') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 128_000);
      return json(res, 201, await nativeOrchestration.appendNativeDelegationLog(body.taskId, body));
    }
    if (pathname === '/api/nolane/native-core/pty/start') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 64_000);
      return json(res, 201, await nativeOrchestration.startNativePtySession({ id: body.id, command: body.command, args: body.args, cwd: body.cwd, envRefs: body.envRefs }));
    }
    if (pathname === '/api/nolane/native-core/pty/write') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 128_000);
      return json(res, 200, await nativeOrchestration.writeNativePtySession(body.sessionId, body.data));
    }
    if (pathname === '/api/nolane/native-core/pty/retry') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.nextNativeTurnRetry(await readJson(req, 64_000)));
    }
    if (pathname === '/api/nolane/native-core/gateway/heartbeat') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 64_000);
      return json(res, 200, nativeOrchestration.heartbeatNativeGatewayHost(body.hostId, body));
    }
    if (pathname === '/api/nolane/native-core/media/local') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 1_000_000);
      if (typeof body.base64 !== 'string' || body.base64.length > 1_500_000) throw Object.assign(new Error('bounded base64 media payload is required'), { statusCode: 400 });
      return json(res, 201, await nativeOrchestration.putNativeLocalMedia({ mimeType: body.mimeType, bytes: Buffer.from(body.base64, 'base64'), metadata: body.metadata }));
    }

    if (pathname === '/api/nolane/native-core/status') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.nativeCoreStatus());
    }
    if (pathname === '/api/nolane/native-core/pairing') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 201, nativeOrchestration.issueGatewayPairing(await readJson(req, 64_000)));
    }
    if (pathname === '/api/nolane/native-core/pairing/accept') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 64_000);
      return json(res, 200, nativeOrchestration.acceptGatewayPairing({ ...body, principalId: req.forgePrincipal?.subject }));
    }
    if (pathname === '/api/nolane/native-core/events') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method === 'GET') return json(res, 200, nativeOrchestration.streamGatewayEvents({ afterSequence: Number(url.searchParams.get('afterSequence')) || 0, limit: Number(url.searchParams.get('limit')) || 100 }));
      if (method !== 'POST') return false;
      const body = await readJson(req, 1_000_000);
      return json(res, 201, nativeOrchestration.enqueueGatewayEvent({ ...body, principalId: req.forgePrincipal?.subject }));
    }
    const nativeCoreDelivery = pathname.match(/^\/api\/nolane\/native-core\/events\/([^/]+)\/deliver$/);
    if (nativeCoreDelivery) {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      await readJson(req, 64_000);
      return json(res, 200, await nativeOrchestration.deliverGatewayEvent(decodeURIComponent(nativeCoreDelivery[1])));
    }
    if (pathname === '/api/nolane/native-core/media') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.executeNativeMedia(await readJson(req, 1_000_000)));
    }

    if (pathname === '/api/nolane/native-core/acp') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.handleAcp(await readJson(req, 512_000)));
    }
    if (pathname === '/api/nolane/native-core/acp/cancel') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 64_000);
      return json(res, 200, nativeOrchestration.cancelAcp(body.requestId, body.reason));
    }
    if (pathname === '/api/nolane/native-core/repository/search') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.searchNativeRepository(await readJson(req, 256_000)));
    }
    if (pathname === '/api/nolane/native-core/repository/symbols') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.symbolsNativeRepository(await readJson(req, 256_000)));
    }
    if (pathname === '/api/nolane/native-core/repository/file-sync-plan') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.planNativeFileSync(await readJson(req, 256_000)));
    }
    if (pathname === '/api/nolane/native-core/browser/execute') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.executeNativeBrowser(await readJson(req, 512_000)));
    }
    if (pathname === '/api/nolane/native-core/commands') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.listNativeCommands());
    }
    if (pathname === '/api/nolane/native-core/commands/execute') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.executeNativeCommand({ ...(await readJson(req, 256_000)), principalId: req.forgePrincipal?.subject }));
    }
    if (pathname === '/api/nolane/native-core/usage') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method === 'GET') return json(res, 200, nativeOrchestration.nativeUsageStatus());
      if (method === 'POST') return json(res, 201, nativeOrchestration.recordNativeUsage(await readJson(req, 128_000)));
      return false;
    }
    if (pathname === '/api/nolane/native-core/delegation-context') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.buildDelegationContext(await readJson(req, 512_000)));
    }
    if (pathname === '/api/nolane/native-core/provider/complete') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.completeProviderProtocol(await readJson(req, 1_000_000)));
    }

    if (pathname === '/api/nolane/native-core/agent/normalize') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.normalizeNativeMessage(await readJson(req, 256_000)));
    }
    if (pathname === '/api/nolane/native-core/agent/title') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 512_000);
      return json(res, 200, { title: nativeOrchestration.generateNativeTitle(body.messages ?? []) });
    }
    if (pathname === '/api/nolane/native-core/agent/replay-cleanup') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 1_000_000);
      return json(res, 200, nativeOrchestration.cleanupNativeReplay(body.events ?? []));
    }
    if (pathname === '/api/nolane/native-core/sessions') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      const pinnedValue = url.searchParams.get('pinned');
      return json(res, 200, nativeOrchestration.listNativeSessions({ profileId: url.searchParams.get('profileId') ?? req.forgePrincipal?.subject, query: url.searchParams.get('query') ?? '', pinned: pinnedValue === null ? undefined : pinnedValue === 'true', status: url.searchParams.get('status') ?? undefined, limit: Number(url.searchParams.get('limit')) || 100 }));
    }
    if (pathname === '/api/nolane/native-core/sessions/metadata') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 128_000);
      return json(res, 200, await nativeOrchestration.updateNativeSessionMetadata(body.sessionId, { ...body, profileId: body.profileId ?? req.forgePrincipal?.subject }));
    }
    if (pathname === '/api/nolane/native-core/sessions/branch') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 128_000);
      return json(res, 201, await nativeOrchestration.branchNativeSession({ ...body, profileId: body.profileId ?? req.forgePrincipal?.subject }));
    }
    if (pathname === '/api/nolane/native-core/sessions/rewind') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 128_000);
      return json(res, 201, await nativeOrchestration.rewindNativeSession({ ...body, profileId: body.profileId ?? req.forgePrincipal?.subject }));
    }
    if (pathname === '/api/nolane/native-core/sessions/export') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 128_000);
      return json(res, 200, nativeOrchestration.exportNativeSession({ ...body, profileId: body.profileId ?? req.forgePrincipal?.subject }));
    }
    if (pathname === '/api/nolane/native-core/sessions/input-history') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method === 'GET') return json(res, 200, nativeOrchestration.nativeInputHistory({ profileId: url.searchParams.get('profileId') ?? req.forgePrincipal?.subject }));
      if (method === 'POST') { const body = await readJson(req, 64_000); return json(res, 201, await nativeOrchestration.pushNativeInputHistory({ ...body, profileId: body.profileId ?? req.forgePrincipal?.subject })); }
      return false;
    }
    if (pathname === '/api/nolane/native-core/sessions/queue') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 128_000);
      return json(res, 201, await nativeOrchestration.enqueueNativePrompt({ ...body, profileId: body.profileId ?? req.forgePrincipal?.subject }));
    }
    if (pathname === '/api/nolane/native-core/sessions/queue/drain') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 64_000);
      return json(res, 200, await nativeOrchestration.drainNativePromptQueue({ ...body, profileId: body.profileId ?? req.forgePrincipal?.subject }));
    }
    if (pathname === '/api/nolane/native-core/tools/schema') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 256_000);
      return json(res, 200, nativeOrchestration.governNativeToolSchema(body.schema ?? body));
    }
    if (pathname === '/api/nolane/native-core/tools/url') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 64_000);
      return json(res, 200, nativeOrchestration.authorizeNativeToolUrl(body.url));
    }
    if (pathname === '/api/nolane/native-core/tools/diff') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 1_000_000);
      return json(res, 200, nativeOrchestration.prepareNativeWorkingDiff(body.changes ?? []));
    }
    if (pathname === '/api/nolane/native-core/tools/budget') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.normalizeNativeToolBudget(await readJson(req, 64_000)));
    }
    if (pathname === '/api/nolane/native-core/profiles') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method === 'GET') return json(res, 200, nativeOrchestration.listNativeProfiles());
      if (method === 'POST') return json(res, 201, await nativeOrchestration.createNativeProfile(await readJson(req, 256_000)));
      return false;
    }
    const nativeProfileRoute = pathname.match(/^\/api\/nolane\/native-core\/profiles\/([^/]+)$/);
    if (nativeProfileRoute) {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      const profileId = decodeURIComponent(nativeProfileRoute[1]);
      if (method === 'GET') return json(res, 200, nativeOrchestration.getNativeProfile(profileId));
      if (method === 'PATCH') return json(res, 200, await nativeOrchestration.updateNativeProfile(profileId, await readJson(req, 256_000)));
      if (method === 'DELETE') return json(res, 200, await nativeOrchestration.deleteNativeProfile(profileId, await readJson(req, 64_000)));
      return false;
    }
    if (pathname === '/api/nolane/native-core/oauth/begin') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 201, nativeOrchestration.beginNativeOAuth(await readJson(req, 128_000)));
    }
    if (pathname === '/api/nolane/native-core/oauth/complete') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await nativeOrchestration.completeNativeOAuth(await readJson(req, 128_000)));
    }
    if (pathname === '/api/nolane/native-core/oauth/revoke') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, nativeOrchestration.revokeNativeOAuth(await readJson(req, 64_000)));
    }

    if (pathname === '/api/nolane/native-core/kanban/cards') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 201, await nativeOrchestration.createNativeKanbanCard(await readJson(req, 128_000)));
    }
    if (pathname === '/api/nolane/native-core/kanban/move') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 128_000);
      return json(res, 200, await nativeOrchestration.moveNativeKanbanCard(body.cardId, body));
    }
    if (pathname === '/api/nolane/native-core/observability') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method === 'GET') return json(res, 200, await nativeOrchestration.exportNativeObservations());
      if (method === 'POST') return json(res, 201, await nativeOrchestration.recordNativeObservation(await readJson(req, 256_000)));
      return false;
    }
    if (pathname === '/api/nolane/native-core/skills/bundle') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 201, nativeOrchestration.createNativeSkillBundle(await readJson(req, 1_000_000)));
    }
    if (pathname === '/api/nolane/native-core/session-search/index') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 201, nativeOrchestration.indexNativeSession(await readJson(req, 1_000_000)));
    }
    if (pathname === '/api/nolane/native-core/session-search') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeOrchestration.searchNativeSessions({ query: url.searchParams.get('q') ?? '', profileId: url.searchParams.get('profileId'), limit: Number(url.searchParams.get('limit')) || 20 }));
    }
    if (pathname === '/api/nolane/native-core/json/parse') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req, 1_000_000);
      return json(res, 200, nativeOrchestration.parseNativeJson(body.json));
    }

    if (pathname.startsWith('/api/small-model/foundation/')) {
      if (!smallModelFoundation) throw Object.assign(new Error('Small-model foundation service is not configured'), { statusCode: 503 });
      const operation = pathname.slice('/api/small-model/foundation/'.length);
      if (method === 'GET' && operation === 'status') return json(res, 200, smallModelFoundation.status());
      if (method === 'GET' && operation === 'snapshot') return json(res, 200, smallModelFoundation.snapshot());
      if (method === 'GET' && operation === 'model/suite-status') return json(res, 200, smallModelFoundation.specialistSuiteStatus());
      if (method === 'GET' && operation === 'model/repository-suite-status') return json(res, 200, smallModelFoundation.repositorySpecialistSuiteStatus());
      if (method === 'GET' && operation === 'model/checkpoint-6/status') return json(res, 200, smallModelFoundation.checkpoint6SuiteStatus());
      if (method === 'GET' && operation === 'model/checkpoint-7/status') return json(res, 200, smallModelFoundation.checkpoint7Status());
      if (method === 'GET' && operation === 'model/checkpoint-8/status') return json(res, 200, smallModelFoundation.checkpoint8Status());
      if (method === 'GET' && operation === 'model/checkpoint-9/status') return json(res, 200, smallModelFoundation.checkpoint9Status());
      if (method === 'GET' && operation === 'model/checkpoint-10/status') return json(res, 200, smallModelFoundation.checkpoint10Status());
      if (method === 'GET' && operation === 'model/active') {
        const artifact = smallModelFoundation.activeTrainedSpecialist(url.searchParams.get('specialist') || 'tool-router');
        if (!artifact) throw Object.assign(new Error('No promoted model artifact is available'), { statusCode: 404 });
        return json(res, 200, artifact);
      }
      if (method !== 'POST') return false;
      const body = await readJson(req, 4_000_000);
      if (operation === 'model/train') return json(res, 201, smallModelFoundation.trainSpecialist(body));
      if (operation === 'model/infer') return json(res, 200, smallModelFoundation.inferSpecialist(body));
      if (operation === 'model/evaluate') return json(res, 200, smallModelFoundation.evaluateTrainedSpecialist(body));
      if (operation === 'model/promote') return json(res, 201, smallModelFoundation.promoteTrainedSpecialist(body));
      if (operation === 'model/rollback') return json(res, 200, smallModelFoundation.rollbackTrainedSpecialist(body));
      if (operation === 'model/bootstrap-suite') return json(res, 201, await smallModelFoundation.bootstrapSpecialistSuite(body));
      if (operation === 'model/decision-support') return json(res, 200, smallModelFoundation.runSpecialistDecisionSupport(body));
      if (operation === 'model/bootstrap-repository-suite') return json(res, 201, await smallModelFoundation.bootstrapRepositorySpecialistSuite(body));
      if (operation === 'model/repository-decision-support') return json(res, 200, smallModelFoundation.runRepositoryDecisionSupport(body));
      if (operation === 'model/checkpoint-6/collect') return json(res, 201, await smallModelFoundation.collectCheckpoint6Trajectories(body));
      if (operation === 'model/checkpoint-6/train') return json(res, 201, await smallModelFoundation.prepareCheckpoint6SpecialistSuite(body));
      if (operation === 'model/checkpoint-6/promote') return json(res, 201, smallModelFoundation.promoteCheckpoint6SpecialistSuite(body));
      if (operation === 'model/checkpoint-6/infer') return json(res, 200, smallModelFoundation.inferCheckpoint6Specialist(body));
      if (operation === 'model/checkpoint-6/decision') return json(res, 200, smallModelFoundation.runCheckpoint6DecisionSupport(body));
      if (operation === 'model/bootstrap-checkpoint-6-suite') return json(res, 201, await smallModelFoundation.bootstrapCheckpoint6SpecialistSuite(body));
      if (operation === 'model/checkpoint-7/collect') return json(res, 201, await smallModelFoundation.collectCheckpoint7Missions(body));
      if (operation === 'model/checkpoint-7/prepare') return json(res, 201, await smallModelFoundation.prepareCheckpoint7Evidence(body));
      if (operation === 'model/checkpoint-7/promote') return json(res, 201, smallModelFoundation.promoteCheckpoint7Suite(body));
      if (operation === 'model/checkpoint-7/decision') return json(res, 200, smallModelFoundation.runCheckpoint7DecisionSupport(body));
      if (operation === 'model/checkpoint-8/prepare') return json(res, 201, await smallModelFoundation.prepareCheckpoint8Evidence(body));
      if (operation === 'model/checkpoint-8/promote') return json(res, 201, smallModelFoundation.promoteCheckpoint8Suite(body));
      if (operation === 'model/checkpoint-8/execute-ast') return json(res, 200, smallModelFoundation.executeCheckpoint8AstSkill(body));
      if (operation === 'model/checkpoint-8/execute-constraint') return json(res, 200, smallModelFoundation.executeCheckpoint8ConstraintSkill(body));
      if (operation === 'model/checkpoint-9/prepare') return json(res, 201, await smallModelFoundation.prepareCheckpoint9Evidence(body));
      if (operation === 'model/checkpoint-9/promote') return json(res, 201, smallModelFoundation.promoteCheckpoint9Suite(body));
      if (operation === 'model/checkpoint-9/execute-refactor') return json(res, 200, smallModelFoundation.executeCheckpoint9Refactor(body));
      if (operation === 'model/checkpoint-10/prepare') return json(res, 201, await smallModelFoundation.prepareCheckpoint10Evidence(body));
      if (operation === 'model/checkpoint-10/promote') return json(res, 201, smallModelFoundation.promoteCheckpoint10Suite(body));
      if (operation === 'model/checkpoint-10/execute-typescript') return json(res, 200, smallModelFoundation.executeCheckpoint10TypeScriptRefactor(body));
      if (operation === 'model/checkpoint-10/execute-contract') return json(res, 200, smallModelFoundation.executeCheckpoint10ContractMigration(body));
      if (operation === 'trajectory') return json(res, 201, smallModelFoundation.recordTrajectory(body));
      if (operation === 'verify') return json(res, 200, await smallModelFoundation.verify(body));
      if (operation === 'specialists') return json(res, 201, smallModelFoundation.registerSpecialist(body));
      if (operation === 'allocate') return json(res, 200, smallModelFoundation.allocate(body));
      if (operation === 'distillation') return json(res, 201, smallModelFoundation.recordDistillationStep(body));
      if (operation === 'verifier-red-team') return json(res, 200, smallModelFoundation.inspectVerifier(body));
      if (operation === 'solver') return json(res, 201, smallModelFoundation.induceSolver(body));
      if (operation === 'memory/reinforce') return json(res, 201, smallModelFoundation.reinforceMemory(body));
      if (operation === 'benchmark/ablation') return json(res, 200, smallModelFoundation.runScientificAblation(body));
      if (operation === 'benchmark/quantization') return json(res, 200, smallModelFoundation.gateQuantizationStability(body));
      if (operation === 'benchmark/ood') return json(res, 200, smallModelFoundation.benchmarkOodTransfer(body));
      if (operation === 'benchmark/cost') return json(res, 200, smallModelFoundation.benchmarkSameQualityCost(body));
      if (operation === 'ast-codemod') return json(res, 200, smallModelFoundation.applyAstCodemod(body));
      if (operation === 'smt') return json(res, 200, smallModelFoundation.solveFiniteDomain(body));
      if (operation === 'datalog') return json(res, 200, smallModelFoundation.evaluateDatalog(body));
      if (operation === 'policy-distillation') return json(res, 201, smallModelFoundation.distillMultiAgentPolicy(body));
      if (operation === 'adaptation/outcome') return json(res, 201, smallModelFoundation.recordAdaptationOutcome(body));
      if (operation === 'adaptation/select') return json(res, 200, smallModelFoundation.selectAdaptation(body));
      if (operation === 'latent-memory/register') return json(res, 201, smallModelFoundation.registerLatentExpert(body));
      if (operation === 'latent-memory/route') return json(res, 200, smallModelFoundation.routeLatentMemory(body));
      return false;
    }

    if (pathname === '/api/nolane/native/capabilities/status') {
      if (!nativeCapabilities) throw Object.assign(new Error('Nolane native capability pack is not configured'), { statusCode: 503 });
      if (method !== 'GET') return false;
      return json(res, 200, nativeCapabilities.snapshot());
    }


    if (pathname.startsWith('/api/nolane/operational/')) {
      if (!operationalBoundary) throw Object.assign(new Error('Nolane operational boundary is not configured'), { statusCode: 503 });
      const operation = pathname.slice('/api/nolane/operational/'.length);
      if (method === 'GET' && operation === 'configuration') return json(res, 200, operationalBoundary.configurationContract());
      if (method === 'GET' && operation === 'snapshot') return json(res, 200, operationalBoundary.snapshot());
      if (method !== 'POST') return false;
      const body = await readJson(req);
      if (operation === 'credentials') return json(res, 201, operationalBoundary.registerCredential(body));
      if (operation === 'authorize') return json(res, 200, operationalBoundary.authorizeAction(body));
      return false;
    }

    if (pathname === '/api/nolane/release/preflight') {
      if (!dependencyPreflight) throw Object.assign(new Error('Dependency preflight service is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      return json(res, 200, await dependencyPreflight.run(await readJson(req)));
    }


    if (pathname.startsWith('/api/evidence-runtime/')) {
      if (!evidenceContextRuntime) throw Object.assign(new Error('Evidence context runtime is not configured'), { statusCode: 503 });
      const principalId = req.forgePrincipal?.subject;
      if (method === 'GET' && pathname === '/api/evidence-runtime/graph') {
        return json(res, 200, await evidenceContextRuntime.graph({
          projectId: url.searchParams.get('projectId'), principalId,
          includeStale: url.searchParams.get('includeStale') === 'true',
          limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined,
          nodeType: url.searchParams.get('nodeType') || undefined,
          edgeType: url.searchParams.get('edgeType') || undefined,
        }));
      }
      if (method !== 'POST') return false;
      const body = await readJson(req, 1_000_000);
      const scope = { projectId: body.projectId, principalId };
      if (pathname === '/api/evidence-runtime/index') return json(res, 201, await evidenceContextRuntime.index({ ...scope, nodes: body.nodes ?? [], edges: body.edges ?? [] }));
      if (pathname === '/api/evidence-runtime/retrieve') return json(res, 200, await evidenceContextRuntime.retrieve({ ...scope, query: body.query, hypothesis: body.hypothesis, limit: body.limit, perRetrieverLimit: body.perRetrieverLimit, maxQueries: body.maxQueries }));
      if (pathname === '/api/evidence-runtime/packet') return json(res, 200, await evidenceContextRuntime.packet({ ...scope, taskId: body.taskId, planId: body.planId, role: body.role, goal: body.goal, currentState: body.currentState, constraints: body.constraints, planStep: body.planStep, hypothesis: body.hypothesis, relevantSymbols: body.relevantSymbols, recentFailures: body.recentFailures, availableTools: body.availableTools, completionCriteria: body.completionCriteria, budgetTokens: body.budgetTokens, retrievalLimit: body.retrievalLimit, maxQueries: body.maxQueries }));
      if (pathname === '/api/evidence-runtime/invalidate') return json(res, 200, await evidenceContextRuntime.invalidate({ ...scope, kind: body.kind, sourceRef: body.sourceRef, sourceHash: body.sourceHash, version: body.version, nodeIds: body.nodeIds ?? [], reason: body.reason }));
      if (pathname === '/api/evidence-runtime/compact') return json(res, 201, await evidenceContextRuntime.compact({ ...scope, title: body.title, fullContent: body.fullContent, summary: body.summary, unresolved: body.unresolved ?? [], sourceKind: body.sourceKind, sourceRef: body.sourceRef, sourceHash: body.sourceHash, validUntil: body.validUntil }));
      if (pathname === '/api/evidence-runtime/memory') return json(res, 201, await evidenceContextRuntime.proposeMemory({ ...scope, fact: body.fact, scope: body.scope, evidenceNodeIds: body.evidenceNodeIds ?? [], confidence: body.confidence, status: body.status, metadata: body.metadata ?? {} }));
      if (pathname === '/api/evidence-runtime/subagent/validate') return json(res, 200, await evidenceContextRuntime.validateSubagentResult({ ...scope, result: body.result }));
      if (pathname === '/api/evidence-runtime/audit') return json(res, 200, await evidenceContextRuntime.audit({ ...scope, packet: body.packet }));
      if (pathname === '/api/evidence-runtime/recover') return json(res, 200, await evidenceContextRuntime.recover({ ...scope, recentToolCalls: body.recentToolCalls ?? [], testOutcomes: body.testOutcomes ?? [], previousState: body.previousState ?? {}, currentState: body.currentState ?? {}, staleContextCount: body.staleContextCount, rejectedHypotheses: body.rejectedHypotheses ?? [], dangerousActionPending: body.dangerousActionPending === true }));
      return false;
    }

    if (pathname.startsWith('/api/runtime-readiness/')) {
      if (method === 'GET' && pathname === '/api/runtime-readiness/architecture') {
        if (!architectureStageGate) throw Object.assign(new Error('Architecture stage gate is not configured'), { statusCode: 503 });
        return json(res, 200, await architectureStageGate.inspect());
      }
      if (method === 'POST' && pathname === '/api/runtime-readiness/missions') {
        if (!missionCompletion) throw Object.assign(new Error('Mission completion service is not configured'), { statusCode: 503 });
        const body = await readJson(req);
        return json(res, 201, await missionCompletion.prepare({
          missionId: body.missionId ?? null,
          projectId: body.projectId,
          principalId: req.forgePrincipal?.subject,
          objective: body.objective,
          allowCommit: body.allowCommit === true,
        }));
      }
      if (method === 'POST' && pathname === '/api/runtime-readiness/container') {
        if (!localContainerPreflight) throw Object.assign(new Error('Local container preflight is not configured'), { statusCode: 503 });
        const body = await readJson(req);
        const project = store.getProject(String(body.projectId ?? ''));
        if (!project?.workspaceRoot) throw Object.assign(new Error('Project not found'), { statusCode: 404 });
        const projectRoot = path.resolve(project.workspaceRoot);
        const mounts = (Array.isArray(body.mounts) ? body.mounts : []).map((mount) => {
          const source = String(mount?.source ?? '');
          if (!source || path.isAbsolute(source)) throw Object.assign(new Error('Mount source must be a project-relative path'), { statusCode: 400 });
          return { source: path.resolve(projectRoot, source), target: mount.target, readOnly: mount.readOnly !== false };
        });
        return json(res, 200, await localContainerPreflight.check({ projectRoot, mounts }));
      }
      return false;
    }

    if (pathname.startsWith('/api/local-operations/')) {
      if (!localOperations) throw Object.assign(new Error('Local operations service is not configured'), { statusCode: 503 });
      const principalId = req.forgePrincipal?.subject;
      if (method === 'GET' && pathname === '/api/local-operations/images/inspect') return json(res, 200, await localOperations.inspectImage({ projectId: url.searchParams.get('projectId'), principalId, path: url.searchParams.get('path') }));
      if (method === 'GET' && pathname === '/api/local-operations/images/content') {
        const result = await localOperations.readImage({ projectId: url.searchParams.get('projectId'), principalId, path: url.searchParams.get('path') });
        res.writeHead(200, { 'content-type': result.mimeType, 'content-length': result.buffer.length, 'cache-control': 'no-store', 'x-content-sha256': result.contentSha256, 'x-receipt-sha256': result.receiptSha256 });
        res.end(result.buffer); return true;
      }
      if (method === 'POST' && pathname === '/api/local-operations/call-graph') { const body = await readJson(req); return json(res, 200, await localOperations.callGraph({ projectId: body.projectId, principalId, languageId: body.languageId, path: body.path, line: body.line, character: body.character })); }
      if (method === 'GET' && pathname === '/api/local-operations/git-history') return json(res, 200, await localOperations.gitHistory({ projectId: url.searchParams.get('projectId'), principalId, limit: Number(url.searchParams.get('limit')) || 50 }));
      if (method === 'GET' && pathname === '/api/local-operations/cost') return json(res, 200, localOperations.costSummary({ projectId: url.searchParams.get('projectId'), missionId: url.searchParams.get('missionId'), principalId }));
      if (method === 'POST' && pathname === '/api/local-operations/command-candidates') { const body = await readJson(req); return json(res, 201, localOperations.editCommandCandidate({ projectId: body.projectId, principalId, taskId: body.taskId, shellKind: body.shellKind, command: body.command, args: body.args ?? [], env: body.env ?? {}, previousFingerprint: body.previousFingerprint ?? null })); }
      if (method === 'POST' && pathname === '/api/local-operations/manual-control') { const body = await readJson(req); return json(res, 200, localOperations.takeManualControl({ projectId: body.projectId, principalId, missionId: body.missionId, reason: body.reason })); }
      const sandboxRoute = pathname.match(/^\/api\/local-operations\/sandboxes\/([^/]+)\/(retain|release)$/);
      if (method === 'POST' && sandboxRoute) { const body = await readJson(req); const input = { projectId: body.projectId, principalId, leaseId: decodeURIComponent(sandboxRoute[1]) }; return json(res, 200, sandboxRoute[2] === 'retain' ? await localOperations.retainSandbox({ ...input, retainForMs: body.retainForMs }) : await localOperations.releaseSandbox({ ...input, terminate: body.terminate !== false })); }
      if (pathname === '/api/local-operations/cache' && method === 'GET') return json(res, 200, localOperations.cacheStatus({ projectId: url.searchParams.get('projectId'), principalId, namespace: url.searchParams.get('namespace') || 'operations', limit: Number(url.searchParams.get('limit')) || 100 }));
      if (pathname === '/api/local-operations/cache' && method === 'DELETE') return json(res, 200, localOperations.purgeCache({ projectId: url.searchParams.get('projectId'), principalId, namespace: url.searchParams.get('namespace') || 'operations' }));
      return false;
    }

    if (method === 'GET' && pathname === '/api/agent-modes') {
      if (!agentModes) throw Object.assign(new Error('Agent mode service is not configured'), { statusCode: 503 });
      return json(res, 200, agentModes.list());
    }
    if (method === 'POST' && pathname === '/api/agent-modes/resolve') {
      if (!agentModes) throw Object.assign(new Error('Agent mode service is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      return json(res, 200, agentModes.resolve({ modeId: body.modeId, overrides: body.overrides ?? {} }));
    }

    const workspaceTrustRoute = pathname.match(/^\/api\/workspace-trust\/([^/]+)(?:\/(audit))?$/);
    if (workspaceTrustRoute) {
      if (!workspaceTrust) throw Object.assign(new Error('Workspace trust service is not configured'), { statusCode: 503 });
      const projectId = decodeURIComponent(workspaceTrustRoute[1]);
      if (method === 'GET' && workspaceTrustRoute[2] === 'audit') return json(res, 200, workspaceTrust.audit({ projectId, limit: Number(url.searchParams.get('limit')) || 500 }));
      if (method === 'GET' && !workspaceTrustRoute[2]) return json(res, 200, await workspaceTrust.status(projectId));
      if (method === 'PUT' && !workspaceTrustRoute[2]) {
        const body = await readJson(req);
        return json(res, 200, await workspaceTrust.trust({ projectId, principal: req.forgePrincipal, reason: body.reason }));
      }
      if (method === 'DELETE' && !workspaceTrustRoute[2]) {
        const body = await readJson(req);
        return json(res, 200, await workspaceTrust.revoke({ projectId, principal: req.forgePrincipal, reason: body.reason }));
      }
      return false;
    }

    if (pathname === '/api/local-task-handoffs' || pathname.startsWith('/api/local-task-handoffs/')) {
      if (!localTaskHandoff) throw Object.assign(new Error('Local task handoff service is not configured'), { statusCode: 503 });
      if (method === 'POST' && pathname === '/api/local-task-handoffs') {
        const body = await readJson(req);
        return json(res, 201, await localTaskHandoff.prepare({
          missionId: body.missionId,
          taskId: body.taskId ?? null,
          principalId: req.forgePrincipal?.subject,
        }));
      }
      const handoffRoute = pathname.match(/^\/api\/local-task-handoffs\/([^/]+)$/);
      if (method === 'GET' && handoffRoute) {
        return json(res, 200, localTaskHandoff.get({
          taskId: decodeURIComponent(handoffRoute[1]),
          principalId: req.forgePrincipal?.subject,
        }));
      }
      return false;
    }

    if (pathname === '/api/git-governance/commit' || pathname === '/api/git-governance/checkpoint' || pathname === '/api/git-governance/collisions' || pathname === '/api/git-governance/resolutions' || pathname.startsWith('/api/git-governance/missions/') || pathname.startsWith('/api/git-governance/tasks/')) {
      if (!gitGovernance) throw Object.assign(new Error('Git governance service is not configured'), { statusCode: 503 });
      if (method === 'POST' && (pathname === '/api/git-governance/commit' || pathname === '/api/git-governance/checkpoint')) {
        const body = await readJson(req);
        const operation = pathname.endsWith('/commit') ? 'commit' : 'checkpoint';
        return json(res, 201, await gitGovernance[operation]({
          taskId: body.taskId,
          principal: req.forgePrincipal,
          expectedHead: body.expectedHead,
          paths: body.paths,
          message: body.message ?? null,
          testReceipts: body.testReceipts ?? [],
          residualRisks: body.residualRisks ?? [],
          idempotencyKey: body.idempotencyKey,
        }));
      }
      if (method === 'POST' && pathname === '/api/git-governance/collisions') {
        const body = await readJson(req);
        return json(res, 201, await gitGovernance.collisionMap({
          missionId: body.missionId,
          principal: req.forgePrincipal,
          targetRef: body.targetRef ?? 'HEAD',
          idempotencyKey: body.idempotencyKey,
        }));
      }
      if (method === 'POST' && pathname === '/api/git-governance/resolutions') {
        const body = await readJson(req);
        return json(res, 201, await gitGovernance.recordConflictResolution({
          missionId: body.missionId,
          leftTaskId: body.leftTaskId,
          rightTaskId: body.rightTaskId,
          principal: req.forgePrincipal,
          expectedConflictReceiptSha256: body.expectedConflictReceiptSha256,
          resolutionSummary: body.resolutionSummary,
          testReceipts: body.testReceipts ?? [],
          idempotencyKey: body.idempotencyKey,
        }));
      }
      const missionRoute = pathname.match(/^\/api\/git-governance\/missions\/([^/]+)$/);
      if (method === 'GET' && missionRoute) return json(res, 200, gitGovernance.getMissionCollisionMap({ missionId: decodeURIComponent(missionRoute[1]), principal: req.forgePrincipal }));
      const taskRoute = pathname.match(/^\/api\/git-governance\/tasks\/([^/]+)\/completions$/);
      if (method === 'GET' && taskRoute) return json(res, 200, gitGovernance.listTaskCompletions({ taskId: decodeURIComponent(taskRoute[1]), principal: req.forgePrincipal }));
      return false;
    }

    if (pathname === '/api/skills/catalog' && method === 'GET') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane skill hub is not configured'), { statusCode: 503 });
      const options = {
        source: url.searchParams.get('source'),
        catalog: url.searchParams.get('catalog'),
        query: url.searchParams.get('q'),
        limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : null,
      };
      if (typeof nativeOrchestration.skillCatalog === 'function') return json(res, 200, await nativeOrchestration.skillCatalog(options));
      const skills = await nativeOrchestration.listSkills(options);
      return json(res, 200, { schema: 'nolane.agent.skill-hub-catalog.v1', readOnly: true, source: 'nolane+forge-os', filters: options, counts: { total: skills.length }, skills });
    }
    const skillHubDetail = pathname.match(/^\/api\/skills\/catalog\/([^/]+)$/);
    if (skillHubDetail && method === 'GET') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane skill hub is not configured'), { statusCode: 503 });
      const id = decodeURIComponent(skillHubDetail[1]);
      const catalog = typeof nativeOrchestration.skillCatalog === 'function'
        ? await nativeOrchestration.skillCatalog({ limit: null })
        : { skills: await nativeOrchestration.listSkills({ limit: null }) };
      const skill = catalog.skills.find((entry) => String(entry.id) === id);
      if (!skill) throw Object.assign(new Error(`Unknown skill: ${id}`), { statusCode: 404, code: 'SKILL_NOT_FOUND' });
      return json(res, 200, { schema: 'nolane.agent.skill-hub-skill.v1', readOnly: true, skill });
    }
    const skillHubLoad = pathname.match(/^\/api\/skills\/catalog\/([^/]+)\/load$/);
    if (skillHubLoad && method === 'POST') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane skill hub is not configured'), { statusCode: 503 });
      return json(res, 200, await nativeOrchestration.loadSkill(decodeURIComponent(skillHubLoad[1]), await readJson(req)));
    }
    if (pathname === '/api/nolane/orchestration/status') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration service is not configured'), { statusCode: 503 });
      if (method === 'GET') return json(res, 200, nativeOrchestration.status());
      return false;
    }
    if (pathname === '/api/nolane/orchestration/skills') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration service is not configured'), { statusCode: 503 });
      if (method === 'GET') return json(res, 200, await nativeOrchestration.listSkills({
        source: url.searchParams.get('source'),
        catalog: url.searchParams.get('catalog'),
        query: url.searchParams.get('q'),
        limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : null,
      }));
      return false;
    }
    const orchestrationSkill = pathname.match(/^\/api\/nolane\/orchestration\/skills\/([^/]+)\/load$/);
    if (orchestrationSkill && method === 'POST') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration service is not configured'), { statusCode: 503 });
      return json(res, 200, await nativeOrchestration.loadSkill(decodeURIComponent(orchestrationSkill[1]), await readJson(req)));
    }
    if (pathname === '/api/nolane/orchestration/subagents' && method === 'POST') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration service is not configured'), { statusCode: 503 });
      return json(res, 201, nativeOrchestration.spawnSubagent(await readJson(req)));
    }
    const orchestrationSubagent = pathname.match(/^\/api\/nolane\/orchestration\/subagents\/([^/]+)\/complete$/);
    if (orchestrationSubagent && method === 'POST') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration service is not configured'), { statusCode: 503 });
      return json(res, 200, nativeOrchestration.completeSubagent(decodeURIComponent(orchestrationSubagent[1]), await readJson(req)));
    }
    if (pathname === '/api/nolane/orchestration/messages' && method === 'POST') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration service is not configured'), { statusCode: 503 });
      return json(res, 201, await nativeOrchestration.sendMessage(await readJson(req)));
    }
    const orchestrationGateway = pathname.match(/^\/api\/nolane\/orchestration\/gateways\/([^/]+)(?:\/(start|stop))?$/);
    if (orchestrationGateway) {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration service is not configured'), { statusCode: 503 });
      const id = decodeURIComponent(orchestrationGateway[1]); const operation = orchestrationGateway[2];
      if (method === 'GET' && !operation) return json(res, 200, nativeOrchestration.gatewayStatus(id));
      if (method === 'POST' && operation === 'start') { await readJson(req); return json(res, 200, await nativeOrchestration.startGateway(id)); }
      if (method === 'POST' && operation === 'stop') { await readJson(req); return json(res, 200, await nativeOrchestration.stopGateway(id)); }
      return false;
    }
    if (pathname === '/api/nolane/orchestration/jobs' && method === 'POST') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration service is not configured'), { statusCode: 503 });
      return json(res, 201, await nativeOrchestration.schedule(await readJson(req)));
    }
    if (pathname === '/api/nolane/orchestration/jobs/run-due' && method === 'POST') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration service is not configured'), { statusCode: 503 });
      await readJson(req); return json(res, 200, await nativeOrchestration.runDue());
    }
    if (pathname === '/api/nolane/orchestration/trajectories' && method === 'POST') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration service is not configured'), { statusCode: 503 });
      return json(res, 201, await nativeOrchestration.appendTrajectory(await readJson(req)));
    }
    if (pathname === '/api/nolane/orchestration/trajectories/export' && method === 'POST') {
      if (!nativeOrchestration) throw Object.assign(new Error('Nolane native orchestration service is not configured'), { statusCode: 503 });
      await readJson(req); return json(res, 200, await nativeOrchestration.exportTrajectories());
    }

    if (pathname === '/api/nolane/agent/runs') {
      if (!nativeAgent) throw Object.assign(new Error('Nolane native agent service is not configured'), { statusCode: 503 });
      if (method !== 'POST') return false;
      const body = await readJson(req);
      return json(res, 201, await nativeAgent.run({
        missionId: body.missionId,
        sessionId: body.sessionId,
        projectId: body.projectId,
        objective: body.objective,
        criteria: body.criteria ?? [],
        requiredCapabilities: body.requiredCapabilities ?? [],
        grantedCapabilities: body.grantedCapabilities ?? [],
        approvals: body.approvals ?? [],
        budgets: body.budgets ?? {},
        context: body.context ?? {},
      }));
    }

    if (pathname === '/api/nolane/sessions' || pathname.startsWith('/api/nolane/sessions/')) {
      if (!sessionStore) throw Object.assign(new Error('Nolane session store is not configured'), { statusCode: 503 });
      if (method === 'POST' && pathname === '/api/nolane/sessions') {
        const body = await readJson(req);
        return json(res, 201, await sessionStore.createSession({ id: body.id, title: body.title, projectId: body.projectId }));
      }
      if (method === 'GET' && pathname === '/api/nolane/sessions/search') {
        return json(res, 200, sessionStore.search(url.searchParams.get('q') ?? ''));
      }
      const messageMatch = pathname.match(/^\/api\/nolane\/sessions\/([^/]+)\/messages$/);
      if (method === 'POST' && messageMatch) {
        const body = await readJson(req);
        return json(res, 201, await sessionStore.appendMessage(decodeURIComponent(messageMatch[1]), body));
      }
      const compressMatch = pathname.match(/^\/api\/nolane\/sessions\/([^/]+)\/compress$/);
      if (method === 'POST' && compressMatch) {
        const body = await readJson(req);
        return json(res, 200, sessionStore.compressSession(decodeURIComponent(compressMatch[1]), { maxCharacters: body.maxCharacters, keepRecent: body.keepRecent }));
      }
      const sessionMatch = pathname.match(/^\/api\/nolane\/sessions\/([^/]+)$/);
      if (method === 'GET' && sessionMatch) {
        const session = sessionStore.getSession(decodeURIComponent(sessionMatch[1]));
        if (!session) throw Object.assign(new Error('Nolane session not found'), { statusCode: 404 });
        return json(res, 200, session);
      }
      return false;
    }

    if (pathname.startsWith('/api/nolane/runtime/')) {
      if (!nativeRuntime) throw Object.assign(new Error('Nolane native runtime is not configured'), { statusCode: 503 });
      const operation = pathname.slice('/api/nolane/runtime/'.length);
      if (method === 'GET' && operation === 'status') return json(res, 200, nativeRuntime.status());
      if (method === 'GET' && operation === 'preflight') return json(res, 200, await nativeRuntime.preflight());
      if (method === 'POST' && ['start', 'ping', 'stop'].includes(operation)) {
        await readJson(req);
        return json(res, 200, await nativeRuntime[operation]());
      }
      return false;
    }

    if (pathname === '/api/local-resource-sandboxes/capabilities' || pathname === '/api/local-resource-sandboxes' || pathname.startsWith('/api/local-resource-sandboxes/')) {
      if (!localResourceSandbox) throw Object.assign(new Error('Local resource sandbox is not configured'), { statusCode: 503 });
      if (method === 'GET' && pathname === '/api/local-resource-sandboxes/capabilities') return json(res, 200, await localResourceSandbox.capabilities());
      if (method === 'GET' && pathname === '/api/local-resource-sandboxes') return json(res, 200, localResourceSandbox.list({ projectId: url.searchParams.get('projectId') || null, principalId: req.forgePrincipal?.subject }));
      const sandboxMatch = pathname.match(/^\/api\/local-resource-sandboxes\/([^/]+)(?:\/(sample|close))?$/);
      if (sandboxMatch) {
        const id = decodeURIComponent(sandboxMatch[1]); const operation = sandboxMatch[2] ?? null;
        if (method === 'GET' && !operation) return json(res, 200, localResourceSandbox.status(id, { projectId: url.searchParams.get('projectId') || null, principalId: req.forgePrincipal?.subject }));
        if (method === 'POST' && operation === 'sample') { const body = await readJson(req); return json(res, 200, await localResourceSandbox.sample(id, { projectId: body.projectId ?? null, principalId: req.forgePrincipal?.subject })); }
        if (method === 'POST' && operation === 'close') { const body = await readJson(req); return json(res, 200, await localResourceSandbox.closeLease(id, { projectId: body.projectId ?? null, principalId: req.forgePrincipal?.subject, terminate: body.terminate !== false })); }
      }
      return false;
    }

    if (pathname === '/api/tree-sitter/capabilities' || pathname === '/api/tree-sitter/parse') {
      if (!treeSitterRuntime) throw Object.assign(new Error('Tree-sitter runtime is not configured'), { statusCode: 503 });
      if (method === 'GET' && pathname === '/api/tree-sitter/capabilities') return json(res, 200, await treeSitterRuntime.capabilities());
      if (method === 'POST' && pathname === '/api/tree-sitter/parse') {
        const body = await readJson(req);
        return json(res, 200, await treeSitterRuntime.parse({ projectId: body.projectId, file: body.file, principalId: req.forgePrincipal?.subject }));
      }
      return false;
    }

    if (pathname === '/api/environments' || pathname.startsWith('/api/environments/')) {
      if (!environmentControl) throw Object.assign(new Error('Environment supervision is not configured'), { statusCode: 503 });
      if (method === 'GET' && pathname === '/api/environments') return json(res, 200, environmentControl.list({ projectId: url.searchParams.get('projectId') || null }));
      if (method === 'POST' && pathname === '/api/environments/register') {
        const body = await readJson(req); const { sessionId = null, ...spec } = body;
        if (workspaceTrust) await workspaceTrust.requireTrusted(spec.projectId, 'bootstrap');
        return json(res, 201, await environmentControl.register(spec, { principal: req.forgePrincipal, sessionId }));
      }
      const match = pathname.match(/^\/api\/environments\/([^/]+)(?:\/(snapshot|start|heal|recover|stop))?$/);
      if (match) {
        const id = decodeURIComponent(match[1]); const operation = match[2] ?? null;
        if (method === 'GET' && !operation) return json(res, 200, await environmentControl.status(id, { projectId: url.searchParams.get('projectId') || null }));
        if (method === 'GET' && operation === 'snapshot') return json(res, 200, await environmentControl.snapshot(id, { projectId: url.searchParams.get('projectId') || null }));
        if (method === 'POST' && ['start', 'heal', 'recover', 'stop'].includes(operation)) {
          const body = await readJson(req);
          if (workspaceTrust && operation !== 'stop') await workspaceTrust.requireTrusted(body.projectId, 'bootstrap');
          return json(res, 200, await environmentControl[operation](id, { principal: req.forgePrincipal, sessionId: body.sessionId ?? null, projectId: body.projectId ?? null }));
        }
      }
      return false;
    }
    if (pathname === '/api/repository-discovery' || pathname === '/api/repository-discovery/refresh') {
      if (!repositoryDiscovery) throw Object.assign(new Error('Repository discovery is not configured'), { statusCode: 503 });
      if (method === 'GET' && pathname === '/api/repository-discovery') return json(res, 200, await repositoryDiscovery.snapshot({ projectId: url.searchParams.get('projectId'), principalId: req.forgePrincipal?.subject, refresh: false }));
      if (method === 'POST' && pathname === '/api/repository-discovery/refresh') {
        const body = await readJson(req);
        return json(res, 200, await repositoryDiscovery.snapshot({ projectId: body.projectId, principalId: req.forgePrincipal?.subject, refresh: true }));
      }
      return false;
    }
    if (pathname === '/api/semantic-dependency/index' || pathname === '/api/semantic-dependency/search' || pathname === '/api/semantic-dependency/graph') {
      if (!semanticDependency) throw Object.assign(new Error('Semantic dependency intelligence is not configured'), { statusCode: 503 });
      if (method === 'POST' && pathname === '/api/semantic-dependency/index') {
        const body = await readJson(req);
        return json(res, 200, await semanticDependency.indexProject({ projectId: body.projectId, principalId: req.forgePrincipal?.subject }));
      }
      if (method === 'POST' && pathname === '/api/semantic-dependency/search') {
        const body = await readJson(req);
        return json(res, 200, await semanticDependency.search({ projectId: body.projectId, query: body.query, limit: body.limit, pathPrefix: body.pathPrefix, language: body.language, principalId: req.forgePrincipal?.subject }));
      }
      if (method === 'GET' && pathname === '/api/semantic-dependency/graph') {
        return json(res, 200, semanticDependency.dependencies({
          projectId: url.searchParams.get('projectId'),
          rootPath: url.searchParams.get('rootPath') || null,
          direction: url.searchParams.get('direction') || 'both',
          depth: url.searchParams.has('depth') ? Number(url.searchParams.get('depth')) : undefined,
          limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined,
          principalId: req.forgePrincipal?.subject,
        }));
      }
      return false;
    }
    if (pathname === '/api/code-relationships/index' || pathname === '/api/code-relationships/inheritance' || pathname === '/api/code-relationships/issues') {
      if (!codeRelationships) throw Object.assign(new Error('Code relationship intelligence is not configured'), { statusCode: 503 });
      if (method === 'POST' && pathname === '/api/code-relationships/index') {
        const body = await readJson(req);
        return json(res, 200, await codeRelationships.indexProject({ projectId: body.projectId, principalId: req.forgePrincipal?.subject }));
      }
      if (method === 'GET' && pathname === '/api/code-relationships/inheritance') {
        return json(res, 200, codeRelationships.inheritance({
          projectId: url.searchParams.get('projectId'),
          root: url.searchParams.get('root') || null,
          path: url.searchParams.get('path') || null,
          direction: url.searchParams.get('direction') || 'both',
          depth: url.searchParams.has('depth') ? Number(url.searchParams.get('depth')) : undefined,
          limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined,
          principalId: req.forgePrincipal?.subject,
        }));
      }
      if (method === 'GET' && pathname === '/api/code-relationships/issues') {
        return json(res, 200, codeRelationships.issues({
          projectId: url.searchParams.get('projectId'),
          issueKey: url.searchParams.get('issueKey') || null,
          pathPrefix: url.searchParams.get('pathPrefix') || null,
          limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined,
          principalId: req.forgePrincipal?.subject,
        }));
      }
      return false;
    }
    if (pathname === '/api/codebase-knowledge' || pathname.startsWith('/api/codebase-knowledge/')) {
      if (!codebaseKnowledge) throw Object.assign(new Error('Codebase knowledge service is not configured'), { statusCode: 503 });
      if (method === 'GET' && pathname === '/api/codebase-knowledge') return json(res, 200, codebaseKnowledge.snapshot(String(url.searchParams.get('projectId') ?? ''), { limit: Number(url.searchParams.get('limit')) || 500 }));
      if (method === 'POST' && pathname === '/api/codebase-knowledge/index') {
        const body = await readJson(req); return json(res, 200, await codebaseKnowledge.indexProject({ projectId: body.projectId, principalId: req.forgePrincipal?.subject }));
      }
      if (method === 'GET' && pathname === '/api/codebase-knowledge/regex') return json(res, 200, codebaseKnowledge.searchRegex(String(url.searchParams.get('projectId') ?? ''), String(url.searchParams.get('pattern') ?? ''), { flags: url.searchParams.get('flags') ?? 'g', limit: Number(url.searchParams.get('limit')) || 100, pathPrefix: url.searchParams.get('pathPrefix') || null }));
      if (method === 'GET' && pathname === '/api/codebase-knowledge/rank') return json(res, 200, codebaseKnowledge.rank(String(url.searchParams.get('projectId') ?? ''), String(url.searchParams.get('q') ?? ''), { seedPaths: url.searchParams.getAll('seed'), limit: Number(url.searchParams.get('limit')) || 20 }));
      if (method === 'GET' && pathname === '/api/codebase-knowledge/watch') return json(res, 200, codebaseKnowledge.watchStatus(String(url.searchParams.get('projectId') ?? '')));
      if (method === 'POST' && pathname === '/api/codebase-knowledge/watch/start') { const body = await readJson(req); return json(res, 200, await codebaseKnowledge.watchStart({ projectId: body.projectId, principalId: req.forgePrincipal?.subject })); }
      if (method === 'POST' && pathname === '/api/codebase-knowledge/watch/stop') { const body = await readJson(req); return json(res, 200, await codebaseKnowledge.watchStop({ projectId: body.projectId, principalId: req.forgePrincipal?.subject })); }
      return false;
    }
    if (pathname.startsWith('/api/adaptive/')) {
      if (!adaptiveIntelligence) throw Object.assign(new Error('Adaptive intelligence plane is not configured'), { statusCode: 503 });
      if (method === 'GET' && pathname === '/api/adaptive/status') return json(res, 200, await adaptiveIntelligence.status());
      if (method === 'POST' && pathname === '/api/adaptive/repository/index') return json(res, 200, await adaptiveIntelligence.repository('index', await readJson(req)));
      if (method === 'GET' && pathname === '/api/adaptive/repository/search') return json(res, 200, await adaptiveIntelligence.repository('search', { projectId: url.searchParams.get('projectId'), query: url.searchParams.get('q'), limit: Number(url.searchParams.get('limit')) || 20, pathPrefix: url.searchParams.get('pathPrefix'), language: url.searchParams.get('language') }));
      if (method === 'GET' && pathname === '/api/adaptive/repository/map') return json(res, 200, await adaptiveIntelligence.repository('map', { projectId: url.searchParams.get('projectId'), maxFiles: Number(url.searchParams.get('maxFiles')) || 200, maxSymbolsPerFile: Number(url.searchParams.get('maxSymbolsPerFile')) || 20, maxChars: Number(url.searchParams.get('maxChars')) || 32000 }));
      if (method === 'GET' && pathname === '/api/adaptive/repository/state') return json(res, 200, await adaptiveIntelligence.repository('state', { projectId: url.searchParams.get('projectId') }));
      if (method === 'POST' && pathname === '/api/adaptive/repository/feedback') return json(res, 200, await adaptiveIntelligence.repository('feedback', await readJson(req)));
      if (method === 'GET' && pathname === '/api/adaptive/tools') return json(res, 200, adaptiveIntelligence.tools('list'));
      if (method === 'GET' && pathname === '/api/adaptive/tools/search') return json(res, 200, adaptiveIntelligence.tools('search', { query: url.searchParams.get('q'), limit: Number(url.searchParams.get('limit')) || 20 }));
      const toolSchema = pathname.match(/^\/api\/adaptive\/tools\/([^/]+)\/schema$/);
      if (method === 'GET' && toolSchema) return json(res, 200, adaptiveIntelligence.tools('schema', { name: decodeURIComponent(toolSchema[1]) }));
      const contextRead = pathname.match(/^\/api\/adaptive\/context\/([^/]+)\/read$/);
      if (method === 'GET' && contextRead) return json(res, 200, await adaptiveIntelligence.context('read', { id: decodeURIComponent(contextRead[1]), startByte: Number(url.searchParams.get('startByte')) || 0, maxBytes: Number(url.searchParams.get('maxBytes')) || 64_000 }));
      const contextSearch = pathname.match(/^\/api\/adaptive\/context\/([^/]+)\/search$/);
      if (method === 'GET' && contextSearch) return json(res, 200, await adaptiveIntelligence.context('search', { id: decodeURIComponent(contextSearch[1]), query: url.searchParams.get('q'), limit: Number(url.searchParams.get('limit')) || 100, caseSensitive: url.searchParams.get('caseSensitive') === 'true', regex: url.searchParams.get('regex') === 'true' }));
      const contextGet = pathname.match(/^\/api\/adaptive\/context\/([^/]+)$/);
      if (method === 'GET' && contextGet) return json(res, 200, await adaptiveIntelligence.context('get', { id: decodeURIComponent(contextGet[1]) }));
      if (method === 'GET' && pathname === '/api/adaptive/history') return json(res, 200, await adaptiveIntelligence.history('list', { projectId: url.searchParams.get('projectId'), missionId: url.searchParams.has('missionId') ? url.searchParams.get('missionId') : undefined, sessionId: url.searchParams.has('sessionId') ? url.searchParams.get('sessionId') : undefined, kind: url.searchParams.get('kind'), limit: Number(url.searchParams.get('limit')) || 100 }));
      if (method === 'GET' && pathname === '/api/adaptive/history/search') return json(res, 200, await adaptiveIntelligence.history('search', { projectId: url.searchParams.get('projectId'), missionId: url.searchParams.has('missionId') ? url.searchParams.get('missionId') : undefined, sessionId: url.searchParams.has('sessionId') ? url.searchParams.get('sessionId') : undefined, kind: url.searchParams.get('kind'), query: url.searchParams.get('q'), limit: Number(url.searchParams.get('limit')) || 100, regex: url.searchParams.get('regex') === 'true', caseSensitive: url.searchParams.get('caseSensitive') === 'true' }));
      if (method === 'POST' && pathname === '/api/adaptive/history/conversation/archive') return json(res, 201, await adaptiveIntelligence.history('archive-conversation', await readJson(req)));
      if (method === 'POST' && pathname === '/api/adaptive/history/conversation/compact') return json(res, 201, await adaptiveIntelligence.history('compact-conversation', await readJson(req)));
      const historyGet = pathname.match(/^\/api\/adaptive\/history\/([^/]+)$/);
      if (method === 'GET' && historyGet) return json(res, 200, await adaptiveIntelligence.history('get', { projectId: url.searchParams.get('projectId'), id: decodeURIComponent(historyGet[1]) }));
      if (method === 'POST' && pathname === '/api/adaptive/memory') return json(res, 201, await adaptiveIntelligence.memory('propose', await readJson(req), req.forgePrincipal));
      const memoryOperation = pathname.match(/^\/api\/adaptive\/memory\/([^/]+)\/(approve|edit|revoke|purge)$/);
      if (method === 'POST' && memoryOperation) return json(res, 200, await adaptiveIntelligence.memory(memoryOperation[2], { ...(await readJson(req)), id: decodeURIComponent(memoryOperation[1]) }, req.forgePrincipal));
      const memoryGet = pathname.match(/^\/api\/adaptive\/memory\/([^/]+)$/);
      if (method === 'GET' && memoryGet) return json(res, 200, await adaptiveIntelligence.memory('get', { id: decodeURIComponent(memoryGet[1]) }, req.forgePrincipal));
      if (method === 'POST' && pathname === '/api/adaptive/reviews') return json(res, 201, await adaptiveIntelligence.review('run', await readJson(req)));
      const reviewHandoff = pathname.match(/^\/api\/adaptive\/reviews\/([^/]+)\/handoff$/);
      if (method === 'POST' && reviewHandoff) return json(res, 200, await adaptiveIntelligence.review('handoff', { ...(await readJson(req)), id: decodeURIComponent(reviewHandoff[1]) }));
      const reviewGet = pathname.match(/^\/api\/adaptive\/reviews\/([^/]+)$/);
      if (method === 'GET' && reviewGet) return json(res, 200, await adaptiveIntelligence.review('get', { id: decodeURIComponent(reviewGet[1]) }));
      if (method === 'GET' && pathname === '/api/adaptive/automations') return json(res, 200, await adaptiveIntelligence.automation('list', { projectId: url.searchParams.get('projectId') }));
      if (method === 'POST' && pathname === '/api/adaptive/automations') return json(res, 201, await adaptiveIntelligence.automation('create', await readJson(req)));
      if (method === 'POST' && pathname === '/api/adaptive/automations/events') return json(res, 202, await adaptiveIntelligence.automation('event', await readJson(req)));
      if (method === 'POST' && pathname === '/api/adaptive/automations/tick') return json(res, 200, await adaptiveIntelligence.automation('tick', await readJson(req)));
      const automationRuns = pathname.match(/^\/api\/adaptive\/automations\/([^/]+)\/runs$/);
      if (method === 'GET' && automationRuns) return json(res, 200, await adaptiveIntelligence.automation('runs', { id: decodeURIComponent(automationRuns[1]), limit: Number(url.searchParams.get('limit')) || 100 }));
      const automationGet = pathname.match(/^\/api\/adaptive\/automations\/([^/]+)$/);
      if (method === 'GET' && automationGet) return json(res, 200, await adaptiveIntelligence.automation('get', { id: decodeURIComponent(automationGet[1]) }));
      if (method === 'POST' && pathname === '/api/adaptive/design/capture') return json(res, 201, await adaptiveIntelligence.design('capture', await readJson(req), req.forgePrincipal));
      if (method === 'POST' && pathname === '/api/adaptive/design/takeover') return json(res, 201, await adaptiveIntelligence.design('takeover', await readJson(req), req.forgePrincipal));
      const designRelease = pathname.match(/^\/api\/adaptive\/design\/takeover\/([^/]+)\/release$/);
      if (method === 'POST' && designRelease) return json(res, 200, await adaptiveIntelligence.design('release', { ...(await readJson(req)), id: decodeURIComponent(designRelease[1]) }, req.forgePrincipal));
      const designEdits = pathname.match(/^\/api\/adaptive\/design\/([^/]+)\/edits$/);
      if (method === 'GET' && designEdits) return json(res, 200, await adaptiveIntelligence.design('edits', { id: decodeURIComponent(designEdits[1]) }, req.forgePrincipal));
      if (method === 'POST' && designEdits) return json(res, 201, await adaptiveIntelligence.design('edit', { ...(await readJson(req)), id: decodeURIComponent(designEdits[1]) }, req.forgePrincipal));
      const designGet = pathname.match(/^\/api\/adaptive\/design\/([^/]+)$/);
      if (method === 'GET' && designGet) return json(res, 200, await adaptiveIntelligence.design('get', { id: decodeURIComponent(designGet[1]) }, req.forgePrincipal));
      if (method === 'POST' && pathname === '/api/adaptive/diagnostics/compare') return json(res, 200, await adaptiveIntelligence.diagnostics('compare', await readJson(req)));
      if (method === 'POST' && pathname === '/api/adaptive/providers/outcomes') return json(res, 200, await adaptiveIntelligence.providers('outcome', await readJson(req), req.forgePrincipal));
      if (method === 'POST' && pathname === '/api/adaptive/providers/route') return json(res, 200, adaptiveIntelligence.providers('route', await readJson(req)));
      return false;
    }
    if (pathname === '/api/mission-state-progress' || pathname === '/api/mission-state-progress/cost-check') {
      if (!missionStateProgress) throw Object.assign(new Error('Mission State Progress is not configured'), { statusCode: 503 });
      if (method === 'GET' && pathname === '/api/mission-state-progress') return json(res, 200, await missionStateProgress.snapshot({ projectId: url.searchParams.get('projectId'), missionId: url.searchParams.get('missionId'), principalId: req.forgePrincipal?.subject }));
      if (method === 'POST' && pathname === '/api/mission-state-progress/cost-check') return json(res, 200, missionStateProgress.assertWithinCostLimit({ ...(await readJson(req)), principalId: req.forgePrincipal?.subject }));
      return false;
    }
    if (method === 'GET' && pathname === '/api/operations-center') {
      if (!operationsCenter) throw Object.assign(new Error('Agent Operations Center is not configured'), { statusCode: 503 });
      return json(res, 200, await operationsCenter.snapshot({ projectId: url.searchParams.get('projectId'), principalId: req.forgePrincipal?.subject }));
    }
    if (pathname === '/api/trace-evidence' || pathname.startsWith('/api/trace-evidence/')) {
      if (!traceEvidenceCenter) throw Object.assign(new Error('Trace and Evidence Center is not configured'), { statusCode: 503 });
      if (method === 'GET' && pathname === '/api/trace-evidence') return json(res, 200, await traceEvidenceCenter.snapshot({ projectId: url.searchParams.get('projectId'), missionId: url.searchParams.get('missionId'), taskId: url.searchParams.get('taskId'), afterSeq: Number(url.searchParams.get('after') ?? 0), limit: Number(url.searchParams.get('limit') ?? 500), principalId: req.forgePrincipal?.subject }));
      if (method === 'GET' && pathname === '/api/trace-evidence/events') return json(res, 200, await traceEvidenceCenter.events({ projectId: url.searchParams.get('projectId'), missionId: url.searchParams.get('missionId'), taskId: url.searchParams.get('taskId'), afterSeq: Number(url.searchParams.get('after') ?? 0), limit: Number(url.searchParams.get('limit') ?? 500), principalId: req.forgePrincipal?.subject }));
      if (method === 'POST' && pathname === '/api/trace-evidence/export') return json(res, 201, await traceEvidenceCenter.exportBundle({ ...(await readJson(req)), principalId: req.forgePrincipal?.subject }));
      return false;
    }
    if (pathname === '/api/context-orchestration/plan' || pathname.startsWith('/api/context-orchestration/checkpoints')) {
      if (!contextOrchestration) throw Object.assign(new Error('Context Orchestration is not configured'), { statusCode: 503 });
      if (method === 'POST' && pathname === '/api/context-orchestration/plan') return json(res, 200, contextOrchestration.plan({ ...(await readJson(req)), principalId: req.forgePrincipal?.subject }));
      if (method === 'POST' && pathname === '/api/context-orchestration/checkpoints') return json(res, 201, contextOrchestration.checkpoint({ ...(await readJson(req)), principalId: req.forgePrincipal?.subject }));
      const checkpointItems = pathname.match(/^\/api\/context-orchestration\/checkpoints\/([^/]+)\/items$/);
      if (method === 'GET' && checkpointItems) return json(res, 200, contextOrchestration.pageCheckpoint(decodeURIComponent(checkpointItems[1]), { projectId: url.searchParams.get('projectId'), principalId: req.forgePrincipal?.subject, cursor: url.searchParams.get('cursor'), limit: Number(url.searchParams.get('limit') ?? 100) }));
      const checkpointGet = pathname.match(/^\/api\/context-orchestration\/checkpoints\/([^/]+)$/);
      if (method === 'GET' && checkpointGet) return json(res, 200, contextOrchestration.getCheckpoint(decodeURIComponent(checkpointGet[1]), { projectId: url.searchParams.get('projectId'), principalId: req.forgePrincipal?.subject }));
      return false;
    }
    if (pathname === '/api/context-memory-center' || pathname.startsWith('/api/context-memory-center/')) {
      if (!contextMemoryCenter) throw Object.assign(new Error('Context and Memory Center is not configured'), { statusCode: 503 });
      if (method === 'GET' && pathname === '/api/context-memory-center') return json(res, 200, await contextMemoryCenter.snapshot({ projectId: url.searchParams.get('projectId'), principalId: req.forgePrincipal?.subject }));
      if (method === 'POST' && pathname === '/api/context-memory-center/pins') return json(res, 201, await contextMemoryCenter.pinArtifact({ ...(await readJson(req)), principalId: req.forgePrincipal?.subject }));
      const pinRoute = pathname.match(/^\/api\/context-memory-center\/pins\/([^/]+)$/);
      if (method === 'DELETE' && pinRoute) return json(res, 200, await contextMemoryCenter.unpinArtifact({ projectId: url.searchParams.get('projectId'), artifactId: decodeURIComponent(pinRoute[1]), principalId: req.forgePrincipal?.subject }));
      const verifyRoute = pathname.match(/^\/api\/context-memory-center\/memory\/([^/]+)\/verify$/);
      if (method === 'POST' && verifyRoute) return json(res, 200, await contextMemoryCenter.verifyMemory({ ...(await readJson(req)), memoryId: decodeURIComponent(verifyRoute[1]), principalId: req.forgePrincipal?.subject }));
      return false;
    }
    if (method === 'GET' && pathname === '/api/capabilities') {
      if (!capabilityLedger) throw Object.assign(new Error('Capability ledger is not configured'), { statusCode: 503 });
      return json(res, 200, capabilityLedger.registry.list());
    }
    if (method === 'GET' && pathname === '/api/capability-grants') {
      if (!capabilityLedger) throw Object.assign(new Error('Capability ledger is not configured'), { statusCode: 503 });
      return json(res, 200, capabilityLedger.listGrants({ principalId: url.searchParams.get('principalId') || null, effect: url.searchParams.get('effect') || null, activeOnly: url.searchParams.get('activeOnly') === 'true', sessionId: url.searchParams.get('sessionId') || null }));
    }
    if (method === 'POST' && pathname === '/api/capability-grants') {
      if (!capabilityLedger) throw Object.assign(new Error('Capability ledger is not configured'), { statusCode: 503 });
      if (!req.forgePrincipal?.subject) throw Object.assign(new Error('An authenticated principal is required to approve capabilities'), { statusCode: 401, code: 'CAPABILITY_APPROVER_REQUIRED' });
      const body = await readJson(req);
      return json(res, 201, capabilityLedger.grant({ ...body, approvedBy: req.forgePrincipal.subject }));
    }
    const capabilityGrant = pathname.match(/^\/api\/capability-grants\/([^/]+)$/);
    if (method === 'PATCH' && capabilityGrant) {
      if (!capabilityLedger) throw Object.assign(new Error('Capability ledger is not configured'), { statusCode: 503 });
      if (!req.forgePrincipal?.subject) throw Object.assign(new Error('An authenticated principal is required to amend capabilities'), { statusCode: 401, code: 'CAPABILITY_APPROVER_REQUIRED' });
      const body = await readJson(req);
      return json(res, 200, capabilityLedger.amend(decodeURIComponent(capabilityGrant[1]), { ...body, approvedBy: req.forgePrincipal.subject }));
    }
    if (method === 'DELETE' && capabilityGrant) {
      if (!capabilityLedger) throw Object.assign(new Error('Capability ledger is not configured'), { statusCode: 503 });
      if (!req.forgePrincipal?.subject) throw Object.assign(new Error('An authenticated principal is required to revoke capabilities'), { statusCode: 401, code: 'CAPABILITY_APPROVER_REQUIRED' });
      const body = await readJson(req);
      return json(res, 200, capabilityLedger.revoke(decodeURIComponent(capabilityGrant[1]), { revokedBy: req.forgePrincipal.subject, reason: body.reason }));
    }
    if (method === 'GET' && pathname === '/api/operating-plane/status') {
      if (!operatingPlane) throw Object.assign(new Error('Agent operating plane is not configured'), { statusCode: 503 });
      return json(res, 200, await operatingPlane.status());
    }
    const projectProfiles = pathname.match(/^\/api\/projects\/([^/]+)\/agent-profiles$/);
    if (method === 'GET' && projectProfiles) {
      if (!operatingPlane) throw Object.assign(new Error('Agent operating plane is not configured'), { statusCode: 503 });
      return json(res, 200, await operatingPlane.listProfiles(decodeURIComponent(projectProfiles[1])));
    }
    const codeOperation = pathname.match(/^\/api\/code\/(symbols|definition|references|call-hierarchy|read-symbol|replace-symbol|insert-before-symbol|insert-after-symbol|search-advanced|ast-query|ast-patch)$/);
    if (method === 'POST' && codeOperation) {
      if (!operatingPlane) throw Object.assign(new Error('Agent operating plane is not configured'), { statusCode: 503 });
      const operation = ({
        'call-hierarchy': 'callHierarchy',
        'read-symbol': 'readSymbol',
        'replace-symbol': 'replaceSymbol',
        'insert-before-symbol': 'insertBeforeSymbol',
        'insert-after-symbol': 'insertAfterSymbol',
        'search-advanced': 'searchAdvanced',
        'ast-query': 'astQuery',
        'ast-patch': 'astPatch',
      })[codeOperation[1]] ?? codeOperation[1];
      return json(res, 200, await operatingPlane.code(operation, await readJson(req)));
    }
    const securityOperation = pathname.match(/^\/api\/security\/(scan-artifacts|scan-dependencies)$/);
    if (method === 'POST' && securityOperation) {
      if (!operatingPlane) throw Object.assign(new Error('Agent operating plane is not configured'), { statusCode: 503 });
      const operation = securityOperation[1] === 'scan-artifacts' ? 'scanArtifacts' : 'scanDependencies';
      return json(res, 200, await operatingPlane.security(operation, await readJson(req)));
    }
    const testOperation = pathname.match(/^\/api\/tests\/(detect|run)$/);
    if (method === 'POST' && testOperation) {
      if (!operatingPlane) throw Object.assign(new Error('Agent operating plane is not configured'), { statusCode: 503 });
      return json(res, 200, await operatingPlane.tests(testOperation[1], await readJson(req)));
    }
    if (method === 'POST' && pathname === '/api/images/compare') {
      if (!operatingPlane) throw Object.assign(new Error('Agent operating plane is not configured'), { statusCode: 503 });
      return json(res, 200, await operatingPlane.compareImages(await readJson(req)));
    }
    const sessionOperation = pathname.match(/^\/api\/sessions\/([^/]+)\/(verify|checkpoint|rewind|fork)$/);
    if (method === 'POST' && sessionOperation) {
      if (!operatingPlane) throw Object.assign(new Error('Agent operating plane is not configured'), { statusCode: 503 });
      return json(res, 200, await operatingPlane.session(sessionOperation[2], { ...(await readJson(req)), sessionId: decodeURIComponent(sessionOperation[1]) }));
    }
    if (method === 'GET' && pathname === '/api/git/status') {
      if (!operatingPlane) throw Object.assign(new Error('Agent operating plane is not configured'), { statusCode: 503 });
      return json(res, 200, await operatingPlane.git('status', { projectId: url.searchParams.get('projectId') }));
    }
    if (method === 'POST' && pathname === '/api/git/diff') {
      if (!operatingPlane) throw Object.assign(new Error('Agent operating plane is not configured'), { statusCode: 503 });
      return json(res, 200, await operatingPlane.git('diff', await readJson(req)));
    }
    if (method === 'GET' && pathname === '/api/projects') return json(res, 200, store.listProjects());
    if (method === 'GET' && pathname === '/api/goals') {
      if (!goalService) throw Object.assign(new Error('Goal service is not configured'), { statusCode: 503 });
      return json(res, 200, goalService.list({ projectId: url.searchParams.get('projectId') || undefined, status: url.searchParams.get('status') || undefined }));
    }
    if (method === 'POST' && pathname === '/api/goals') {
      if (!goalService || !goalRunService) throw Object.assign(new Error('Goal runtime is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      const input = {
        projectId: body.projectId,
        title: body.title ?? (String(body.objective ?? '').slice(0, 120) || 'Untitled goal'),
        objective: body.objective,
        successCriteria: body.successCriteria ?? [],
        budget: body.budget ?? {},
        schedule: body.schedule ?? { kind: 'manual' },
        assumptions: body.assumptions ?? [],
        metadata: {
          ...(body.metadata ?? {}),
          browserAllowedActions: Array.isArray(body.browserAllowedActions) ? body.browserAllowedActions : [],
          mcpAllowedTools: Array.isArray(body.mcpAllowedTools) ? body.mcpAllowedTools : [],
          goalAutoApplyPlanPatches: body.goalAutoApplyPlanPatches === true,
        },
        providerId: body.providerId ?? 'auto',
        workerId: body.workerId ?? 'goal-autopilot',
        budgets: body.budgets,
        browserAllowedActions: body.browserAllowedActions,
        mcpAllowedTools: body.mcpAllowedTools,
        autoApplyPlanPatches: body.goalAutoApplyPlanPatches === true,
      };
      if (body.start === false) return json(res, 201, { goal: goalService.create(input), run: null });
      if (workspaceTrust) await workspaceTrust.requireTrusted(input.projectId, 'background');
      return json(res, 201, await goalRunService.createAndStart(input));
    }
    if (method === 'POST' && pathname === '/api/goals/scheduler/tick') {
      if (!goalScheduler) throw Object.assign(new Error('Goal scheduler is not configured'), { statusCode: 503 });
      return json(res, 200, await goalScheduler.tick());
    }
    const goalStart = pathname.match(/^\/api\/goals\/([^/]+)\/start$/);
    if (method === 'POST' && goalStart) {
      if (!goalRunService) throw Object.assign(new Error('Goal runtime is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      const goalId = decodeURIComponent(goalStart[1]);
      if (workspaceTrust) {
        const goal = goalService?.get?.(goalId);
        if (!goal) throw Object.assign(new Error('Goal not found'), { statusCode: 404 });
        await workspaceTrust.requireTrusted(goal.projectId, 'background');
      }
      return json(res, 200, await goalRunService.start(goalId, body));
    }
    const goalFacts = pathname.match(/^\/api\/goals\/([^/]+)\/facts$/);
    if (goalFacts && method === 'GET') {
      if (!goalService) throw Object.assign(new Error('Goal service is not configured'), { statusCode: 503 });
      return json(res, 200, goalService.listFacts(decodeURIComponent(goalFacts[1])));
    }
    if (goalFacts && method === 'POST') {
      if (!goalService) throw Object.assign(new Error('Goal service is not configured'), { statusCode: 503 });
      return json(res, 201, goalService.recordFact(decodeURIComponent(goalFacts[1]), await readJson(req)));
    }
    const goalReplans = pathname.match(/^\/api\/goals\/([^/]+)\/replans$/);
    if (method === 'GET' && goalReplans) {
      if (!replanner) throw Object.assign(new Error('Adaptive replanner is not configured'), { statusCode: 503 });
      return json(res, 200, replanner.store.listGoalPlanPatches(decodeURIComponent(goalReplans[1])));
    }
    const goalReplan = pathname.match(/^\/api\/goals\/([^/]+)\/replan$/);
    if (method === 'POST' && goalReplan) {
      if (!replanner) throw Object.assign(new Error('Adaptive replanner is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      return json(res, 201, replanner.propose({ goalId: decodeURIComponent(goalReplan[1]), reason: body.reason, patch: body.patch, idempotencyKey: body.idempotencyKey }));
    }
    const applyReplan = pathname.match(/^\/api\/replans\/([^/]+)\/apply$/);
    if (method === 'POST' && applyReplan) {
      if (!replanner) throw Object.assign(new Error('Adaptive replanner is not configured'), { statusCode: 503 });
      return json(res, 200, replanner.apply(decodeURIComponent(applyReplan[1])));
    }
    const goalById = pathname.match(/^\/api\/goals\/([^/]+)$/);
    if (method === 'GET' && goalById) {
      if (!goalService) throw Object.assign(new Error('Goal service is not configured'), { statusCode: 503 });
      const goal = goalService.get(decodeURIComponent(goalById[1]));
      if (!goal) throw Object.assign(new Error('Goal not found'), { statusCode: 404 });
      return json(res, 200, goal);
    }
    if (method === 'PATCH' && goalById) {
      if (!goalService) throw Object.assign(new Error('Goal service is not configured'), { statusCode: 503 });
      return json(res, 200, goalService.update(decodeURIComponent(goalById[1]), await readJson(req)));
    }
    if (method === 'GET' && pathname === '/api/commands') {
      if (!commandRegistry) throw Object.assign(new Error('Command registry is not configured'), { statusCode: 503 });
      return json(res, 200, commandRegistry.list());
    }
    if (method === 'POST' && pathname === '/api/commands') {
      if (!commandRegistry) throw Object.assign(new Error('Command registry is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      return json(res, 200, await commandRegistry.execute(String(body.command ?? ''), body.context ?? {}));
    }
    if (method === 'GET' && pathname === '/api/browser/runtime') {
      if (!browserRuntimeInstaller?.status) throw Object.assign(new Error('Browser runtime installer is not configured'), { statusCode: 503 });
      return json(res, 200, await browserRuntimeInstaller.status());
    }
    if (method === 'POST' && pathname === '/api/browser/runtime/install') {
      if (!browserRuntimeInstaller?.install) throw Object.assign(new Error('Browser runtime installer is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      return json(res, 200, await browserRuntimeInstaller.install({ force: body.force === true }));
    }
    if (pathname === '/api/permissions/browser' && (method === 'GET' || method === 'POST')) {
      if (!browserPermissionService) throw Object.assign(new Error('Browser permission service is not configured'), { statusCode: 503 });
      const input = method === 'GET' ? Object.fromEntries(url.searchParams.entries()) : await readJson(req);
      if (method === 'GET' || String(input.action ?? 'show') === 'show') return json(res, 200, browserPermissionService.inspect({ goalId: input.goalId }));
      if (input.action === 'grant') return json(res, 200, browserPermissionService.grant({ goalId: input.goalId, actions: input.actions }));
      if (input.action === 'revoke') return json(res, 200, browserPermissionService.revoke({ goalId: input.goalId, actions: input.actions }));
      throw Object.assign(new Error('Unsupported browser permission action'), { statusCode: 400 });
    }
    const browserAction = pathname.match(/^\/api\/browser\/([a-z-]+)$/);
    if (browserAction && (method === 'POST' || (method === 'GET' && ['detect', 'status'].includes(browserAction[1])))) {
      if (!browserService) throw Object.assign(new Error('Browser service is not configured'), { statusCode: 503 });
      const actionName = browserAction[1];
      if (!['detect', 'open', 'goto', 'snapshot', 'find', 'click', 'fill', 'type', 'press', 'tabs', 'screenshot', 'artifact', 'close', 'status'].includes(actionName) || typeof browserService[actionName] !== 'function') return false;
      const input = method === 'POST' ? await readJson(req) : Object.fromEntries(url.searchParams.entries());
      if (BROWSER_WRITE_ACTIONS.includes(actionName)) {
        if (!browserPermissionService?.inspect) throw Object.assign(new Error('Browser permission service is not configured'), { statusCode: 503, code: 'BROWSER_PERMISSION_UNAVAILABLE' });
        const goalId = String(input.goalId ?? '').trim();
        if (!goalId) throw Object.assign(new TypeError('goalId is required for browser write actions'), { statusCode: 400, code: 'BROWSER_GOAL_REQUIRED' });
        const permission = browserPermissionService.inspect({ goalId });
        if (permission.projectId && String(permission.projectId) !== String(input.projectId ?? '')) throw Object.assign(new Error('Browser goal is not scoped to the requested project'), { statusCode: 403, code: 'BROWSER_PROJECT_SCOPE_DENIED' });
        if (!Array.isArray(permission.allowedActions) || !permission.allowedActions.map(String).includes(actionName)) throw Object.assign(new Error(`Browser action is not allowlisted for goal ${goalId}: ${actionName}`), { statusCode: 403, code: 'BROWSER_ACTION_NOT_ALLOWED' });
      }
      return json(res, 200, await browserService[actionName](input));
    }
    if (method === 'GET' && pathname === '/api/plugins') {
      if (!pluginService) throw Object.assign(new Error('Plugin service is not configured'), { statusCode: 503 });
      return json(res, 200, pluginService.publicView());
    }
    if (method === 'GET' && pathname === '/api/plugins/marketplaces') {
      if (!pluginService) throw Object.assign(new Error('Plugin service is not configured'), { statusCode: 503 });
      return json(res, 200, pluginService.listMarketplaces());
    }
    if (method === 'POST' && pathname === '/api/plugins/marketplaces') {
      if (!pluginService) throw Object.assign(new Error('Plugin service is not configured'), { statusCode: 503 });
      return json(res, 201, await pluginService.addMarketplace(await readJson(req)));
    }
    if (method === 'POST' && pathname === '/api/plugins/install') {
      if (!pluginService) throw Object.assign(new Error('Plugin service is not configured'), { statusCode: 503 });
      return json(res, 201, await pluginService.install(await readJson(req)));
    }
    const pluginReview = pathname.match(/^\/api\/plugins\/([^/]+)\/review$/);
    if (method === 'GET' && pluginReview) {
      if (!pluginService?.review) throw Object.assign(new Error('Plugin capability review is not configured'), { statusCode: 503 });
      return json(res, 200, await pluginService.review(decodeURIComponent(pluginReview[1]), { projectId: url.searchParams.get('projectId') || null }));
    }
    const pluginAction = pathname.match(/^\/api\/plugins\/([^/]+)\/(activate|deactivate)$/);
    if (method === 'POST' && pluginAction) {
      if (!pluginService) throw Object.assign(new Error('Plugin service is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      const pluginId = decodeURIComponent(pluginAction[1]);
      if (pluginAction[2] === 'activate' && workspaceTrust) await workspaceTrust.requireTrusted(body.projectId, 'plugins');
      return json(res, 200, await pluginService[pluginAction[2]](pluginId, body));
    }


    if (method === 'GET' && pathname === '/api/onboarding/status') {
      if (!onboardingService?.status) throw Object.assign(new Error('Onboarding service is not configured'), { statusCode: 503 });
      return json(res, 200, await onboardingService.status());
    }
    if (method === 'POST' && pathname === '/api/onboarding/progress') {
      if (!onboardingService?.saveProgress) throw Object.assign(new Error('Onboarding service is not configured'), { statusCode: 503 });
      return json(res, 200, await onboardingService.saveProgress(await readJson(req, 256_000)));
    }
    if (method === 'POST' && pathname === '/api/onboarding/complete') {
      if (!onboardingService?.complete) throw Object.assign(new Error('Onboarding service is not configured'), { statusCode: 503 });
      return json(res, 200, await onboardingService.complete(await readJson(req, 256_000)));
    }
    if (method === 'POST' && pathname === '/api/onboarding/recommended') {
      if (!onboardingService?.recommended) throw Object.assign(new Error('Onboarding service is not configured'), { statusCode: 503 });
      return json(res, 200, await onboardingService.recommended(await readJson(req, 64_000)));
    }
    if (method === 'POST' && pathname === '/api/onboarding/skip') {
      if (!onboardingService?.skip) throw Object.assign(new Error('Onboarding service is not configured'), { statusCode: 503 });
      return json(res, 200, await onboardingService.skip());
    }
    if (method === 'GET' && pathname === '/api/session/restore') {
      if (!sessionRestore?.restore) throw Object.assign(new Error('Session restore service is not configured'), { statusCode: 503 });
      return json(res, 200, await sessionRestore.restore());
    }
    if (method === 'PATCH' && pathname === '/api/session/restore') {
      if (!sessionRestore?.updateRestore) throw Object.assign(new Error('Session restore service is not configured'), { statusCode: 503 });
      return json(res, 200, await sessionRestore.updateRestore(await readJson(req, 256_000)));
    }
    if (method === 'GET' && pathname === '/api/session/draft') {
      if (!sessionRestore?.draft) throw Object.assign(new Error('Session restore service is not configured'), { statusCode: 503 });
      return json(res, 200, { schema: 'nolane.composer-draft-response.v1', scope: url.searchParams.get('scope') || 'home', draft: await sessionRestore.draft(url.searchParams.get('scope') || 'home') });
    }
    if (method === 'PUT' && pathname === '/api/session/draft') {
      if (!sessionRestore?.saveDraft) throw Object.assign(new Error('Session restore service is not configured'), { statusCode: 503 });
      const body = await readJson(req, 512_000);
      return json(res, 200, await sessionRestore.saveDraft({ scope: body.scope ?? 'home', draft: body.draft ?? body }));
    }
    if (method === 'DELETE' && pathname === '/api/session/draft') {
      if (!sessionRestore?.clearDraft) throw Object.assign(new Error('Session restore service is not configured'), { statusCode: 503 });
      return json(res, 200, await sessionRestore.clearDraft(url.searchParams.get('scope') || 'home'));
    }
    if (method === 'GET' && pathname === '/api/personalization/profile') {
      if (!personalizationProfile?.exportProfile) throw Object.assign(new Error('Personalization profile is not configured'), { statusCode: 503 });
      return json(res, 200, await personalizationProfile.exportProfile({ projectId: url.searchParams.get('projectId') || null }));
    }
    if (method === 'GET' && pathname === '/api/personalization/context') {
      if (!personalizationProfile?.compileContext) throw Object.assign(new Error('Personalization profile is not configured'), { statusCode: 503 });
      return json(res, 200, await personalizationProfile.compileContext({ projectId: url.searchParams.get('projectId') || null }));
    }
    if (method === 'POST' && pathname === '/api/personalization/import/preview') {
      if (!personalizationProfile?.previewImport) throw Object.assign(new Error('Personalization profile is not configured'), { statusCode: 503 });
      const body = await readJson(req, 1_000_000);
      return json(res, 200, await personalizationProfile.previewImport({ profile: body.profile ?? body, projectId: body.projectId ?? null }));
    }
    if (method === 'POST' && pathname === '/api/personalization/import') {
      if (!personalizationProfile?.applyImport) throw Object.assign(new Error('Personalization profile is not configured'), { statusCode: 503 });
      const body = await readJson(req, 1_000_000);
      return json(res, 200, await personalizationProfile.applyImport({ profile: body.profile ?? body, projectId: body.projectId ?? null, source: body.source ?? 'explicit-import' }));
    }
    if (method === 'PATCH' && pathname === '/api/personalization/preferences') {
      if (!personalizationProfile?.updatePreferences) throw Object.assign(new Error('Personalization profile is not configured'), { statusCode: 503 });
      const body = await readJson(req, 256_000);
      return json(res, 200, await personalizationProfile.updatePreferences({ patch: body.patch ?? {}, source: body.source ?? 'explicit', projectId: body.projectId ?? null }));
    }
    if (method === 'GET' && pathname === '/api/settings/catalog') {
      if (!settingsService?.catalog) throw Object.assign(new Error('Settings catalog is not configured'), { statusCode: 503 });
      return json(res, 200, settingsService.catalog());
    }
    if (method === 'POST' && pathname === '/api/settings/reset') {
      if (!settingsService?.reset) throw Object.assign(new Error('Settings reset is not configured'), { statusCode: 503 });
      return json(res, 200, await settingsService.reset(await readJson(req)));
    }
    if (method === 'GET' && pathname === '/api/model-profiles') {
      if (!modelProfiles?.publicView) throw Object.assign(new Error('Model profile registry is not configured'), { statusCode: 503 });
      return json(res, 200, modelProfiles.publicView({ providerId: url.searchParams.get('providerId') || null, query: url.searchParams.get('query') || '' }));
    }
    if (method === 'POST' && pathname === '/api/model-profiles') {
      if (!modelProfiles?.upsert || !modelProfiles?.publicView) throw Object.assign(new Error('Model profile registry is not configured'), { statusCode: 503 });
      const body = await readJson(req, 128 * 1024);
      const providerId = String(body.providerId ?? '').trim();
      const modelId = String(body.modelId ?? body.id ?? '').trim();
      if (!providerId) throw Object.assign(new TypeError('providerId is required'), { statusCode: 400, code: 'provider_id_required' });
      if (!modelId || modelId.length > 256 || /[\u0000-\u001f\u007f]/.test(modelId)) throw Object.assign(new TypeError('modelId is invalid'), { statusCode: 400, code: 'model_id_invalid' });
      const provider = providers?.publicView?.().find((item) => String(item.id) === providerId);
      if (!provider) throw Object.assign(new Error(`Unknown provider: ${providerId}`), { statusCode: 404, code: 'provider_not_found' });
      const profile = modelProfiles.upsert({
        providerId,
        modelId,
        displayName: String(body.displayName ?? modelId).trim().slice(0, 256) || modelId,
        metadata: { providerKind: provider.kind ?? null, configured: provider.configured === true, source: 'user' },
        local: provider.kind === 'cli' ? { runtime: 'official-cli' } : undefined,
      }, { source: 'userOverrides' });
      return json(res, 201, { profile, profiles: modelProfiles.publicView({ providerId }) });
    }
    if (method === 'POST' && pathname === '/api/model-profiles/discover') {
      if (!providerConnections?.discoverModels) throw Object.assign(new Error('Model discovery is not configured'), { statusCode: 503 });
      const body = await readJson(req, 128 * 1024);
      return json(res, 200, await providerConnections.discoverModels(body.providerId));
    }
    if (method === 'POST' && pathname === '/api/model-profiles/probe') {
      if (!providerConnections?.probeModel) throw Object.assign(new Error('Model capability probes are not configured'), { statusCode: 503 });
      const body = await readJson(req, 128 * 1024);
      return json(res, 200, await providerConnections.probeModel(body.providerId, { modelId: body.modelId, probes: body.probes }));
    }
    if (method === 'GET' && pathname === '/api/model-intelligence/snapshot') {
      if (!modelManager?.truthSnapshot) throw Object.assign(new Error('Model truth plane is not configured'), { statusCode: 503 });
      return json(res, 200, modelManager.truthSnapshot());
    }
    if (method === 'GET' && pathname === '/api/model-intelligence/entities') {
      if (!modelManager?.truthEntities) throw Object.assign(new Error('Model truth plane is not configured'), { statusCode: 503 });
      const modelId = url.searchParams.get('modelId');
      if (!modelId) throw Object.assign(new TypeError('modelId is required'), { statusCode: 400, code: 'model_id_required' });
      return json(res, 200, modelManager.truthEntities(modelId));
    }
    if (method === 'GET' && pathname === '/api/model-intelligence/facts') {
      if (!modelManager?.truthFacts) throw Object.assign(new Error('Model truth plane is not configured'), { statusCode: 503 });
      const modelId = url.searchParams.get('modelId');
      if (!modelId) throw Object.assign(new TypeError('modelId is required'), { statusCode: 400, code: 'model_id_required' });
      return json(res, 200, modelManager.truthFacts(modelId, { pathPrefix: url.searchParams.get('pathPrefix') || '' }));
    }
    if (method === 'POST' && pathname === '/api/model-intelligence/facts') {
      if (!modelManager?.recordFact) throw Object.assign(new Error('Model truth plane is not configured'), { statusCode: 503 });
      return json(res, 201, modelManager.recordFact(await readJson(req, 512 * 1024)));
    }
    if (method === 'POST' && pathname === '/api/model-intelligence/evaluations') {
      if (!modelManager?.recordEvaluation) throw Object.assign(new Error('Model truth plane is not configured'), { statusCode: 503 });
      return json(res, 201, modelManager.recordEvaluation(await readJson(req, 1_000_000)));
    }
    if (method === 'POST' && pathname === '/api/model-intelligence/compare') {
      if (!modelManager?.compare) throw Object.assign(new Error('Model comparison is not configured'), { statusCode: 503 });
      return json(res, 200, modelManager.compare(await readJson(req, 512 * 1024)));
    }
    if (method === 'POST' && pathname === '/api/model-management/explain') {
      if (!modelManager?.explain) throw Object.assign(new Error('Model routing explanation is not configured'), { statusCode: 503 });
      return json(res, 200, modelManager.explain(await readJson(req, 512 * 1024)));
    }
    if (method === 'GET' && pathname === '/api/model-management/snapshot') {
      if (!modelManager?.snapshot) throw Object.assign(new Error('Model management service is not configured'), { statusCode: 503 });
      return json(res, 200, modelManager.snapshot());
    }
    if (method === 'POST' && pathname === '/api/model-management/recommend') {
      if (!modelManager?.recommend) throw Object.assign(new Error('Model management service is not configured'), { statusCode: 503 });
      return json(res, 200, modelManager.recommend(await readJson(req, 512 * 1024)));
    }
    if (method === 'POST' && pathname === '/api/model-management/portfolio') {
      if (!modelManager?.createPortfolio) throw Object.assign(new Error('Model management service is not configured'), { statusCode: 503 });
      return json(res, 200, modelManager.createPortfolio(await readJson(req, 512 * 1024)));
    }
    if (method === 'POST' && pathname === '/api/model-management/observations') {
      if (!modelManager?.recordExecution) throw Object.assign(new Error('Model management service is not configured'), { statusCode: 503 });
      const body = await readJson(req, 256 * 1024);
      if (!body?.modelId) throw Object.assign(new TypeError('modelId is required'), { statusCode: 400, code: 'model_id_required' });
      return json(res, 202, modelManager.recordExecution(body.modelId, body.observation ?? body));
    }
    if (method === 'GET' && pathname === '/api/model-management/dossier') {
      if (!modelManager?.dossier) throw Object.assign(new Error('Model management service is not configured'), { statusCode: 503 });
      const modelId = url.searchParams.get('modelId');
      if (!modelId) throw Object.assign(new TypeError('modelId is required'), { statusCode: 400, code: 'model_id_required' });
      return json(res, 200, modelManager.dossier(modelId));
    }
    if (method === 'GET' && pathname === '/api/ui/summary') {
      if (!uiSummary?.snapshot) throw Object.assign(new Error('UI summary is not configured'), { statusCode: 503 });
      return json(res, 200, await uiSummary.snapshot({ projectId: url.searchParams.get('projectId') || null }));
    }
    const summaryStop = pathname.match(/^\/api\/ui\/summary\/processes\/([^/]+)\/stop$/);
    if (method === 'POST' && summaryStop) {
      if (!uiSummary?.stopProcess) throw Object.assign(new Error('UI process controls are not configured'), { statusCode: 503 });
      return json(res, 200, await uiSummary.stopProcess(decodeURIComponent(summaryStop[1])));
    }
    if (method === 'GET' && pathname === '/api/settings/effective') {
      if (!settingsService) throw Object.assign(new Error('Settings service is not configured'), { statusCode: 503 });
      return json(res, 200, await settingsService.effective(url.searchParams.get('projectId') || null));
    }
    if (method === 'PUT' && pathname === '/api/settings') {
      if (!settingsService) throw Object.assign(new Error('Settings service is not configured'), { statusCode: 503 });
      return json(res, 200, await settingsService.update(await readJson(req)));
    }
    if (method === 'GET' && pathname === '/api/mission-graph') {
      if (!missionGraph) throw Object.assign(new Error('Mission graph is not configured'), { statusCode: 503 });
      return json(res, 200, missionGraph.snapshot({ goalId: url.searchParams.get('goalId') || null, missionId: url.searchParams.get('missionId') || null }));
    }
    if (method === 'GET' && pathname === '/api/provider-connections') {
      if (!providerConnections) throw Object.assign(new Error('Provider connection service is not configured'), { statusCode: 503 });
      return json(res, 200, providerConnections.list());
    }
    if (method === 'GET' && pathname === '/api/provider-connections/readiness') {
      if (!providerConnections) throw Object.assign(new Error('Provider connection service is not configured'), { statusCode: 503 });
      return json(res, 200, providerConnections.readiness({ providerId: url.searchParams.get('providerId') ?? 'auto' }));
    }
    if (method === 'POST' && pathname === '/api/provider-connections/refresh') {
      if (!providerConnections) throw Object.assign(new Error('Provider connection service is not configured'), { statusCode: 503 });
      return json(res, 200, await providerConnections.refreshAll());
    }
    if (method === 'POST' && pathname === '/api/provider-connections/configure') {
      if (!providerConnections) throw Object.assign(new Error('Provider connection service is not configured'), { statusCode: 503 });
      const body = await readJson(req, 128 * 1024);
      return json(res, 201, await providerConnections.configureApi({
        id: body.id, kind: body.kind, model: body.model, baseUrl: body.baseUrl, apiKey: body.apiKey,
        account: body.account, headers: body.headers, testConnection: body.testConnection !== false,
      }));
    }
    if (method === 'POST' && pathname === '/api/provider-connections/select-model') {
      if (!providerConnections?.selectApiModel) throw Object.assign(new Error('API model selection is not configured'), { statusCode: 503 });
      const body = await readJson(req, 128 * 1024);
      return json(res, 200, await providerConnections.selectApiModel(body.providerId, { modelId: body.modelId, testConnection: body.testConnection !== false }));
    }
    const providerDelete = pathname.match(/^\/api\/provider-connections\/([^/]+)$/);
    if (method === 'DELETE' && providerDelete) {
      if (!providerConnections) throw Object.assign(new Error('Provider connection service is not configured'), { statusCode: 503 });
      return json(res, 200, { deleted: await providerConnections.deleteApi(decodeURIComponent(providerDelete[1])) });
    }
    const providerAction = pathname.match(/^\/api\/provider-connections\/([^/]+)\/(test|login|logout)$/);
    if (method === 'POST' && providerAction) {
      if (!providerConnections) throw Object.assign(new Error('Provider connection service is not configured'), { statusCode: 503 });
      const id = decodeURIComponent(providerAction[1]); const action = providerAction[2]; const body = await readJson(req, 64 * 1024);
      if (action === 'test') return json(res, 200, await providerConnections.test(id));
      if (action === 'login') return json(res, 200, await providerConnections.startLogin(id, body));
      return json(res, 200, await providerConnections.logout(id));
    }
    const providerLoginCancel = pathname.match(/^\/api\/provider-connections\/([^/]+)\/login\/cancel$/);
    if (method === 'POST' && providerLoginCancel) {
      if (!providerConnections) throw Object.assign(new Error('Provider connection service is not configured'), { statusCode: 503 });
      return json(res, 200, await providerConnections.cancelLogin(decodeURIComponent(providerLoginCancel[1]), await readJson(req, 64 * 1024)));
    }
    if (pathname === '/api/mission-resource-fabric') {
      if (method !== 'GET') return false;
      if (!missionResourceFabric) throw Object.assign(new Error('Mission resource fabric is not configured'), { statusCode: 503 });
      return json(res, 200, missionResourceFabric.publicView());
    }
    if (pathname.startsWith('/api/superiority/')) {
      const decision = missionResourceFabric?.decision;
      if (!decision) throw Object.assign(new Error('Superiority plane is not configured'), { statusCode: 503 });
      if (method === 'GET' && pathname === '/api/superiority/snapshot') return json(res, 200, decision.superioritySnapshot() ?? decision.superiority.snapshot());
      if (method !== 'POST') return false;
      const body = await readJson(req, 256 * 1024);
      if (pathname === '/api/superiority/proof/compile') return json(res, 201, decision.compileProofMission(body));
      if (pathname === '/api/superiority/proof/evidence') return json(res, 201, decision.recordProofEvidence(body.planId, body));
      if (pathname === '/api/superiority/proof/evaluate') return json(res, 200, decision.evaluateProofMission(body.planId));
      if (pathname === '/api/superiority/twin/nodes') return json(res, 201, decision.registerCausalTwinNode(body));
      if (pathname === '/api/superiority/twin/edges') return json(res, 201, decision.linkCausalTwin(body));
      if (pathname === '/api/superiority/twin/predict') return json(res, 200, decision.predictCausalImpact(body));
      if (pathname === '/api/superiority/twin/outcomes') return json(res, 201, decision.recordCausalOutcome(body));
      if (pathname === '/api/superiority/twin/invalidate') return json(res, 200, decision.invalidateCausalEvidence(body.sourceHash));
      if (pathname === '/api/superiority/tournament/open') return json(res, 201, decision.openAdversarialTournament(body));
      if (pathname === '/api/superiority/tournament/candidates') return json(res, 201, decision.registerTournamentCandidate(body.tournamentId, body));
      if (pathname === '/api/superiority/tournament/attacks') return json(res, 201, decision.recordTournamentAttack(body.tournamentId, body));
      if (pathname === '/api/superiority/tournament/verifications') return json(res, 201, decision.recordTournamentVerification(body.tournamentId, body));
      if (pathname === '/api/superiority/tournament/decide') return json(res, 200, decision.decideAdversarialTournament(body.tournamentId));
      if (pathname === '/api/superiority/models/register') return json(res, 201, decision.registerGovernedModel(body));
      if (pathname === '/api/superiority/models/route') return json(res, 200, decision.routeGovernedModel(body));
      if (pathname === '/api/superiority/models/outcomes') return json(res, 201, decision.recordGovernedModelOutcome(body));
      if (pathname === '/api/superiority/models/promote') {
        const roles = Array.isArray(req.forgePrincipal?.roles) ? req.forgePrincipal.roles.map(String) : [];
        const approvedByHuman = roles.some((role) => role === 'owner' || role === 'admin' || role === 'operator');
        return json(res, 200, decision.authorizeGovernedModelPromotion(body.modelId, { approvedByHuman, actor: req.forgePrincipal?.subject ?? 'unknown', approvalReceiptSha256: body.approvalReceiptSha256 }));
      }
      if (pathname === '/api/superiority/constitution/register') return json(res, 201, decision.registerMissionConstitution(body));
      if (pathname === '/api/superiority/constitution/evaluate') return json(res, 200, decision.evaluateConstitutionAction(body.constitutionId, body));
      if (pathname === '/api/superiority/constitution/amend') {
        const roles = Array.isArray(req.forgePrincipal?.roles) ? req.forgePrincipal.roles.map(String) : [];
        const approvedByHuman = roles.some((role) => role === 'owner' || role === 'admin' || role === 'operator');
        return json(res, 200, decision.amendMissionConstitution(body.constitutionId, { ...body, approvedByHuman, actor: req.forgePrincipal?.subject ?? 'unknown' }));
      }
      if (pathname === '/api/superiority/counterfactual/open') return json(res, 201, decision.openCounterfactualPlan(body));
      if (pathname === '/api/superiority/counterfactual/candidates') return json(res, 201, decision.registerCounterfactualCandidate(body.planningId, body));
      if (pathname === '/api/superiority/counterfactual/decide') return json(res, 200, decision.decideCounterfactualPlan(body.planningId));
      if (pathname === '/api/superiority/memory/propose') return json(res, 201, decision.proposeVerifiedMemory(body));
      if (pathname === '/api/superiority/memory/outcomes') return json(res, 201, decision.recordVerifiedMemoryOutcome(body.memoryId, body));
      if (pathname === '/api/superiority/memory/evaluate') return json(res, 200, decision.evaluateVerifiedMemory(body.memoryId));
      if (pathname === '/api/superiority/memory/promote') {
        const roles = Array.isArray(req.forgePrincipal?.roles) ? req.forgePrincipal.roles.map(String) : [];
        const approvedByHuman = roles.some((role) => role === 'owner' || role === 'admin' || role === 'operator');
        return json(res, 200, decision.promoteVerifiedMemory(body.memoryId, { ...body, approvedByHuman, actor: req.forgePrincipal?.subject ?? 'unknown' }));
      }
      if (pathname === '/api/superiority/memory/invalidate') return json(res, 200, decision.invalidateVerifiedMemory(body.memoryId, body));
      if (pathname === '/api/superiority/memory/tombstone') {
        const roles = Array.isArray(req.forgePrincipal?.roles) ? req.forgePrincipal.roles.map(String) : [];
        const approvedByHuman = roles.some((role) => role === 'owner' || role === 'admin' || role === 'operator');
        return json(res, 200, decision.tombstoneVerifiedMemory(body.memoryId, { ...body, approvedByHuman, actor: req.forgePrincipal?.subject ?? 'unknown' }));
      }
      if (pathname === '/api/superiority/self-healing/components') return json(res, 201, decision.registerSelfHealingComponent(body));
      if (pathname === '/api/superiority/self-healing/anomalies') return json(res, 201, decision.observeSelfHealingAnomaly(body));
      if (pathname === '/api/superiority/self-healing/plans') return json(res, 201, decision.planSelfHealingRepair(body.componentId, body));
      if (pathname === '/api/superiority/budget/schedule') return json(res, 200, decision.scheduleProofBudget(body));
      if (pathname === '/api/superiority/benchmark/studies') return json(res, 201, decision.createComparativeStudy(body));
      if (pathname === '/api/superiority/benchmark/runs') return json(res, 201, decision.ingestComparativeRun(body.studyId, body));
      if (pathname === '/api/superiority/benchmark/evaluate') return json(res, 200, decision.evaluateComparativeStudy(body.studyId));
      if (pathname === '/api/superiority/ui/certify') return json(res, 200, decision.certifyLocalUi(body));
      if (pathname === '/api/superiority/dogfood/suites') return json(res, 201, decision.createDogfoodSuite(body));
      if (pathname === '/api/superiority/dogfood/verify') return json(res, 200, decision.verifyDogfoodReceipt(body.suiteId, body));
      if (pathname === '/api/superiority/dogfood/evaluate') return json(res, 200, decision.evaluateDogfoodSuite(body.suiteId));
      return false;
    }
    if (pathname.startsWith('/api/collaboration-experience/')) {
      const decision = missionResourceFabric?.decision;
      if (!decision) throw Object.assign(new Error('Collaboration experience plane is not configured'), { statusCode: 503 });
      if (method === 'GET' && pathname === '/api/collaboration-experience/snapshot') {
        return json(res, 200, decision.collaborationExperienceSnapshot() ?? decision.collaborationExperience.snapshot());
      }
      if (method !== 'POST') return false;
      const body = await readJson(req, 128 * 1024);
      if (pathname === '/api/collaboration-experience/review/items') return json(res, 201, decision.addReviewItem({
        itemId: body.itemId, kind: body.kind, target: body.target, risk: body.risk, dependencies: body.dependencies ?? [], missionStage: body.missionStage, receiptSha256: body.receiptSha256,
      }));
      if (pathname === '/api/collaboration-experience/review/decisions') return json(res, 200, decision.decideReviewItem({
        itemId: body.itemId, decision: body.decision, receiptSha256: body.receiptSha256, actor: req.forgePrincipal?.subject ?? 'local-user',
      }));
      if (pathname === '/api/collaboration-experience/playback/rewind') return json(res, 200, decision.createPlaybackRewindPlan({ checkpointId: body.checkpointId }));
      if (pathname === '/api/collaboration-experience/steering') return json(res, 200, decision.issueMissionSteering({
        missionId: body.missionId, action: body.action, expectedRevision: body.expectedRevision, capabilities: body.capabilities ?? [], reason: body.reason, target: body.target ?? null, evidenceReceiptSha256: body.evidenceReceiptSha256, actor: req.forgePrincipal?.subject ?? 'local-user',
      }));
      return false;
    }
    if (pathname.startsWith('/api/security-certification/')) {
      const decision = missionResourceFabric?.decision;
      if (!decision) throw Object.assign(new Error('Security certification plane is not configured'), { statusCode: 503 });
      if (method === 'GET' && pathname === '/api/security-certification/snapshot') {
        return json(res, 200, decision.securityCertificationSnapshot() ?? decision.securityCertification.snapshot());
      }
      if (method !== 'POST') return false;
      const body = await readJson(req, 128 * 1024);
      if (pathname === '/api/security-certification/dependency/assess') return json(res, 200, decision.assessDependencySecurity({
        dependency: body.dependency, evidence: body.evidence, compatibility: body.compatibility,
      }));
      if (pathname === '/api/security-certification/boundary/authorize') {
        const roles = Array.isArray(req.forgePrincipal?.roles) ? req.forgePrincipal.roles.map(String) : [];
        const actor = { id: req.forgePrincipal?.subject ?? 'local-user', type: roles.some((role) => role === 'operator' || role === 'admin') ? 'human' : 'agent' };
        return json(res, 200, decision.authorizeProtectedSecurityBoundary({ paths: body.paths ?? [], actor, overrideReceipt: body.overrideReceipt ?? null }));
      }
      if (pathname === '/api/security-certification/benchmark/certify') return json(res, 200, decision.certifyBenchmarkComparison({
        suite: body.suite, runs: body.runs ?? [], contracts: body.contracts ?? [], attestation: body.attestation ?? null,
      }));
      return false;
    }
    if (method === 'GET' && pathname === '/api/runtime') {
      if (!runtimeStatus) throw Object.assign(new Error('Runtime status is not configured'), { statusCode: 503 });
      return json(res, 200, await runtimeStatus.snapshot());
    }
    if (method === 'GET' && pathname === '/api/forgeos/status') {
      if (!forgeBridge) throw Object.assign(new Error('ForgeOS bridge is not configured'), { statusCode: 503 });
      return json(res, 200, await forgeBridge.runtimeStatus());
    }
    if (method === 'GET' && pathname === '/api/forgeos/upstream') {
      if (!forgeBridge?.upstreamStatus) throw Object.assign(new Error('ForgeOS upstream verifier is not configured'), { statusCode: 503, code: 'FORGEOS_UPSTREAM_UNAVAILABLE' });
      return json(res, 200, await forgeBridge.upstreamStatus());
    }
    if (method === 'GET' && pathname === '/api/forgeos/lanes') {
      if (!forgeBridge) throw Object.assign(new Error('ForgeOS bridge is not configured'), { statusCode: 503 });
      return json(res, 200, await forgeBridge.listUniversalLanes());
    }
    if (method === 'GET' && pathname === '/api/forgeos/sandbox') {
      if (!forgeBridge) throw Object.assign(new Error('ForgeOS bridge is not configured'), { statusCode: 503 });
      return json(res, 200, await forgeBridge.probeRemoteSandbox());
    }
    if (method === 'POST' && pathname === '/api/projects') {
      const body = await readJson(req);
      return json(res, 201, await (projectService?.create?.({ name: body.name, workspaceRoot: body.workspaceRoot, metadata: body.metadata ?? {} }) ?? store.createProject({ name: body.name, workspaceRoot: body.workspaceRoot, metadata: body.metadata ?? {} })));
    }
    if (method === 'GET' && pathname === '/api/agent/runs') {
      if (!runCoordinator) throw Object.assign(new Error('Agent run coordinator is not configured'), { statusCode: 503 });
      const projectId = String(url.searchParams.get('projectId') ?? '').trim();
      if (!projectId) throw Object.assign(new Error('projectId is required'), { statusCode: 400 });
      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 30));
      const missions = store.listMissions({ projectId }).slice(-limit).reverse();
      return json(res, 200, missions.map((mission) => runCoordinator.snapshot(mission.id)));
    }
    if (method === 'POST' && pathname === '/api/agent/runs') {
      if (!runCoordinator) throw Object.assign(new Error('Agent run coordinator is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      if (workspaceTrust) await workspaceTrust.requireTrusted(body.projectId, 'background');
      return json(res, 201, runCoordinator.createRun({
        projectId: body.projectId,
        objective: body.objective,
        autonomyProfile: body.autonomyProfile,
        modeId: body.modeId,
        modeOverrides: body.modeOverrides,
        providerId: body.providerId ?? 'auto',
        budgets: body.budgets,
        maxTasks: body.maxTasks,
        mcpAllowedTools: body.mcpAllowedTools,
        forgeOsCapabilities: body.forgeOsCapabilities,
        remoteSandboxApproval: body.remoteSandboxApproval,
      }));
    }
    const runDetail = pathname.match(/^\/api\/agent\/runs\/([^/]+)$/);
    if (method === 'GET' && runDetail) {
      if (!runCoordinator) throw Object.assign(new Error('Agent run coordinator is not configured'), { statusCode: 503 });
      return json(res, 200, runCoordinator.snapshot(decodeURIComponent(runDetail[1])));
    }
    const runActivities = pathname.match(/^\/api\/agent\/runs\/([^/]+)\/activities$/);
    if (method === 'GET' && runActivities) {
      if (!runCoordinator) throw Object.assign(new Error('Agent run coordinator is not configured'), { statusCode: 503 });
      return json(res, 200, runCoordinator.snapshot(decodeURIComponent(runActivities[1])).activities);
    }
    const runReview = pathname.match(/^\/api\/agent\/runs\/([^/]+)\/review$/);
    if (method === 'GET' && runReview) {
      if (!runCoordinator) throw Object.assign(new Error('Agent run coordinator is not configured'), { statusCode: 503 });
      return json(res, 200, await runCoordinator.review(decodeURIComponent(runReview[1])));
    }
    const runDiffReviewDecision = pathname.match(/^\/api\/agent\/runs\/([^/]+)\/diff-review\/decisions$/);
    if (method === 'POST' && runDiffReviewDecision) {
      if (!diffReview) throw Object.assign(new Error('Diff review service is not configured'), { statusCode: 503 });
      const missionId = decodeURIComponent(runDiffReviewDecision[1]);
      const body = await readJson(req);
      const snapshot = await diffReview.snapshot(missionId);
      if (workspaceTrust) await workspaceTrust.requireTrusted(snapshot.projectId, 'background');
      return json(res, 200, await diffReview.decide({ ...body, missionId, principal: req.forgePrincipal }));
    }
    const runDiffReview = pathname.match(/^\/api\/agent\/runs\/([^/]+)\/diff-review$/);
    if (method === 'GET' && runDiffReview) {
      if (!diffReview) throw Object.assign(new Error('Diff review service is not configured'), { statusCode: 503 });
      return json(res, 200, await diffReview.snapshot(decodeURIComponent(runDiffReview[1])));
    }
    const runRollback = pathname.match(/^\/api\/agent\/runs\/([^/]+)\/rollback$/);
    if (method === 'POST' && runRollback) {
      if (!runCoordinator) throw Object.assign(new Error('Agent run coordinator is not configured'), { statusCode: 503 });
      return json(res, 200, await runCoordinator.rollback(decodeURIComponent(runRollback[1])));
    }
    const runMessages = pathname.match(/^\/api\/agent\/runs\/([^/]+)\/messages$/);
    if (method === 'POST' && runMessages) {
      if (!runCoordinator) throw Object.assign(new Error('Agent run coordinator is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      return json(res, 201, runCoordinator.sendMessage(decodeURIComponent(runMessages[1]), body.content));
    }
    const runAction = pathname.match(/^\/api\/agent\/runs\/([^/]+)\/(pause|resume|stop|retry)$/);
    if (method === 'POST' && runAction) {
      if (!runCoordinator) throw Object.assign(new Error('Agent run coordinator is not configured'), { statusCode: 503 });
      const missionId = decodeURIComponent(runAction[1]);
      const action = runAction[2];
      return json(res, 200, runCoordinator[action](missionId));
    }
    const autonomySettings = pathname.match(/^\/api\/projects\/([^/]+)\/autonomy$/);
    if (method === 'GET' && autonomySettings) {
      const projectId = decodeURIComponent(autonomySettings[1]);
      if (!store.getProject(projectId)) throw Object.assign(new Error('Unknown project'), { statusCode: 404 });
      return json(res, 200, store.getAutonomyGrant(projectId));
    }
    if (method === 'PUT' && autonomySettings) {
      const projectId = decodeURIComponent(autonomySettings[1]);
      if (!store.getProject(projectId)) throw Object.assign(new Error('Unknown project'), { statusCode: 404 });
      const body = await readJson(req);
      const profile = String(body.profile ?? '').trim();
      if (!Object.hasOwn(AUTONOMY_PROFILES, profile)) throw Object.assign(new Error('Unknown autonomy profile'), { statusCode: 400 });
      return json(res, 200, store.createAutonomyGrant({
        projectId,
        profile,
        actor: 'human:workspace-owner',
        scope: body.scope && typeof body.scope === 'object' ? body.scope : {},
      }));
    }
    if (method === 'GET' && pathname === '/api/workroom/tree') {
      if (!fileService) throw Object.assign(new Error('Workroom file service is not configured'), { statusCode: 503 });
      return json(res, 200, await fileService.tree({ projectId: String(url.searchParams.get('projectId') ?? ''), directory: String(url.searchParams.get('directory') ?? '.') }));
    }
    if (method === 'GET' && pathname === '/api/workroom/file') {
      if (!fileService) throw Object.assign(new Error('Workroom file service is not configured'), { statusCode: 503 });
      return json(res, 200, await fileService.read({ projectId: String(url.searchParams.get('projectId') ?? ''), file: String(url.searchParams.get('file') ?? '') }));
    }
    if (method === 'PUT' && pathname === '/api/workroom/file') {
      if (!fileService) throw Object.assign(new Error('Workroom file service is not configured'), { statusCode: 503 });
      const body = await readJson(req, 3_000_000);
      return json(res, 200, await fileService.write({ projectId: body.projectId, file: body.file, content: body.content, expectedSha256: body.expectedSha256 }));
    }
    if (method === 'POST' && pathname === '/api/workroom/diff') {
      if (!fileService) throw Object.assign(new Error('Workroom file service is not configured'), { statusCode: 503 });
      const body = await readJson(req, 3_000_000);
      return json(res, 200, await fileService.diff({ projectId: body.projectId, file: body.file, content: body.content }));
    }
    if (method === 'GET' && pathname === '/api/credentials') {
      if (!credentialVault) throw Object.assign(new Error('Credential vault is not configured'), { statusCode: 503 });
      return json(res, 200, await credentialVault.list({ service: url.searchParams.get('service') }));
    }
    if (method === 'POST' && pathname === '/api/credentials') {
      if (!credentialVault) throw Object.assign(new Error('Credential vault is not configured'), { statusCode: 503 });
      const body = await readJson(req, 64 * 1024);
      return json(res, 201, await credentialVault.set({ service: body.service, account: body.account, secret: body.secret }));
    }
    const credentialDelete = pathname.match(/^\/api\/credentials\/([^/]+)\/([^/]+)$/);
    if (method === 'DELETE' && credentialDelete) {
      if (!credentialVault) throw Object.assign(new Error('Credential vault is not configured'), { statusCode: 503 });
      const deleted = await credentialVault.delete({ service: decodeURIComponent(credentialDelete[1]), account: decodeURIComponent(credentialDelete[2]) });
      return json(res, 200, { deleted });
    }
    if (method === 'GET' && pathname === '/api/ui-assets') {
      if (!uiAssets) throw Object.assign(new Error('UI asset installer is not configured'), { statusCode: 503 });
      return json(res, 200, await uiAssets.status());
    }
    if (method === 'POST' && pathname === '/api/ui-assets/install') {
      if (!uiAssets) throw Object.assign(new Error('UI asset installer is not configured'), { statusCode: 503 });
      return json(res, 200, await uiAssets.install());
    }
    if (method === 'POST' && pathname === '/api/updates/check') {
      if (!updateService) throw Object.assign(new Error('Signed updater is not configured'), { statusCode: 503 });
      return json(res, 200, await updateService.check());
    }
    if (method === 'POST' && pathname === '/api/updates/stage') {
      if (!updateService) throw Object.assign(new Error('Signed updater is not configured'), { statusCode: 503 });
      const body = await readJson(req, 512 * 1024);
      return json(res, 200, await updateService.stage(body.manifest));
    }
    if (method === 'POST' && pathname === '/api/updates/prepare') {
      if (!updatePreparation) throw Object.assign(new Error('Update preparation is not configured'), { statusCode: 503 });
      const body = await readJson(req, 32 * 1024);
      return json(res, 200, await updatePreparation.prepare({ targetVersion: body.targetVersion }));
    }
    if (method === 'GET' && pathname === '/api/updates/preparation') {
      if (!updatePreparation) throw Object.assign(new Error('Update preparation is not configured'), { statusCode: 503 });
      return json(res, 200, await updatePreparation.status());
    }
    if (pathname === '/api/instruction-policy' || pathname === '/api/instruction-policy/refresh') {
      if (!instructionPolicy) throw Object.assign(new Error('Instruction policy is not configured'), { statusCode: 503 });
      if (method === 'GET' && pathname === '/api/instruction-policy') {
        const paths = url.searchParams.getAll('path').filter(Boolean);
        return json(res, 200, await instructionPolicy.resolve({ projectId: url.searchParams.get('projectId'), principalId: req.forgePrincipal?.subject, paths, language: url.searchParams.get('language') || null, taskType: url.searchParams.get('taskType') || null, refresh: false }));
      }
      if (method === 'POST' && pathname === '/api/instruction-policy/refresh') {
        const body = await readJson(req);
        instructionPolicy.clear?.(body.projectId ?? null);
        return json(res, 200, await instructionPolicy.resolve({ projectId: body.projectId, principalId: req.forgePrincipal?.subject, paths: Array.isArray(body.paths) ? body.paths : [], language: body.language ?? null, taskType: body.taskType ?? null, refresh: true }));
      }
      return false;
    }
    if (method === 'GET' && pathname === '/api/instructions') {
      if (!instructionDiscovery) throw Object.assign(new Error('Instruction discovery is not configured'), { statusCode: 503 });
      const project = store.getProject(String(url.searchParams.get('projectId') ?? ''));
      if (!project) throw Object.assign(new Error('Unknown project'), { statusCode: 404 });
      return json(res, 200, await instructionDiscovery.discover(project));
    }
    if (method === 'GET' && pathname === '/api/missions') return json(res, 200, store.listMissions({ projectId: url.searchParams.get('projectId'), status: url.searchParams.get('status') }));
    if (method === 'GET' && pathname === '/api/tasks') return json(res, 200, store.listTasks({ projectId: url.searchParams.get('projectId'), missionId: url.searchParams.get('missionId'), status: url.searchParams.get('status') }));
    if (method === 'GET' && pathname === '/api/evidence') return json(res, 200, store.listEvidence({ projectId: url.searchParams.get('projectId'), taskId: url.searchParams.get('taskId'), status: url.searchParams.get('status') }));
    if (method === 'GET' && pathname === '/api/events') return json(res, 200, store.listEvents({ afterSeq: Number(url.searchParams.get('after') ?? 0), limit: Number(url.searchParams.get('limit') ?? 1000) }));
    if (method === 'GET' && pathname === '/api/providers') return json(res, 200, providers.publicView());
    if (method === 'GET' && pathname === '/api/providers/detect') return json(res, 200, await providers.detectAll());
    if (method === 'POST' && pathname === '/api/providers/route') {
      if (!router) throw Object.assign(new Error('Adaptive provider router is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      const ranked = router.rank({ providerId: body.providerId ?? 'auto', requiredCapabilities: body.requiredCapabilities ?? ['coding', 'governed-actions'], localOnly: body.localOnly === true, maxCostTier: body.maxCostTier ?? Number.POSITIVE_INFINITY, prefer: body.prefer ?? [] });
      return json(res, 200, ranked.map((entry) => ({ provider: typeof entry.provider.publicView === 'function' ? entry.provider.publicView() : { id: entry.provider.id }, eligible: entry.eligible, reason: entry.reason, score: entry.score, profile: entry.profile })));
    }
    if (method === 'POST' && pathname === '/api/repository/index') {
      if (!repositoryIndex) throw Object.assign(new Error('Repository intelligence is not configured'), { statusCode: 503 });
      const body = await readJson(req); const project = store.getProject(String(body.projectId ?? ''));
      if (!project) throw Object.assign(new Error('Unknown project'), { statusCode: 404 });
      return json(res, 200, await repositoryIndex.index(project));
    }
    if (method === 'GET' && pathname === '/api/repository/search') {
      if (!repositoryIndex) throw Object.assign(new Error('Repository intelligence is not configured'), { statusCode: 503 });
      const projectId = String(url.searchParams.get('projectId') ?? ''); const query = String(url.searchParams.get('q') ?? '');
      const result = await repositoryIndex.search(projectId, query, { limit: Math.max(1, Math.min(200, Number(url.searchParams.get('limit')) || 20)) });
      return json(res, 200, Array.isArray(result) ? result : (result?.items ?? []));
    }
    if (method === 'GET' && pathname === '/api/repository/symbols') {
      if (!repositoryIndex) throw Object.assign(new Error('Repository intelligence is not configured'), { statusCode: 503 });
      return json(res, 200, repositoryIndex.symbols(String(url.searchParams.get('projectId') ?? ''), { path: url.searchParams.get('path'), query: url.searchParams.get('q'), limit: Number(url.searchParams.get('limit')) || 200 }));
    }
    if (method === 'GET' && pathname === '/api/git/snapshot') {
      if (!gitInspector) throw Object.assign(new Error('Git inspector is not configured'), { statusCode: 503 });
      return json(res, 200, await gitInspector.snapshot({ projectId: String(url.searchParams.get('projectId') ?? ''), taskId: url.searchParams.get('taskId') || null }));
    }
    if (method === 'GET' && pathname === '/api/mcp') return json(res, 200, mcpRegistry?.publicView?.() ?? []);
    if (method === 'GET' && pathname === '/api/mcp/tools') {
      if (!mcpRegistry) throw Object.assign(new Error('MCP registry is not configured'), { statusCode: 503 });
      return json(res, 200, await mcpRegistry.listTools());
    }
    if (method === 'GET' && pathname === '/api/memory') {
      if (!memoryService) throw Object.assign(new Error('Project memory is not configured'), { statusCode: 503 });
      const statuses = url.searchParams.getAll('status').flatMap((value) => value.split(',')).filter(Boolean);
      return json(res, 200, memoryService.list(String(url.searchParams.get('projectId') ?? ''), { statuses: statuses.length ? statuses : null, limit: Number(url.searchParams.get('limit')) || 200 }));
    }
    if (method === 'GET' && pathname === '/api/memory/search') {
      if (!memoryService) throw Object.assign(new Error('Project memory is not configured'), { statusCode: 503 });
      const statuses = url.searchParams.getAll('status').flatMap((value) => value.split(',')).filter(Boolean);
      return json(res, 200, memoryService.search(String(url.searchParams.get('projectId') ?? ''), String(url.searchParams.get('q') ?? ''), { statuses: statuses.length ? statuses : ['active'], limit: Number(url.searchParams.get('limit')) || 20 }));
    }
    if (method === 'POST' && pathname === '/api/memory') {
      if (!memoryService) throw Object.assign(new Error('Project memory is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      return json(res, 201, await memoryService.observe({ projectId: body.projectId, title: body.title, content: body.content, kind: body.kind, confidence: body.confidence, sourceTaskId: body.sourceTaskId, evidenceReceiptSha256: body.evidenceReceiptSha256, actor: body.actor ?? 'operator' }));
    }
    const memoryTransition = pathname.match(/^\/api\/memory\/([^/]+)\/transition$/);
    if (method === 'POST' && memoryTransition) {
      if (!memoryService) throw Object.assign(new Error('Project memory is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      return json(res, 200, await memoryService.transition(decodeURIComponent(memoryTransition[1]), body.status, { actor: body.actor ?? 'operator', evidenceReceiptSha256: body.evidenceReceiptSha256 }));
    }
    if (method === 'POST' && pathname === '/api/evals/run') {
      if (!evalRunner) throw Object.assign(new Error('Evaluation runner is not configured'), { statusCode: 503 });
      const body = await readJson(req, 2_000_000);
      return json(res, 200, await evalRunner.runSuite(body.suite, { providerIds: body.providerIds, timeoutMs: Number(body.timeoutMs) || 120_000 }));
    }
    if (method === 'POST' && pathname === '/api/web/fetch') {
      if (!webIntelligence) throw Object.assign(new Error('Web intelligence is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      return json(res, 200, await webIntelligence.fetch(String(body.url ?? ''), { maxBytes: Math.max(1, Math.min(5_000_000, Number(body.maxBytes) || 1_000_000)) }));
    }
    if (method === 'POST' && pathname === '/api/web/research') {
      if (!webIntelligence) throw Object.assign(new Error('Web intelligence is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      return json(res, 200, await webIntelligence.research({ query: String(body.query ?? ''), maxSources: Math.max(1, Math.min(12, Number(body.maxSources) || 5)), maxFetchBytes: Math.max(1, Math.min(2_000_000, Number(body.maxFetchBytes) || 500_000)) }));
    }
    if (method === 'POST' && pathname === '/api/missions/plan') {
      const body = await readJson(req);
      const projectId = String(body.projectId ?? '').trim();
      const objective = String(body.objective ?? '').trim();
      if (!projectId) throw Object.assign(new TypeError('Choose a project before sending a mission.'), { statusCode: 400, code: 'PROJECT_REQUIRED' });
      if (typeof store?.getProject === 'function' && !store.getProject(projectId)) throw Object.assign(new Error('The selected project is no longer available. Choose another project.'), { statusCode: 404, code: 'PROJECT_NOT_FOUND' });
      if (!objective) throw Object.assign(new TypeError('Enter a mission objective before sending.'), { statusCode: 400, code: 'OBJECTIVE_REQUIRED' });
      const requestedMcpTools = Array.isArray(body.mcpAllowedTools)
        ? [...new Set(body.mcpAllowedTools.map((item) => String(item).trim()).filter(Boolean))].slice(0, 128)
        : [];
      const planningProviderId = String(body.planningProviderId ?? 'auto').trim() || 'auto';
      const planningModelId = String(body.planningModelId ?? body.deployment?.modelId ?? '').trim() || null;
      const basePlanner = body.plan
        ? async () => body.plan
        : plannerService
          ? async (input) => plannerService.plan({ ...input, providerId: planningProviderId, ...(planningModelId ? { modelId: planningModelId } : {}) })
          : async (input) => defaultPlanner(input);
      const planner = async (input) => {
        const plan = await basePlanner(input);
        if (!requestedMcpTools.length) return plan;
        return {
          ...plan,
          tasks: plan.tasks.map((task) => ({
            ...task,
            metadata: { ...(task.metadata ?? {}), mcpAllowedTools: requestedMcpTools },
          })),
        };
      };
      const result = await missionRunner.plan({
        projectId,
        objective,
        planner,
        planningMetadata: { planningProviderId, ...(planningModelId ? { planningModelId } : {}) },
      });
      return json(res, 201, result);
    }
    const interruptTask = pathname.match(/^\/api\/tasks\/([^/]+)\/interrupt$/);
    if (method === 'POST' && interruptTask) {
      const body = await readJson(req);
      return json(res, 201, missionRunner.interruptTask({ taskId: decodeURIComponent(interruptTask[1]), kind: body.kind, prompt: body.prompt, expiresInMs: body.expiresInMs, idempotencyKey: body.idempotencyKey }));
    }
    const resumeInterrupt = pathname.match(/^\/api\/interrupts\/([^/]+)\/resume$/);
    if (method === 'POST' && resumeInterrupt) {
      const body = await readJson(req);
      return json(res, 200, missionRunner.resumeInterrupt({ interruptId: decodeURIComponent(resumeInterrupt[1]), resumeToken: body.resumeToken, response: body.response, idempotencyKey: body.idempotencyKey }));
    }
    const autoVerify = pathname.match(/^\/api\/tasks\/([^/]+)\/auto-verify$/);
    if (method === 'POST' && autoVerify) {
      if (!verificationRunner) throw Object.assign(new Error('Automatic verification is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      const taskId = decodeURIComponent(autoVerify[1]);
      const report = await verificationRunner.runTask(taskId);
      if (report.status !== 'pass') return json(res, 409, { report, error: 'verification-failed' });
      const verified = await missionRunner.verify({ taskId, workerId: String(body.workerId ?? ''), fencingToken: Number(body.fencingToken), evidence: report.evidence });
      return json(res, 200, { report, verified });
    }
    const verify = pathname.match(/^\/api\/tasks\/([^/]+)\/verify$/);
    if (method === 'POST' && verify) {
      const body = await readJson(req);
      return json(res, 200, await missionRunner.verify({ taskId: decodeURIComponent(verify[1]), workerId: String(body.workerId ?? ''), fencingToken: Number(body.fencingToken), evidence: body.evidence }));
    }
    const runToCompletion = pathname.match(/^\/api\/missions\/([^/]+)\/run-to-completion$/);
    if (method === 'POST' && runToCompletion) {
      if (!autopilot) throw Object.assign(new Error('Mission autopilot is not configured'), { statusCode: 503 });
      const body = await readJson(req);
      return json(res, 200, await autopilot.run({
        missionId: decodeURIComponent(runToCompletion[1]),
        providerId: body.providerId ?? 'auto',
        modelId: body.modelId ?? body.deployment?.modelId,
        workerId: body.workerId ?? 'autopilot',
        maxTasks: body.maxTasks,
        budgets: body.budgets,
      }));
    }
    const action = pathname.match(/^\/api\/missions\/([^/]+)\/(run-next|stop|resume)$/);
    if (method === 'POST' && action) {
      const missionId = decodeURIComponent(action[1]); const body = await readJson(req);
      if (action[2] === 'run-next') return json(res, 200, await missionRunner.runNext({ missionId, workerId: body.workerId ?? 'local-worker', providerId: body.providerId, modelId: body.modelId ?? body.deployment?.modelId, budgets: body.budgets }));
      if (action[2] === 'stop') return json(res, 200, missionRunner.stop(missionId, body.reason));
      return json(res, 200, missionRunner.resume(missionId));
    }
    return false;
  };
}

export { json };
