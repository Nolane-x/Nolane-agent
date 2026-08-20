import test from 'node:test';
import assert from 'node:assert/strict';
import { EpistemicActionSelector } from '../src/cognition/epistemic-action-selector.mjs';

test('prefers a cheap discriminating probe and rejects irreversible action under high uncertainty', () => {
  const selector = new EpistemicActionSelector();
  const result = selector.select({
    uncertainty: 0.8,
    irreversibilityLimit: 0.3,
    actions: [
      { id: 'read-20-files', kind: 'read', taskUtility: 0.2, informationGain: 0.25, tokenCost: 8000, ramMbSeconds: 300, timeMs: 12000, irreversibility: 0 },
      { id: 'run-target-test', kind: 'probe', taskUtility: 0.3, informationGain: 0.85, tokenCost: 100, ramMbSeconds: 20, timeMs: 2000, irreversibility: 0 },
      { id: 'rewrite-cache', kind: 'patch', taskUtility: 0.9, informationGain: 0.1, tokenCost: 600, ramMbSeconds: 30, timeMs: 4000, irreversibility: 0.8 },
    ],
  });
  assert.equal(result.selected.id, 'run-target-test');
  assert.equal(result.ranked.find((item) => item.id === 'rewrite-cache').eligible, false);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('enforces the irreversibility limit independently of uncertainty', () => {
  const selector = new EpistemicActionSelector();
  for (const uncertainty of [0, 0.5, 0.500001]) {
    const result = selector.select({
      uncertainty,
      irreversibilityLimit: 0.3,
      actions: [
        { id: 'at-limit', taskUtility: 0.1, informationGain: 0.1, tokenCost: 1, ramMbSeconds: 1, timeMs: 1, irreversibility: 0.3 },
        { id: 'over-limit', taskUtility: 1, informationGain: 1, tokenCost: 1, ramMbSeconds: 1, timeMs: 1, irreversibility: 0.300001 },
      ],
    });
    assert.equal(result.ranked.find((item) => item.id === 'at-limit').eligible, true);
    assert.equal(result.ranked.find((item) => item.id === 'over-limit').eligible, false);
    assert.equal(result.ranked.find((item) => item.id === 'over-limit').rejectedReason, 'irreversibility-exceeds-limit');
  }
});

test('uses an evidence-backed uncertainty floor without discarding the caller claim', () => {
  const selector = new EpistemicActionSelector();

  const result = selector.select({
    uncertainty: 0.1,
    uncertaintyFloor: 0.75,
    actions: [{ id: 'bounded-probe', taskUtility: 0.4, informationGain: 0.7, tokenCost: 1, ramMbSeconds: 1, timeMs: 1, irreversibility: 0.4 }],
  });

  assert.equal(result.uncertainty, 0.75);
  assert.equal(result.claimedUncertainty, 0.1);
  assert.equal(result.uncertaintyFloor, 0.75);
});
