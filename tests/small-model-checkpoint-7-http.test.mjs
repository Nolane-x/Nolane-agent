import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer nolane-token', 'content-type': 'application/json', ...(options.headers ?? {}) } });
const projectRoot = path.resolve(new URL('..', import.meta.url).pathname);
const repositoryTrajectoryDir = path.join(projectRoot, 'datasets', 'trajectories', 'repository-v1');
const multiRuntimeDir = path.join(projectRoot, 'datasets', 'trajectories', 'multi-runtime-v1');

test('authenticated checkpoint 7 HTTP workflow remains pending until explicit transfer-governed promotion', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-checkpoint-7-http-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const foundation = new SmallModelFoundationService();
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'nolane-token' }, store, providers: new ProviderRegistry(), missionRunner: {}, smallModelFoundation: foundation, uiRoot: root });
  t.after(() => service.close());

  const statusUrl = `${service.url}/api/small-model/foundation/model/checkpoint-7/status`;
  assert.equal((await fetch(statusUrl)).status, 401);
  assert.equal((await (await fetch(statusUrl, auth())).json()).ready, false);

  const collect = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-7/collect`, auth({ method: 'POST', body: JSON.stringify({ root: projectRoot, trainingRepositoryIds: [] }) }));
  assert.equal(collect.status, 201);
  const collection = await collect.json();
  assert.equal(collection.primaryMissions.length, 3);

  const prepare = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-7/prepare`, auth({ method: 'POST', body: JSON.stringify({ collectionReceiptSha256: collection.receiptSha256, repositoryTrajectoryDir, multiRuntimeDir, writeOutputs: false }) }));
  assert.equal(prepare.status, 201);
  const prepared = await prepare.json();
  assert.equal(prepared.status, 'pending-approval');
  assert.equal((await (await fetch(statusUrl, auth())).json()).ready, false);

  const denied = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-7/promote`, auth({ method: 'POST', body: JSON.stringify({ bundleReceiptSha256: prepared.bundleReceiptSha256 }) }));
  assert.equal(denied.status, 500);
  const promote = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-7/promote`, auth({ method: 'POST', body: JSON.stringify({ bundleReceiptSha256: prepared.bundleReceiptSha256, approvedBy: 'checkpoint-owner' }) }));
  assert.equal(promote.status, 201);
  assert.equal((await promote.json()).specialistPromotions.length, 5);
  assert.equal((await (await fetch(statusUrl, auth())).json()).ready, true);

  const safe = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-7/decision`, auth({ method: 'POST', body: JSON.stringify(prepared.decisionFixtures.safe) }));
  assert.equal(safe.status, 200);
  assert.equal((await safe.json()).status, 'allow');
  const unsafe = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-7/decision`, auth({ method: 'POST', body: JSON.stringify(prepared.decisionFixtures.unsafe) }));
  assert.equal(unsafe.status, 200);
  assert.equal((await unsafe.json()).status, 'blocked');
});
