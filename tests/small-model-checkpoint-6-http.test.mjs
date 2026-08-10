import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';
import { buildCheckpoint6SpecialistDataset, CHECKPOINT_6_SPECIALISTS } from '../src/small-model/checkpoint-6-specialist-dataset.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer nolane-token', 'content-type': 'application/json', ...(options.headers ?? {}) } });
const repositoryTrajectoryDir = path.join(process.cwd(), 'datasets', 'trajectories', 'repository-v1');
const multiRuntimeDir = path.join(process.cwd(), 'datasets', 'trajectories', 'multi-runtime-v1');
const outputRoot = path.join(process.cwd(), 'models', 'specialists-checkpoint-6');
const keyBySpecialist = { 'tool-router': 'tool', 'context-scorer': 'context', 'test-selector': 'test', 'patch-ranker': 'patch', 'risk-classifier': 'risk' };

async function decisionInput(scenarioGroup) {
  const input = {};
  for (const specialist of CHECKPOINT_6_SPECIALISTS) {
    const dataset = await buildCheckpoint6SpecialistDataset({ repositoryTrajectoryDir, multiRuntimeDir, specialist });
    input[keyBySpecialist[specialist]] = dataset.examples.find((entry) => entry.state.scenarioGroup === scenarioGroup).state;
  }
  return input;
}

test('authenticated checkpoint 6 HTTP workflow separates train promotion inference and decision support', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-checkpoint-6-http-'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const foundation = new SmallModelFoundationService();
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'nolane-token' }, store, providers: new ProviderRegistry(), missionRunner: {}, smallModelFoundation: foundation, uiRoot: root });
  t.after(() => service.close());
  t.after(() => rm(root, { recursive: true, force: true }));

  const statusUrl = `${service.url}/api/small-model/foundation/model/checkpoint-6/status`;
  assert.equal((await fetch(statusUrl)).status, 401);
  assert.equal((await (await fetch(statusUrl, auth())).json()).ready, false);

  const trainedResponse = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-6/train`, auth({ method: 'POST', body: JSON.stringify({ repositoryTrajectoryDir, multiRuntimeDir, outputRoot, writeOutputs: false }) }));
  assert.equal(trainedResponse.status, 201);
  const trained = await trainedResponse.json();
  assert.match(trained.suiteReceiptSha256, /^[a-f0-9]{64}$/);
  assert.equal((await (await fetch(statusUrl, auth())).json()).ready, false);

  const denied = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-6/promote`, auth({ method: 'POST', body: JSON.stringify({ suiteReceiptSha256: trained.suiteReceiptSha256 }) }));
  assert.equal(denied.status, 500);
  const promotedResponse = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-6/promote`, auth({ method: 'POST', body: JSON.stringify({ suiteReceiptSha256: trained.suiteReceiptSha256, approvedBy: 'checkpoint-owner' }) }));
  assert.equal(promotedResponse.status, 201);
  assert.equal((await promotedResponse.json()).promotions.length, 5);

  const inferResponse = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-6/infer`, auth({ method: 'POST', body: JSON.stringify({ specialist: 'risk-classifier', state: (await decisionInput('browser-injection-guard')).risk, abstainThreshold: 0 }) }));
  assert.equal(inferResponse.status, 200);
  assert.equal((await inferResponse.json()).action, 'critical');

  const safeResponse = await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-6/decision`, auth({ method: 'POST', body: JSON.stringify(await decisionInput('advanced-search-service')) }));
  assert.equal(safeResponse.status, 200);
  assert.equal((await safeResponse.json()).status, 'allow');

  const unsafe = await (await fetch(`${service.url}/api/small-model/foundation/model/checkpoint-6/decision`, auth({ method: 'POST', body: JSON.stringify(await decisionInput('browser-injection-guard')) }))).json();
  assert.equal(unsafe.status, 'blocked');
  assert.equal(unsafe.allowed, false);
});
