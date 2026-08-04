import assert from 'node:assert/strict';
import test from 'node:test';

import { TeacherChallengeLab } from '../src/development/teacher-challenge-lab.mjs';
import { AdaptiveLearningControlPlane } from '../src/learning/adaptive-learning-control-plane.mjs';

const H = (ch) => ch.repeat(64);

test('AdaptiveLearningControlPlane calibrates multi-turn trajectories across tool types by weakest critical stage', () => {
  const plane = new AdaptiveLearningControlPlane({ cohorts: ['local'] });
  const assessment = plane.assessTrajectory({
    domain: 'backend', taskType: 'migration',
    turns: [
      { turnId: 't1', toolType: 'retrieval', confidence: 0.9, critical: true, evidenceReceiptSha256: H('a') },
      { turnId: 't2', toolType: 'edit', confidence: 0.55, critical: true, evidenceReceiptSha256: H('b') },
      { turnId: 't3', toolType: 'test', confidence: 0.8, critical: true, evidenceReceiptSha256: H('c') },
    ],
    independentReceipts: [{ kind: 'test', status: 'pass', receiptSha256: H('d') }],
  });
  assert.equal(assessment.turnCount, 3);
  assert.equal(assessment.toolTypes.join(','), 'edit,retrieval,test');
  assert.equal(assessment.trajectory.weakestCritical.kind, 't2:edit');
  assert.equal(assessment.trajectory.finalConfidence <= 0.55, true);
  assert.equal(assessment.claims.multiTurnCalibrated, true);

  plane.recordTrajectoryOutcome({ domain: 'backend', taskType: 'migration', turnId: 't2', toolType: 'edit', confidence: 0.55, success: false, verificationReceiptSha256: H('e') });
  const buckets = plane.snapshot().trajectory.buckets;
  assert.equal(buckets.some((item) => item.taskType === 'migration/edit' && item.verifiedSamples === 1), true);
});

test('TeacherChallengeLab separates structural understanding from surface memorization', () => {
  const lab = new TeacherChallengeLab({ challengeRevisionSha256: H('1') });
  const packageOne = lab.createPair({
    seed: 'symbol-rename-1', language: 'javascript', concept: 'call-graph',
    source: 'export function total(a,b){return a+b}; total(1,2)',
    structuralAnswer: { callers: ['module:total-call'], callee: 'total' },
  });
  const packageTwo = lab.createPair({
    seed: 'symbol-rename-1', language: 'javascript', concept: 'call-graph',
    source: 'export function total(a,b){return a+b}; total(1,2)',
    structuralAnswer: { callers: ['module:total-call'], callee: 'total' },
  });
  assert.equal(packageOne.receiptSha256, packageTwo.receiptSha256);
  assert.equal(Object.hasOwn(packageOne.executor.structureTask, 'answer'), false);
  assert.equal(Object.hasOwn(packageOne.executor.surfaceTask, 'answer'), false);
  assert.deepEqual(packageOne.oracle.structureAnswer, { callers: ['module:total-call'], callee: 'total' });
  assert.notEqual(packageOne.executor.structureTask.source, packageOne.executor.surfaceTask.source);
  assert.equal(packageOne.claims.hiddenAnswerExposedToExecutor, false);
});

test('TeacherChallengeLab generates mutation, rename, distractor, platform, and prompt-injection challenges', () => {
  const lab = new TeacherChallengeLab({ challengeRevisionSha256: H('2') });
  const set = lab.createChallengeSet({ seed: 'challenge-set', language: 'python', source: 'def add(a,b): return a+b', expected: { behavior: 'sum' } });
  assert.deepEqual(set.executor.challenges.map((item) => item.kind), ['distractor', 'mutation', 'platform', 'prompt-injection', 'rename']);
  assert.equal(set.executor.challenges.find((item) => item.kind === 'prompt-injection').instructions.includes('ignore previous'), true);
  assert.equal(set.oracle.answers.length, 5);
  assert.equal(set.claims.executorCanReadOracle, false);
  assert.match(set.receiptSha256, /^[a-f0-9]{64}$/);
});
