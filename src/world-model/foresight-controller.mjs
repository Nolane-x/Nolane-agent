import { finite, signed, unit } from './world-model-utils.mjs';
export class ForesightController {
  constructor({ minimumReliability = 0.65, maximumHorizon = 8, maximumRollouts = 4 } = {}) { this.minimumReliability = unit(minimumReliability, 0.65); this.maximumHorizon = Math.max(1, Math.floor(finite(maximumHorizon, 8))); this.maximumRollouts = Math.max(1, Math.floor(finite(maximumRollouts, 4))); }
  decide(input = {}) {
    const risk = unit(input.risk); const uncertainty = unit(input.uncertainty); const impact = unit(input.decisionImpact); const gain = unit(input.expectedInformationGain); const reliability = unit(input.modelReliability);
    const tokenCost = Math.max(0, finite(input.cost?.tokens)); const memoryCost = Math.max(0, finite(input.cost?.rssMbSeconds));
    const value = risk * 0.25 + uncertainty * 0.3 + impact * 0.25 + gain * 0.2;
    const normalizedCost = Math.min(1, tokenCost / 8_000 * 0.7 + memoryCost / 1_000 * 0.3);
    let action = 'skip-simulation';
    if (reliability < this.minimumReliability && value >= 0.45) action = 'real-probe-required';
    else if (reliability >= this.minimumReliability && value - normalizedCost >= 0.3) action = 'simulate';
    const horizon = action === 'simulate' ? Math.max(1, Math.min(this.maximumHorizon, Math.ceil(1 + uncertainty * 3 + risk * 2))) : 0;
    const rolloutCount = action === 'simulate' ? Math.max(1, Math.min(this.maximumRollouts, Math.floor(finite(input.candidateCount, 1)))) : 0;
    return signed({ schema: 'forge.foresight-decision.v1', action, value, normalizedCost, modelReliability: reliability, horizon, rolloutCount, claims: { simulationIsObservedEvidence: false, fileCommitAllowed: false } });
  }
}
