import { boundedNumber, canonicalSha256, deepFreeze, clone } from './shared.mjs';
import { paretoRankCandidates } from './candidate-ranker.mjs';

export class AdaptiveComputeGovernor {
  #usage = [];
  #calibrations = [];
  #escalationThreshold = 0.72;

  allocate({ difficulty = 0, uncertainty = 0, risk = 0, profile = 'balanced' } = {}) {
    difficulty = boundedNumber(difficulty, 'difficulty');
    uncertainty = boundedNumber(uncertainty, 'uncertainty');
    risk = boundedNumber(risk, 'risk');
    if (!['lite', 'balanced', 'performance'].includes(profile)) throw new TypeError('Unknown compute profile');
    const pressure = (difficulty + uncertainty + risk) / 3;
    const lite = profile === 'lite';
    const performance = profile === 'performance';
    const base = {
      schema: 'nolane.small-model.compute-allocation.v1', profile,
      modelTier: lite ? 'local-small' : pressure >= this.#escalationThreshold ? 'local-large-or-escalation' : pressure > 0.4 ? 'local-medium' : 'local-small',
      contextTokens: lite ? Math.min(4096, 2048 + Math.round(pressure * 2048)) : Math.round((performance ? 8192 : 4096) + pressure * (performance ? 8192 : 4096)),
      candidateBudget: lite ? 1 : 1 + Math.round(pressure * (performance ? 4 : 2)),
      verifierBudget: 1 + Math.round((risk + uncertainty) * (performance ? 4 : 2)),
      kvCacheMb: lite ? 512 : Math.round(768 + pressure * (performance ? 1536 : 768)),
      escalationRequired: lite ? false : pressure >= this.#escalationThreshold,
      escalationThreshold: this.#escalationThreshold,
      difficulty, uncertainty, risk,
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  calibrateEscalation({ heldOut, cases } = {}) {
    if (heldOut !== true) throw new Error('Escalation calibration requires held-out cases');
    if (!Array.isArray(cases) || cases.length < 2) throw new TypeError('At least two labeled calibration cases are required');
    const normalized = cases.map((item, index) => {
      if (typeof item?.shouldEscalate !== 'boolean') throw new TypeError(`Calibration case ${index} requires shouldEscalate`);
      const difficulty = boundedNumber(item.difficulty, 'difficulty');
      const uncertainty = boundedNumber(item.uncertainty, 'uncertainty');
      const risk = boundedNumber(item.risk, 'risk');
      return { difficulty, uncertainty, risk, pressure: (difficulty + uncertainty + risk) / 3, shouldEscalate: item.shouldEscalate };
    });
    const negatives = normalized.filter((item) => !item.shouldEscalate).map((item) => item.pressure);
    const positives = normalized.filter((item) => item.shouldEscalate).map((item) => item.pressure);
    if (negatives.length === 0 || positives.length === 0) throw new Error('Calibration requires both escalation and non-escalation labels');
    const maxNegative = Math.max(...negatives);
    const minPositive = Math.min(...positives);
    if (maxNegative >= minPositive) throw new Error('Held-out labels are not separable by pressure');
    const threshold = Number(((maxNegative + minPositive) / 2).toFixed(6));
    const correct = normalized.filter((item) => (item.pressure >= threshold) === item.shouldEscalate).length;
    const base = {
      schema: 'nolane.small-model.escalation-calibration.v1', version: String(this.#calibrations.length + 1),
      heldOut: true, threshold, accuracy: correct / normalized.length, cases: clone(normalized),
      previousThreshold: this.#escalationThreshold,
    };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#calibrations.push(receipt);
    this.#escalationThreshold = threshold;
    return receipt;
  }

  rollbackEscalationCalibration() {
    if (this.#calibrations.length < 2) throw new Error('No previous escalation calibration to restore');
    this.#calibrations.pop();
    const active = this.#calibrations.at(-1);
    this.#escalationThreshold = active.threshold;
    return active;
  }

  chooseRoute(routes, { qualityTolerance = 0.01 } = {}) {
    const ranked = paretoRankCandidates(routes);
    const best = Math.max(...ranked.map((item) => item.quality));
    return ranked.filter((item) => item.pareto && best - item.quality <= qualityTolerance).sort((a, b) => a.cost - b.cost || a.risk - b.risk)[0] ?? ranked[0];
  }

  shouldContinue({ gains = [], costs = [] } = {}) {
    if (!gains.length) return false;
    const recent = gains.slice(-3).map(Number);
    const recentCost = costs.slice(-3).reduce((a, b) => a + Number(b || 0), 0);
    if (recent.length >= 3 && recent[2] < 0.005 && recent[2] < recent[1] * 0.25) return false;
    return recent.reduce((a, b) => a + b, 0) > Math.max(0.02, recentCost * 0.01);
  }

  recordUsage({ actionId, rssMb, durationSeconds }) {
    const base = { actionId, rssMb: Number(rssMb), durationSeconds: Number(durationSeconds), rssMbSeconds: Number(rssMb) * Number(durationSeconds) };
    const value = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#usage.push(value);
    return value;
  }

  snapshot() {
    return deepFreeze({
      schema: 'nolane.small-model.adaptive-compute-governor.v1', usageReceipts: this.#usage.length,
      totalRssMbSeconds: this.#usage.reduce((sum, item) => sum + item.rssMbSeconds, 0),
      calibrations: this.#calibrations.length, escalationThreshold: this.#escalationThreshold,
    });
  }
}
