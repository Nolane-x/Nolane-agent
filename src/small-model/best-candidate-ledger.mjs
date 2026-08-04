import { canonicalSha256, deepFreeze } from './shared.mjs';
const SHA256 = /^[a-f0-9]{64}$/;

export class BestCandidateLedger {
  #missionId; #best = null; #history = []; #regressionsRejected = 0;
  constructor({ missionId } = {}) {
    if (!missionId) throw new TypeError('missionId is required');
    this.#missionId = String(missionId);
  }
  consider({ candidateId, sourceSha256, verified, score, stepId } = {}) {
    if (!candidateId || !stepId || !SHA256.test(String(sourceSha256 ?? '')) || !Number.isFinite(Number(score))) throw new TypeError('candidateId, stepId, sourceSha256 and finite score are required');
    const candidate = deepFreeze({ candidateId: String(candidateId), sourceSha256: String(sourceSha256), verified: verified === true, score: Number(score), stepId: String(stepId) });
    let accepted = false;
    let reason = 'not-better';
    if (!candidate.verified) {
      this.#regressionsRejected += 1;
      reason = 'unverified-regression';
    } else if (!this.#best || candidate.score > this.#best.score) {
      this.#best = candidate;
      accepted = true;
      reason = 'verified-improvement';
    } else if (candidate.sourceSha256 === this.#best.sourceSha256) {
      reason = 'verified-equivalent-preserved';
    }
    const base = { schema: 'nolane.small-model.best-candidate-decision.v1', missionId: this.#missionId, candidate, accepted, reason, bestCandidateId: this.#best?.candidateId ?? null };
    const decision = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#history.push(decision);
    return decision;
  }
  best() { return this.#best; }
  snapshot() {
    const base = { schema: 'nolane.small-model.best-candidate-ledger.v1', missionId: this.#missionId, best: this.#best, decisions: this.#history.length, regressionsRejected: this.#regressionsRejected };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
