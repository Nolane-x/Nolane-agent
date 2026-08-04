import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SovereignAgentKernel } from '../src/kernel/sovereign-agent-kernel.mjs';
import { createRoutes } from '../src/server/routes.mjs';

async function call(route, { method = 'GET', pathname, body = null }) {
  let status; let data = '';
  const req = { method, async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(JSON.stringify(body)); } };
  const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
  const handled = await route(req, res, new URL(`http://local${pathname}`));
  return { handled, status, body: data ? JSON.parse(data) : null };
}

test('sovereign kernel HTTP API exposes durable threads, compiled context, plans, leases, checkpoints and health', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-sovereign-api-'));
  const kernel = new SovereignAgentKernel({ dataDir: root });
  try {
    const route = createRoutes({ sovereignKernel: kernel });
    const created = await call(route, { method: 'POST', pathname: '/api/sovereign-kernel/threads', body: { projectId: 'project-1', title: 'Deep core evolution', objective: 'Strengthen the execution kernel.', principalId: 'user:test' } });
    assert.equal(created.status, 201);
    const threadId = created.body.id;
    const context = await call(route, { method: 'POST', pathname: `/api/sovereign-kernel/threads/${threadId}/context`, body: { tokenBudget: 8_000, targetPaths: ['src/kernel/**'], instructions: [{ id: 'rule', content: 'Never merge without independent review.', source: 'AGENTS.md', pathScopes: ['src/kernel/**'], trust: 'trusted' }] } });
    assert.equal(context.status, 201);
    assert.equal(context.body.segments.some((item) => item.id === 'rule' && item.lane === 'instructions'), true);
    assert.equal(context.body.claims.sourceContentFabricated, false);
    const plan = await call(route, { method: 'POST', pathname: `/api/sovereign-kernel/threads/${threadId}/plans`, body: { tasks: [{ id: 'scout', role: 'scout', objective: 'Inspect the kernel.', ownedPaths: ['src/kernel/**'] }] } });
    assert.equal(plan.status, 201);
    assert.equal(plan.body.projectId, 'project-1');
    const lease = await call(route, { method: 'POST', pathname: `/api/sovereign-kernel/threads/${threadId}/capabilities`, body: { capability: 'filesystem.read', resource: 'src/kernel/**', scope: 'once', risk: 'low', reason: 'Inspect kernel source for the active plan.' } });
    assert.equal(lease.status, 201);
    assert.equal(lease.body.lease.state, 'granted');
    assert.equal(lease.body.review.decision, 'approved');
    const checkpoint = await call(route, { method: 'POST', pathname: `/api/sovereign-kernel/threads/${threadId}/checkpoints`, body: { label: 'pre-execution' } });
    assert.equal(checkpoint.status, 201);
    const snapshot = await call(route, { pathname: '/api/sovereign-kernel/snapshot?projectId=project-1' });
    assert.equal(snapshot.body.metrics.threads, 1);
    assert.equal(snapshot.body.metrics.plans, 1);
    assert.equal(snapshot.body.architecture.independentReviewBoundary, true);
    const health = await call(route, { pathname: '/api/sovereign-kernel/health' });
    assert.equal(health.body.status, 'ready');
  } finally { kernel.close(); await rm(root, { recursive: true, force: true }); }
});
