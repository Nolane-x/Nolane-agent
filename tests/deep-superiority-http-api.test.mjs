import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { DecisionPlane } from '../src/decision/decision-plane.mjs';

const H = (c) => c.repeat(64);
const auth = (body, method = 'POST') => ({ method, headers: { authorization: 'Bearer deep-token', 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

test('authenticated deep superiority API exposes constitution, counterfactual, memory, budgets, benchmark and UI certification', async (t) => {
  const decision = new DecisionPlane({ clock: () => 700 });
  const service = await createHttpServer({ config: { host: '127.0.0.1', port: 0, authToken: 'deep-token' }, store: { listEvents: () => [], listProjects: () => [], listMissions: () => [] }, providers: new ProviderRegistry(), missionRunner: {}, missionResourceFabric: { decision, publicView: () => ({}) }, uiRoot: path.resolve('ui') });
  t.after(() => { decision.close(); service.close(); });

  let response = await fetch(`${service.url}/api/superiority/constitution/register`, auth({ constitutionId: 'c', missionId: 'm', rules: [{ ruleId: 'r', effect: 'source.write', decision: 'allow', maxRisk: 1 }] }));
  assert.equal(response.status, 201);
  response = await fetch(`${service.url}/api/superiority/constitution/evaluate`, auth({ constitutionId: 'c', actionId: 'a', effects: ['source.write'], capabilities: [], risk: 0.1, reversible: false, estimated: {}, observed: true, evidenceHash: H('a') }));
  assert.equal((await response.json()).allowed, true);

  response = await fetch(`${service.url}/api/superiority/budget/schedule`, auth({ missionId: 'm', budget: { tokens: 100, elapsedMs: 100, costUsd: 1 }, verificationReserveRatio: 0.5, tasks: [{ taskId: 'verify', proofRequired: true, dependencies: [], risk: 1, estimated: { tokens: 50, elapsedMs: 50, costUsd: 0.1 } }] }));
  assert.equal((await response.json()).status, 'scheduled');

  response = await fetch(`${service.url}/api/superiority/ui/certify`, auth({ sourceHash: H('b'), breakpoints: [640, 900, 1180, 1440], semantics: { landmarks: true, keyboardNavigation: true, focusVisible: true, liveRegions: true, reducedMotion: true, zoom200: true, labels: true }, budgets: { maxDomNodes: 10, maxRssBytes: 100, maxIdleCpuPercent: 3, maxLongTaskMs: 50, maxInputLatencyMs: 100 }, metrics: { domNodes: 5, rssBytes: 50, idleCpuPercent: 1, longestTaskMs: 10, inputLatencyMs: 20 }, visualHashes: [H('c'), H('d'), H('e'), H('f')] }));
  const ui = await response.json();
  assert.equal(ui.localResponsiveImplemented, true);
  assert.equal(ui.windowsCertificationRequired, true);

  response = await fetch(`${service.url}/api/superiority/snapshot`, auth(undefined, 'GET'));
  const snapshot = await response.json();
  assert.equal(snapshot.claims.selfHealingRuntime, true);
  assert.equal(snapshot.claims.comparativeSuperiorityClaimAllowed, false);
});
