import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { DecisionPlane } from '../src/decision/decision-plane.mjs';

const H = (c) => c.repeat(64);
const auth = (body, method = 'POST') => ({ method, headers: { authorization: 'Bearer superiority-token', 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

test('authenticated superiority API compiles proof missions, predicts repository impact, runs tournaments, and routes models', async (t) => {
  const decision = new DecisionPlane({ clock: (() => { let n = 0; return () => ++n; })() });
  const service = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'superiority-token' },
    store: { listEvents: () => [], listProjects: () => [], listMissions: () => [] },
    providers: new ProviderRegistry(), missionRunner: {}, missionResourceFabric: { decision, publicView: () => ({}) }, uiRoot: path.resolve('ui'),
  });
  t.after(() => { decision.close(); service.close(); });

  assert.equal((await fetch(`${service.url}/api/superiority/snapshot`)).status, 401);
  let response = await fetch(`${service.url}/api/superiority/proof/compile`, auth({ missionId: 'm1', goal: 'x', criteria: [{ claimId: 'c', claim: 'works' }] }));
  assert.equal(response.status, 201);
  const proof = await response.json();
  assert.equal(proof.authorization.deployAllowed, false);

  await fetch(`${service.url}/api/superiority/twin/nodes`, auth({ nodeId: 'file:a', kind: 'file', locator: 'a.mjs' }));
  await fetch(`${service.url}/api/superiority/twin/nodes`, auth({ nodeId: 'test:a', kind: 'test', locator: 'a.test.mjs' }));
  await fetch(`${service.url}/api/superiority/twin/edges`, auth({ from: 'file:a', to: 'test:a', relation: 'verified-by', confidence: 0.9, sourceHash: H('a') }));
  response = await fetch(`${service.url}/api/superiority/twin/predict`, auth({ changedNodeIds: ['file:a'] }));
  assert.deepEqual((await response.json()).requiredTestNodeIds, ['test:a']);

  await fetch(`${service.url}/api/superiority/tournament/open`, auth({ tournamentId: 't1', missionPlanReceiptSha256: proof.receiptSha256, minimumProofCoverage: 0.8 }));
  await fetch(`${service.url}/api/superiority/tournament/candidates`, auth({ tournamentId: 't1', candidateId: 'candidate', proposerKey: 'builder', proofPlanReceiptSha256: proof.receiptSha256, patchHash: H('b'), expectedEffectHash: H('c'), reversibility: { score: 1, rollbackReceiptSha256: H('d') }, resourceCost: { tokens: 10, elapsedMs: 10 } }));
  await fetch(`${service.url}/api/superiority/tournament/attacks`, auth({ tournamentId: 't1', candidateId: 'candidate', attackId: 'attack', severity: 'high', status: 'refuted', falsifierKey: 'red', evidenceHash: H('e') }));
  await fetch(`${service.url}/api/superiority/tournament/verifications`, auth({ tournamentId: 't1', candidateId: 'candidate', status: 'pass', observed: true, proofCoverage: 1, correctnessScore: 1, verifierKey: 'judge', evidenceHash: H('f') }));
  response = await fetch(`${service.url}/api/superiority/tournament/decide`, auth({ tournamentId: 't1' }));
  assert.equal((await response.json()).selectedCandidateId, 'candidate');

  for (const model of [
    { modelId: 'small', tier: 'small', privacy: 'remote', status: 'active', costPer1kTokens: 0.1, latencyMs: 50, baselineReliability: 0.9, capabilities: ['coding', 'verification'] },
    { modelId: 'large', tier: 'large', privacy: 'remote', status: 'active', costPer1kTokens: 2, latencyMs: 200, baselineReliability: 0.98, capabilities: ['coding', 'verification'] },
  ]) await fetch(`${service.url}/api/superiority/models/register`, auth(model));
  response = await fetch(`${service.url}/api/superiority/models/route`, auth({ taskId: 'task', taskFamily: 'coding', difficulty: 0.2, uncertainty: 0.1, blastRadius: 0.1, tokenBudget: 1000 }));
  assert.equal((await response.json()).primaryModelId, 'small');

  response = await fetch(`${service.url}/api/superiority/snapshot`, auth(undefined, 'GET'));
  const snapshot = await response.json();
  assert.equal(snapshot.claims.comparativeSuperiorityClaimAllowed, false);
  assert.equal(JSON.stringify(snapshot).includes('secret-value'), false);
});

test('superiority API rejects malformed proof requests without exposing internals', async (t) => {
  const decision = new DecisionPlane();
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'superiority-token' }, store: { listEvents: () => [], listProjects: () => [], listMissions: () => [] }, providers: new ProviderRegistry(), missionRunner: {}, missionResourceFabric: { decision, publicView: () => ({}) }, uiRoot: path.resolve('ui') });
  t.after(() => { decision.close(); service.close(); });
  const response = await fetch(`${service.url}/api/superiority/proof/compile`, auth({ missionId: '', goal: '', criteria: [] }));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, 'bad-request');
  assert.equal('stack' in body, false);
});
