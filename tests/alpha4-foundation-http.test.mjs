import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';
import { NolaneOperationalBoundaryService } from '../src/nolane-native/operational-boundary-service.mjs';
import { DependencyPreflightService } from '../src/release/dependency-preflight-service.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer nolane-token', 'content-type': 'application/json', ...(options.headers ?? {}) } });
const post = (url, body) => fetch(url, auth({ method: 'POST', body: JSON.stringify(body) }));

const distillationStep = {
  id: 'http-step-1', episodeId: 'http-episode-1', kind: 'tool-policy', repositoryId: 'repo-train', domain: 'javascript',
  state: { taskType: 'repair', evidenceIds: ['e1'] },
  teacher: { id: 'teacher-a', action: { type: 'run-test', parameters: { target: 'focused' } } },
  student: { action: { type: 'run-test', parameters: { target: 'focused' } } },
  expectedEffect: { criterionDelta: 1 }, actualEffect: { criterionDelta: 1, changed: true },
  oracle: { id: 'test-oracle', valid: true, independent: true, readOnly: true },
  safety: { rewardHacking: false, unsafe: false }, cost: { tokens: 12 },
};

const solverInput = {
  id: 'http-rename', version: '1',
  episodes: [{ id: 'verified-episode', verified: true, receiptSha256: 'a'.repeat(64) }],
  definition: {
    inputType: 'source-text', outputType: 'source-text', kind: 'text-rewrite',
    operations: [{ op: 'replace-exact', from: 'oldName', to: 'newName', maxReplacements: 1 }],
    soundnessScope: ['exact-token-rename'], knownIncompleteness: ['comments'],
  },
};

test('alpha.4 authenticated HTTP routes expose bounded foundation and Nolane-native operations', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-alpha4-http-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const smallModelFoundation = new SmallModelFoundationService();
  const operationalBoundary = new NolaneOperationalBoundaryService();
  const dependencyPreflight = new DependencyPreflightService({
    projectRoot: root,
    probeExecutable: async (name) => name === 'node' ? { available: true, version: 'test-node' } : { available: false, reason: 'missing' },
  });
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'nolane-token' }, store,
    providers: new ProviderRegistry(), missionRunner: {}, smallModelFoundation,
    operationalBoundary, dependencyPreflight, uiRoot: root,
  });
  t.after(() => service.close());

  assert.equal((await fetch(`${service.url}/api/nolane/operational/configuration`)).status, 401);

  const distilled = await (await post(`${service.url}/api/small-model/foundation/distillation`, distillationStep)).json();
  assert.match(distilled.receiptSha256, /^[a-f0-9]{64}$/);

  const redTeam = await (await post(`${service.url}/api/small-model/foundation/verifier-red-team`, {
    verifierId: 'candidate-verifier', output: { pass: true, readOnly: true, evidence: ['receipt:a'] },
  })).json();
  assert.equal(redTeam.accepted, true);

  const solver = await (await post(`${service.url}/api/small-model/foundation/solver`, solverInput)).json();
  assert.equal(solver.definition.kind, 'text-rewrite');

  const memory = await (await post(`${service.url}/api/small-model/foundation/memory/reinforce`, {
    id: 'memory-http', reward: 1, verified: true, provenance: ['episode-http'],
  })).json();
  assert.equal(memory.qValue, 0.5);

  const configuration = await (await fetch(`${service.url}/api/nolane/operational/configuration`, auth())).json();
  assert.equal(configuration.defaults.runtime, 'nolane-native');
  assert.equal(Object.hasOwn(configuration.defaults, 'nolane_nativeExecutionEnabled'), false);
  assert.equal(JSON.stringify(configuration).toLowerCase().includes('nolane_native'), false);

  const credential = await (await post(`${service.url}/api/nolane/operational/credentials`, {
    provider: 'openai', account: 'local', secretRef: { service: 'keychain', account: 'nolane-openai' }, capabilities: ['model:invoke'],
  })).json();
  assert.equal(credential.id, 'openai:local');
  assert.equal(JSON.stringify(credential).includes('api-key-value'), false);

  const authorization = await (await post(`${service.url}/api/nolane/operational/authorize`, {
    kind: 'delete-worktree', reversible: false, approvalReceiptSha256: 'b'.repeat(64),
  })).json();
  assert.equal(authorization.allowed, true);
  assert.equal(authorization.approvalRequired, true);

  const preflight = await (await post(`${service.url}/api/nolane/release/preflight`, { dependencies: [
    { id: 'node', kind: 'executable', name: 'node', required: true, remediation: 'Install Node.js.' },
    { id: 'optional-tool', kind: 'executable', name: 'missing-tool', required: false, remediation: 'Install optional tool.' },
  ] })).json();
  assert.equal(preflight.ready, true);
  assert.equal(preflight.degraded, true);
  assert.deepEqual(preflight.missingOptional, ['optional-tool']);

  const snapshot = await (await fetch(`${service.url}/api/nolane/operational/snapshot`, auth())).json();
  assert.equal(snapshot.secretValuesStored, false);
  assert.equal(snapshot.credentials.length, 1);
});
