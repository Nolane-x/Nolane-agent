import test from 'node:test';
import assert from 'node:assert/strict';
import { DecisionPlane } from '../src/decision/decision-plane.mjs';

const H = (c) => c.repeat(64);

test('DecisionPlane composes all deep superiority waves behind one fail-closed production plane', () => {
  const plane = new DecisionPlane({ clock: () => 600 });
  plane.registerMissionConstitution({ constitutionId: 'c', missionId: 'm', rules: [{ ruleId: 'r', effect: 'source.write', decision: 'allow', maxRisk: 1, requiredCapabilities: [], reversibleRequired: false }] });
  const action = plane.evaluateConstitutionAction('c', { actionId: 'a', effects: ['source.write'], capabilities: [], risk: 0.1, reversible: false, estimated: {}, observed: true, evidenceHash: H('a') });
  assert.equal(action.allowed, true);
  const schedule = plane.scheduleProofBudget({ missionId: 'm', budget: { tokens: 100, elapsedMs: 100, costUsd: 1 }, verificationReserveRatio: 0.5, tasks: [{ taskId: 't', dependencies: [], proofRequired: true, risk: 1, estimated: { tokens: 50, elapsedMs: 50, costUsd: 0.1 } }] });
  assert.equal(schedule.status, 'scheduled');
  const snapshot = plane.superioritySnapshot();
  assert.equal(snapshot.claims.missionConstitutionControl, true);
  assert.equal(snapshot.claims.counterfactualExecutionPlanning, true);
  assert.equal(snapshot.claims.verificationMemoryCuration, true);
  assert.equal(snapshot.claims.selfHealingRuntime, true);
  assert.equal(snapshot.claims.proofBudgetScheduling, true);
  assert.equal(snapshot.claims.comparativeBenchmarkLab, true);
  assert.equal(snapshot.claims.localUiCertification, true);
  assert.equal(snapshot.claims.providerRealDogfoodProtocol, true);
  assert.equal(snapshot.claims.comparativeSuperiorityClaimAllowed, false);
  assert.equal(JSON.stringify(snapshot).includes('chainOfThought'), false);
});
