import test from 'node:test';
import assert from 'node:assert/strict';
import { SpecialistModelFabric } from '../src/small-model/specialist-model-fabric.mjs';

test('SpecialistModelFabric updates domain-conditioned trust from verified outcomes', () => {
  const fabric = new SpecialistModelFabric();
  fabric.register({ id: 'router-a', version: '1', kind: 'classifier', capabilities: ['route'], domains: ['js', 'python'], trust: 0.5, serializer: 'typed-v1' });
  fabric.register({ id: 'router-b', version: '1', kind: 'classifier', capabilities: ['route'], domains: ['js'], trust: 0.6, serializer: 'typed-v1' });
  fabric.updateDomainTrust({ id: 'router-a', domain: 'js', success: true, verified: true, learningRate: 0.5 });
  assert.equal(fabric.select({ capability: 'route', domain: 'js' }).id, 'router-a');
  const receipt = fabric.updateDomainTrust({ id: 'router-a', domain: 'python', success: false, verified: true, learningRate: 0.5 });
  assert.equal(receipt.domain, 'python');
  assert.match(receipt.receiptSha256, /^[a-f0-9]{64}$/);
});

test('SpecialistModelFabric shares typed embedding and state schemas', () => {
  const fabric = new SpecialistModelFabric();
  fabric.registerSharedSchema({ id: 'repo-state', version: '1', embeddingDimensions: 3, stateFields: ['goal', 'evidenceIds'] });
  const validated = fabric.validateSharedRepresentation({ schemaId: 'repo-state', embedding: [0.1, 0.2, 0.3], state: { goal: 'g1', evidenceIds: ['e1'], privateScratchpad: 'drop' } });
  assert.deepEqual(validated.embedding, [0.1, 0.2, 0.3]);
  assert.equal(validated.serializedState.includes('privateScratchpad'), false);
  assert.throws(() => fabric.validateSharedRepresentation({ schemaId: 'repo-state', embedding: [0.1], state: { goal: 'g1' } }), /dimensions/i);
});

test('SpecialistModelFabric requires independent held-out benchmark receipts for every specialist', () => {
  const fabric = new SpecialistModelFabric();
  fabric.register({ id: 'ranker', version: '1', kind: 'reranker', capabilities: ['rank'], domains: ['*'], trust: 0.7, serializer: 'typed-v1' });
  fabric.register({ id: 'router', version: '1', kind: 'router', capabilities: ['route'], domains: ['*'], trust: 0.8, serializer: 'typed-v1' });
  assert.throws(() => fabric.recordIndependentBenchmark({ id: 'ranker', version: '1', independent: false, heldOut: true, tasks: 10, success: 0.8, latencyMs: 5, rssMbSeconds: 2 }), /independent/i);
  fabric.recordIndependentBenchmark({ id: 'ranker', version: '1', independent: true, heldOut: true, tasks: 10, success: 0.8, latencyMs: 5, rssMbSeconds: 2 });
  fabric.recordIndependentBenchmark({ id: 'router', version: '1', independent: true, heldOut: true, tasks: 12, success: 0.9, latencyMs: 3, rssMbSeconds: 1 });
  const certification = fabric.certifyIndependentBenchmarks();
  assert.equal(certification.complete, true);
  assert.deepEqual(certification.specialists, ['ranker@1', 'router@1']);
});
