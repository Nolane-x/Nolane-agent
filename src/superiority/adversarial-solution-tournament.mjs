import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { boundedNumber, deepFreeze, nonEmpty, requireSha256, signed } from './superiority-utils.mjs';

const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const ATTACK_STATUSES = new Set(['confirmed', 'refuted', 'inconclusive']);

export class AdversarialSolutionTournament {
  constructor({ clock = () => Date.now(), limits = {} } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxTournaments = Math.max(1, Math.floor(Number(limits.maxTournaments) || 500));
    this.maxCandidates = Math.max(1, Math.floor(Number(limits.maxCandidates) || 32));
    this.tournaments = new Map();
  }

  open(input = {}) {
    const tournamentId = nonEmpty(input.tournamentId, 'tournamentId');
    if (this.tournaments.has(tournamentId)) throw new Error(`Tournament ${tournamentId} already exists`);
    const state = {
      tournamentId,
      missionPlanReceiptSha256: requireSha256(input.missionPlanReceiptSha256, 'missionPlanReceiptSha256'),
      minimumProofCoverage: boundedNumber(input.minimumProofCoverage, 0.85, 0, 1),
      candidates: new Map(),
      openedAtMs: Number(this.clock()),
    };
    this.tournaments.set(tournamentId, state);
    while (this.tournaments.size > this.maxTournaments) this.tournaments.delete(this.tournaments.keys().next().value);
    return this.snapshot(tournamentId);
  }

  registerCandidate(tournamentId, input = {}) {
    const state = this.#tournament(tournamentId);
    const candidateId = nonEmpty(input.candidateId, 'candidateId');
    if (state.candidates.has(candidateId)) throw new Error(`Candidate ${candidateId} already exists`);
    if (state.candidates.size >= this.maxCandidates) throw new Error('Tournament candidate limit exceeded');
    const candidate = {
      candidateId,
      proposerKey: nonEmpty(input.proposerKey, 'proposerKey'),
      proofPlanReceiptSha256: requireSha256(input.proofPlanReceiptSha256, 'proofPlanReceiptSha256'),
      patchHash: requireSha256(input.patchHash, 'patchHash'),
      expectedEffectHash: requireSha256(input.expectedEffectHash, 'expectedEffectHash'),
      reversibility: deepFreeze({
        score: boundedNumber(input?.reversibility?.score, 0, 0, 1),
        rollbackReceiptSha256: input?.reversibility?.rollbackReceiptSha256 ? requireSha256(input.reversibility.rollbackReceiptSha256, 'rollbackReceiptSha256') : null,
      }),
      resourceCost: deepFreeze({ tokens: Math.max(0, Number(input?.resourceCost?.tokens) || 0), elapsedMs: Math.max(0, Number(input?.resourceCost?.elapsedMs) || 0) }),
      attacks: [],
      verifications: [],
      registeredAtMs: Number(this.clock()),
    };
    state.candidates.set(candidateId, candidate);
    return signed({ schema: 'nolane.superiority.tournament-candidate.v1', tournamentId: state.tournamentId, candidate: this.#candidatePublic(candidate) });
  }

  recordAttack(tournamentId, input = {}) {
    const candidate = this.#candidate(tournamentId, input.candidateId);
    const severity = String(input.severity ?? '').toLowerCase();
    const status = String(input.status ?? '').toLowerCase();
    if (!SEVERITIES.has(severity)) throw new TypeError('severity must be low, medium, high, or critical');
    if (!ATTACK_STATUSES.has(status)) throw new TypeError('status must be confirmed, refuted, or inconclusive');
    const attack = deepFreeze({
      attackId: nonEmpty(input.attackId, 'attackId'), severity, status,
      falsifierKey: nonEmpty(input.falsifierKey, 'falsifierKey'),
      evidenceHash: requireSha256(input.evidenceHash, 'evidenceHash'),
      recordedAtMs: Number(this.clock()),
    });
    candidate.attacks.push(attack);
    return signed({ schema: 'nolane.superiority.tournament-attack.v1', tournamentId: String(tournamentId), candidateId: candidate.candidateId, attack });
  }

  recordVerification(tournamentId, input = {}) {
    if (input.observed !== true) throw new Error('Tournament verification must be observed');
    const candidate = this.#candidate(tournamentId, input.candidateId);
    const status = String(input.status ?? '').toLowerCase();
    if (!['pass', 'fail'].includes(status)) throw new TypeError('status must be pass or fail');
    const verification = deepFreeze({
      status,
      observed: true,
      proofCoverage: boundedNumber(input.proofCoverage, 0, 0, 1),
      correctnessScore: boundedNumber(input.correctnessScore, 0, 0, 1),
      verifierKey: nonEmpty(input.verifierKey, 'verifierKey'),
      evidenceHash: requireSha256(input.evidenceHash, 'evidenceHash'),
      recordedAtMs: Number(this.clock()),
    });
    candidate.verifications.push(verification);
    return signed({ schema: 'nolane.superiority.tournament-verification.v1', tournamentId: String(tournamentId), candidateId: candidate.candidateId, verification });
  }

  decide(tournamentId) {
    const state = this.#tournament(tournamentId);
    const eligible = [];
    const rejected = [];
    for (const candidate of state.candidates.values()) {
      const reasons = [];
      const independentAttacks = candidate.attacks.filter((attack) => attack.falsifierKey !== candidate.proposerKey);
      const independentVerifications = candidate.verifications.filter((verification) => verification.verifierKey !== candidate.proposerKey && verification.observed);
      const passingVerification = [...independentVerifications].reverse().find((verification) => verification.status === 'pass');
      if (!independentAttacks.length) reasons.push('independent-falsifier-missing');
      if (!independentVerifications.length) reasons.push('independent-verifier-missing');
      if (candidate.attacks.some((attack) => attack.severity === 'critical' && attack.status === 'confirmed')) reasons.push('critical-counterexample-confirmed');
      if (!passingVerification) reasons.push('observed-verification-pass-missing');
      if (passingVerification && passingVerification.proofCoverage < state.minimumProofCoverage) reasons.push('proof-coverage-below-threshold');
      if (!candidate.reversibility.rollbackReceiptSha256 || candidate.reversibility.score <= 0) reasons.push('rollback-proof-missing');
      const evaluation = {
        candidateId: candidate.candidateId,
        reasons: [...new Set(reasons)],
        correctnessScore: passingVerification?.correctnessScore ?? 0,
        proofCoverage: passingVerification?.proofCoverage ?? 0,
        reversibilityScore: candidate.reversibility.score,
        resourceCost: candidate.resourceCost,
      };
      if (evaluation.reasons.length) rejected.push(deepFreeze(evaluation));
      else eligible.push({ candidate, evaluation });
    }
    eligible.sort((left, right) => (
      right.evaluation.correctnessScore - left.evaluation.correctnessScore
      || right.evaluation.proofCoverage - left.evaluation.proofCoverage
      || right.evaluation.reversibilityScore - left.evaluation.reversibilityScore
      || left.evaluation.resourceCost.tokens - right.evaluation.resourceCost.tokens
      || left.evaluation.resourceCost.elapsedMs - right.evaluation.resourceCost.elapsedMs
      || left.candidate.candidateId.localeCompare(right.candidate.candidateId)
    ));
    const selected = eligible[0] ?? null;
    const base = {
      schema: 'nolane.superiority.adversarial-tournament-decision.v1',
      tournamentId: state.tournamentId,
      missionPlanReceiptSha256: state.missionPlanReceiptSha256,
      status: selected ? 'selected' : 'real-probe-required',
      selectedCandidateId: selected?.candidate.candidateId ?? null,
      selectedScore: selected ? deepFreeze({ ...selected.evaluation }) : null,
      rejected: rejected.sort((a, b) => a.candidateId.localeCompare(b.candidateId)),
      evaluatedCandidateCount: state.candidates.size,
      decidedAtMs: Number(this.clock()),
      authorization: { selectionAllowed: Boolean(selected), automaticCommitAllowed: false, automaticDeploymentAllowed: false, humanApprovalRequired: true },
      claims: { hiddenReasoningStored: false, selfVerificationSufficient: false, observedEvidenceRequired: true, comparativeSuperiorityClaimAllowed: false },
    };
    return signed(base);
  }

  snapshot(tournamentId = null) {
    if (tournamentId) {
      const state = this.#tournament(tournamentId);
      return signed({
        schema: 'nolane.superiority.adversarial-tournament.v1', tournamentId: state.tournamentId,
        missionPlanReceiptSha256: state.missionPlanReceiptSha256, minimumProofCoverage: state.minimumProofCoverage,
        candidates: [...state.candidates.values()].map((candidate) => this.#candidatePublic(candidate)).sort((a, b) => a.candidateId.localeCompare(b.candidateId)),
        openedAtMs: state.openedAtMs,
        authorization: { selectionAllowed: false, automaticCommitAllowed: false },
        claims: { hiddenReasoningStored: false, comparativeSuperiorityClaimAllowed: false },
      });
    }
    return signed({ schema: 'nolane.superiority.adversarial-tournament-snapshot.v1', tournaments: [...this.tournaments.keys()].map((id) => this.snapshot(id)), claims: { hiddenReasoningStored: false } });
  }

  #candidatePublic(candidate) {
    return deepFreeze({
      candidateId: candidate.candidateId, proposerKey: candidate.proposerKey,
      proofPlanReceiptSha256: candidate.proofPlanReceiptSha256, patchHash: candidate.patchHash, expectedEffectHash: candidate.expectedEffectHash,
      reversibility: candidate.reversibility, resourceCost: candidate.resourceCost,
      attacks: [...candidate.attacks], verifications: [...candidate.verifications], registeredAtMs: candidate.registeredAtMs,
    });
  }

  #tournament(tournamentId) {
    const id = nonEmpty(tournamentId, 'tournamentId');
    const state = this.tournaments.get(id);
    if (!state) throw new Error(`Unknown tournament ${id}`);
    return state;
  }

  #candidate(tournamentId, candidateId) {
    const state = this.#tournament(tournamentId);
    const id = nonEmpty(candidateId, 'candidateId');
    const candidate = state.candidates.get(id);
    if (!candidate) throw new Error(`Unknown candidate ${id}`);
    return candidate;
  }
}
