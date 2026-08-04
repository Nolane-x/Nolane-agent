import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRoutes } from '../src/server/routes.mjs';
import { ForgeStudioClient } from '../src/client/forge-studio-client.mjs';

function response() { return { statusCode: null, headers: null, body: '', writeHead(status, headers) { this.statusCode = status; this.headers = headers; }, end(body = '') { this.body = String(body); } }; }
function request(method, body = null, principal = { subject: 'reviewer-1', roles: ['developer'] }) { const req = new EventEmitter(); req.method = method; req.headers = {}; req.forgePrincipal = principal; req[Symbol.asyncIterator] = async function* () { if (body !== null) yield Buffer.from(JSON.stringify(body)); }; return req; }
function parse(res) { return JSON.parse(res.body || '{}'); }

function fixture() {
  const calls = [];
  const decision = {
    collaborationExperienceSnapshot() { calls.push(['snapshot']); return { schema: 'forge.collaboration-experience-plane.v1', reviewQueue: { items: [] } }; },
    addReviewItem(input) { calls.push(['add', input]); return { schema: 'forge.review-queue-item.v1', itemId: input.itemId }; },
    decideReviewItem(input) { calls.push(['decide', input]); return { schema: 'forge.review-queue-item.v1', itemId: input.itemId, state: 'approved' }; },
    createPlaybackRewindPlan(input) { calls.push(['rewind', input]); return { schema: 'forge.playback-rewind-plan.v1', allowed: true }; },
    issueMissionSteering(input) { calls.push(['steer', input]); return { schema: 'forge.mission-steering-command.v1', missionId: input.missionId, actor: input.actor }; },
  };
  return { calls, routes: createRoutes({ store: { listProjects: () => [] }, providers: {}, missionRunner: {}, missionResourceFabric: { decision } }) };
}

test('collaboration experience HTTP API exposes bounded snapshot, review, rewind and steering surfaces', async () => {
  const { calls, routes } = fixture();
  const snapshotRes = response();
  await routes(request('GET'), snapshotRes, new URL('/api/collaboration-experience/snapshot', 'http://localhost'));
  assert.equal(snapshotRes.statusCode, 200);
  assert.equal(parse(snapshotRes).schema, 'forge.collaboration-experience-plane.v1');

  const addRes = response();
  await routes(request('POST', { itemId: 'review-1', kind: 'hunk', target: 'src/app.mjs:1-4', risk: 'high', dependencies: [], missionStage: 'verification', receiptSha256: 'a'.repeat(64), rawDiff: 'secret', principalId: 'attacker' }), addRes, new URL('/api/collaboration-experience/review/items', 'http://localhost'));
  assert.equal(addRes.statusCode, 201);

  const decideRes = response();
  await routes(request('POST', { itemId: 'review-1', decision: 'approve', receiptSha256: 'b'.repeat(64), actor: 'attacker' }), decideRes, new URL('/api/collaboration-experience/review/decisions', 'http://localhost'));
  assert.equal(decideRes.statusCode, 200);

  const rewindRes = response();
  await routes(request('POST', { checkpointId: 'checkpoint-1', command: 'git reset --hard' }), rewindRes, new URL('/api/collaboration-experience/playback/rewind', 'http://localhost'));
  assert.equal(rewindRes.statusCode, 200);

  const steerRes = response();
  await routes(request('POST', { missionId: 'mission-1', action: 'pause', expectedRevision: 0, capabilities: ['mission.pause'], reason: 'Inspect blocker', target: null, evidenceReceiptSha256: 'c'.repeat(64), actor: 'attacker', command: 'kill -9' }), steerRes, new URL('/api/collaboration-experience/steering', 'http://localhost'));
  assert.equal(steerRes.statusCode, 200);

  assert.deepEqual(calls, [
    ['snapshot'],
    ['add', { itemId: 'review-1', kind: 'hunk', target: 'src/app.mjs:1-4', risk: 'high', dependencies: [], missionStage: 'verification', receiptSha256: 'a'.repeat(64) }],
    ['decide', { itemId: 'review-1', decision: 'approve', receiptSha256: 'b'.repeat(64), actor: 'reviewer-1' }],
    ['rewind', { checkpointId: 'checkpoint-1' }],
    ['steer', { missionId: 'mission-1', action: 'pause', expectedRevision: 0, capabilities: ['mission.pause'], reason: 'Inspect blocker', target: null, evidenceReceiptSha256: 'c'.repeat(64), actor: 'reviewer-1' }],
  ]);
});

test('collaboration experience HTTP API fails closed when Mission Resource Fabric is absent', async () => {
  const routes = createRoutes({ store: { listProjects: () => [] }, providers: {}, missionRunner: {} });
  await assert.rejects(() => routes(request('GET'), response(), new URL('/api/collaboration-experience/snapshot', 'http://localhost')), (error) => error.statusCode === 503);
});

test('ForgeStudioClient exposes collaboration experience APIs without raw execution controls', async () => {
  const calls = [];
  const client = new ForgeStudioClient({ baseUrl: 'http://127.0.0.1:8787', token: 'token', fetch: async (url, init) => { calls.push({ url: String(url), init }); return { ok: true, status: init?.method === 'POST' ? 200 : 200, headers: { get: () => 'application/json' }, async json() { return { ok: true }; } }; } });
  await client.getCollaborationExperience();
  await client.decideReviewItem({ itemId: 'r1', decision: 'approve', receiptSha256: 'a'.repeat(64) });
  await client.createPlaybackRewindPlan('cp1');
  await client.steerMission({ missionId: 'm1', action: 'pause', expectedRevision: 0, capabilities: ['mission.pause'], reason: 'review', evidenceReceiptSha256: 'b'.repeat(64) });
  assert.deepEqual(calls.map((x) => [new URL(x.url).pathname, x.init.method ?? 'GET']), [
    ['/api/collaboration-experience/snapshot', 'GET'],
    ['/api/collaboration-experience/review/decisions', 'POST'],
    ['/api/collaboration-experience/playback/rewind', 'POST'],
    ['/api/collaboration-experience/steering', 'POST'],
  ]);
  assert.doesNotMatch(JSON.stringify(calls), /git reset|shell|rawCommand/i);
});
