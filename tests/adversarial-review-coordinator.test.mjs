import test from 'node:test';
import assert from 'node:assert/strict';

import { AdversarialReviewCoordinator } from '../src/verification/adversarial-review-coordinator.mjs';

const hash = (char) => char.repeat(64);

test('selects a reviewer independent from the executor and omits executor rationale', async () => {
  let request;
  const reviewService = {
    async review(input) {
      request = input;
      return { reviewId: 'review-1', receiptSha256: hash('a'), findings: [] };
    },
  };
  const coordinator = new AdversarialReviewCoordinator({ reviewService });
  const result = await coordinator.review({
    projectId: 'project-1',
    executor: { id: 'executor', providerId: 'openai', model: 'gpt', harnessProfile: 'codex' },
    reviewerCandidates: [
      { id: 'same', providerId: 'openai', model: 'gpt', harnessProfile: 'codex', role: 'reviewer' },
      { id: 'claude-reviewer', providerId: 'anthropic', model: 'claude', harnessProfile: 'claude-review', role: 'reviewer' },
    ],
    diff: 'diff --git a/a.mjs b/a.mjs\n+x();\n',
    requirements: [{ id: 'r1', text: 'Keep auth safe' }],
    evidence: [{ evidenceId: 'ev1', claim: 'Auth input reaches validator', receiptSha256: hash('b') }],
    testReceipts: [{ kind: 'security', status: 'pass', receiptSha256: hash('c') }],
    residualRisks: ['platform difference'],
    executorRationale: 'private hidden reasoning',
  });
  assert.equal(result.reviewer.id, 'claude-reviewer');
  assert.equal(request.reviewerId, 'claude-reviewer');
  assert.equal(Object.hasOwn(request.reviewContext, 'executorRationale'), false);
  assert.equal(JSON.stringify(request).includes('private hidden reasoning'), false);
  assert.deepEqual(request.reviewContext.requirements, [{ id: 'r1', text: 'Keep auth safe' }]);
  assert.equal(result.status, 'pass');
});

test('uses a different harness profile when only one provider and model exist', async () => {
  const coordinator = new AdversarialReviewCoordinator({ reviewService: { review: async () => ({ reviewId: 'r', receiptSha256: hash('d'), findings: [] }) } });
  const result = await coordinator.review({
    projectId: 'p', executor: { id: 'builder', providerId: 'local', model: 'qwen', harnessProfile: 'implementation' },
    reviewerCandidates: [{ id: 'reviewer', providerId: 'local', model: 'qwen', harnessProfile: 'adversarial-review', role: 'reviewer' }],
    diff: '+safe();', requirements: [], evidence: [], testReceipts: [], residualRisks: [],
  });
  assert.equal(result.independence.kind, 'harness-role');
  assert.equal(result.status, 'pass');
});

test('blocks high and critical disagreement until a verified resolution exists', async () => {
  const finding = { fingerprint: hash('e'), severity: 'critical', category: 'security', message: 'Auth bypass', path: 'src/auth.mjs', line: 4 };
  const coordinator = new AdversarialReviewCoordinator({ reviewService: { review: async () => ({ reviewId: 'r2', receiptSha256: hash('f'), findings: [finding] }) } });
  const input = {
    projectId: 'p', executor: { id: 'builder', providerId: 'a', model: 'm1', harnessProfile: 'impl' },
    reviewerCandidates: [{ id: 'reviewer', providerId: 'b', model: 'm2', harnessProfile: 'review', role: 'reviewer' }],
    diff: '+unsafe();', requirements: [], evidence: [], testReceipts: [], residualRisks: [],
  };
  const blocked = await coordinator.review(input);
  assert.equal(blocked.status, 'blocked');
  assert.deepEqual(blocked.unresolvedFindingFingerprints, [hash('e')]);

  const resolved = await coordinator.review({ ...input, resolutions: [{ findingFingerprint: hash('e'), status: 'repaired', receiptSha256: hash('1') }] });
  assert.equal(resolved.status, 'pass');
  assert.equal(resolved.unresolvedFindingFingerprints.length, 0);
});
