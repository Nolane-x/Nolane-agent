import assert from 'node:assert/strict';
import test from 'node:test';

import { AdaptiveIntelligencePlane } from '../src/agent/adaptive-intelligence-plane.mjs';

function fixture() {
  const calls = [];
  const repository = {
    async index(project) { calls.push(['repo.index', project.id]); return { projectId: project.id, semantic: { rootSha256: 'a'.repeat(64) } }; },
    async search(projectId, query, options) { calls.push(['repo.search', projectId, query, options.limit]); return { items: [{ path: 'src/a.mjs' }] }; },
    recordFeedback(projectId, query, hash, outcome) { calls.push(['repo.feedback', projectId, query, hash, outcome.accepted]); return { ok: true }; },
    state(projectId) { return { projectId, semantic: { phase: 'ready' } }; },
    map(projectId, options) { calls.push(['repo.map', projectId, options.maxFiles]); return { files: [{ path: 'src/core.mjs' }] }; },
  };
  const toolCatalog = {
    summaries() { return [{ name: 'fs.read' }]; },
    search(query, options) { calls.push(['tools.search', query, options.limit]); return [{ name: 'fs.read' }]; },
    loadSchema(name) { calls.push(['tools.load', name]); return { type: 'function', function: { name } }; },
  };
  const contextStore = {
    async get(id) { calls.push(['context.get', id]); return { id }; },
    async read(id, options) { calls.push(['context.read', id, options.startByte]); return { id, content: 'page' }; },
    async search(id, query, options) { calls.push(['context.search', id, query, options.limit]); return { id, items: [] }; },
  };
  const memory = {
    async propose(input) { calls.push(['memory.propose', input.projectId]); return { id: 'memory-1', status: 'candidate' }; },
    async approve(id, input) { calls.push(['memory.approve', id, input.actor]); return { id, status: 'active' }; },
    async edit(id, input) { calls.push(['memory.edit', id, input.actor]); return { id }; },
    async revoke(id, input) { calls.push(['memory.revoke', id, input.actor]); return { id, status: 'revoked' }; },
    async purge(id, input) { calls.push(['memory.purge', id, input.actor]); return { id, purged: true }; },
    get(id) { return { id }; },
  };
  const reviewer = {
    async review(input) { calls.push(['review.run', input.projectId]); return { reviewId: 'review-1' }; },
    get(id) { return { reviewId: id }; },
    createRepairHandoff(id, input) { calls.push(['review.handoff', id, input.targetAgentProfile]); return { reviewId: id }; },
  };
  const automations = {
    create(input) { calls.push(['automation.create', input.projectId]); return { id: 'automation-1' }; },
    list(input) { return [{ id: 'automation-1', projectId: input.projectId }]; },
    get(id) { return { id }; },
    ingestEvent(input) { calls.push(['automation.event', input.eventId]); return { queued: 1 }; },
    enqueue(id, event) { calls.push(['automation.enqueue', id, event.eventId]); return { queued: 1 }; },
    async tick() { calls.push(['automation.tick']); return { started: [] }; },
    listRuns(id, options) { calls.push(['automation.runs', id, options.limit]); return []; },
  };
  const design = {
    async capture(input, scope) { calls.push(['design.capture', input.projectId, scope.secretValues.length]); return { id: 'design-1' }; },
    get(id) { return { id }; },
    enqueueEdit(id, input) { calls.push(['design.edit', id, input.selector]); return { id: 'edit-1' }; },
    listEdits(id) { return [{ id: 'edit-1', contextId: id }]; },
    requestTakeover(input) { calls.push(['design.takeover', input.sessionId, input.actor]); return { leaseId: 'lease-1' }; },
    releaseTakeover(id, input) { calls.push(['design.release', id, input.actor]); return { leaseId: id }; },
    recordHotReload(input) { calls.push(['design.reload', input.sessionId]); return { revision: input.revision }; },
  };
  const diagnostics = { compare(input) { calls.push(['diagnostics.compare', input.current]); return { summary: { new: 1 } }; } };
  const outcomes = { recordUserFeedback(input, principal) { calls.push(['outcome.feedback', input.taskId, principal.subject]); return { recorded: true, providerId: 'fake' }; } };
  const router = { decide(input) { calls.push(['router.decide', input.mode]); return { selectedProviderId: 'fake', decisionSha256: 'd'.repeat(64) }; } };
  const environment = { list(input) { calls.push(['environment.list', input.projectId]); return [{ id: 'web', projectId: input.projectId, state: 'healthy' }]; }, status(id, input) { calls.push(['environment.status', id, input.projectId]); return { id, projectId: input.projectId, state: 'healthy' }; }, snapshot(id, input) { calls.push(['environment.snapshot', id, input.projectId]); return { environmentId: id, manifestSha256: 'f'.repeat(64) }; } };
  return { calls, plane: new AdaptiveIntelligencePlane({ version: '1.0.0', projectResolver: (id) => ({ id, workspaceRoot: '/repo' }), repository, toolCatalog, contextStore, memory, reviewer, automations, design, diagnostics, outcomes, router, environment }) };
}

test('AdaptiveIntelligencePlane exposes bounded adaptive intelligence operations through one application service', async () => {
  const { plane, calls } = fixture();
  const status = await plane.status();
  assert.equal(status.version, '1.0.0');
  assert.equal(status.capabilities.includes('secure-semantic-index'), true);
  await plane.repository('index', { projectId: 'p1' });
  await plane.repository('search', { projectId: 'p1', query: 'auth', limit: 4 });
  await plane.repository('feedback', { projectId: 'p1', query: 'auth', contentSha256: 'a'.repeat(64), accepted: true });
  assert.equal((await plane.repository('map', { projectId: 'p1', maxFiles: 10 })).files[0].path, 'src/core.mjs');
  assert.equal(plane.tools('list').length, 1);
  assert.equal(plane.tools('schema', { name: 'fs.read' }).function.name, 'fs.read');
  await plane.context('read', { id: 'ctx_1', startByte: 2, maxBytes: 10 });
  await plane.memory('propose', { projectId: 'p1', title: 'T', content: 'C', actor: 'alice' }, { subject: 'alice' });
  await plane.memory('approve', { id: 'memory-1', evidenceReceiptSha256: 'b'.repeat(64) }, { subject: 'alice' });
  await plane.review('run', { projectId: 'p1', diff: '+x', executorId: 'worker', reviewerId: 'reviewer' });
  await plane.automation('create', { projectId: 'p1', name: 'Nightly', objective: 'Review' });
  await plane.design('capture', { projectId: 'p1', sessionId: 's1', url: 'http://localhost', elements: [{ selector: '#a', tagName: 'button' }] }, { subject: 'alice' });
  assert.equal((await plane.diagnostics('compare', { baseline: '', current: 'Error: new' })).summary.new, 1);
  assert.equal(plane.providers('route', { mode: 'intelligence' }).selectedProviderId, 'fake');
  assert.equal(plane.providers('outcome', { taskId: 'task-1', accepted: true, evidenceReceiptSha256: 'e'.repeat(64) }, { subject: 'alice' }).recorded, true);
  assert.equal((await plane.environment('status', { projectId: 'p1', id: 'web' })).state, 'healthy');
  assert.deepEqual(calls.slice(0, 3).map((item) => item[0]), ['repo.index', 'repo.search', 'repo.feedback']);
});

test('AdaptiveIntelligencePlane binds destructive memory and takeover actions to authenticated principals', async () => {
  const { plane, calls } = fixture();
  await assert.rejects(() => plane.memory('revoke', { id: 'memory-1' }, null), /authenticated principal/i);
  await plane.memory('revoke', { id: 'memory-1' }, { subject: 'owner' });
  await plane.design('takeover', { sessionId: 's1', ttlMs: 1_000 }, { subject: 'owner' });
  assert.deepEqual(calls.filter((item) => item[0] === 'memory.revoke')[0], ['memory.revoke', 'memory-1', 'owner']);
  assert.deepEqual(calls.filter((item) => item[0] === 'design.takeover')[0], ['design.takeover', 's1', 'owner']);
});

test('AdaptiveIntelligencePlane exposes project-scoped durable context history operations', async () => {
  const calls = [];
  const history = {
    list(input) { calls.push(['list', input]); return [{ id: 'history-1', projectId: input.projectId }]; },
    async get(id, scope) { calls.push(['get', id, scope]); return { id, projectId: scope.projectId }; },
    async search(input) { calls.push(['search', input]); return { items: [{ archiveId: 'history-1' }] }; },
    async archiveConversation(input) { calls.push(['archiveConversation', input]); return { created: true, itemCount: 2 }; },
    async compactConversation(input) { calls.push(['compactConversation', input]); return { schema: 'forge.context-history-compaction.v1' }; },
  };
  const plane = new AdaptiveIntelligencePlane({ version: '1.0.0', projectResolver: (id) => ({ id, workspaceRoot: '/repo' }), history });
  assert.equal((await plane.status()).services.history, true);
  assert.equal((await plane.history('list', { projectId: 'p1' }))[0].id, 'history-1');
  assert.equal((await plane.history('get', { projectId: 'p1', id: 'history-1' })).projectId, 'p1');
  assert.equal((await plane.history('search', { projectId: 'p1', query: 'failure' })).items.length, 1);
  assert.equal((await plane.history('archive-conversation', { projectId: 'p1', missionId: 'm1', messages: [] })).created, true);
  assert.equal((await plane.history('compact-conversation', { projectId: 'p1', missionId: 'm1', summary: 'summary' })).schema, 'forge.context-history-compaction.v1');
  assert.deepEqual(calls.map((item) => item[0]), ['list', 'get', 'search', 'archiveConversation', 'compactConversation']);
});
