import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer review-token', 'content-type': 'application/json', ...(options.headers ?? {}) } });

test('diff review API is authenticated and forwards actor-bound decisions', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-diff-review-http-'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const calls = [];
  const diffReview = {
    async snapshot(missionId) { calls.push(['snapshot', missionId]); return { missionId, reviewSha256: 'a'.repeat(64), files: [] }; },
    async decide(input) { calls.push(['decide', input]); return { decision: input.decision, actor: input.principal.subject, receiptSha256: 'b'.repeat(64) }; },
  };
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'review-token' }, store, providers: new ProviderRegistry(), missionRunner: {}, diffReview, uiRoot: root });
  t.after(() => service.close());
  t.after(() => rm(root, { recursive: true, force: true }));

  assert.equal((await fetch(`${service.url}/api/agent/runs/m1/diff-review`)).status, 401);
  const snapshot = await (await fetch(`${service.url}/api/agent/runs/m1/diff-review`, auth())).json();
  assert.equal(snapshot.reviewSha256, 'a'.repeat(64));
  const response = await fetch(`${service.url}/api/agent/runs/m1/diff-review/decisions`, auth({ method: 'POST', body: JSON.stringify({ taskId: 't1', hunkId: 'c'.repeat(64), decision: 'reject', expectedReviewSha256: 'a'.repeat(64), reason: 'Unrelated change' }) }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).actor, 'local-admin');
  const decisionCall = calls.find(([type]) => type === 'decide');
  assert.equal(decisionCall[1].missionId, 'm1');
  assert.equal(decisionCall[1].principal.subject, 'local-admin');
});
