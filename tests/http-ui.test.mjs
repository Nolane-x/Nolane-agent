import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

import { createHttpServer } from '../src/server/http-server.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { createEvent } from '../src/protocol/events.mjs';

async function fixture(t, { host = '127.0.0.1', allowRemoteBinding = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-http-'));
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const providers = new ProviderRegistry();
  providers.register({ id: 'fake', publicView: () => ({ id: 'fake', kind: 'test' }), detect: async () => ({ id: 'fake', kind: 'test', available: true }) });
  const calls = [];
  const projectService = { create(input) { calls.push(['createProject', input.name]); return store.createProject(input); } };
  const missionRunner = {
    async plan({ projectId, objective, planner }) { const planned = await planner({ projectId, objective }); calls.push(['plan', projectId, objective, planned.summary]); const mission = store.createMission({ projectId, objective, status: 'running' }); return { ...mission, tasks: planned.tasks ?? [] }; },
    async runNext(input) { calls.push(['runNext', input.missionId]); return { task: { id: 'task-1', status: 'review' }, result: { state: 'awaiting-verification' } }; },
    stop(id, reason) { calls.push(['stop', id, reason]); return store.updateMission(id, { status: 'stopped' }); },
    resume(id) { calls.push(['resume', id]); return store.updateMission(id, { status: 'running' }); },
    async verify(input) { calls.push(['verify', input.taskId]); return { task: { id: input.taskId, status: 'done' }, evidence: input.evidence }; },
  };
  const webIntelligence = {
    async fetch(url) { calls.push(['webFetch', url]); return { canonicalUrl: url, title: 'Fetched', text: 'Evidence', contentSha256: 'a'.repeat(64) }; },
    async research(input) { calls.push(['webResearch', input.query]); return { query: input.query, sources: [], citations: [], omissions: [], evidenceSha256: 'b'.repeat(64) }; },
  };
  missionRunner.interruptTask = (input) => { calls.push(['interrupt', input.taskId]); return { id: 'interrupt-1', taskId: input.taskId, status: 'pending', resumeToken: 'resume-token' }; };
  missionRunner.resumeInterrupt = (input) => { calls.push(['resumeInterrupt', input.interruptId]); return { interrupt: { id: input.interruptId, status: 'resumed' }, task: { id: 'task-1', status: 'ready' } }; };
  const repositoryIndex = {
    async index(project) { calls.push(['repoIndex', project.id]); return { projectId: project.id, indexed: 2, reused: 1 }; },
    search(projectId, query) { calls.push(['repoSearch', projectId, query]); return [{ path: 'src/a.mjs', score: 10 }]; },
    symbols(projectId) { return [{ path: 'src/a.mjs', name: 'a', projectId }]; },
  };
  const router = { rank(input) { calls.push(['routeProvider', input.requiredCapabilities?.join(',')]); return [{ provider: providers.get('fake'), eligible: true, reason: 'eligible', score: 10 }]; } };
  const mcpRegistry = { publicView: () => [{ id: 'docs', state: 'idle' }], async listTools() { calls.push(['mcpTools']); return [{ name: 'docs__search', description: 'Search docs', inputSchema: { type: 'object' } }]; } };
  const evalRunner = { async runSuite(suite, options) { calls.push(['eval', suite.id, options.providerIds[0]]); return { suiteId: suite.id, reportSha256: 'e'.repeat(64), providers: { fake: { passRate: 1 } }, cases: [] }; } };
  const verificationRunner = { async runTask(taskId) { calls.push(['autoVerify', taskId]); return { taskId, status: 'pass', evidence: [{ kind: 'diff-check', status: 'pass', commit: 'abc', artifactSha256: 'a'.repeat(64), receiptSha256: 'b'.repeat(64) }] }; } };
  const autopilot = { async run(input) { calls.push(['autopilot', input.missionId, input.providerId, input.modelId ?? null, input.maxTasks]); return { missionId: input.missionId, status: 'completed', completedTasks: 3, reports: [] }; } };
  const plannerService = { async plan(input) { calls.push(['intelligentPlan', input.providerId, input.modelId ?? null]); return { summary: 'AI plan', tasks: [{ id: 'review', title: 'Review', objective: input.objective, role: 'reviewer', dependencies: [], allowedPaths: ['**'], deniedPaths: ['.env'] }] }; } };
  const gitInspector = {
    async snapshot(input) {
      const projectId = String(input.projectId ?? '').trim();
      if (!projectId) throw Object.assign(new TypeError('projectId is required'), { statusCode: 400, code: 'PROJECT_ID_REQUIRED' });
      if (!store.getProject(projectId)) throw Object.assign(new Error(`Unknown project: ${projectId}`), { statusCode: 404, code: 'PROJECT_NOT_FOUND' });
      calls.push(['gitSnapshot', projectId, input.taskId]);
      return { schema: 'forge.git.snapshot.v1', projectId, taskId: input.taskId ?? null, head: 'a'.repeat(40), branch: 'feature', dirty: true, status: [{ code: ' M', path: 'src/a.mjs' }], diffStat: '1 file changed', diff: '+change', receipts: [], snapshotSha256: 'f'.repeat(64) };
    },
  };
  const browserPermissionService = {
    allowedActions: ['open', 'snapshot'],
    inspect({ goalId } = {}) {
      const id = String(goalId ?? '').trim();
      if (!id) throw Object.assign(new TypeError('goalId is required'), { statusCode: 400, code: 'GOAL_ID_REQUIRED' });
      if (id !== 'goal-1') throw Object.assign(new Error(`Unknown goal: ${id}`), { statusCode: 404, code: 'GOAL_NOT_FOUND' });
      calls.push(['browserPermissionInspect', id]);
      return { goalId: id, allowedActions: [...browserPermissionService.allowedActions] };
    },
  };
  const browserService = {};
  for (const action of ['detect', 'open', 'goto', 'snapshot', 'find', 'click', 'fill', 'type', 'press', 'tabs', 'screenshot', 'artifact', 'close', 'status']) {
    browserService[action] = async (input = {}) => { calls.push(['browser', action, input]); return { action, input, untrusted: true }; };
  }
  const terminalManager = new EventEmitter();
  terminalManager.create = async (input) => { calls.push(['terminalCreate', input.projectId]); setTimeout(() => terminalManager.emit('output', { sessionId: 'term-1', data: 'ready\r\n', cursor: 7 }), 0); return { id: 'term-1', state: 'running', cols: input.cols, rows: input.rows }; };
  terminalManager.input = async (sessionId, data) => { calls.push(['terminalInput', sessionId, data]); return { ok: true }; };
  terminalManager.resize = async (sessionId, cols, rows) => { calls.push(['terminalResize', sessionId, cols, rows]); return { ok: true }; };
  terminalManager.snapshot = async (sessionId, afterCursor) => ({ sessionId, afterCursor, data: 'ready\r\n', cursor: 7 });
  terminalManager.terminate = async (sessionId) => { calls.push(['terminalTerminate', sessionId]); return { ok: true }; };
  terminalManager.list = async () => [{ id: 'term-1', state: 'running' }];

  const fileService = {
    async tree(input) { calls.push(['fileTree', input.projectId, input.directory]); return { projectId: input.projectId, directory: input.directory, entries: [{ name: 'a.mjs', path: 'src/a.mjs', type: 'file', bytes: 4 }] }; },
    async read(input) { calls.push(['fileRead', input.projectId, input.file]); return { projectId: input.projectId, path: input.file, content: 'code', sha256: 'c'.repeat(64), bytes: 4 }; },
    async write(input) { calls.push(['fileWrite', input.projectId, input.file]); return { ok: true, receipt: { sha256: 'd'.repeat(64) } }; },
    async diff(input) { calls.push(['fileDiff', input.projectId, input.file]); return { path: input.file, original: 'code', modified: input.content, changed: true }; },
  };
  const credentialVault = {
    async list() { calls.push(['credentialList']); return [{ service: 'openai', account: 'default', present: true }]; },
    async set(input) { calls.push(['credentialSet', input.service, input.account]); return { service: input.service, account: input.account, present: true }; },
    async delete(input) { calls.push(['credentialDelete', input.service, input.account]); return true; },
  };
  const uiAssets = {
    async status() { calls.push(['assetsStatus']); return { ready: true, version: 1 }; },
    async install() { calls.push(['assetsInstall']); return { ready: true, installed: true }; },
  };
  const updateService = {
    async check() { calls.push(['updateCheck']); return { available: true, manifest: { version: '0.3.1' } }; },
    async stage(manifest) { calls.push(['updateStage', manifest.version]); return { version: manifest.version, staged: true }; },
  };
  const updatePreparation = {
    async prepare(input) { calls.push(['updatePrepare', input.targetVersion]); return { prepared: true, targetVersion: input.targetVersion, snapshotReceiptSha256: 'f'.repeat(64) }; },
  };
  const runCoordinator = {
    createRun(input) { calls.push(['runCreate', input]); return { mission: { id: 'mission-forge', status: 'planning', metadata: input } }; },
    async review(id) { calls.push(['runReview', id]); return { missionId: id, status: 'completed', changes: [], verification: { status: 'pass', passed: 2, total: 2, checks: ['Tests passed'] }, canRollback: true }; },
    async rollback(id) { calls.push(['runRollback', id]); return { mission: { id, status: 'rolled-back' }, review: { missionId: id, canRollback: false }, rollback: { removedWorktrees: 1 } }; },
  };
  const runtimeStatus = { async snapshot() { calls.push(['runtimeStatus']); return { version: '0.6.0', allowedShells: ['/bin/sh'], resources: { state: 'normal' } }; } };
  const forgeBridge = {
    runtimeStatus() { calls.push(['forgeStatus']); return { version: '0.6.1', techniques: 128, universalLanes: 12 }; },
    upstreamStatus() { calls.push(['forgeUpstream']); return { schema: 'nolane.forgeos.upstream-verification.v1', status: 'blocked', claims: { localManifestVerified: true, remoteFreshnessVerified: false, externallyCertified: false }, blockers: ['dirty snapshot'] }; },
    listUniversalLanes() { calls.push(['forgeLanes']); return [{ id: 'software-engineering', title: 'Software engineering' }, { id: 'physical-ai', title: 'Physical AI' }]; },
    async probeRemoteSandbox() { calls.push(['forgeSandbox']); return { available: false, mode: 'not-configured' }; },
  };
  const instructionDiscovery = {
    async discover(project) { calls.push(['instructionDiscover', project.id]); return { projectId: project.id, instructions: [{ path: 'AGENTS.md', content: 'Use tests.' }], workflows: [] }; },
  };
  const memoryService = {
    list(projectId, options) { calls.push(['memoryList', projectId, options.statuses?.join(',')]); return [{ id: 'memory-1', projectId, status: 'observed', title: 'Lesson' }]; },
    search(projectId, q, options) { calls.push(['memorySearch', projectId, q, options.statuses.join(',')]); return [{ id: 'memory-1', projectId, status: options.statuses[0], title: 'Lesson' }]; },
    async observe(input) { calls.push(['memoryObserve', input.projectId]); return { id: 'memory-2', ...input, status: 'observed' }; },
    async transition(id, status, input) { calls.push(['memoryTransition', id, status, input.actor]); return { id, status, actor: input.actor }; },
  };
  await mkdir(path.join(root, 'xterm'), { recursive: true }); await writeFile(path.join(root, 'xterm', 'probe.mjs'), 'export const probe = true;');
  const service = await createHttpServer({
    config: { host, port: 0, authToken: 'test-token' }, store, providers, missionRunner, runCoordinator, projectService, webIntelligence,
    repositoryIndex, router, mcpRegistry, evalRunner, verificationRunner, plannerService, memoryService, gitInspector, browserService, browserPermissionService, autopilot, terminalManager, fileService, credentialVault, uiAssets, updateService, updatePreparation, instructionDiscovery, runtimeStatus, forgeBridge, uiRoot: path.resolve('ui'), uiAssetsRoot: root,
    allowRemoteBinding,
  });
  t.after(() => service.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  return { ...service, store, calls, root, browserPermissionService };
}

function auth(init = {}) { return { ...init, headers: { authorization: 'Bearer test-token', 'content-type': 'application/json', ...(init.headers ?? {}) } }; }

test('HTTP server binds loopback, requires auth, sets CSP, and rejects traversal', async (t) => {
  const f = await fixture(t);
  assert.match(f.url, /^http:\/\/127\.0\.0\.1:/);
  const health = await fetch(`${f.url}/health`); assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');
  const unauthorized = await fetch(`${f.url}/api/projects`); assert.equal(unauthorized.status, 401);
  const ui = await fetch(`${f.url}/`); assert.equal(ui.status, 200);
  assert.match(ui.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(await ui.text(), /Nolane Agent/);
  const traversal = await fetch(`${f.url}/..%2Fpackage.json`); assert.ok([400, 404].includes(traversal.status));
  const tokenInQuery = await fetch(`${f.url}/api/projects?token=test-token`); assert.equal(tokenInQuery.status, 401);
  const moduleAsset = await fetch(`${f.url}/vendor-assets/xterm/probe.mjs`); assert.equal(moduleAsset.status, 200); assert.match(moduleAsset.headers.get('content-type'), /text\/javascript/);
});

test('local session bootstrap exchanges an authorization header for an HttpOnly same-site cookie', async (t) => {
  const f = await fixture(t);
  const bootstrap = await fetch(`${f.url}/api/local-session/bootstrap`, auth({ method: 'POST', body: '{}' }));
  assert.equal(bootstrap.status, 200);
  assert.deepEqual(await bootstrap.json(), { authenticated: true, transport: 'local-session-cookie' });
  const setCookie = bootstrap.headers.get('set-cookie');
  assert.match(setCookie, /^nolane_local_session=test-token;/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  const session = await fetch(`${f.url}/api/projects`, { headers: { cookie: setCookie.split(';')[0] } });
  assert.equal(session.status, 200);
});

test('local session bootstrap refuses an explicitly remote-bound runtime', async (t) => {
  const f = await fixture(t, { host: '0.0.0.0', allowRemoteBinding: true });
  const localUrl = f.url.replace('0.0.0.0', '127.0.0.1');
  const bootstrap = await fetch(`${localUrl}/api/local-session/bootstrap`, auth({ method: 'POST', body: '{}' }));
  assert.equal(bootstrap.status, 403);
  assert.equal((await bootstrap.json()).error, 'local-session-bootstrap-loopback-only');
});

test('project, task, provider, and mission endpoints execute real handlers', async (t) => {
  const f = await fixture(t);
  const missingFolder = await fetch(`${f.url}/api/projects`, auth({ method: 'POST', body: JSON.stringify({ name: 'Missing', workspaceRoot: path.join(f.root, 'does-not-exist') }) }));
  assert.equal(missingFolder.status, 400);
  const createdResponse = await fetch(`${f.url}/api/projects`, auth({ method: 'POST', body: JSON.stringify({ name: 'Demo', workspaceRoot: f.root }) }));
  assert.equal(createdResponse.status, 201);
  const project = await createdResponse.json();
  assert.equal(project.name, 'Demo');
  const projects = await (await fetch(`${f.url}/api/projects`, auth())).json();
  assert.equal(projects.length, 1);
  const missingProject = await fetch(`${f.url}/api/missions/plan`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'missing', objective: 'Build it' }) }));
  assert.equal(missingProject.status, 404);
  assert.deepEqual(await missingProject.json(), { error: 'The selected project is no longer available. Choose another project.', code: 'PROJECT_NOT_FOUND' });
  const missingSelection = await fetch(`${f.url}/api/missions/plan`, auth({ method: 'POST', body: JSON.stringify({ objective: 'Build it' }) }));
  assert.equal(missingSelection.status, 400);
  assert.deepEqual(await missingSelection.json(), { error: 'Choose a project before sending a mission.', code: 'PROJECT_REQUIRED' });
  const providers = await (await fetch(`${f.url}/api/providers/detect`, auth())).json();
  assert.equal(providers[0].available, true);
  const missionResponse = await fetch(`${f.url}/api/missions/plan`, auth({ method: 'POST', body: JSON.stringify({ projectId: project.id, objective: 'Build it' }) }));
  const mission = await missionResponse.json(); assert.equal(mission.status, 'running');
  await fetch(`${f.url}/api/missions/${mission.id}/run-next`, auth({ method: 'POST', body: JSON.stringify({ providerId: 'fake', workerId: 'worker-1' }) }));
  await fetch(`${f.url}/api/missions/${mission.id}/stop`, auth({ method: 'POST', body: JSON.stringify({ reason: 'test' }) }));
  await fetch(`${f.url}/api/missions/${mission.id}/resume`, auth({ method: 'POST', body: '{}' }));
  const verify = await fetch(`${f.url}/api/tasks/task-1/verify`, auth({ method: 'POST', body: JSON.stringify({ workerId: 'worker-1', fencingToken: 1, evidence: [{ status: 'pass' }] }) }));
  assert.equal(verify.status, 200);
  const fetched = await fetch(`${f.url}/api/web/fetch`, auth({ method: 'POST', body: JSON.stringify({ url: 'https://example.test/page' }) }));
  assert.equal((await fetched.json()).title, 'Fetched');
  const researched = await fetch(`${f.url}/api/web/research`, auth({ method: 'POST', body: JSON.stringify({ query: 'agent evidence', maxSources: 3 }) }));
  assert.equal((await researched.json()).query, 'agent evidence');
  assert.deepEqual(f.calls.map((item) => item[0]), ['createProject', 'intelligentPlan', 'plan', 'runNext', 'stop', 'resume', 'verify', 'webFetch', 'webResearch']);
});

test('SSE replays durable events and UI contains only wired action controls', async (t) => {
  const f = await fixture(t);
  f.store.appendEvent(createEvent('test.event', { value: 7 }));
  const controller = new AbortController();
  const response = await fetch(`${f.url}/events?after=0`, { headers: { authorization: 'Bearer test-token' }, signal: controller.signal });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  let text = '';
  while (!text.includes('test.event')) { const chunk = await reader.read(); text += new TextDecoder().decode(chunk.value ?? new Uint8Array()); }
  controller.abort();
  assert.match(text, /event: test\.event/);
  assert.match(text, /"value":7/);

  const appJs = await (await fetch(`${f.url}/app.js`)).text();
  const workroomJs = await (await fetch(`${f.url}/workroom.js`)).text();
  for (const endpoint of ['/api/workroom/tree', '/api/workroom/file', '/api/credentials', '/api/ui-assets', '/api/updates/check', '/api/instructions', '/api/runtime']) assert.match(workroomJs, new RegExp(endpoint.replace('/', '\\/')));
  assert.doesNotMatch(workroomJs, /TODO|coming soon|fake button/i);
  for (const endpoint of ['/api/projects', '/api/agent/runs', '/messages', '/pause', '/resume', '/stop', '/retry', '/autonomy']) assert.match(appJs, new RegExp(endpoint.replace('/', '\\/')));
  assert.match(appJs, /import\(['"]\.\/workroom\.js['"]\)/);
  assert.doesNotMatch(appJs, /^import .*workroom\.js/m);
  assert.doesNotMatch(appJs, /TODO|fake button|coming soon|Commit hash đã kiểm chứng|SHA-256 artifact/i);
});


test('repository, routing, MCP, interrupt, and evaluation endpoints are wired to real services', async (t) => {
  const f = await fixture(t);
  const project = await (await fetch(`${f.url}/api/projects`, auth({ method: 'POST', body: JSON.stringify({ name: 'Intel', workspaceRoot: f.root }) }))).json();
  const indexed = await (await fetch(`${f.url}/api/repository/index`, auth({ method: 'POST', body: JSON.stringify({ projectId: project.id }) }))).json();
  assert.equal(indexed.indexed, 2);
  const searched = await (await fetch(`${f.url}/api/repository/search?projectId=${project.id}&q=router`, auth())).json();
  assert.equal(searched[0].path, 'src/a.mjs');
  const routed = await (await fetch(`${f.url}/api/providers/route`, auth({ method: 'POST', body: JSON.stringify({ requiredCapabilities: ['coding'] }) }))).json();
  assert.equal(routed[0].provider.id, 'fake');
  const tools = await (await fetch(`${f.url}/api/mcp/tools`, auth())).json();
  assert.equal(tools[0].name, 'docs__search');
  const paused = await (await fetch(`${f.url}/api/tasks/task-1/interrupt`, auth({ method: 'POST', body: JSON.stringify({ prompt: { question: 'Continue?' }, idempotencyKey: 'pause-http' }) }))).json();
  assert.equal(paused.status, 'pending');
  const resumed = await (await fetch(`${f.url}/api/interrupts/interrupt-1/resume`, auth({ method: 'POST', body: JSON.stringify({ resumeToken: 'resume-token', response: { answer: 'yes' }, idempotencyKey: 'resume-http' }) }))).json();
  assert.equal(resumed.task.status, 'ready');
  const report = await (await fetch(`${f.url}/api/evals/run`, auth({ method: 'POST', body: JSON.stringify({ suite: { id: 'api-suite', cases: [{ id: 'c' }] }, providerIds: ['fake'] }) }))).json();
  assert.equal(report.providers.fake.passRate, 1);
});


test('automatic verification endpoint runs checks and passes generated evidence to the mission gate', async (t) => {
  const f = await fixture(t);
  const response = await fetch(`${f.url}/api/tasks/task-1/auto-verify`, auth({ method: 'POST', body: JSON.stringify({ workerId: 'worker-1', fencingToken: 7 }) }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.report.status, 'pass');
  assert.equal(body.verified.task.status, 'done');
  assert.deepEqual(f.calls.slice(-2).map((item) => item[0]), ['autoVerify', 'verify']);
});


test('mission planning uses the intelligent planner with explicit provider routing', async (t) => {
  const f = await fixture(t);
  const project = await (await fetch(`${f.url}/api/projects`, auth({ method: 'POST', body: JSON.stringify({ name: 'Plan', workspaceRoot: f.root }) }))).json();
  const response = await fetch(`${f.url}/api/missions/plan`, auth({ method: 'POST', body: JSON.stringify({ projectId: project.id, objective: 'Refactor router', planningProviderId: 'fake', planningModelId: 'fake-model-v2', mcpAllowedTools: ['docs__search'] }) }));
  assert.equal(response.status, 201);
  const mission = await response.json();
  assert.equal(mission.tasks[0].role, 'reviewer');
  assert.deepEqual(mission.tasks[0].metadata.mcpAllowedTools, ['docs__search']);
  assert.deepEqual(f.calls.filter((item) => item[0] === 'intelligentPlan')[0], ['intelligentPlan', 'fake', 'fake-model-v2']);
});


test('memory endpoints expose quarantined observations and evidence-backed promotion', async (t) => {
  const f = await fixture(t);
  const project = await (await fetch(`${f.url}/api/projects`, auth({ method: 'POST', body: JSON.stringify({ name: 'Memory', workspaceRoot: f.root }) }))).json();
  const observed = await (await fetch(`${f.url}/api/memory`, auth({ method: 'POST', body: JSON.stringify({ projectId: project.id, title: 'Rule', content: 'Use receipts.' }) }))).json();
  assert.equal(observed.status, 'observed');
  const listed = await (await fetch(`${f.url}/api/memory?projectId=${project.id}&status=observed`, auth())).json();
  assert.equal(listed[0].id, 'memory-1');
  const searched = await (await fetch(`${f.url}/api/memory/search?projectId=${project.id}&q=receipts&status=active`, auth())).json();
  assert.equal(searched[0].status, 'active');
  const promoted = await (await fetch(`${f.url}/api/memory/memory-1/transition`, auth({ method: 'POST', body: JSON.stringify({ status: 'candidate', actor: 'operator' }) }))).json();
  assert.equal(promoted.status, 'candidate');
  assert.deepEqual(f.calls.slice(-4).map((item) => item[0]), ['memoryObserve', 'memoryList', 'memorySearch', 'memoryTransition']);
});


test('Git snapshot endpoint returns a governed repository diff snapshot', async (t) => {
  const f = await fixture(t);
  const project = await (await fetch(`${f.url}/api/projects`, auth({ method: 'POST', body: JSON.stringify({ name: 'Git', workspaceRoot: f.root }) }))).json();
  const response = await fetch(`${f.url}/api/git/snapshot?projectId=${encodeURIComponent(project.id)}&taskId=task-1`, auth());
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.equal(snapshot.dirty, true);
  assert.equal(snapshot.status[0].path, 'src/a.mjs');
  assert.deepEqual(f.calls.at(-1), ['gitSnapshot', project.id, 'task-1']);
});



test('parameterized GET routes return explicit client errors instead of internal failures', async (t) => {
  const f = await fixture(t);

  const missingProject = await fetch(`${f.url}/api/git/snapshot`, auth());
  assert.equal(missingProject.status, 400);
  assert.equal((await missingProject.json()).code, 'PROJECT_ID_REQUIRED');

  const unknownProject = await fetch(`${f.url}/api/git/snapshot?projectId=missing-project`, auth());
  assert.equal(unknownProject.status, 404);
  assert.equal((await unknownProject.json()).code, 'PROJECT_NOT_FOUND');

  const missingGoal = await fetch(`${f.url}/api/permissions/browser`, auth());
  assert.equal(missingGoal.status, 400);
  assert.equal((await missingGoal.json()).code, 'GOAL_ID_REQUIRED');

  const unknownGoal = await fetch(`${f.url}/api/permissions/browser?goalId=missing-goal`, auth());
  assert.equal(unknownGoal.status, 404);
  assert.equal((await unknownGoal.json()).code, 'GOAL_NOT_FOUND');

  const permission = await fetch(`${f.url}/api/permissions/browser?goalId=goal-1`, auth());
  assert.equal(permission.status, 200);
  assert.equal((await permission.json()).goalId, 'goal-1');
});

test('browser write routes require a goal permission and reject unallowlisted actions', async (t) => {
  const f = await fixture(t);
  const missingGoal = await fetch(`${f.url}/api/browser/click`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'project-1', target: 'button' }) }));
  assert.equal(missingGoal.status, 400);
  assert.equal((await missingGoal.json()).code, 'BROWSER_GOAL_REQUIRED');

  const denied = await fetch(`${f.url}/api/browser/click`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'project-1', goalId: 'goal-1', target: 'button' }) }));
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, 'BROWSER_ACTION_NOT_ALLOWED');
  assert.equal(f.calls.some((item) => item[0] === 'browser' && item[1] === 'click'), false);

  f.browserPermissionService.allowedActions.push('click');
  const allowed = await fetch(`${f.url}/api/browser/click`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'project-1', goalId: 'goal-1', target: 'button' }) }));
  assert.equal(allowed.status, 200);
  assert.equal(f.calls.some((item) => item[0] === 'browser' && item[1] === 'click'), true);
});

test('mission autopilot endpoint runs the bounded DAG through automatic verification', async (t) => {
  const f = await fixture(t);
  const project = await (await fetch(`${f.url}/api/projects`, auth({ method: 'POST', body: JSON.stringify({ name: 'Auto', workspaceRoot: f.root }) }))).json();
  const mission = f.store.createMission({ projectId: project.id, objective: 'Complete all', status: 'running' });
  const response = await fetch(`${f.url}/api/missions/${mission.id}/run-to-completion`, auth({ method: 'POST', body: JSON.stringify({ providerId: 'fake', workerId: 'desktop-auto', maxTasks: 8 }) }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.status, 'completed');
  assert.deepEqual(f.calls.at(-1), ['autopilot', mission.id, 'fake', null, 8]);
});


test('terminal WebSocket requires authentication and forwards bounded terminal protocol messages', async (t) => {
  const f = await fixture(t);
  await assert.rejects(async () => {
    const socket = new WebSocket(`${f.url.replace('http:', 'ws:')}/terminal`);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = () => reject(new Error('unauthorized')); });
  }, /unauthorized/);
  await assert.rejects(async () => {
    const socket = new WebSocket(`${f.url.replace('http:', 'ws:')}/terminal?token=test-token`);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = () => reject(new Error('unauthorized')); });
  }, /unauthorized/);

  const socket = new WebSocket(`${f.url.replace('http:', 'ws:')}/terminal`, ['nolane-auth.test-token']);
  t.after(() => socket.close());
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const messages = [];
  socket.onmessage = (event) => messages.push(JSON.parse(String(event.data)));
  socket.send(JSON.stringify({ id: '1', type: 'create', projectId: 'project-1', shell: '/bin/sh', cwd: '.', cols: 80, rows: 24 }));
  const deadline = Date.now() + 1_000;
  while (!messages.some((item) => item.id === '1') || !messages.some((item) => item.type === 'output')) {
    if (Date.now() > deadline) assert.fail(`terminal messages timed out: ${JSON.stringify(messages)}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(messages.find((item) => item.id === '1').result.id, 'term-1');
  assert.equal(messages.find((item) => item.type === 'output').data, 'ready\r\n');
  socket.send(JSON.stringify({ id: '2', type: 'snapshot', sessionId: 'term-1', afterCursor: 0 }));
  while (!messages.some((item) => item.id === '2')) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(messages.find((item) => item.id === '2').result.cursor, 7);
});


test('workroom, credential, asset, update, and instruction endpoints are wired to real services', async (t) => {
  const f = await fixture(t);
  const project = await (await fetch(`${f.url}/api/projects`, auth({ method: 'POST', body: JSON.stringify({ name: 'Workroom', workspaceRoot: f.root }) }))).json();
  assert.equal((await (await fetch(`${f.url}/api/workroom/tree?projectId=${project.id}&directory=.`, auth())).json()).entries[0].path, 'src/a.mjs');
  assert.equal((await (await fetch(`${f.url}/api/workroom/file?projectId=${project.id}&file=src%2Fa.mjs`, auth())).json()).content, 'code');
  assert.equal((await (await fetch(`${f.url}/api/workroom/file`, auth({ method: 'PUT', body: JSON.stringify({ projectId: project.id, file: 'src/a.mjs', content: 'next', expectedSha256: 'c'.repeat(64) }) }))).json()).ok, true);
  assert.equal((await (await fetch(`${f.url}/api/workroom/diff`, auth({ method: 'POST', body: JSON.stringify({ projectId: project.id, file: 'src/a.mjs', content: 'next' }) }))).json()).changed, true);
  assert.equal((await (await fetch(`${f.url}/api/credentials`, auth())).json())[0].account, 'default');
  assert.equal((await (await fetch(`${f.url}/api/credentials`, auth({ method: 'POST', body: JSON.stringify({ service: 'openai', account: 'default', secret: 'private' }) }))).json()).present, true);
  assert.equal((await (await fetch(`${f.url}/api/credentials/openai/default`, auth({ method: 'DELETE' }))).json()).deleted, true);
  assert.equal((await (await fetch(`${f.url}/api/ui-assets`, auth())).json()).ready, true);
  assert.equal((await (await fetch(`${f.url}/api/ui-assets/install`, auth({ method: 'POST', body: '{}' }))).json()).installed, true);
  const update = await (await fetch(`${f.url}/api/updates/check`, auth({ method: 'POST', body: '{}' }))).json();
  assert.equal(update.manifest.version, '0.3.1');
  assert.equal((await (await fetch(`${f.url}/api/updates/stage`, auth({ method: 'POST', body: JSON.stringify({ manifest: update.manifest }) }))).json()).staged, true);
  assert.equal((await (await fetch(`${f.url}/api/updates/prepare`, auth({ method: 'POST', body: JSON.stringify({ targetVersion: '0.3.1' }) }))).json()).prepared, true);
  assert.equal((await (await fetch(`${f.url}/api/instructions?projectId=${project.id}`, auth())).json()).instructions[0].path, 'AGENTS.md');
  assert.equal((await (await fetch(`${f.url}/api/runtime`, auth())).json()).version, '0.6.0');
  assert.deepEqual(f.calls.slice(-14).map((item) => item[0]), ['fileTree', 'fileRead', 'fileWrite', 'fileDiff', 'credentialList', 'credentialSet', 'credentialDelete', 'assetsStatus', 'assetsInstall', 'updateCheck', 'updateStage', 'updatePrepare', 'instructionDiscover', 'runtimeStatus']);
});


test('terminal WebSocket reclaims sessions for the same durable client identity', async (t) => {
  const f = await fixture(t);
  const connect = async () => {
    const socket = new WebSocket(`${f.url.replace('http:', 'ws:')}/terminal?clientId=workroom-client`, ['nolane-auth.test-token']);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    return socket;
  };
  const first = await connect();
  const firstMessages = []; first.onmessage = (event) => firstMessages.push(JSON.parse(String(event.data)));
  first.send(JSON.stringify({ id: 'create', type: 'create', projectId: 'project-1', shell: '/bin/sh', cwd: '.' }));
  while (!firstMessages.some((item) => item.id === 'create')) await new Promise((resolve) => setTimeout(resolve, 10));
  first.close(); await new Promise((resolve) => setTimeout(resolve, 20));
  const second = await connect(); t.after(() => second.close());
  const messages = []; second.onmessage = (event) => messages.push(JSON.parse(String(event.data)));
  second.send(JSON.stringify({ id: 'list', type: 'list' }));
  while (!messages.some((item) => item.id === 'list')) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(messages.find((item) => item.id === 'list').result[0].id, 'term-1');
});


test('human review and rollback endpoints expose concise outcomes instead of technical receipts', async (t) => {
  const f = await fixture(t);
  const reviewResponse = await fetch(`${f.url}/api/agent/runs/mission-1/review`, auth());
  assert.equal(reviewResponse.status, 200);
  const review = await reviewResponse.json();
  assert.equal(review.verification.status, 'pass');
  assert.equal(JSON.stringify(review).includes('receiptSha256'), false);
  const rollbackResponse = await fetch(`${f.url}/api/agent/runs/mission-1/rollback`, auth({ method: 'POST', body: '{}' }));
  assert.equal(rollbackResponse.status, 200);
  assert.equal((await rollbackResponse.json()).mission.status, 'rolled-back');
  assert.deepEqual(f.calls.filter(([name]) => name.startsWith('run')), [['runReview', 'mission-1'], ['runRollback', 'mission-1']]);
});


test('ForgeOS diagnostic endpoints expose read-only runtime, lanes, and sandbox readiness', async (t) => {
  const f = await fixture(t);
  const statusResponse = await fetch(`${f.url}/api/forgeos/status`, auth());
  assert.equal(statusResponse.status, 200);
  assert.deepEqual(await statusResponse.json(), { version: '0.6.1', techniques: 128, universalLanes: 12 });
  const upstreamResponse = await fetch(`${f.url}/api/forgeos/upstream`, auth());
  assert.equal(upstreamResponse.status, 200);
  assert.equal((await upstreamResponse.json()).claims.remoteFreshnessVerified, false);
  const lanesResponse = await fetch(`${f.url}/api/forgeos/lanes`, auth());
  assert.equal(lanesResponse.status, 200);
  assert.equal((await lanesResponse.json()).length, 2);
  const sandboxResponse = await fetch(`${f.url}/api/forgeos/sandbox`, auth());
  assert.equal(sandboxResponse.status, 200);
  assert.deepEqual(await sandboxResponse.json(), { available: false, mode: 'not-configured' });
  assert.deepEqual(f.calls.slice(-4).map((item) => item[0]), ['forgeStatus', 'forgeUpstream', 'forgeLanes', 'forgeSandbox']);
  const forbidden = await fetch(`${f.url}/api/forgeos/sandbox/run`, auth({ method: 'POST', body: '{}' }));
  assert.equal(forbidden.status, 404);
});


test('agent run endpoint forwards bounded ForgeOS capability grants and approval metadata', async (t) => {
  const f = await fixture(t);
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const response = await fetch(`${f.url}/api/agent/runs`, auth({ method: 'POST', body: JSON.stringify({
    projectId: 'project-1', objective: 'Run remote check', forgeOsCapabilities: ['remote-sandbox.run'], remoteSandboxApproval: { id: 'approval-http', expiresAt },
  }) }));
  assert.equal(response.status, 201);
  const call = f.calls.find((item) => item[0] === 'runCreate');
  assert.deepEqual(call[1].forgeOsCapabilities, ['remote-sandbox.run']);
  assert.deepEqual(call[1].remoteSandboxApproval, { id: 'approval-http', expiresAt });
});
