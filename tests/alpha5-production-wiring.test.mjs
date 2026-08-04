import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';
import { createNolaneNativeCapabilityPack } from '../src/nolane-native/capability-pack.mjs';
import { buildPlatformView, renderPlatformView } from '../ui-v3/control-plane/domains/platform.mjs';

const auth = (options = {}) => ({ ...options, headers: { authorization: 'Bearer nolane-token', 'content-type': 'application/json', ...(options.headers ?? {}) } });
const post = (url, body) => fetch(url, auth({ method: 'POST', body: JSON.stringify(body) }));
const observations = (name, quality = 0.9) => ({
  name, parameters: 100, flops: 1000,
  observations: [
    { taskId: 't1', repositoryId: 'held-a', seed: 1, tuned: false, success: 1, quality, actionErrors: 0 },
    { taskId: 't2', repositoryId: 'held-b', seed: 2, tuned: false, success: 1, quality, actionErrors: 0 },
  ],
});

test('SmallModelFoundationService exposes alpha.5 benchmark, symbolic, distillation and learning components without model claims', async () => {
  const foundation = new SmallModelFoundationService();
  const ablation = foundation.runScientificAblation({ mode: 'same-flop', independent: true, heldOut: true, baseline: observations('base', 0.8), candidate: observations('candidate', 0.9) });
  assert.equal(ablation.matchedBudget, true);
  assert.equal(ablation.claimAllowed, false);

  const codemod = foundation.applyAstCodemod({ language: 'javascript', source: 'const oldName = 1; console.log(oldName);', operations: [{ op: 'rename-identifier', from: 'oldName', to: 'newName', scope: 'program' }] });
  assert.match(codemod.output, /newName/);
  const sat = foundation.solveFiniteDomain({ variables: { x: [1, 2] }, constraints: [{ op: 'eq', left: { var: 'x' }, right: { value: 2 } }] });
  assert.equal(sat.status, 'sat');

  const policy = foundation.distillMultiAgentPolicy({ id: 'policy', version: '1', teachers: [
    { id: 'teacher-a', role: 'reviewer', modelFamily: 'symbolic', receiptSha256: 'a'.repeat(64), trajectories: [{ stateKey: 'repair', action: 'test', verified: true, receiptSha256: 'e'.repeat(64) }] },
    { id: 'teacher-b', role: 'executor', modelFamily: 'model', receiptSha256: 'b'.repeat(64), trajectories: [{ stateKey: 'repair', action: 'test', verified: true, receiptSha256: 'd'.repeat(64) }] },
  ] });
  assert.equal(policy.hiddenChainOfThoughtStored, false);
  const learned = foundation.recordAdaptationOutcome({ contextKey: 'repair', action: 'test', reward: 1, verified: true, receiptSha256: 'c'.repeat(64) });
  assert.equal(learned.qValue > 0, true);
  const snapshot = foundation.snapshot();
  assert.equal(snapshot.status.trainedModel, false);
  assert.equal(snapshot.scientificBenchmarks.receipts, 1);
  assert.equal(snapshot.policyDistillation.policies, 1);
  assert.equal(snapshot.adaptationPolicy.contexts, 1);
  assert.equal(snapshot.status.claims.competitorSuperiority, false);
});

test('authenticated HTTP routes expose bounded alpha.5 operations and native capability status', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-alpha5-http-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const foundation = new SmallModelFoundationService();
  const nativeCapabilities = await createNolaneNativeCapabilityPack({ memoryFile: path.join(root, 'memory.json'), allowHosts: ['docs.example.test'], fetchImpl: async () => new Response('docs') });
  t.after(() => nativeCapabilities.close());
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'nolane-token' }, store,
    providers: new ProviderRegistry(), missionRunner: {}, smallModelFoundation: foundation, nativeCapabilities, uiRoot: root,
  });
  t.after(() => service.close());

  assert.equal((await fetch(`${service.url}/api/nolane/native/capabilities/status`)).status, 401);
  const nativeStatus = await (await fetch(`${service.url}/api/nolane/native/capabilities/status`, auth())).json();
  assert.equal(nativeStatus.runtimeOwner, 'nolane-native');
  assert.equal(Object.hasOwn(nativeStatus, 'nolane_nativeImported'), false);
  assert.equal(JSON.stringify(nativeStatus).toLowerCase().includes('nolane_native'), false);

  const codemod = await (await post(`${service.url}/api/small-model/foundation/ast-codemod`, { language: 'javascript', source: 'const x = 1; console.log(x);', operations: [{ op: 'rename-identifier', from: 'x', to: 'value', scope: 'program' }] })).json();
  assert.match(codemod.output, /value/);
  const smt = await (await post(`${service.url}/api/small-model/foundation/smt`, { variables: { x: [1, 2] }, constraints: [{ op: 'eq', left: { var: 'x' }, right: { value: 1 } }] })).json();
  assert.equal(smt.status, 'sat');
  const benchmark = await (await post(`${service.url}/api/small-model/foundation/benchmark/ablation`, { mode: 'same-flop', independent: true, heldOut: true, baseline: observations('base', 0.8), candidate: observations('candidate', 0.9) })).json();
  assert.equal(benchmark.claimAllowed, false);
  const learned = await (await post(`${service.url}/api/small-model/foundation/adaptation/outcome`, { contextKey: 'repair', action: 'test', reward: 1, verified: true, receiptSha256: 'd'.repeat(64) })).json();
  assert.equal(learned.qValue > 0, true);

  const snapshot = await (await fetch(`${service.url}/api/small-model/foundation/snapshot`, auth())).json();
  assert.equal(snapshot.alpha5Operations.astCodemods, 1);
  assert.equal(snapshot.scientificBenchmarks.receipts, 1);
});

test('Control Plane Labs renders alpha.5 subsystem evidence and preserves non-claims', () => {
  const foundation = new SmallModelFoundationService();
  foundation.runScientificAblation({ mode: 'same-flop', independent: true, heldOut: true, baseline: observations('base', 0.8), candidate: observations('candidate', 0.9) });
  foundation.applyAstCodemod({ language: 'javascript', source: 'const x = 1;', operations: [{ op: 'rename-identifier', from: 'x', to: 'value', scope: 'program' }] });
  const view = buildPlatformView({ foundation: foundation.snapshot() });
  assert.equal(view.labs.foundation.subsystems.scientificBenchmarks, 1);
  assert.equal(view.labs.foundation.subsystems.astCodemods, 1);
  const html = renderPlatformView(view, 'labs');
  assert.match(html, /scientific benchmarks/);
  assert.match(html, /AST codemods/);
  assert.match(html, /trained-model/);
});

test('application wires native capabilities without increasing static import boundary', async () => {
  const source = await (await import('node:fs/promises')).readFile('src/app.mjs', 'utf8');
  assert.match(source, /await import\('\.\/nolane-native\/capability-pack\.mjs'\)/);
  assert.match(source, /nativeCapabilities/);
  assert.match(source, /await nativeCapabilities\.close\(\)/);
});
