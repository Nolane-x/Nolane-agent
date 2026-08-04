import { createHash } from 'node:crypto';

function clean(value, max = 256) { return String(value ?? '').trim().slice(0, max); }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); return value; }
function sha256(value) { return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const item of Object.values(value)) freeze(item); return Object.freeze(value); }
function fraction(value, label, min = 0, max = 1) { const number = Number(value); if (!Number.isFinite(number) || number < min || number > max) throw new TypeError(`${label} is invalid`); return number; }
function integer(value, label, min = 1, max = 1_000_000) { const number = Number(value); if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${label} is invalid`); return number; }
function bucket(scope) { return parseInt(createHash('sha256').update([scope.family, scope.projectId, scope.missionId, scope.userId].map((value) => clean(value, 512) || '-').join(':')).digest('hex').slice(0, 8), 16) / 0x1_0000_0000; }
function metric() { return { samples: 0, passes: 0, failures: 0, totalLatencyMs: 0, totalPeakRssBytes: 0, totalRetries: 0 }; }
function metricView(value) { return freeze({ samples: value.samples, passes: value.passes, failures: value.failures, passRate: value.samples ? value.passes / value.samples : 0, averageLatencyMs: value.samples ? value.totalLatencyMs / value.samples : 0, averagePeakRssBytes: value.samples ? value.totalPeakRssBytes / value.samples : 0, averageRetries: value.samples ? value.totalRetries / value.samples : 0 }); }

export class HarnessCanaryController {
  constructor({ registry, clock = () => Date.now(), maxJournal = 2_000, eventSink = () => {} } = {}) {
    if (!registry?.resolve || !registry?.get) throw new TypeError('registry is required');
    this.registry = registry; this.clock = clock; this.maxJournal = Math.max(1, Math.floor(Number(maxJournal) || 2_000)); this.eventSink = typeof eventSink === 'function' ? eventSink : () => {};
    this.configs = new Map(); this.metrics = new Map(); this.journal = [];
  }
  #event(type, detail = {}) { const base = { schema: 'forge.harness-canary-event.v1', type, atMs: this.clock(), ...detail }; const event = freeze({ ...base, receiptSha256: sha256(base) }); this.journal.push(event); if (this.journal.length > this.maxJournal) this.journal.splice(0, this.journal.length - this.maxJournal); try { void this.eventSink(event); } catch {} return event; }
  #metric(profileId) { let value = this.metrics.get(profileId); if (!value) { value = metric(); this.metrics.set(profileId, value); } return value; }
  configure({ family, candidateId, percentage = 5, minSamples = 20, maxPassRateRegression = 0.02, maxResourceRegression = 0.25 } = {}) {
    const cleanFamily = clean(family, 64); if (!cleanFamily) throw new TypeError('family is required');
    const candidate = this.registry.get(candidateId); if (candidate.family !== cleanFamily || candidate.status !== 'candidate') throw new Error('candidate profile is invalid for family');
    const baseline = this.registry.resolve({ harnessFamily: cleanFamily });
    const config = { family: cleanFamily, candidateId: candidate.id, candidateProfileSha256: candidate.profileSha256, baselineProfileId: baseline.id, baselineProfileSha256: baseline.profileSha256, percentage: fraction(Number(percentage) / 100, 'percentage'), minSamples: integer(minSamples, 'minSamples'), maxPassRateRegression: fraction(maxPassRateRegression, 'maxPassRateRegression'), maxResourceRegression: fraction(maxResourceRegression, 'maxResourceRegression', 0, 10), enabled: true, disabledReason: null, configuredAtMs: this.clock() };
    this.configs.set(candidate.id, config); this.#event('harness-canary.configured', { family: cleanFamily, candidateId: candidate.id, baselineProfileId: baseline.id, percentage: config.percentage });
    return this.#configView(config);
  }
  #configView(config) { const base = { schema: 'forge.harness-canary-config.v1', family: config.family, candidateId: config.candidateId, candidateProfileSha256: config.candidateProfileSha256, baselineProfileId: config.baselineProfileId, baselineProfileSha256: config.baselineProfileSha256, percentage: config.percentage, minSamples: config.minSamples, maxPassRateRegression: config.maxPassRateRegression, maxResourceRegression: config.maxResourceRegression, enabled: config.enabled, disabledReason: config.disabledReason, configuredAtMs: config.configuredAtMs }; return freeze({ ...base, receiptSha256: sha256(base) }); }
  assign({ family, projectId = null, missionId = null, userId = null } = {}) {
    const cleanFamily = clean(family, 64); if (!cleanFamily) throw new TypeError('family is required');
    const stableProfile = this.registry.resolve({ harnessFamily: cleanFamily });
    const config = [...this.configs.values()].find((item) => item.family === cleanFamily && item.enabled);
    const cohortValue = bucket({ family: cleanFamily, projectId, missionId, userId });
    const candidate = config && cohortValue < config.percentage ? this.registry.get(config.candidateId) : null;
    const selected = candidate ?? stableProfile;
    const base = { schema: 'forge.harness-canary-assignment.v1', family: cleanFamily, profileId: selected.id, profileSha256: selected.profileSha256, cohort: candidate ? 'candidate' : 'stable', bucket: cohortValue, percentage: config?.percentage ?? 0, candidateId: config?.candidateId ?? null, projectIdHash: projectId == null ? null : sha256(clean(projectId, 512)), missionIdHash: missionId == null ? null : sha256(clean(missionId, 512)) };
    return freeze({ ...base, receiptSha256: sha256(base) });
  }
  recordOutcome({ family, profileId, cohort = 'stable', passed = false, latencyMs = 0, peakRssBytes = 0, retries = 0 } = {}) {
    const cleanFamily = clean(family, 64); const profile = this.registry.get(profileId); if (profile.family !== cleanFamily) throw new Error('profile family mismatch');
    const value = this.#metric(profile.id); value.samples += 1; if (passed === true) value.passes += 1; else value.failures += 1; value.totalLatencyMs += Math.max(0, Number(latencyMs) || 0); value.totalPeakRssBytes += Math.max(0, Number(peakRssBytes) || 0); value.totalRetries += Math.max(0, Math.floor(Number(retries) || 0));
    const receipt = this.#event('harness-canary.outcome', { family: cleanFamily, profileId: profile.id, cohort: clean(cohort, 32) || 'stable', passed: passed === true, latencyMs: Math.max(0, Number(latencyMs) || 0), peakRssBytes: Math.max(0, Number(peakRssBytes) || 0), retries: Math.max(0, Math.floor(Number(retries) || 0)) });
    return freeze({ schema: 'forge.harness-canary-outcome.v1', profileId: profile.id, metrics: metricView(value), receiptSha256: receipt.receiptSha256 });
  }
  evaluate(candidateId) {
    const config = this.configs.get(String(candidateId)); if (!config) throw new Error(`Unknown harness canary: ${candidateId}`);
    const candidate = metricView(this.#metric(config.candidateId)); const baseline = metricView(this.#metric(config.baselineProfileId));
    const reasons = []; let decision = 'insufficient-samples';
    if (!config.enabled) { decision = 'disabled'; reasons.push(config.disabledReason ?? 'disabled'); }
    else if (candidate.samples >= config.minSamples && baseline.samples >= config.minSamples) {
      if (candidate.passRate < baseline.passRate - config.maxPassRateRegression) reasons.push(`Candidate pass rate ${candidate.passRate.toFixed(4)} regressed below baseline ${baseline.passRate.toFixed(4)}.`);
      if (baseline.averagePeakRssBytes > 0 && candidate.averagePeakRssBytes > baseline.averagePeakRssBytes * (1 + config.maxResourceRegression)) reasons.push(`Candidate resource use ${candidate.averagePeakRssBytes.toFixed(2)} exceeded baseline ${baseline.averagePeakRssBytes.toFixed(2)}.`);
      if (reasons.length) { config.enabled = false; config.disabledReason = reasons.join(' '); decision = 'disable-regression'; this.#event('harness-canary.disabled', { family: config.family, candidateId: config.candidateId, reason: config.disabledReason, automatic: true }); }
      else decision = 'continue';
    }
    const base = { schema: 'forge.harness-canary-evaluation.v1', family: config.family, candidateId: config.candidateId, baselineProfileId: config.baselineProfileId, enabled: config.enabled, decision, reasons, candidate, baseline, minimumSamples: config.minSamples };
    return freeze({ ...base, receiptSha256: sha256(base) });
  }
  disable(candidateId, reason = 'operator-disabled') { const config = this.configs.get(String(candidateId)); if (!config) throw new Error(`Unknown harness canary: ${candidateId}`); config.enabled = false; config.disabledReason = clean(reason, 1_000) || 'operator-disabled'; const receipt = this.#event('harness-canary.disabled', { family: config.family, candidateId: config.candidateId, reason: config.disabledReason, automatic: false }); return freeze({ schema: 'forge.harness-canary-disable.v1', candidateId: config.candidateId, enabled: false, reason: config.disabledReason, receiptSha256: receipt.receiptSha256 }); }
  snapshot() { const base = { schema: 'forge.harness-canary-controller-snapshot.v1', configs: [...this.configs.values()].map((item) => this.#configView(item)).sort((a, b) => a.candidateId.localeCompare(b.candidateId)), metrics: [...this.metrics.entries()].map(([profileId, value]) => ({ profileId, ...metricView(value) })).sort((a, b) => a.profileId.localeCompare(b.profileId)), journal: [...this.journal] }; return freeze({ ...base, receiptSha256: sha256(base) }); }
}
