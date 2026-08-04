import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeTaskContract, assertTaskActionAllowed } from '../src/orchestration/task-contract.mjs';
import { VerificationClaimGuard } from '../src/security/verification-claim-guard.mjs';
import { AutonomyPolicy } from '../src/security/autonomy-policy.mjs';

function contract() {
  return normalizeTaskContract({
    objective: 'Implement one scoped change and make all focused tests pass without widening permissions.',
    successCriteria: [{ id: 'c1', description: 'Focused test passes', verification: { command: 'node', args: ['--test', 'tests/x.test.mjs'] } }],
    scope: { allowedPaths: ['src/**', 'tests/**'], deniedPaths: ['src/security/guardrails/**'] },
    allowedCommands: ['node'], networkPolicy: { mode: 'deny' }, testCriteria: ['focused test passes'], performanceCriteria: ['no regression'],
    securityCriteria: ['no scope expansion'], compatibilityCriteria: ['public API remains stable'], outputContract: { kind: 'report', requiredArtifacts: ['release/report.json'] },
    autonomy: 'workspace-autopilot', tokenBudget: 1000, deadline: '2030-01-01T00:00:00.000Z', riskLevel: 'medium', stopConditions: ['criterion c1 passes'],
  });
}

test('agent runtime allows scoped reversible actions with explicit policy', () => {
  const value = contract();
  assert.equal(assertTaskActionAllowed(value, { kind: 'file.write', path: 'src/feature.mjs' }), true);
  assert.equal(assertTaskActionAllowed(value, { kind: 'process.run', command: 'node' }), true);
  const decision = new AutonomyPolicy().evaluate({ kind: 'fs.patch', reversible: true }, { profile: 'workspace-autopilot', withinWorkspace: true, inManagedWorktree: true });
  assert.equal(decision.decision, 'allow');
});

test('agent runtime rejects scope expansion and unsupported self-certification', () => {
  const value = contract();
  assert.throws(() => assertTaskActionAllowed(value, { kind: 'file.write', path: 'src/security/guardrails/policy.mjs' }), /expands scope/i);
  assert.throws(() => assertTaskActionAllowed(value, { kind: 'process.run', command: 'bash' }), /outside task contract/i);
  const assessment = new VerificationClaimGuard().assess({ output: 'All tests passed and the task is complete.', receipts: [], activity: {} });
  assert.equal(assessment.status, 'blocked-unverified-claims');
  assert.ok(assessment.unsupportedClaims.includes('test-success'));
  assert.ok(assessment.unsupportedClaims.includes('completion'));
  const decision = new AutonomyPolicy().evaluate({ kind: 'database.destroy', reversible: false }, { profile: 'workspace-autopilot', withinWorkspace: true, inManagedWorktree: true });
  assert.equal(decision.decision, 'ask');
  assert.equal(decision.hardStop, true);
});
