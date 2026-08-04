import assert from 'node:assert/strict';
import test from 'node:test';

import { createDecisionReceipt } from '../src/decision/decision-receipt-service.mjs';

function input(overrides = {}) {
  return {
    decisionId: 'decision-104',
    taskId: 'task-18',
    goal: 'Fix expired session cache',
    hypotheses: [
      { id: 'h1', confidence: 0.12, claim: 'Cache invalidation is missing' },
      { id: 'h2', confidence: 0.81, claim: 'Expiration milliseconds are normalized incorrectly' },
    ],
    evidenceUsed: ['ev-12', 'ev-19'],
    counterEvidenceUsed: ['ev-27'],
    alternativesRejected: [{ action: 'Rewrite cache service', reason: 'Unnecessary semantic footprint' }],
    selectedAction: 'Normalize expiration milliseconds',
    expectedImpact: ['validateSession'],
    actualImpact: ['validateSession'],
    patchMetrics: { files: 1, changedLines: 7, semanticFootprint: 3, revertedLines: 0 },
    verification: { targetedTests: 'passed', impactedTests: 'passed', verifiedCriterionIds: ['root-fixed'] },
    resourceCost: { inputTokens: 3000, outputTokens: 421, rssMbSeconds: 18420 },
    createdAtMs: 100,
    ...overrides,
  };
}

test('createDecisionReceipt creates deterministic privacy-safe public reasoning receipts', () => {
  const a = createDecisionReceipt(input());
  const b = createDecisionReceipt(input());
  assert.equal(a.receiptSha256, b.receiptSha256);
  assert.equal(a.schema, 'forge.decision-receipt.v1');
  assert.deepEqual(a.counterEvidenceUsed, ['ev-27']);
  assert.equal(a.patchMetrics.semanticFootprint, 3);
  assert.equal(a.resourceCost.rssMbSeconds, 18420);
  assert.equal(Object.isFrozen(a), true);
  assert.equal(Object.isFrozen(a.hypotheses), true);
});

test('createDecisionReceipt rejects chain of thought, raw prompts, model output and environment dumps', () => {
  for (const forbidden of [
    { chainOfThought: 'private reasoning' },
    { rawPrompt: 'system prompt' },
    { modelOutput: 'raw answer' },
    { environment: { HOME: '/secret' } },
    { metadata: { password: 'secret' } },
    { alternativesRejected: [{ action: 'x', reason: 'y', apiKey: 'secret' }] },
  ]) {
    assert.throws(() => createDecisionReceipt(input(forbidden)), /forbidden private or secret field/i);
  }
});

test('createDecisionReceipt validates confidence, bounded fields and numeric impact metrics', () => {
  assert.throws(() => createDecisionReceipt(input({ hypotheses: [{ id: 'h1', confidence: 2, claim: 'bad' }] })), /confidence/i);
  assert.throws(() => createDecisionReceipt(input({ evidenceUsed: [] })), /evidenceUsed/i);
  assert.throws(() => createDecisionReceipt(input({ patchMetrics: { files: -1, changedLines: 2, semanticFootprint: 1 } })), /files/i);
  assert.throws(() => createDecisionReceipt(input({ selectedAction: 'x'.repeat(20_001) })), /selectedAction/i);
});

test('createDecisionReceipt preserves criterion snapshots without allowing them to claim completion', () => {
  const receipt = createDecisionReceipt(input({
    criterionSnapshot: {
      taskId: 'task-18',
      totalCriteriaWeight: 7,
      verifiedCriteriaScore: 4,
      criteria: [
        { criterionId: 'root-fixed', weight: 4, verified: true },
        { criterionId: 'old-tests', weight: 3, verified: false },
      ],
      receiptSha256: 'a'.repeat(64),
    },
  }));
  assert.equal(receipt.criterionSnapshot.verifiedCriteriaScore, 4);
  assert.equal(receipt.criterionSnapshot.criteria[1].verified, false);
});
