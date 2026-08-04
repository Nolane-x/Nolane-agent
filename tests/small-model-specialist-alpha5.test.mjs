import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SpecialistModelFabric } from '../src/small-model/specialist-model-fabric.mjs';
import { MultiAgentPolicyDistiller } from '../src/small-model/multi-agent-policy-distiller.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const receipt = (char) => char.repeat(64);

test('SpecialistModelFabric lazy-loads verified file-backed artifacts and exposes read-only slices', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-specialist-'));
  try {
    const bytes = Buffer.from('model-artifact-v1');
    const artifactPath = path.join(root, 'ranker.bin');
    await writeFile(artifactPath, bytes);
    const fabric = new SpecialistModelFabric();
    fabric.register({ id: 'ranker', version: '1', kind: 'reranker', capabilities: ['rank'], domains: ['*'], trust: 0.8, serializer: 'typed-v1' });
    fabric.registerArtifact({ id: 'ranker', version: '1', path: artifactPath, sha256: sha256(bytes), mapping: 'file-backed', memoryMb: 16 });
    assert.deepEqual(fabric.snapshot().resident, []);
    const loaded = await fabric.lazyLoad('ranker');
    assert.equal(loaded.mappingMode, 'file-backed-blob');
    assert.equal(loaded.byteLength, bytes.length);
    const view = await fabric.readOnlySlice('ranker', 0, 5);
    assert.equal(view.toString('utf8'), 'model');
    view[0] = 0;
    assert.equal((await fabric.readOnlySlice('ranker', 0, 5)).toString('utf8'), 'model');
    assert.deepEqual(fabric.snapshot().resident, ['ranker']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('SpecialistModelFabric refuses artifact hash mismatch and unloads under pressure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-specialist-'));
  try {
    const file = path.join(root, 'generator.bin');
    await writeFile(file, 'generator');
    const fabric = new SpecialistModelFabric({ maxResidentGenerative: 1 });
    fabric.register({ id: 'g1', version: '1', kind: 'generative', capabilities: ['generate'], domains: ['*'], trust: 0.7, serializer: 'typed-v1' });
    fabric.registerArtifact({ id: 'g1', version: '1', path: file, sha256: '0'.repeat(64), mapping: 'file-backed', memoryMb: 1024 });
    await assert.rejects(() => fabric.lazyLoad('g1'), /sha256 mismatch/i);
    fabric.registerArtifact({ id: 'g1', version: '1', path: file, sha256: sha256(Buffer.from('generator')), mapping: 'file-backed', memoryMb: 1024 });
    await fabric.lazyLoad('g1');
    const result = await fabric.pressureUnload({ availableMb: 256, requiredFreeMb: 512 });
    assert.deepEqual(result.unloaded, ['g1']);
    assert.deepEqual(fabric.snapshot().resident, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('SpecialistModelFabric supports an injected native mmap provider without exposing mutable storage', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-specialist-'));
  try {
    const bytes = Buffer.from('mapped-native');
    const file = path.join(root, 'mapped.bin');
    await writeFile(file, bytes);
    let closed = false;
    const fabric = new SpecialistModelFabric({ mappingProvider: {
      async mapReadOnly({ path: mappedPath }) {
        assert.equal(mappedPath, file);
        return { byteLength: bytes.length, async slice(start, end) { return Buffer.from(bytes.subarray(start, end)); }, async close() { closed = true; } };
      },
    } });
    fabric.register({ id: 'mapped', version: '1', kind: 'classifier', capabilities: ['classify'], domains: ['*'], trust: 0.5, serializer: 'typed-v1' });
    fabric.registerArtifact({ id: 'mapped', version: '1', path: file, sha256: sha256(bytes), mapping: 'mmap-readonly', memoryMb: 4 });
    assert.equal((await fabric.lazyLoad('mapped')).mappingMode, 'mmap-readonly');
    assert.equal((await fabric.readOnlySlice('mapped', 0, 6)).toString(), 'mapped');
    await fabric.unload('mapped');
    assert.equal(closed, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('MultiAgentPolicyDistiller requires heterogeneous verified teachers and preserves disagreement', () => {
  const distiller = new MultiAgentPolicyDistiller();
  const policy = distiller.distill({
    id: 'repair-policy', version: '1',
    teachers: [
      { id: 'planner', role: 'planner', modelFamily: 'family-a', receiptSha256: receipt('a'), trajectories: [{ stateKey: 'failing-test', action: 'read-stack', verified: true, receiptSha256: receipt('b') }] },
      { id: 'reviewer', role: 'reviewer', modelFamily: 'family-b', receiptSha256: receipt('c'), trajectories: [{ stateKey: 'failing-test', action: 'run-focused-test', verified: true, receiptSha256: receipt('d') }] },
      { id: 'executor', role: 'executor', modelFamily: 'family-a', receiptSha256: receipt('e'), trajectories: [{ stateKey: 'failing-test', action: 'read-stack', verified: true, receiptSha256: receipt('f') }] },
    ],
  });
  assert.equal(policy.actions['failing-test'], 'read-stack');
  assert.equal(policy.disagreements.length, 1);
  assert.deepEqual(policy.disagreements[0].candidates.map((item) => item.action), ['read-stack', 'run-focused-test']);
  assert.equal(policy.hiddenChainOfThoughtStored, false);
  assert.throws(() => distiller.distill({ id: 'bad', version: '1', teachers: [
    { id: 'a', role: 'same', modelFamily: 'same', receiptSha256: receipt('a'), trajectories: [{ stateKey: 'x', action: 'a', verified: true, receiptSha256: receipt('b') }] },
    { id: 'b', role: 'same', modelFamily: 'same', receiptSha256: receipt('c'), trajectories: [{ stateKey: 'x', action: 'a', verified: true, receiptSha256: receipt('d') }] },
  ] }), /heterogeneous/i);
});

test('MultiAgentPolicyDistiller promotes only on independent held-out evidence and rolls back', () => {
  const distiller = new MultiAgentPolicyDistiller();
  const make = (version, action) => distiller.distill({ id: 'p', version, teachers: [
    { id: 'a', role: 'planner', modelFamily: 'x', receiptSha256: receipt('a'), trajectories: [{ stateKey: 's', action, verified: true, receiptSha256: receipt('b') }] },
    { id: 'b', role: 'reviewer', modelFamily: 'y', receiptSha256: receipt('c'), trajectories: [{ stateKey: 's', action, verified: true, receiptSha256: receipt('d') }] },
  ] });
  make('1', 'read');
  const promoted = distiller.promote({ id: 'p', version: '1', independent: true, heldOut: true, tasks: 20, success: 0.8, baselineSuccess: 0.75, safetyViolations: 0, baselineSafetyViolations: 0 });
  assert.equal(promoted.promoted, true);
  make('2', 'test');
  assert.throws(() => distiller.promote({ id: 'p', version: '2', independent: true, heldOut: true, tasks: 20, success: 0.7, baselineSuccess: 0.75, safetyViolations: 0, baselineSafetyViolations: 0 }), /promotion gate/i);
  assert.equal(distiller.rollback('p').version, '1');
});
