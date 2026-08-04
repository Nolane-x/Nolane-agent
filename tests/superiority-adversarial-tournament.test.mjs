import test from 'node:test';
import assert from 'node:assert/strict';
import { AdversarialSolutionTournament } from '../src/superiority/adversarial-solution-tournament.mjs';

const H = (c) => c.repeat(64);

function candidate(candidateId, proposerKey, extra = {}) {
  return {
    candidateId,
    proposerKey,
    proofPlanReceiptSha256: H(candidateId === 'a' ? 'a' : 'b'),
    patchHash: H(candidateId === 'a' ? 'c' : 'd'),
    expectedEffectHash: H(candidateId === 'a' ? 'e' : 'f'),
    reversibility: { score: 0.9, rollbackReceiptSha256: H('1') },
    resourceCost: { tokens: candidateId === 'a' ? 100 : 200, elapsedMs: candidateId === 'a' ? 10 : 20 },
    ...extra,
  };
}

test('adversarial tournament rejects critical counterexamples and selects the strongest independently verified candidate', () => {
  const tournament = new AdversarialSolutionTournament({ clock: () => 1000 });
  const opened = tournament.open({ tournamentId: 't1', missionPlanReceiptSha256: H('9'), minimumProofCoverage: 0.9 });
  assert.equal(opened.authorization.selectionAllowed, false);
  tournament.registerCandidate('t1', candidate('a', 'builder-a'));
  tournament.registerCandidate('t1', candidate('b', 'builder-b'));

  tournament.recordAttack('t1', { candidateId: 'a', attackId: 'secret-leak', severity: 'critical', status: 'confirmed', falsifierKey: 'red-team', evidenceHash: H('2') });
  tournament.recordAttack('t1', { candidateId: 'b', attackId: 'path-escape', severity: 'critical', status: 'refuted', falsifierKey: 'red-team', evidenceHash: H('3') });
  tournament.recordVerification('t1', { candidateId: 'a', status: 'pass', observed: true, proofCoverage: 1, correctnessScore: 0.99, verifierKey: 'independent-a', evidenceHash: H('4') });
  tournament.recordVerification('t1', { candidateId: 'b', status: 'pass', observed: true, proofCoverage: 0.95, correctnessScore: 0.96, verifierKey: 'independent-b', evidenceHash: H('5') });

  const decision = tournament.decide('t1');
  assert.equal(decision.status, 'selected');
  assert.equal(decision.selectedCandidateId, 'b');
  assert.equal(decision.authorization.automaticCommitAllowed, false);
  assert.ok(decision.rejected.some((item) => item.candidateId === 'a' && item.reasons.includes('critical-counterexample-confirmed')));
  assert.equal(decision.claims.hiddenReasoningStored, false);
});

test('adversarial tournament requires independent proposer, falsifier, and verifier lanes and falls back to a real probe', () => {
  const tournament = new AdversarialSolutionTournament();
  tournament.open({ tournamentId: 't2', missionPlanReceiptSha256: H('6'), minimumProofCoverage: 0.8 });
  tournament.registerCandidate('t2', candidate('a', 'same-lane'));
  tournament.recordAttack('t2', { candidateId: 'a', attackId: 'attack', severity: 'high', status: 'refuted', falsifierKey: 'same-lane', evidenceHash: H('7') });
  tournament.recordVerification('t2', { candidateId: 'a', status: 'pass', observed: true, proofCoverage: 1, correctnessScore: 1, verifierKey: 'same-lane', evidenceHash: H('8') });
  const decision = tournament.decide('t2');
  assert.equal(decision.status, 'real-probe-required');
  assert.equal(decision.selectedCandidateId, null);
  assert.ok(decision.rejected[0].reasons.includes('independent-falsifier-missing'));
  assert.ok(decision.rejected[0].reasons.includes('independent-verifier-missing'));
});
