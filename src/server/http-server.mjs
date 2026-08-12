import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';

import { eventToSse } from '../protocol/events.mjs';
import { createRoutes, json } from './routes.mjs';
import { attachTerminalWebSocket } from './terminal-websocket.mjs';
import { localRequestToken } from './local-session-auth.mjs';
import { VERSION } from '../version.mjs';

const MIME = Object.freeze({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' });
const CSP = "default-src 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self'; script-src 'self'; worker-src 'self' blob:; connect-src 'self' ws:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
function sameSecret(actual, expected) { const a = Buffer.from(String(actual ?? '')); const b = Buffer.from(String(expected ?? '')); return a.length === b.length && timingSafeEqual(a, b); }

const FORBIDDEN_PATH_CODES = new Set(['PATH_ESCAPE', 'PATH_SYMLINK_ESCAPE', 'PATH_SCOPE_DENIED', 'PATH_DENIED']);
const BAD_INPUT_PATH_CODES = new Set(['INVALID_PATH', 'PATH_REQUIRED']);

export function classifyHttpError(error) {
  const statusCode = Number(error?.statusCode);
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599) {
    const body = { error: String(error?.message ?? 'request-failed') };
    if (error?.code) body.code = String(error.code);
    if (error?.current !== undefined) body.current = error.current;
    if (error?.readiness !== undefined) body.readiness = error.readiness;
    if (error?.details !== undefined) body.details = error.details;
    return Object.freeze({ status: statusCode, body: Object.freeze(body) });
  }
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? error ?? '');
  if (FORBIDDEN_PATH_CODES.has(code) || /(?:path|write).*?(?:escapes|outside|denied|symlink)/i.test(message)) {
    return Object.freeze({ status: 403, body: Object.freeze({ error: 'forbidden', code: code || 'PATH_BOUNDARY_DENIED' }) });
  }
  if (BAD_INPUT_PATH_CODES.has(code) || error instanceof TypeError || /absolute paths? (?:are|is) not allowed/i.test(message)) {
    return Object.freeze({ status: 400, body: Object.freeze({ error: 'bad-request', code: code || 'INVALID_INPUT' }) });
  }
  if (code === 'PLANNING_INPUT_REQUIRED' || error?.name === 'PlanningInputRequiredError') {
    return Object.freeze({ status: 422, body: Object.freeze({ error: 'Planning requires additional user input', code: 'PLANNING_INPUT_REQUIRED', inputRequest: error?.inputRequest ?? null, preflightReceiptSha256: error?.preflightReceiptSha256 ?? null }) });
  }
  if (code === 'RUNTIME_LEASE_ADMISSION_BLOCKED' || /admission blocked in (?:pressure|brownout|emergency) state/i.test(message)) {
    return Object.freeze({ status: 503, body: Object.freeze({ error: 'Runtime is temporarily conserving resources. Try again shortly.', code: 'RUNTIME_ADMISSION_BLOCKED', retryable: true }) });
  }
  if (/not inside a trusted directory|skip-git-repo-check/i.test(message)) {
    return Object.freeze({ status: 409, body: Object.freeze({ error: 'provider-workspace-trust-required', code: 'PROVIDER_WORKSPACE_TRUST_REQUIRED' }) });
  }
  if (/(?:provider|codex|claude|gemini|opencode).*?(?:exited with|timed out|cancelled)/i.test(message)) {
    return Object.freeze({ status: 502, body: Object.freeze({ error: 'provider-error', code: 'PROVIDER_EXECUTION_FAILED' }) });
  }
  return Object.freeze({ status: 500, body: Object.freeze({ error: 'internal-error' }) });
}

export async function createHttpServer({ config, store, providers, missionRunner, runCoordinator = null, projectService = null, webIntelligence = null, repositoryIndex = null, router = null, mcpRegistry = null, evalRunner = null, verificationRunner = null, plannerService = null, memoryService = null, gitInspector = null, autopilot = null, terminalManager = null, fileService = null, credentialVault = null, providerConnections = null, uiAssets = null, updateService = null, updatePreparation = null, instructionDiscovery = null, instructionPolicy = null, runtimeStatus = null, goalService = null, goalRunService = null, replanner = null, commandRegistry = null, browserService = null, browserRuntimeInstaller = null, browserPermissionService = null, pluginService = null, settingsService = null, personalizationProfile = null, onboardingService = null, sessionRestore = null, missionGraph = null, goalScheduler = null, forgeBridge = null, enterpriseCloudRoutes = null, operatingPlane = null, capabilityLedger = null, adaptiveIntelligence = null, environmentControl = null, nativeRuntime = null, nativeAgent = null, nativeOrchestration = null, sessionStore = null, smallModelFoundation = null, nativeCapabilities = null, operationalBoundary = null, dependencyPreflight = null, workspaceTrust = null, diffReview = null, operationsCenter = null, contextMemoryCenter = null, contextOrchestration = null, traceEvidenceCenter = null, repositoryDiscovery = null, codebaseKnowledge = null, semanticDependency = null, codeRelationships = null, localResourceSandbox = null, localTaskHandoff = null, gitGovernance = null, treeSitterRuntime = null, agentModes = null, missionStateProgress = null, localOperations = null, architectureStageGate = null, missionCompletion = null, localContainerPreflight = null, evidenceContextRuntime = null, missionResourceFabric = null, modelProfiles = null, modelManager = null, executionStory = null, timeTravel = null, sovereignKernel = null, uiSummary = null, eventHub = null, remoteMcpHttp = null, scimHttp = null, oidcHttp = null, requestAuthorizer = null, routeSecurityTelemetry = null, allowRemoteBinding = false, uiRoot, uiAssetsRoot = null } = {}) {
  const host = String(config?.host ?? '127.0.0.1');
  if (!['127.0.0.1', '::1', 'localhost'].includes(host) && allowRemoteBinding !== true) throw new Error('HTTP server must bind to loopback unless explicit remote binding is enabled');
  const localSessionCookieAllowed = ['127.0.0.1', '::1', 'localhost'].includes(host);
  const token = String(config?.authToken ?? randomBytes(32).toString('base64url'));
  const root = path.resolve(uiRoot);
  const assetsRoot = uiAssetsRoot ? path.resolve(uiAssetsRoot) : null;
  const route = createRoutes({ store, providers, missionRunner, runCoordinator, projectService, webIntelligence, repositoryIndex, router, mcpRegistry, evalRunner, verificationRunner, plannerService, memoryService, gitInspector, autopilot, fileService, credentialVault, providerConnections, uiAssets, updateService, updatePreparation, instructionDiscovery, instructionPolicy, runtimeStatus, goalService, goalRunService, replanner, commandRegistry, browserService, browserRuntimeInstaller, browserPermissionService, pluginService, settingsService, personalizationProfile, onboardingService, sessionRestore, missionGraph, goalScheduler, forgeBridge, enterpriseCloudRoutes, operatingPlane, capabilityLedger, adaptiveIntelligence, environmentControl, nativeRuntime, nativeAgent, nativeOrchestration, sessionStore, smallModelFoundation, nativeCapabilities, operationalBoundary, dependencyPreflight, workspaceTrust, diffReview, operationsCenter, contextMemoryCenter, contextOrchestration, traceEvidenceCenter, repositoryDiscovery, codebaseKnowledge, semanticDependency, codeRelationships, localResourceSandbox, localTaskHandoff, gitGovernance, treeSitterRuntime, agentModes, missionStateProgress, localOperations, architectureStageGate, missionCompletion, localContainerPreflight, evidenceContextRuntime, missionResourceFabric, modelProfiles, modelManager, executionStory, timeTravel, sovereignKernel, uiSummary });
  if (routeSecurityTelemetry !== null && typeof routeSecurityTelemetry?.start !== 'function') throw new TypeError('routeSecurityTelemetry must expose start()');
  const clients = new Set();
  const server = createServer(async (req, res) => {
    res.setHeader('content-security-policy', CSP);
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const routeTrace = routeSecurityTelemetry?.start({ method: req.method, pathname: url.pathname }) ?? null;
    try {
      if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { status: 'ok', version: VERSION }, { 'cache-control': 'no-store' });
      if (remoteMcpHttp && (url.pathname === '/mcp' || url.pathname === '/.well-known/oauth-protected-resource')) {
        const handled = await remoteMcpHttp.handle(req, res, url);
        if (handled) return;
      }
      if (scimHttp && url.pathname.startsWith('/scim/v2/')) {
        try { const handled = await scimHttp.handle(req, res, url); if (handled) return; } catch (error) { scimHttp.writeError(res, error); return; }
      }
      if (oidcHttp && (url.pathname.startsWith('/api/enterprise/sso/') || url.pathname === '/api/enterprise/session')) {
        const handled = await oidcHttp.handle(req, res, url);
        if (handled) return;
      }
      const localAuthorized = sameSecret(localRequestToken(req), token);
      const principal = localAuthorized
        ? Object.freeze({ subject: 'local-admin', organizationId: 'local', roles: Object.freeze(['owner']), groups: Object.freeze([]), kind: 'local-token' })
        : (oidcHttp?.authenticateRequest ? await oidcHttp.authenticateRequest(req) : null);
      req.forgePrincipal = principal;
      const protectedPath = url.pathname.startsWith('/api/') || url.pathname === '/events';
      if (protectedPath) routeTrace?.record('authentication', principal ? 'allow' : 'deny', { statusCode: principal ? 200 : 401 });
      if (protectedPath && !principal) return json(res, 401, { error: 'unauthorized' });
      if (protectedPath && typeof requestAuthorizer === 'function') {
        const decision = await requestAuthorizer({ req, url, principal });
        const allowed = decision === true || decision?.decision === 'allow';
        routeTrace?.record('organization-authorization', allowed ? 'allow' : 'deny', { statusCode: allowed ? 200 : 403, code: allowed ? null : decision?.code ?? 'request-denied' });
        if (!allowed) return json(res, 403, { error: 'forbidden', code: decision?.code ?? 'request-denied' });
      } else if (protectedPath) routeTrace?.record('organization-authorization', 'allow', { statusCode: 200, code: 'local-policy' });
      if (req.method === 'POST' && url.pathname === '/api/local-session/bootstrap') {
        if (!localAuthorized) return json(res, 403, { error: 'local-session-bootstrap-requires-local-token' });
        if (!localSessionCookieAllowed) return json(res, 403, { error: 'local-session-bootstrap-loopback-only' });
        return json(res, 200, { authenticated: true, transport: 'local-session-cookie' }, {
          'cache-control': 'no-store',
          'set-cookie': `nolane_local_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/`,
        });
      }
      if (req.method === 'GET' && url.pathname === '/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' });
        res.flushHeaders?.();
        let cursor = Number(url.searchParams.get('after') ?? req.headers['last-event-id'] ?? 0) || 0;
        let replaying = true; const pending = [];
        const writeEvent = (event) => { if (Number(event.seq) <= cursor) return; cursor = Number(event.seq); res.write(eventToSse(event, event.seq)); };
        const unsubscribe = eventHub?.subscribe?.((event) => { if (replaying) pending.push(event); else writeEvent(event); }) ?? (() => {});
        const reconcile = () => { for (const event of store.listEvents({ afterSeq: cursor, limit: 500 })) writeEvent(event); };
        reconcile(); replaying = false; for (const event of pending.sort((a, b) => a.seq - b.seq)) writeEvent(event);
        const reconcileTimer = setInterval(reconcile, 5_000); reconcileTimer.unref?.();
        const heartbeatTimer = setInterval(() => res.write(': heartbeat\n\n'), 15_000); heartbeatTimer.unref?.();
        const client = { res, reconcileTimer, heartbeatTimer, unsubscribe }; clients.add(client);
        req.once('close', () => { clearInterval(reconcileTimer); clearInterval(heartbeatTimer); unsubscribe(); clients.delete(client); });
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        const handled = await route(req, res, url);
        if (handled !== false) { routeTrace?.record('route-handler', 'pass', { statusCode: res.statusCode || 200 }); return; }
        routeTrace?.record('route-handler', 'not-found', { statusCode: 404 });
        return json(res, 404, { error: 'not-found' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method-not-allowed' });
      let decoded;
      try { decoded = decodeURIComponent(url.pathname); } catch { return json(res, 400, { error: 'bad-path' }); }
      if (decoded.includes('\0') || decoded.split('/').includes('..')) return json(res, 400, { error: 'bad-path' });
      const vendorRequest = decoded.startsWith('/vendor-assets/');
      const servingRoot = vendorRequest ? assetsRoot : root;
      if (!servingRoot) return json(res, 404, { error: 'not-found' });
      const relative = vendorRequest ? decoded.slice('/vendor-assets/'.length) : (decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, ''));
      const file = path.resolve(servingRoot, relative); const rel = path.relative(servingRoot, file);
      if (rel.startsWith('..') || path.isAbsolute(rel)) return json(res, 400, { error: 'bad-path' });
      let info; try { info = await stat(file); } catch { return json(res, 404, { error: 'not-found' }); }
      if (!info.isFile()) return json(res, 404, { error: 'not-found' });
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'content-length': body.length, 'cache-control': path.basename(file) === 'index.html' ? 'no-store' : 'public, max-age=3600' });
      if (req.method === 'HEAD') res.end(); else res.end(body);
    } catch (error) {
      if (res.headersSent) { res.destroy(error); return; }
      const classified = classifyHttpError(error);
      if (url.pathname.startsWith('/api/')) routeTrace?.record('route-handler', 'error', { statusCode: classified.status, code: classified.body.code ?? null });
      json(res, classified.status, classified.body);
    }
  });
  const terminalSocket = attachTerminalWebSocket({ server, token, terminalManager, maxFrameBytes: config?.performance?.maxTerminalFrameBytes ?? 1024 * 1024, maxQueueBytes: config?.performance?.maxTerminalQueueBytes ?? 2 * 1024 * 1024 });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(config?.port ?? 0), host, resolve); });
  const address = server.address(); const url = `http://${host === '::1' ? '[::1]' : host}:${address.port}`;
  return Object.freeze({
    server, url, token,
    close: async () => { terminalSocket.close(); for (const client of clients) { clearInterval(client.reconcileTimer); clearInterval(client.heartbeatTimer); client.unsubscribe?.(); client.res.end(); } clients.clear(); await new Promise((resolve) => server.close(resolve)); },
  });
}
