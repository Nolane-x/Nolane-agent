import assert from 'node:assert/strict';
import test from 'node:test';
import { SemanticProgressDetector } from '../src/cognition/semantic-progress-detector.mjs';
const sha = (c) => c.repeat(64);

test('counts verified criterion test semantic and information gains as progress', () => {
  const detector = new SemanticProgressDetector({ noProgressWindow: 3 });
  detector.observe({ scope: 'mission:m1', observationId: 'o1', actionFingerprint: 'a', verificationReceiptSha256: sha('a'), verifiedCriteriaScore: 1, testsPassed: 10, testsFailed: 2, semanticDiffHash: sha('b'), semanticDiffUnits: 2, informationGain: 0.2 });
  detector.observe({ scope: 'mission:m1', observationId: 'o2', actionFingerprint: 'b', verificationReceiptSha256: sha('c'), verifiedCriteriaScore: 2, testsPassed: 12, testsFailed: 1, semanticDiffHash: sha('d'), semanticDiffUnits: 3, informationGain: 0.4 });
  const result = detector.evaluate('mission:m1');
  assert.equal(result.status, 'progressing');
  assert.ok(result.signals.includes('verified-criteria-increased'));
  assert.ok(result.signals.includes('tests-improved'));
  assert.ok(result.signals.includes('semantic-change-verified'));
  assert.ok(result.signals.includes('information-gained'));
});

test('duplicate verification receipts are idempotent and churn-only diffs do not count', () => {
  const detector = new SemanticProgressDetector({ noProgressWindow: 2 });
  detector.observe({ scope: 'task:t1', observationId: 'o1', actionFingerprint: 'same', verificationReceiptSha256: sha('a'), verifiedCriteriaScore: 1, testsPassed: 5, testsFailed: 0, semanticDiffHash: sha('b'), semanticDiffUnits: 1, informationGain: 0.1 });
  const duplicate = detector.observe({ scope: 'task:t1', observationId: 'o2', actionFingerprint: 'same', verificationReceiptSha256: sha('a'), verifiedCriteriaScore: 100, testsPassed: 99, testsFailed: 0, semanticDiffHash: sha('c'), semanticDiffUnits: 99, informationGain: 1 });
  assert.equal(duplicate.duplicate, true);
  detector.observe({ scope: 'task:t1', observationId: 'o3', actionFingerprint: 'same', verificationReceiptSha256: sha('d'), verifiedCriteriaScore: 1, testsPassed: 5, testsFailed: 0, semanticDiffHash: sha('e'), semanticDiffUnits: 20, informationGain: 0, effectVerified: false });
  detector.observe({ scope: 'task:t1', observationId: 'o4', actionFingerprint: 'same', verificationReceiptSha256: sha('f'), verifiedCriteriaScore: 1, testsPassed: 5, testsFailed: 0, semanticDiffHash: sha('1'), semanticDiffUnits: 30, informationGain: 0, effectVerified: false });
  const result = detector.evaluate('task:t1');
  assert.equal(result.status, 'stalled');
  assert.equal(result.repeatedActionFingerprint, 'same');
  assert.equal(result.churnOnly, true);
});

test('rejects out-of-order observations and bounds history', () => {
  let now = 0;
  const detector = new SemanticProgressDetector({ maxObservationsPerScope: 2, clock: () => now });
  now = 10; detector.observe({ scope: 's', observationId: 'o1', actionFingerprint: 'a', verificationReceiptSha256: sha('a'), atMs: 10 });
  now = 20; detector.observe({ scope: 's', observationId: 'o2', actionFingerprint: 'b', verificationReceiptSha256: sha('b'), atMs: 20 });
  now = 30; detector.observe({ scope: 's', observationId: 'o3', actionFingerprint: 'c', verificationReceiptSha256: sha('c'), atMs: 30 });
  assert.equal(detector.snapshot('s').observations.length, 2);
  assert.throws(() => detector.observe({ scope: 's', observationId: 'o4', actionFingerprint: 'd', verificationReceiptSha256: sha('d'), atMs: 15 }), /monotonic/i);
});
