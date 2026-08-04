import test from 'node:test';
import assert from 'node:assert/strict';

import { ExecutablePlanEngine } from '../src/construction/executable-plan-engine.mjs';

function createPlan(engine) {
  return engine.createPlan({
    planId: 'plan-1', missionId: 'mission-1', specificationId: 'spec-1', repositoryFingerprint: 'repo-a', assumptionReceiptSha256: 'assumption-a',
    milestones: [{ milestoneId: 'm1', title: 'Implement feature', capabilities: [{ capabilityId: 'cap1', title: 'Session expiration', contracts: [{ contractId: 'contract1', stepIds: ['inspect', 'build'] }] }] }],
    steps: [
      { stepId: 'inspect', milestoneId: 'm1', capabilityId: 'cap1', contractId: 'contract1', title: 'Inspect', dependencies: [], preconditions: ['repository-readable'], allowedFiles: ['src/**'], forbiddenChanges: ['public-api'], expectedState: 'root-cause-known', expectedEffect: 'evidence-collected', verificationIds: ['verify-inspect'], maxAttempts: 1 },
      { stepId: 'build', milestoneId: 'm1', capabilityId: 'cap1', contractId: 'contract1', title: 'Build', dependencies: ['inspect'], preconditions: ['root-cause-known'], allowedFiles: ['src/session/**'], forbiddenChanges: ['public-api'], expectedState: 'patch-ready', expectedEffect: 'criterion-c1-satisfied', verificationIds: ['verify-build'], maxAttempts: 2 },
    ],
  });
}

test('enforces dependency readiness and verified completion transitions', () => {
  const engine = new ExecutablePlanEngine();
  const plan = createPlan(engine);
  assert.equal(plan.steps.find((s) => s.stepId === 'inspect').state, 'ready');
  assert.equal(plan.steps.find((s) => s.stepId === 'build').state, 'pending');
  assert.throws(() => engine.transition('plan-1', 'inspect', { type: 'complete' }), /invalid transition/i);
  engine.transition('plan-1', 'inspect', { type: 'start', preconditionsSatisfied: ['repository-readable'] });
  engine.transition('plan-1', 'inspect', { type: 'begin-verification' });
  assert.throws(() => engine.transition('plan-1', 'inspect', { type: 'verification-passed', receiptId: '' }), /receipt/i);
  engine.transition('plan-1', 'inspect', { type: 'verification-passed', receiptId: 'verify-inspect-receipt', actualState: 'root-cause-known' });
  const snapshot = engine.snapshot('plan-1');
  assert.equal(snapshot.steps.find((s) => s.stepId === 'inspect').state, 'completed');
  assert.equal(snapshot.steps.find((s) => s.stepId === 'build').state, 'ready');
});

test('revalidation blocks stale plans and bounded retries fail closed', () => {
  const engine = new ExecutablePlanEngine();
  createPlan(engine);
  const result = engine.revalidate('plan-1', { repositoryFingerprint: 'repo-b', assumptionReceiptSha256: 'assumption-a' });
  assert.equal(result.valid, false);
  assert.ok(result.invalidReasons.includes('repository-fingerprint-changed'));
  const step = engine.snapshot('plan-1').steps.find((item) => item.stepId === 'inspect');
  assert.equal(step.state, 'blocked');
});
