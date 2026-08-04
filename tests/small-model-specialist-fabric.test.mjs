import test from 'node:test';
import assert from 'node:assert/strict';
import { SpecialistModelFabric } from '../src/small-model/specialist-model-fabric.mjs';

test('SpecialistModelFabric selects by capability, domain and calibrated trust', () => {
  const fabric = new SpecialistModelFabric({ maxResidentGenerative: 1 });
  fabric.register({ id: 'router-a', version: '1', kind: 'classifier', capabilities: ['route'], domains: ['js'], trust: 0.8, serializer: 'typed-v1' });
  fabric.register({ id: 'router-b', version: '1', kind: 'classifier', capabilities: ['route'], domains: ['python'], trust: 0.95, serializer: 'typed-v1' });
  assert.equal(fabric.select({ capability: 'route', domain: 'python' }).id, 'router-b');
});

test('SpecialistModelFabric enforces one resident generative model and pressure unload', () => {
  const fabric = new SpecialistModelFabric({ maxResidentGenerative: 1 });
  fabric.register({ id: 'exec-a', version: '1', kind: 'generative', capabilities: ['execute'], domains: ['*'], trust: 0.8, serializer: 'typed-v1', memoryMb: 1200 });
  fabric.register({ id: 'exec-b', version: '1', kind: 'generative', capabilities: ['execute'], domains: ['*'], trust: 0.9, serializer: 'typed-v1', memoryMb: 1400 });
  fabric.load('exec-a'); fabric.load('exec-b');
  assert.deepEqual(fabric.snapshot().resident, ['exec-b']);
  fabric.applyMemoryPressure({ availableMb: 300 });
  assert.deepEqual(fabric.snapshot().resident, []);
});

test('SpecialistModelFabric serializes typed state, records benchmark receipt and rolls back versions', () => {
  const fabric = new SpecialistModelFabric();
  fabric.register({ id: 'ranker', version: '1', kind: 'classifier', capabilities: ['rank'], domains: ['*'], trust: 0.7, serializer: 'typed-v1' });
  fabric.register({ id: 'ranker', version: '2', kind: 'classifier', capabilities: ['rank'], domains: ['*'], trust: 0.8, serializer: 'typed-v1' });
  const serialized = fabric.serialize('ranker', { goal: 'g1', evidenceIds: ['e1'] });
  assert.match(serialized, /"goal":"g1"/);
  const receipt = fabric.recordBenchmark({ id: 'ranker', version: '2', success: 0.8, latencyMs: 12, rssMbSeconds: 2 });
  assert.match(receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(fabric.rollback('ranker').version, '1');
});
