import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const HASH = /^[a-f0-9]{64}$/i;

function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, finite(value))); }
function text(value, label, max = 512) { const out = String(value ?? '').trim(); if (!out) throw new TypeError(`${label} is required`); if (out.length > max) throw new RangeError(`${label} exceeds ${max} characters`); return out; }
function normalizeFeatures(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('features must be an object');
  const allowed = ['taskType', 'language', 'repoSize', 'risk', 'symbolCount', 'contextTokens', 'toolCount', 'localOnly'];
  return Object.freeze(Object.fromEntries(allowed.filter((key) => value[key] !== undefined).map((key) => [key, typeof value[key] === 'number' ? finite(value[key]) : typeof value[key] === 'boolean' ? value[key] : String(value[key]).slice(0, 256)])));
}
function pairId(providerId, harnessProfile) { return `${text(providerId, 'providerId', 256)}::${text(harnessProfile, 'harnessProfile', 256)}`; }
function signed(base) { return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class VerifiedOutcomeBandit {
  constructor({ exploration = 0.2, shadowRolloutPercent = 100, maxSamplesPerBucket = 500, clock = Date.now } = {}) {
    this.exploration = clamp(exploration, 0, 10);
    this.shadowRolloutPercent = clamp(shadowRolloutPercent, 0, 100);
    this.maxSamplesPerBucket = Math.max(1, Math.min(10_000, Math.trunc(finite(maxSamplesPerBucket, 500))));
    this.clock = clock;
    this.stats = new Map();
    this.policies = new Map();
    const initial = this.#makePolicy({ version: 'policy-v1', parentVersion: null, reason: 'verified-outcome-shadow-baseline' });
    this.policies.set(initial.version, initial);
    this.currentVersion = initial.version;
  }

  #makePolicy({ version, parentVersion, reason }) {
    const base = { schema: 'forge.verified-outcome-policy.v1', version: text(version, 'policy version', 256), parentVersion, reason: text(reason, 'policy reason', 2_000), mode: 'shadow', createdAt: Math.trunc(this.clock()) };
    return Object.freeze({ ...base, policySha256: canonicalSha256(base) });
  }

  currentPolicy() { return this.policies.get(this.currentVersion); }

  createPolicy({ version, reason, parentVersion = this.currentVersion } = {}) {
    const normalizedVersion = text(version, 'policy version', 256);
    if (this.policies.has(normalizedVersion)) throw new Error(`Policy already exists: ${normalizedVersion}`);
    if (parentVersion !== null && !this.policies.has(String(parentVersion))) throw new Error(`Unknown parent policy: ${parentVersion}`);
    const policy = this.#makePolicy({ version: normalizedVersion, parentVersion: parentVersion === null ? null : String(parentVersion), reason });
    this.policies.set(policy.version, policy);
    this.currentVersion = policy.version;
    return policy;
  }

  rollbackPolicy(targetVersion) {
    const target = this.policies.get(String(targetVersion));
    if (!target) throw new Error(`Unknown policy: ${targetVersion}`);
    const from = this.currentPolicy();
    this.currentVersion = target.version;
    return signed({ schema: 'forge.verified-outcome-policy-rollback.v1', fromVersion: from.version, fromPolicySha256: from.policySha256, toVersion: target.version, toPolicySha256: target.policySha256, current: target, mode: 'shadow' });
  }

  recordOutcome({ providerId, harnessProfile, features = {}, verified = false, accepted = null, verifiedCriteriaScore = 0, firstPatchPassed = false, retainedPatch = false, tokenCost = 0, latencyMs = 0, peakRssMb = 0, rssMbSeconds = 0, correctionCycles = 0, humanInterventions = 0, revertedLines = 0, verificationReceiptSha256 } = {}) {
    const receipt = String(verificationReceiptSha256 ?? '').toLowerCase();
    if (!HASH.test(receipt)) throw new TypeError('A verification receipt SHA-256 is required');
    if (verified !== true) throw new TypeError('A verified outcome is required before bandit learning');
    const normalizedFeatures = normalizeFeatures(features);
    const id = pairId(providerId, harnessProfile);
    const contextKey = canonicalSha256(normalizedFeatures);
    const reward = finite(verifiedCriteriaScore)
      + (firstPatchPassed === true ? 1 : 0)
      + (retainedPatch === true ? 1 : 0)
      - Math.max(0, finite(tokenCost)) / 10_000
      - Math.max(0, finite(latencyMs)) / 10_000
      - Math.max(0, finite(peakRssMb)) / 2_000
      - Math.max(0, finite(rssMbSeconds)) / 100_000
      - Math.max(0, finite(correctionCycles)) * 0.5
      - Math.max(0, finite(humanInterventions)) * 0.75
      - Math.max(0, finite(revertedLines)) / 1_000;
    const key = `${this.currentVersion}\0${contextKey}\0${id}`;
    const state = this.stats.get(key) ?? { samples: 0, sum: 0, sumSquares: 0, receipts: [] };
    state.samples += 1;
    state.sum += reward;
    state.sumSquares += reward * reward;
    state.receipts.push(receipt);
    if (state.receipts.length > this.maxSamplesPerBucket) state.receipts.splice(0, state.receipts.length - this.maxSamplesPerBucket);
    this.stats.set(key, state);
    return signed({ schema: 'forge.verified-outcome-bandit-record.v1', recorded: true, pairId: id, policyVersion: this.currentVersion, contextKey, reward, acceptedObserved: typeof accepted === 'boolean', verificationReceiptSha256: receipt, claims: { acceptClickSufficient: false, unverifiedResponseLearned: false } });
  }

  rank({ taskId, candidates = [], features = {} } = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) throw new TypeError('candidates must be a non-empty array');
    const normalizedFeatures = normalizeFeatures(features);
    const contextKey = canonicalSha256(normalizedFeatures);
    const policy = this.currentPolicy();
    const cohortValue = Number.parseInt(canonicalSha256({ taskId: String(taskId ?? ''), policySha256: policy.policySha256 }).slice(0, 8), 16) % 100;
    const cohortIncluded = cohortValue < this.shadowRolloutPercent;
    const ranked = candidates.map((candidate, index) => {
      const id = pairId(candidate?.providerId, candidate?.harnessProfile);
      const state = this.stats.get(`${policy.version}\0${contextKey}\0${id}`) ?? { samples: 0, sum: 0, sumSquares: 0 };
      const meanReward = state.samples ? state.sum / state.samples : 0;
      const uncertainty = state.samples > 1 ? Math.sqrt(Math.max(0, (state.sumSquares / state.samples) - (meanReward * meanReward))) : 1;
      const explorationBonus = this.exploration * uncertainty / Math.sqrt(state.samples + 1);
      const eligible = candidate?.eligible !== false;
      const score = eligible ? meanReward + explorationBonus : null;
      return { pairId: id, providerId: String(candidate.providerId), harnessProfile: String(candidate.harnessProfile), eligible, reason: eligible ? 'hard-constraints-pass' : String(candidate.reason ?? 'hard-constraint-blocked'), samples: state.samples, meanReward, explorationBonus, score, sortScore: eligible ? score : -Number.MAX_VALUE, sourceIndex: index };
    });
    ranked.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.sortScore - a.sortScore || a.pairId.localeCompare(b.pairId));
    const selected = ranked.find((item) => item.eligible) ?? null;
    const publicRanked = ranked.map(({ sortScore, ...item }) => Object.freeze(item));
    return signed({ schema: 'forge.verified-outcome-shadow-ranking.v1', mode: 'shadow', policyVersion: policy.version, policySha256: policy.policySha256, contextKey, cohortIncluded, shadowRolloutPercent: this.shadowRolloutPercent, selectedPairId: selected?.pairId ?? null, ranked: publicRanked, claims: { productionTrafficChanged: false, hardConstraintsRelaxed: false, providerAndHarnessPaired: true } });
  }

  snapshot() {
    return signed({ schema: 'forge.verified-outcome-bandit-snapshot.v1', currentPolicy: this.currentPolicy(), policies: [...this.policies.values()], bucketCount: this.stats.size, mode: 'shadow', claims: { productionTrafficAuthority: false } });
  }
}
