import test from 'node:test';
import assert from 'node:assert/strict';
import { CausalRepositoryTwin } from '../src/superiority/causal-repository-twin.mjs';

const H = (c) => c.repeat(64);

test('causal repository twin predicts bounded transitive impact and excludes stale evidence', () => {
  const twin = new CausalRepositoryTwin({ clock: () => 1000 });
  for (const node of [
    { nodeId: 'file:auth', kind: 'file', locator: 'src/auth.mjs' },
    { nodeId: 'symbol:authorize', kind: 'symbol', locator: 'src/auth.mjs#authorize' },
    { nodeId: 'test:auth', kind: 'test', locator: 'tests/auth.test.mjs' },
    { nodeId: 'contract:security', kind: 'contract', locator: 'NOL-SECURITY' },
  ]) twin.registerNode(node);
  twin.link({ from: 'file:auth', to: 'symbol:authorize', relation: 'defines', confidence: 0.95, sourceHash: H('a') });
  twin.link({ from: 'symbol:authorize', to: 'test:auth', relation: 'verified-by', confidence: 0.9, sourceHash: H('b') });
  twin.link({ from: 'symbol:authorize', to: 'contract:security', relation: 'implements', confidence: 0.85, sourceHash: H('c') });

  const prediction = twin.predictImpact({ changedNodeIds: ['file:auth'], maxDepth: 3, minimumConfidence: 0.5 });
  assert.deepEqual(prediction.affectedNodeIds, ['contract:security', 'symbol:authorize', 'test:auth']);
  assert.deepEqual(prediction.requiredTestNodeIds, ['test:auth']);
  assert.equal(prediction.claims.sourceMutationAllowed, false);

  twin.invalidateEvidence(H('b'));
  const staleAware = twin.predictImpact({ changedNodeIds: ['file:auth'], maxDepth: 3, minimumConfidence: 0.5 });
  assert.deepEqual(staleAware.requiredTestNodeIds, []);
  assert.ok(staleAware.excludedStaleEdges >= 1);
});

test('causal repository twin calibrates confidence only from observed verification outcomes and remains bounded', () => {
  const twin = new CausalRepositoryTwin({ clock: (() => { let t = 0; return () => ++t; })() });
  twin.registerNode({ nodeId: 'a', kind: 'file', locator: 'a.mjs' });
  twin.registerNode({ nodeId: 'b', kind: 'test', locator: 'b.test.mjs' });
  twin.registerNode({ nodeId: 'c', kind: 'contract', locator: 'c' });
  const edge = twin.link({ from: 'a', to: 'b', relation: 'verified-by', confidence: 0.6, sourceHash: H('d') });
  twin.link({ from: 'a', to: 'c', relation: 'implements', confidence: 0.6, sourceHash: H('e') });
  const prediction = twin.predictImpact({ changedNodeIds: ['a'] });

  assert.throws(() => twin.recordObservedOutcome({ predictionReceiptSha256: prediction.receiptSha256, observedNodeIds: ['b'], observed: false, verificationReceiptSha256: H('f') }), /observed/i);
  const outcome = twin.recordObservedOutcome({ predictionReceiptSha256: prediction.receiptSha256, observedNodeIds: ['b'], observed: true, verificationReceiptSha256: H('f') });
  assert.equal(outcome.truePositiveNodeIds.includes('b'), true);
  assert.equal(outcome.falsePositiveNodeIds.includes('c'), true);
  const snapshot = twin.snapshot();
  const updated = snapshot.edges.find((item) => item.edgeId === edge.edgeId);
  assert.ok(updated.confidence > 0.6 && updated.confidence <= 0.99);
  assert.ok(snapshot.edges.find((item) => item.to === 'c').confidence < 0.6);
  assert.equal(snapshot.claims.automaticSourceMutationAllowed, false);
});
