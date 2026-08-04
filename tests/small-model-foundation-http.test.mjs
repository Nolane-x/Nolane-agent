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
const episode = { id:'ep-http', kind:'tool-policy', state:{taskType:'repair'}, action:{type:'test',parameters:{}}, expectedEffect:{criterionDelta:1}, actualEffect:{criterionDelta:1,changed:true}, verifier:{valid:true,rewardHacking:false}, cost:{tokens:1,rssMbSeconds:1} };

test('small-model foundation HTTP API is authenticated and exposes real receipts without trained-model claims', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-small-http-')); t.after(() => rm(root,{recursive:true,force:true}));
  await writeFile(path.join(root,'index.html'),'<!doctype html>');
  const store = new StudioStore(path.join(root,'studio.db')); t.after(()=>store.close());
  const foundation = new SmallModelFoundationService();
  foundation.verifiers.register({ id:'deterministic', soundnessScope:['contract'], readOnly:true, independent:true, evaluate:()=>({pass:true,criterionDelta:1}) });
  const service = await createHttpServer({ config:{host:'127.0.0.1',port:0,authToken:'nolane-token'}, store, providers:new ProviderRegistry(), missionRunner:{}, smallModelFoundation:foundation, uiRoot:root });
  t.after(()=>service.close());
  assert.equal((await fetch(`${service.url}/api/small-model/foundation/status`)).status,401);
  const status = await (await fetch(`${service.url}/api/small-model/foundation/status`,auth())).json();
  assert.equal(status.foundationReady,true); assert.equal(status.trainedModel,false); assert.equal(status.claims.frontierParity,false);
  const stored = await (await fetch(`${service.url}/api/small-model/foundation/trajectory`,auth({method:'POST',body:JSON.stringify(episode)}))).json();
  assert.match(stored.receiptSha256,/^[a-f0-9]{64}$/);
  const verified = await (await fetch(`${service.url}/api/small-model/foundation/verify`,auth({method:'POST',body:JSON.stringify({candidateId:'c1',expectedEffect:{criterionDelta:1}})}))).json();
  assert.equal(verified.status,'pass');
  const allocation = await (await fetch(`${service.url}/api/small-model/foundation/allocate`,auth({method:'POST',body:JSON.stringify({difficulty:.8,uncertainty:.8,risk:.8,profile:'lite'})}))).json();
  assert.equal(allocation.modelTier,'local-small');
  const snapshot = await (await fetch(`${service.url}/api/small-model/foundation/snapshot`,auth())).json();
  assert.equal(snapshot.trajectory.episodes,1); assert.equal(snapshot.verifiers.receipts,1);
});


test('application wires the foundation service into the authenticated HTTP server', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('src/app.mjs','utf8');
  assert.match(source,/SmallModelFoundationService/);
  assert.match(source,/const smallModelFoundation = new SmallModelFoundationService/);
  assert.match(source,/sessionStore, smallModelFoundation, nativeCapabilities, operationalBoundary, dependencyPreflight, workspaceTrust/);
});

test('authenticated HTTP API trains and governs bounded specialist artifacts', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-small-model-http-')); t.after(() => rm(root,{recursive:true,force:true}));
  await writeFile(path.join(root,'index.html'),'<!doctype html>');
  const store = new StudioStore(path.join(root,'studio.db')); t.after(()=>store.close());
  const foundation = new SmallModelFoundationService();
  const service = await createHttpServer({ config:{host:'127.0.0.1',port:0,authToken:'nolane-token'}, store, providers:new ProviderRegistry(), missionRunner:{}, smallModelFoundation:foundation, uiRoot:root });
  t.after(()=>service.close());
  const trainingExamples = Array.from({ length: 12 }, (_, index) => [
    { state: { phase: 'discovery', hasCandidate: false, variant: index }, action: { type: 'search' } },
    { state: { phase: 'verification', patchReady: true, variant: index }, action: { type: 'test' } },
  ]).flat();
  const trainedResponse = await fetch(`${service.url}/api/small-model/foundation/model/train`, auth({ method:'POST', body:JSON.stringify({ specialist:'tool-router', examples:trainingExamples, datasetReceiptSha256:'a'.repeat(64), trainingConfig:{dimensions:64,epochs:60,learningRate:0.15,seed:'http-trained'} }) }));
  assert.equal(trainedResponse.status, 201);
  const artifact = await trainedResponse.json();
  assert.match(artifact.artifactSha256,/^[a-f0-9]{64}$/);
  const status = await (await fetch(`${service.url}/api/small-model/foundation/status`,auth())).json();
  assert.equal(status.trainedModel,true);
  assert.equal(status.claims.generalCodingIntelligence,false);

  const inference = await (await fetch(`${service.url}/api/small-model/foundation/model/infer`, auth({ method:'POST', body:JSON.stringify({ artifactSha256:artifact.artifactSha256, state:{phase:'discovery',hasCandidate:false,variant:99}, topK:2 }) }))).json();
  assert.equal(inference.action,'search');
  const evaluation = await (await fetch(`${service.url}/api/small-model/foundation/model/evaluate`, auth({ method:'POST', body:JSON.stringify({ artifactSha256:artifact.artifactSha256, examples:trainingExamples, independent:true, heldOut:true, minAccuracy:0.9 }) }))).json();
  assert.equal(evaluation.allowed,true);
  const rejected = await fetch(`${service.url}/api/small-model/foundation/model/promote`, auth({ method:'POST', body:JSON.stringify({ artifactSha256:artifact.artifactSha256, evaluation }) }));
  assert.equal(rejected.status,500);
  const promoted = await (await fetch(`${service.url}/api/small-model/foundation/model/promote`, auth({ method:'POST', body:JSON.stringify({ artifactSha256:artifact.artifactSha256, evaluation, approvedBy:'checkpoint-owner' }) }))).json();
  assert.equal(promoted.status,'promoted');
  const active = await (await fetch(`${service.url}/api/small-model/foundation/model/active?specialist=tool-router`,auth())).json();
  assert.equal(active.artifactSha256,artifact.artifactSha256);
});

test('authenticated HTTP API bootstraps the four-specialist suite and serves fail-closed decision support', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-specialist-suite-http-')); t.after(() => rm(root,{recursive:true,force:true}));
  await writeFile(path.join(root,'index.html'),'<!doctype html>');
  const store = new StudioStore(path.join(root,'studio.db')); t.after(()=>store.close());
  const foundation = new SmallModelFoundationService();
  const service = await createHttpServer({ config:{host:'127.0.0.1',port:0,authToken:'nolane-token'}, store, providers:new ProviderRegistry(), missionRunner:{}, smallModelFoundation:foundation, uiRoot:root });
  t.after(()=>service.close());

  const before = await (await fetch(`${service.url}/api/small-model/foundation/model/suite-status`, auth())).json();
  assert.equal(before.ready, false);
  const denied = await fetch(`${service.url}/api/small-model/foundation/model/bootstrap-suite`, auth({ method:'POST', body:JSON.stringify({ root:process.cwd(), variants:12 }) }));
  assert.equal(denied.status, 500);
  const bootstrapped = await (await fetch(`${service.url}/api/small-model/foundation/model/bootstrap-suite`, auth({ method:'POST', body:JSON.stringify({ root:process.cwd(), variants:12, approvedBy:'checkpoint-owner' }) }))).json();
  assert.equal(bootstrapped.promotions.length, 4);

  const decisionInput = {
    context: { specialist:'context-scorer', relevance:'high', fresh:true, trusted:true, contradiction:false, userPinned:false, authoritative:false, generatedNoise:false, sourcePath:'src/app.mjs', testPath:'tests/app.test.mjs', variant:91, tokenCost:20, ageHours:1, repositoryScope:'nolane-agent' },
    test: { specialist:'test-selector', sourcePath:'src/app.mjs', testPath:'tests/app.test.mjs', variant:91, changedFiles:1, changedSymbols:2, risk:'low', publicApiChanged:false, crossModule:false, dependencyChanged:false, assertionChanged:false, regressionUnknown:false },
    patch: { specialist:'patch-ranker', sourcePath:'src/app.mjs', testPath:'tests/app.test.mjs', variant:91, scopeMatch:true, testsPassed:true, hiddenTestsPassed:true, securityFindings:0, risk:'low', regressionDetected:false, apiChange:false, evidenceComplete:true, reversible:true },
    risk: { specialist:'risk-classifier', sourcePath:'src/app.mjs', testPath:'tests/app.test.mjs', variant:91, reversible:true, outsideWorkspace:false, destructive:false, secretAccess:false, networkEgress:false, operation:'read-or-local-test', filesAffected:1, schemaChange:false, authChange:false },
  };
  const decision = await (await fetch(`${service.url}/api/small-model/foundation/model/decision-support`, auth({ method:'POST', body:JSON.stringify(decisionInput) }))).json();
  assert.equal(decision.status, 'allow');
  const after = await (await fetch(`${service.url}/api/small-model/foundation/model/suite-status`, auth())).json();
  assert.equal(after.ready, true);
});
