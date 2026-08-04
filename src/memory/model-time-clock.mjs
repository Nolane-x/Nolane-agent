import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function finite(value) { const n = Number(value ?? 0); return Number.isFinite(n) && n > 0 ? n : 0; }
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class ModelTimeClock {
  constructor({ weights = {} } = {}) {
    this.weights = Object.freeze({ policyDrift: 1.5, schemaChanges: 0.5, correctionRate: 1.2, skillRevisions: 0.7, distributionShift: 1.0, ...weights });
    this.modelTime = 0;
    this.observations = 0;
  }
  observe(input = {}) {
    const signals = Object.freeze({
      policyDrift: Math.min(1, finite(input.policyDrift)), schemaChanges: finite(input.schemaChanges), correctionRate: Math.min(1, finite(input.correctionRate)),
      skillRevisions: finite(input.skillRevisions), distributionShift: Math.min(1, finite(input.distributionShift)),
    });
    const delta = Object.entries(signals).reduce((sum, [key, value]) => sum + value * Number(this.weights[key] ?? 0), 0);
    this.modelTime += delta;
    this.observations += 1;
    return signed({ schema: 'forge.model-time-clock.v1', modelTime: this.modelTime, delta, observations: this.observations, signals, rawStepsIgnored: true });
  }
  snapshot() { return signed({ schema: 'forge.model-time-clock-snapshot.v1', modelTime: this.modelTime, observations: this.observations, rawStepsIgnored: true }); }
}
