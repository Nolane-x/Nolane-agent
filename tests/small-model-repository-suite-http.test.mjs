import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';
import { buildRepositorySpecialistDataset, REPOSITORY_SPECIALISTS } from '../src/small-model/repository-specialist-suite-dataset.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer nolane-token', 'content-type': 'application/json', ...(options.headers ?? {}) } });
const trajectoryDir = path.join(process.cwd(), 'datasets', 'trajectories', 'repository-v1');

async function decisionInput(group) {
  const input = {};
  const keyBySpecialist = { 'tool-router':'tool', 'context-scorer':'context', 'test-selector':'test', 'patch-ranker':'patch', 'risk-classifier':'risk' };
  for (const specialist of REPOSITORY_SPECIALISTS) {
    const dataset = await buildRepositorySpecialistDataset({ trajectoryDir, specialist });
    input[keyBySpecialist[specialist]] = dataset.examples.find((entry) => entry.scenarioGroup === group).state;
  }
  return input;
}

test('authenticated HTTP API bootstraps repository specialists and serves fail-closed decisions', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-repository-suite-http-'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const foundation = new SmallModelFoundationService();
  const service = await createHttpServer({ config:{host:'127.0.0.1',port:0,authToken:'nolane-token'}, store, providers:new ProviderRegistry(), missionRunner:{}, smallModelFoundation:foundation, uiRoot:root });
  t.after(() => service.close());
  t.after(() => rm(root, { recursive: true, force: true }));

  assert.equal((await fetch(`${service.url}/api/small-model/foundation/model/repository-suite-status`)).status, 401);
  const before = await (await fetch(`${service.url}/api/small-model/foundation/model/repository-suite-status`, auth())).json();
  assert.equal(before.ready, false);
  assert.equal(before.missing.length, 5);

  const denied = await fetch(`${service.url}/api/small-model/foundation/model/bootstrap-repository-suite`, auth({ method:'POST', body:JSON.stringify({ trajectoryDir }) }));
  assert.equal(denied.status, 500);
  const bootstrappedResponse = await fetch(`${service.url}/api/small-model/foundation/model/bootstrap-repository-suite`, auth({ method:'POST', body:JSON.stringify({ trajectoryDir, approvedBy:'checkpoint-owner' }) }));
  assert.equal(bootstrappedResponse.status, 201);
  const bootstrapped = await bootstrappedResponse.json();
  assert.equal(bootstrapped.promotions.length, 5);

  const safeResponse = await fetch(`${service.url}/api/small-model/foundation/model/repository-decision-support`, auth({ method:'POST', body:JSON.stringify(await decisionInput('context-utility-selector')) }));
  assert.equal(safeResponse.status, 200);
  const safe = await safeResponse.json();
  assert.equal(safe.status, 'allow');
  assert.equal(safe.allowed, true);

  const unsafe = await (await fetch(`${service.url}/api/small-model/foundation/model/repository-decision-support`, auth({ method:'POST', body:JSON.stringify(await decisionInput('browser-injection-guard')) }))).json();
  assert.equal(unsafe.status, 'blocked');
  assert.equal(unsafe.allowed, false);

  const after = await (await fetch(`${service.url}/api/small-model/foundation/model/repository-suite-status`, auth())).json();
  assert.equal(after.ready, true);
  const status = await (await fetch(`${service.url}/api/small-model/foundation/status`, auth())).json();
  assert.equal(status.repositorySpecialistSuiteReady, true);
  assert.equal(status.claims.generalCodingIntelligence, false);
});
