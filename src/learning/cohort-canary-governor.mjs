import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { number, receipt, signed, text, uniqueStrings } from './learning-utils.mjs';

function emptyMetric() { return { samples: 0, successes: 0, correctionTotal: 0, rssMbSecondsTotal: 0, receipts: [] }; }
function view(metric) {
  return Object.freeze({
    samples: metric.samples,
    passRate: metric.samples ? metric.successes / metric.samples : 0,
    averageCorrectionCycles: metric.samples ? metric.correctionTotal / metric.samples : 0,
    averageRssMbSeconds: metric.samples ? metric.rssMbSecondsTotal / metric.samples : 0,
  });
}

export class CohortCanaryGovernor {
  constructor({ cohorts, minSamples = 5, maxPassRateRegression = 0.05, maxCorrectionRegression = 0.25, maxResourceRegression = 0.25 } = {}) {
    this.cohorts = uniqueStrings(cohorts ?? [], 'cohorts', 128);
    if (!this.cohorts.length) throw new TypeError('at least one cohort is required');
    this.minSamples = number(minSamples, 'minSamples', { min: 1, max: 100_000, integer: true });
    this.maxPassRateRegression = number(maxPassRateRegression, 'maxPassRateRegression', { min: 0, max: 1 });
    this.maxCorrectionRegression = number(maxCorrectionRegression, 'maxCorrectionRegression', { min: 0, max: 100_000 });
    this.maxResourceRegression = number(maxResourceRegression, 'maxResourceRegression', { min: 0, max: 100 });
    this.state = new Map(this.cohorts.map((cohort) => [cohort, { enabled: true, disabledReason: null, baseline: emptyMetric(), candidate: emptyMetric() }]));
  }

  assign({ missionId, policySha256, eligibleCohorts = this.cohorts } = {}) {
    const mission = text(missionId, 'missionId', 256);
    const policy = receipt(policySha256, 'policySha256');
    const eligible = uniqueStrings(eligibleCohorts, 'eligibleCohorts', 128).filter((cohort) => this.state.has(cohort));
    if (!eligible.length) throw new TypeError('no eligible cohort is configured');
    const bucket = Number.parseInt(canonicalSha256({ mission, policy }).slice(0, 12), 16) % eligible.length;
    return signed({ schema: 'forge.cohort-canary-assignment.v1', missionId: mission, policySha256: policy, cohort: eligible[bucket], eligibleCohorts: eligible, productionRoutingChanged: false });
  }

  record(input = {}) {
    if (input.verified !== true) throw new TypeError('verified outcome is required');
    const cohort = text(input.cohort, 'cohort', 256).toLowerCase();
    const group = this.state.get(cohort);
    if (!group) throw new TypeError(`unknown cohort: ${cohort}`);
    const variant = text(input.variant, 'variant', 32).toLowerCase();
    if (!['baseline', 'candidate'].includes(variant)) throw new TypeError('variant must be baseline or candidate');
    if (typeof input.success !== 'boolean') throw new TypeError('success must be boolean');
    const verificationReceiptSha256 = receipt(input.verificationReceiptSha256);
    const metric = group[variant];
    metric.samples += 1;
    if (input.success) metric.successes += 1;
    metric.correctionTotal += number(input.correctionCycles ?? 0, 'correctionCycles', { min: 0, max: 1_000_000 });
    metric.rssMbSecondsTotal += number(input.rssMbSeconds ?? 0, 'rssMbSeconds', { min: 0, max: 1_000_000_000 });
    metric.receipts.push(verificationReceiptSha256);
    return signed({ schema: 'forge.cohort-canary-outcome.v1', cohort, variant, success: input.success, verificationReceiptSha256, claims: { verifiedOutcomeOnly: true, productionRoutingChanged: false } });
  }

  evaluate(cohortInput) {
    const cohort = text(cohortInput, 'cohort', 256).toLowerCase();
    const group = this.state.get(cohort);
    if (!group) throw new TypeError(`unknown cohort: ${cohort}`);
    const baseline = view(group.baseline);
    const candidate = view(group.candidate);
    const reasons = [];
    let decision = 'insufficient-samples';
    if (!group.enabled) decision = 'disabled';
    else if (baseline.samples >= this.minSamples && candidate.samples >= this.minSamples) {
      if (candidate.passRate < baseline.passRate - this.maxPassRateRegression) reasons.push('candidate pass rate regressed');
      if (candidate.averageCorrectionCycles > baseline.averageCorrectionCycles + this.maxCorrectionRegression) reasons.push('candidate correction rate regressed');
      if (baseline.averageRssMbSeconds > 0 && candidate.averageRssMbSeconds > baseline.averageRssMbSeconds * (1 + this.maxResourceRegression)) reasons.push('candidate resource use regressed');
      if (reasons.length) {
        group.enabled = false;
        group.disabledReason = reasons.join('; ');
        decision = 'disable-regression';
      } else decision = 'continue';
    }
    return signed({ schema: 'forge.cohort-canary-evaluation.v1', cohort, enabled: group.enabled, decision, reasons: Object.freeze(reasons), baseline, candidate, claims: { productionPromotionExecuted: false, cohortMetricsIsolated: true } });
  }

  snapshot() {
    const cohorts = [...this.state.entries()].map(([cohort, group]) => Object.freeze({ cohort, enabled: group.enabled, disabledReason: group.disabledReason, baseline: view(group.baseline), candidate: view(group.candidate) })).sort((a, b) => a.cohort.localeCompare(b.cohort));
    return signed({ schema: 'forge.cohort-canary-governor-snapshot.v1', cohorts, minSamples: this.minSamples, claims: { productionPromotionAuthority: false } });
  }
}
