import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { boundedArray, finite, sha, signed, text, unit } from './world-model-utils.mjs';
import { SimulationReceiptLedger } from './simulation-receipt-ledger.mjs';

function cacheKey(input) { return canonicalSha256({ stateHash: input.state.stateHash, environmentDigest: input.state.environmentDigest, repositoryDigest: input.state.repositoryDigest, modelId: input.model.id, modelVersion: input.model.version, horizon: input.horizon, candidates: input.candidates.map((c) => ({ id: c.id, kind: c.kind, assumptions: c.assumptions })) }); }
function score(rollout) { return unit(rollout.reliability) * 2 + finite(rollout.effects?.criteria) - finite(rollout.effects?.regressions) * 3 - unit(rollout.blastRadius) - (1 - unit(rollout.rollbackFeasibility)); }
export class CounterfactualSimulator {
  constructor({ minimumReliability = 0.6, maximumCandidates = 4, maximumCacheEntries = 256 } = {}) { this.minimumReliability = unit(minimumReliability, 0.6); this.maximumCandidates = Math.max(1, Math.floor(finite(maximumCandidates, 4))); this.maximumCacheEntries = Math.max(1, Math.floor(finite(maximumCacheEntries, 256))); this.cache = new Map(); this.ledger = new SimulationReceiptLedger(); }
  async simulate(input = {}) {
    const state = { stateHash: sha(input.state?.stateHash, 'stateHash'), environmentDigest: sha(input.state?.environmentDigest, 'environmentDigest'), repositoryDigest: sha(input.state?.repositoryDigest, 'repositoryDigest') };
    const modelId = text(input.model?.id, 'model.id', 256); const modelVersion = text(input.model?.version, 'model.version', 64); const adapter = input.model?.adapter;
    if (typeof adapter?.rollout !== 'function') throw new TypeError('world model rollout adapter is required');
    const horizon = Math.max(1, Math.min(32, Math.floor(finite(input.horizon, 1))));
    const candidates = boundedArray(input.candidates, this.maximumCandidates).map((candidate) => ({ id: text(candidate.id, 'candidate.id', 256), kind: text(candidate.kind, 'candidate.kind', 64), assumptions: boundedArray(candidate.assumptions, 32).map(String) }));
    if (!candidates.length) throw new TypeError('at least one candidate is required');
    const normalized = { state, model: { id: modelId, version: modelVersion }, horizon, candidates }; const key = cacheKey(normalized);
    const cached = this.cache.get(key); if (cached) return signed({ ...cached, cacheHit: true });
    const raw = [];
    for (const candidate of candidates) {
      const result = await adapter.rollout({ state, model: normalized.model, horizon, candidate });
      raw.push({ candidateId: candidate.id, candidateKind: candidate.kind, assumptions: candidate.assumptions, reliability: unit(result.reliability), effects: { criteria: finite(result.effects?.criteria), regressions: finite(result.effects?.regressions), changedSymbols: finite(result.effects?.changedSymbols) }, blastRadius: unit(result.blastRadius), rollbackFeasibility: unit(result.rollbackFeasibility), provenance: boundedArray(result.provenance, 32).map((p) => ({ sourceHash: sha(p.sourceHash, 'provenance.sourceHash'), kind: text(p.kind, 'provenance.kind', 64) })) });
    }
    const rollouts = raw.filter((item) => item.reliability >= this.minimumReliability).sort((a, b) => score(b) - score(a) || a.candidateId.localeCompare(b.candidateId));
    const pruned = raw.filter((item) => item.reliability < this.minimumReliability).map((item) => ({ candidateId: item.candidateId, reliability: item.reliability, reason: 'below-reliability-threshold' }));
    const selected = rollouts[0] ?? null; const baseline = raw.find((item) => item.candidateKind === 'no-change') ?? { effects: { criteria: 0, regressions: 0, changedSymbols: 0 }, blastRadius: 0, rollbackFeasibility: 1 };
    const base = { schema: 'forge.counterfactual-simulation.v1', phase: 'imagine', modelId, modelVersion, stateHash: state.stateHash, environmentDigest: state.environmentDigest, repositoryDigest: state.repositoryDigest, horizon, cacheHit: false, rollouts, pruned, selectedCandidateId: selected?.candidateId ?? null, decisionDelta: { criteriaGain: finite(selected?.effects?.criteria) - finite(baseline.effects.criteria), regressionDelta: finite(selected?.effects?.regressions) - finite(baseline.effects.regressions), changedSymbolDelta: finite(selected?.effects?.changedSymbols) - finite(baseline.effects.changedSymbols), blastRadiusDelta: unit(selected?.blastRadius) - unit(baseline.blastRadius), rollbackFeasibilityDelta: unit(selected?.rollbackFeasibility) - unit(baseline.rollbackFeasibility) }, claims: { fileCommitAllowed: false, durableMemoryWriteAllowed: false, commandExecutionAllowed: false, simulationIsObservedEvidence: false } };
    const receipt = signed(base); this.cache.set(key, base); while (this.cache.size > this.maximumCacheEntries) this.cache.delete(this.cache.keys().next().value); this.ledger.record(receipt); return receipt;
  }
  validate(receiptSha256, input = {}) {
    const simulation = this.ledger.find(text(receiptSha256, 'receiptSha256', 64)); if (!simulation) throw new RangeError('unknown simulation receipt');
    if (!/^[a-f0-9]{64}$/i.test(String(input.receiptSha256 ?? ''))) throw new TypeError('observed validation receipt is required');
    const selected = simulation.rollouts.find((item) => item.candidateId === simulation.selectedCandidateId);
    const observed = { criteria: finite(input.observed?.criteria), regressions: finite(input.observed?.regressions) };
    const predictedUtility = finite(selected?.effects?.criteria) - finite(selected?.effects?.regressions); const observedUtility = observed.criteria - observed.regressions;
    return signed({ schema: 'forge.counterfactual-validation.v1', phase: 'verify', simulationReceiptSha256: simulation.receiptSha256, observedReceiptSha256: String(input.receiptSha256).toLowerCase(), calibrationError: Math.abs(predictedUtility - observedUtility), selectedCandidateId: simulation.selectedCandidateId, claims: { executionPerformedBySimulator: false, observedEvidenceRequired: true } });
  }
  snapshot() { return signed({ schema: 'forge.counterfactual-simulator-snapshot.v1', cacheEntries: this.cache.size, ledger: this.ledger.list({ limit: 100 }), claims: { fileCommitAllowed: false, durableMemoryWriteAllowed: false } }); }
}
