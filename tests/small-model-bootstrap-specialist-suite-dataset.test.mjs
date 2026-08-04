import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBootstrapSpecialistDataset, SUPPORTED_BOOTSTRAP_SPECIALISTS } from '../src/small-model/bootstrap-specialist-suite-dataset.mjs';
import { buildDeterministicSplit } from '../src/small-model/verified-dataset.mjs';

const expectedLabels = {
  'context-scorer': ['counter-evidence', 'exclude', 'pin', 'support'],
  'test-selector': ['full', 'integration', 'mutation', 'unit'],
  'patch-ranker': ['accept', 'reject', 'review', 'rollback'],
  'risk-classifier': ['critical', 'high', 'low', 'medium'],
};

test('bootstrap specialist datasets are deterministic, distinct, verified, and split-disjoint', async () => {
  assert.deepEqual([...SUPPORTED_BOOTSTRAP_SPECIALISTS], Object.keys(expectedLabels).sort());
  const receipts = new Set();
  for (const specialist of SUPPORTED_BOOTSTRAP_SPECIALISTS) {
    const first = await buildBootstrapSpecialistDataset({ root: process.cwd(), specialist, variants: 12 });
    const second = await buildBootstrapSpecialistDataset({ root: process.cwd(), specialist, variants: 12 });
    assert.deepEqual(first, second);
    assert.deepEqual(first.labels, expectedLabels[specialist]);
    assert.equal(first.examples.length, 48);
    assert.equal(first.examples.every((item) => item.verifier.valid && item.verifier.independent && item.hiddenChainOfThoughtStored === false), true);
    assert.equal(JSON.stringify(first).includes('privateScratchpad'), false);
    receipts.add(first.receiptSha256);
    const split = buildDeterministicSplit({ examples: first.examples, seed: `cp4-${specialist}`, heldOutRatio: 0.2, validationRatio: 0.2 });
    const groups = (items) => new Set(items.map((item) => item.scenarioGroup));
    const train = groups(split.train), validation = groups(split.validation), held = groups(split.heldOut);
    assert.equal([...train].some((value) => validation.has(value) || held.has(value)), false);
    assert.equal([...validation].some((value) => held.has(value)), false);
  }
  assert.equal(receipts.size, 4);
});

test('bootstrap specialist dataset rejects unknown specialists and unsafe variant counts', async () => {
  await assert.rejects(() => buildBootstrapSpecialistDataset({ specialist: 'general-agi', variants: 12 }), /unsupported specialist/i);
  await assert.rejects(() => buildBootstrapSpecialistDataset({ specialist: 'risk-classifier', variants: 1 }), /variants/i);
});
