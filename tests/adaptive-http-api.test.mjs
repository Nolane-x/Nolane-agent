import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer test-token', 'content-type': 'application/json', ...(options.headers ?? {}) } });

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-adaptive-http-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const calls = [];
  const adaptiveIntelligence = {
    async status() { return { version: '1.0.0', capabilities: ['secure-semantic-index'] }; },
    async repository(op, input) { calls.push(['repository', op, input]); return op === 'search' ? { items: [{ path: 'src/auth.mjs' }] } : { ok: true }; },
    tools(op, input) { calls.push(['tools', op, input]); return op === 'schema' ? { type: 'function', function: { name: input.name } } : [{ name: 'fs.read' }]; },
    async context(op, input) { calls.push(['context', op, input]); return { id: input.id, content: 'page' }; },
    async history(op, input) { calls.push(['history', op, input]); return op === 'list' ? [{ id: 'history-1' }] : op === 'search' ? { items: [{ archiveId: 'history-1' }] } : { created: true, id: 'history-1' }; },
    async memory(op, input, principal) { calls.push(['memory', op, input, principal.subject]); return { id: input.id ?? 'memory-1', status: op === 'approve' ? 'active' : 'candidate' }; },
    async review(op, input) { calls.push(['review', op, input]); return { reviewId: input.id ?? 'review-1' }; },
    async automation(op, input) { calls.push(['automation', op, input]); return { id: input.id ?? 'automation-1' }; },
    async design(op, input, principal) { calls.push(['design', op, input, principal?.subject]); return { id: input.id ?? 'design-1' }; },
    diagnostics(op, input) { calls.push(['diagnostics', op, input]); return { summary: { new: 1 } }; },
    providers(op, input, principal) { calls.push(['providers', op, input, principal?.subject]); return op === 'outcome' ? { recorded: true, actor: principal.subject } : { selectedProviderId: 'fake' }; },
  };
  const providers = new ProviderRegistry();
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'test-token' }, store, providers,
    missionRunner: {}, adaptiveIntelligence, uiRoot: root,
  });
  t.after(() => service.close());
  return { ...service, calls };
}

test('adaptive intelligence API exposes authenticated semantic, tool, context, memory, review, automation, design, and routing surfaces', async (t) => {
  const f = await fixture(t);
  assert.equal((await (await fetch(`${f.url}/api/adaptive/status`, auth())).json()).version, '1.0.0');
  const search = await (await fetch(`${f.url}/api/adaptive/repository/search?projectId=p1&q=login&limit=5`, auth())).json();
  assert.equal(search.items[0].path, 'src/auth.mjs');
  const feedback = await fetch(`${f.url}/api/adaptive/repository/feedback`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', query: 'login', contentSha256: 'a'.repeat(64), accepted: true }) }));
  assert.equal(feedback.status, 200);
  assert.equal((await (await fetch(`${f.url}/api/adaptive/tools/fs.read/schema`, auth())).json()).function.name, 'fs.read');
  assert.equal((await (await fetch(`${f.url}/api/adaptive/context/ctx_1/read?startByte=0&maxBytes=10`, auth())).json()).content, 'page');
  assert.equal((await (await fetch(`${f.url}/api/adaptive/history?projectId=p1&kind=conversation`, auth())).json())[0].id, 'history-1');
  assert.equal((await (await fetch(`${f.url}/api/adaptive/history/search?projectId=p1&q=login`, auth())).json()).items[0].archiveId, 'history-1');
  assert.equal((await (await fetch(`${f.url}/api/adaptive/history/conversation/archive`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', missionId: 'm1', messages: [] }) }))).json()).created, true);
  assert.equal((await (await fetch(`${f.url}/api/adaptive/memory`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', title: 'Rule', content: 'Use tests' }) }))).json()).status, 'candidate');
  assert.equal((await (await fetch(`${f.url}/api/adaptive/memory/memory-1/approve`, auth({ method: 'POST', body: JSON.stringify({ evidenceReceiptSha256: 'b'.repeat(64) }) }))).json()).status, 'active');
  assert.equal((await (await fetch(`${f.url}/api/adaptive/reviews`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', diff: '+x', executorId: 'w', reviewerId: 'r' }) }))).json()).reviewId, 'review-1');
  assert.equal((await (await fetch(`${f.url}/api/adaptive/automations`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', name: 'N', objective: 'Review' }) }))).json()).id, 'automation-1');
  assert.equal((await (await fetch(`${f.url}/api/adaptive/design/capture`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', sessionId: 's1', url: 'http://localhost', elements: [{ selector: '#a', tagName: 'button' }] }) }))).json()).id, 'design-1');
  assert.equal((await (await fetch(`${f.url}/api/adaptive/diagnostics/compare`, auth({ method: 'POST', body: JSON.stringify({ baseline: '', current: 'Error: new' }) }))).json()).summary.new, 1);
  assert.equal((await (await fetch(`${f.url}/api/adaptive/providers/route`, auth({ method: 'POST', body: JSON.stringify({ mode: 'intelligence' }) }))).json()).selectedProviderId, 'fake');
  assert.equal((await (await fetch(`${f.url}/api/adaptive/providers/outcomes`, auth({ method: 'POST', body: JSON.stringify({ taskId: 'task-1', accepted: true, evidenceReceiptSha256: 'e'.repeat(64) }) }))).json()).actor, 'local-admin');
  assert.equal(f.calls.some((item) => item[0] === 'memory' && item[3] === 'local-admin'), true);
});

test('adaptive API is unavailable when the application service is not configured', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-adaptive-http-off-')); t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'test-token' }, store, providers: new ProviderRegistry(), missionRunner: {}, uiRoot: root }); t.after(() => service.close());
  const response = await fetch(`${service.url}/api/adaptive/status`, auth());
  assert.equal(response.status, 503);
});

test('legacy repository search awaits adaptive results and preserves the array response contract', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-adaptive-legacy-search-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const repositoryIndex = {
    async search(projectId, query, options) {
      assert.equal(projectId, 'p1');
      assert.equal(query, 'login');
      assert.equal(options.limit, 5);
      return { items: [{ path: 'src/auth.mjs', score: 0.9 }], receiptSha256: 'a'.repeat(64) };
    },
  };
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'test-token' },
    store,
    providers: new ProviderRegistry(),
    missionRunner: {},
    repositoryIndex,
    uiRoot: root,
  });
  t.after(() => service.close());
  const response = await fetch(`${service.url}/api/repository/search?projectId=p1&q=login&limit=5`, auth());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ path: 'src/auth.mjs', score: 0.9 }]);
});
