import test from 'node:test';
import assert from 'node:assert/strict';
import { MissionConstitutionEngine } from '../src/superiority/deep/mission-constitution-engine.mjs';
import { CounterfactualExecutionPlanner } from '../src/superiority/deep/counterfactual-execution-planner.mjs';

const H = (c) => c.repeat(64);

test('mission constitution blocks forbidden, over-budget and irreversible actions and requires human amendment', () => {
  const engine = new MissionConstitutionEngine({ clock: () => 100 });
  const constitution = engine.register({
    constitutionId: 'constitution:ship', missionId: 'ship',
    budgets: { tokens: 1000, elapsedMs: 10_000, costUsd: 1 },
    rules: [
      { ruleId: 'source-write', effect: 'source.write', decision: 'allow', maxRisk: 0.6, requiredCapabilities: ['repo.write'], reversibleRequired: true },
      { ruleId: 'production-deploy', effect: 'deploy.production', decision: 'approval', maxRisk: 0.4, requiredCapabilities: ['deploy'], reversibleRequired: true },
      { ruleId: 'secret-export', effect: 'secret.export', decision: 'deny' },
    ],
  });
  assert.equal(constitution.version, 1);
  assert.equal(engine.evaluate('constitution:ship', {
    actionId: 'a1', effects: ['source.write'], capabilities: ['repo.write'], risk: 0.2, reversible: true,
    estimated: { tokens: 200, elapsedMs: 1000, costUsd: 0.1 }, observed: true, evidenceHash: H('a'),
  }).allowed, true);
  const denied = engine.evaluate('constitution:ship', {
    actionId: 'a2', effects: ['secret.export'], capabilities: [], risk: 0.1, reversible: false,
    estimated: { tokens: 10, elapsedMs: 10, costUsd: 0 }, observed: true, evidenceHash: H('b'),
  });
  assert.equal(denied.allowed, false);
  assert.ok(denied.violations.some((item) => item.code === 'EFFECT_DENIED'));
  const deploy = engine.evaluate('constitution:ship', {
    actionId: 'a3', effects: ['deploy.production'], capabilities: ['deploy'], risk: 0.3, reversible: true,
    estimated: { tokens: 100, elapsedMs: 1000, costUsd: 0.2 }, observed: true, evidenceHash: H('c'),
  });
  assert.equal(deploy.allowed, false);
  assert.equal(deploy.approvalRequired, true);
  assert.throws(() => engine.amend('constitution:ship', { expectedVersion: 1, approvedByHuman: false, actor: 'agent', approvalReceiptSha256: H('d'), rules: [] }), /human approval/i);
  const amended = engine.amend('constitution:ship', { expectedVersion: 1, approvedByHuman: true, actor: 'owner', approvalReceiptSha256: H('d'), rules: [{ ruleId: 'source-write', effect: 'source.write', decision: 'allow', maxRisk: 0.8, requiredCapabilities: ['repo.write'], reversibleRequired: true }] });
  assert.equal(amended.version, 2);
  assert.equal(amended.claims.automaticPolicyMutationAllowed, false);
});

test('counterfactual planner rejects unsafe and dominated candidates and requests a real probe under uncertainty', () => {
  const planner = new CounterfactualExecutionPlanner({ clock: () => 200 });
  planner.open({ planningId: 'p1', goal: 'repair safely', constraints: { maxRisk: 0.5, minProofCoverage: 0.7, minRollbackCoverage: 0.7 }, causalReceiptSha256: H('e') });
  planner.registerCandidate('p1', { planId: 'unsafe', benefit: 1, risk: 0.9, uncertainty: 0.1, proofCoverage: 1, rollbackCoverage: 1, cost: 0.1, dependenciesSatisfied: true, evidenceHashes: [H('f')] });
  planner.registerCandidate('p1', { planId: 'safe', benefit: 0.9, risk: 0.2, uncertainty: 0.1, proofCoverage: 0.95, rollbackCoverage: 0.9, cost: 0.2, dependenciesSatisfied: true, evidenceHashes: [H('1')] });
  planner.registerCandidate('p1', { planId: 'dominated', benefit: 0.5, risk: 0.3, uncertainty: 0.2, proofCoverage: 0.8, rollbackCoverage: 0.8, cost: 0.4, dependenciesSatisfied: true, evidenceHashes: [H('2')] });
  const decision = planner.decide('p1');
  assert.equal(decision.selectedPlanId, 'safe');
  assert.ok(decision.rejected.some((item) => item.planId === 'unsafe' && item.reasons.includes('risk-budget')));
  assert.ok(decision.rejected.some((item) => item.planId === 'dominated' && item.reasons.includes('dominated')));
  assert.equal(decision.authorization.automaticExecutionAllowed, false);

  planner.open({ planningId: 'p2', goal: 'ambiguous', constraints: { maxRisk: 0.8, minProofCoverage: 0.5, minRollbackCoverage: 0.5, maxDecisionUncertainty: 0.2 }, causalReceiptSha256: H('3') });
  planner.registerCandidate('p2', { planId: 'uncertain', benefit: 1, risk: 0.2, uncertainty: 0.8, proofCoverage: 0.8, rollbackCoverage: 0.8, cost: 0.1, dependenciesSatisfied: true, evidenceHashes: [H('4')] });
  const probe = planner.decide('p2');
  assert.equal(probe.selectedPlanId, null);
  assert.equal(probe.realProbeRequired, true);
});
