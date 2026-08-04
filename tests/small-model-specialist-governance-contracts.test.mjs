import test from 'node:test';
import assert from 'node:assert/strict';
import { SpecialistModelFabric } from '../src/small-model/specialist-model-fabric.mjs';

test('specialist governance contract registers routes serializes state records resources and rolls back independently', () => {
  const fabric = new SpecialistModelFabric({ maxResidentGenerative: 1 });
  fabric.register({ id: 'router', version: '1', kind: 'router', capabilities: ['route'], domains: ['js'], trust: 0.7, serializer: 'typed-v1' });
  fabric.register({ id: 'router', version: '2', kind: 'router', capabilities: ['route'], domains: ['js'], trust: 0.8, serializer: 'typed-v1' });
  fabric.register({ id: 'executor-a', version: '1', kind: 'generative', capabilities: ['execute'], domains: ['*'], trust: 0.8, serializer: 'typed-v1' });
  fabric.register({ id: 'executor-b', version: '1', kind: 'generative', capabilities: ['execute'], domains: ['*'], trust: 0.9, serializer: 'typed-v1' });
  assert.equal(fabric.select({ capability: 'route', domain: 'js' }).version, '2');
  assert.match(fabric.serialize('router', { goal: 'repair', evidenceIds: ['e1'], secret: 'excluded' }), /"goal":"repair"/);
  assert.doesNotMatch(fabric.serialize('router', { goal: 'repair', secret: 'excluded' }), /secret/);
  fabric.load('executor-a'); fabric.load('executor-b');
  assert.deepEqual(fabric.snapshot().resident, ['executor-b']);
  assert.match(fabric.recordIndependentBenchmark({ id: 'router', version: '2', independent: true, heldOut: true, tasks: 4, success: 0.75, latencyMs: 4, rssMbSeconds: 1 }).receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(fabric.rollback('router').version, '1');
});

test('specialist governance contract rejects unsupported models unsafe trust updates invalid benchmarks and missing rollback', () => {
  const fabric = new SpecialistModelFabric();
  assert.throws(() => fabric.register({ id: 'bad', version: '1', kind: 'unknown', capabilities: [], domains: [], serializer: 'typed-v1' }), /Unsupported specialist kind/);
  fabric.register({ id: 'router', version: '1', kind: 'router', capabilities: ['route'], domains: ['*'], trust: 0.5, serializer: 'typed-v1' });
  assert.throws(() => fabric.updateDomainTrust({ id: 'router', domain: 'js', success: true, verified: false }), /Verified specialist outcome/);
  assert.throws(() => fabric.recordIndependentBenchmark({ id: 'router', version: '1', independent: false, heldOut: true, tasks: 1, success: 1, latencyMs: 1, rssMbSeconds: 1 }), /independent/);
  assert.throws(() => fabric.serialize('missing', { goal: 'x' }), /Unknown specialist/);
  assert.throws(() => fabric.rollback('router'), /No rollback version/);
});
