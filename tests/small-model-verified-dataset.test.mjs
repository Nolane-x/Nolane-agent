import test from 'node:test';
import assert from 'node:assert/strict';
import { createVerifiedExample, buildDeterministicSplit } from '../src/small-model/verified-dataset.mjs';
import { buildBootstrapToolRoutingDataset } from '../src/small-model/bootstrap-tool-routing-dataset.mjs';

const H = (char) => char.repeat(64);
function example(id, action, group) {
  return createVerifiedExample({
    id, taskId: `task-${id}`, repositoryId: 'nolane-agent', scenarioGroup: group,
    state: { phase: 'verification', objective: `Objective ${id}`, evidenceCount: 1 },
    action: { type: action }, expectedEffect: { action }, actualEffect: { changed: true, criterionDelta: 1 },
    verifier: { valid: true, independent: true, receiptSha256: H('a') }, cost: { tokens: 0, wallMs: 1 },
  });
}

test('verified dataset accepts public state/action/effect and rejects hidden or unverified examples', () => {
  const value = example('1', 'test', 'g1');
  assert.equal(value.action.type, 'test');
  assert.match(value.exampleSha256, /^[a-f0-9]{64}$/);
  assert.throws(() => createVerifiedExample({ ...value, id: 'hidden', state: { chainOfThought: 'secret' } }), /hidden reasoning/i);
  assert.throws(() => createVerifiedExample({ ...value, id: 'bad', verifier: { valid: false } }), /valid verifier/i);
});

test('deterministic split is group-disjoint, byte-stable and preserves all labels', () => {
  const examples = [];
  for (let group = 0; group < 10; group += 1) for (const action of ['read','search','test']) examples.push(example(`${group}-${action}`, action, `g-${group}`));
  const first = buildDeterministicSplit({ examples, seed: 'cp3', heldOutRatio: 0.2, validationRatio: 0.2, disjointBy: 'scenarioGroup' });
  const second = buildDeterministicSplit({ examples, seed: 'cp3', heldOutRatio: 0.2, validationRatio: 0.2, disjointBy: 'scenarioGroup' });
  assert.equal(first.receiptSha256, second.receiptSha256);
  const groups = (items) => new Set(items.map((item) => item.scenarioGroup));
  const train = groups(first.train), validation = groups(first.validation), heldOut = groups(first.heldOut);
  assert.equal([...train].some((item) => validation.has(item) || heldOut.has(item)), false);
  assert.equal([...validation].some((item) => heldOut.has(item)), false);
  for (const split of [first.train, first.validation, first.heldOut]) assert.deepEqual([...new Set(split.map((item) => item.action.type))].sort(), ['read','search','test']);
});

test('bootstrap tool-routing dataset uses repository paths and covers six bounded actions', async () => {
  const dataset = await buildBootstrapToolRoutingDataset({ root: process.cwd(), variants: 12 });
  assert.equal(dataset.examples.length, 72);
  assert.deepEqual(dataset.labels, ['patch','read','rollback','search','stop','test']);
  assert.equal(dataset.examples.every((item) => item.repositoryId === 'nolane-agent'), true);
  assert.equal(dataset.examples.every((item) => item.verifier.valid === true), true);
  assert.match(dataset.receiptSha256, /^[a-f0-9]{64}$/);
});
