import { boundedNumber, deepFreeze } from './shared.mjs';
export class VerifierReliabilityLedger {
  #records = new Map();
  register({ id, falsePositive = 0, falseNegative = 0, calibrationSamples = 0 } = {}) {
    if (!id) throw new TypeError('Verifier id is required');
    const record = deepFreeze({ id, falsePositive: boundedNumber(falsePositive, 'falsePositive'), falseNegative: boundedNumber(falseNegative, 'falseNegative'), calibrationSamples: Math.max(0, Number(calibrationSamples) || 0) });
    this.#records.set(id, record); return record;
  }
  get(id) { return this.#records.get(id) ?? deepFreeze({ id, falsePositive: 0.5, falseNegative: 0.5, calibrationSamples: 0 }); }
  snapshot() { return deepFreeze({ records: [...this.#records.values()] }); }
}
