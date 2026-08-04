import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { number, receipt, signed, text } from './learning-utils.mjs';

const DAY_MS = 86_400_000;
const EFFORT = new Set(['low', 'medium', 'high']);

function contextKey(input = {}) {
  const normalized = Object.freeze({
    taskType: text(input.taskType ?? 'general', 'context.taskType', 128).toLowerCase(),
    language: text(input.language ?? 'unknown', 'context.language', 128).toLowerCase(),
    riskBand: text(input.riskBand ?? 'medium', 'context.riskBand', 64).toLowerCase(),
  });
  return { normalized, key: canonicalSha256(normalized) };
}

function strategy(input = {}) {
  const reasoningEffort = text(input.reasoningEffort, 'strategy.reasoningEffort', 32).toLowerCase();
  if (!EFFORT.has(reasoningEffort)) throw new TypeError('strategy.reasoningEffort must be low, medium, or high');
  return Object.freeze({
    reasoningEffort,
    toolBudget: number(input.toolBudget, 'strategy.toolBudget', { min: 0, max: 100_000, integer: true }),
    retryBudget: number(input.retryBudget, 'strategy.retryBudget', { min: 0, max: 1_000, integer: true }),
    contextStrategy: text(input.contextStrategy, 'strategy.contextStrategy', 128).toLowerCase(),
  });
}

export class StrategyPolicyLearner {
  constructor({ maxOutcomes = 100_000 } = {}) {
    this.maxOutcomes = number(maxOutcomes, 'maxOutcomes', { min: 1, max: 1_000_000, integer: true });
    this.outcomes = new Map();
    this.buckets = new Map();
    this.survival = new Map();
  }

  recordOutcome(input = {}) {
    if (input.verified !== true) throw new TypeError('verified outcome is required');
    const outcomeId = text(input.outcomeId, 'outcomeId', 256);
    const verificationReceiptSha256 = receipt(input.verificationReceiptSha256);
    const { normalized: context, key } = contextKey(input.context);
    const normalizedStrategy = strategy(input.strategy);
    if (typeof input.success !== 'boolean') throw new TypeError('success must be boolean');
    const verifiedUtility = number(input.verifiedUtility ?? (input.success ? 1 : 0), 'verifiedUtility', { min: -1_000_000, max: 1_000_000 });
    const existing = this.outcomes.get(outcomeId);
    const fingerprint = canonicalSha256({ context, strategy: normalizedStrategy, success: input.success, verifiedUtility, verificationReceiptSha256 });
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new TypeError(`strategy outcome conflict: ${outcomeId}`);
      return signed({ schema: 'forge.strategy-policy-outcome.v1', outcomeId, duplicate: true, verificationReceiptSha256 });
    }
    if (this.outcomes.size >= this.maxOutcomes) throw new RangeError('strategy outcome capacity exceeded');
    const strategyKey = canonicalSha256(normalizedStrategy);
    const bucketKey = `${key}\0${strategyKey}`;
    const bucket = this.buckets.get(bucketKey) ?? { context, strategy: normalizedStrategy, samples: 0, successes: 0, utilityTotal: 0 };
    bucket.samples += 1;
    if (input.success) bucket.successes += 1;
    bucket.utilityTotal += verifiedUtility;
    this.buckets.set(bucketKey, bucket);
    this.outcomes.set(outcomeId, { fingerprint, verificationReceiptSha256 });
    return signed({ schema: 'forge.strategy-policy-outcome.v1', outcomeId, context, strategy: normalizedStrategy, success: input.success, verifiedUtility, duplicate: false, verificationReceiptSha256 });
  }

  recommend(contextInput = {}) {
    const { normalized: context, key } = contextKey(contextInput);
    const candidates = [...this.buckets.entries()].filter(([bucketKey]) => bucketKey.startsWith(`${key}\0`)).map(([, bucket]) => ({
      strategy: bucket.strategy,
      samples: bucket.samples,
      successRate: bucket.samples ? bucket.successes / bucket.samples : 0,
      meanUtility: bucket.samples ? bucket.utilityTotal / bucket.samples : 0,
    }));
    candidates.sort((a, b) => b.meanUtility - a.meanUtility || b.successRate - a.successRate || b.samples - a.samples || canonicalSha256(a.strategy).localeCompare(canonicalSha256(b.strategy)));
    const selected = candidates[0] ?? { strategy: Object.freeze({ reasoningEffort: 'medium', toolBudget: 8, retryBudget: 1, contextStrategy: 'symbol-first' }), samples: 0, successRate: 0, meanUtility: 0 };
    return signed({ schema: 'forge.strategy-policy-recommendation.v1', context, strategy: selected.strategy, samples: selected.samples, successRate: selected.successRate, meanUtility: selected.meanUtility, claims: { verifiedOutcomesOnly: true, productionRoutingChanged: false } });
  }

  recordPatchSurvival(input = {}) {
    if (input.verified !== true) throw new TypeError('verified outcome is required');
    const patchId = text(input.patchId, 'patchId', 256);
    const acceptedAt = number(input.acceptedAt, 'acceptedAt', { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true });
    const observedAt = number(input.observedAt, 'observedAt', { min: acceptedAt, max: Number.MAX_SAFE_INTEGER, integer: true });
    const ageDays = Math.floor((observedAt - acceptedAt) / DAY_MS);
    if (ageDays < 7 || ageDays > 30) throw new TypeError('patch survival observation must be between 7 and 30 days');
    if (typeof input.survived !== 'boolean' || typeof input.reverted !== 'boolean') throw new TypeError('survived and reverted must be boolean');
    const humanRewriteRatio = number(input.humanRewriteRatio ?? 0, 'humanRewriteRatio', { min: 0, max: 1 });
    const verificationReceiptSha256 = receipt(input.verificationReceiptSha256);
    const base = { schema: 'forge.patch-survival-observation.v1', patchId, acceptedAt, observedAt, ageDays, survived: input.survived, reverted: input.reverted, humanRewriteRatio, verificationReceiptSha256 };
    const prior = this.survival.get(patchId);
    if (prior && canonicalSha256(prior) !== canonicalSha256(base)) throw new TypeError(`patch survival conflict: ${patchId}`);
    this.survival.set(patchId, Object.freeze(base));
    return signed(base);
  }

  snapshot() {
    const observations = [...this.survival.values()];
    return signed({
      schema: 'forge.strategy-policy-learner-snapshot.v1',
      strategyBuckets: this.buckets.size,
      outcomeCount: this.outcomes.size,
      patchSurvival: Object.freeze({ observations: observations.length, survived: observations.filter((item) => item.survived).length, reverted: observations.filter((item) => item.reverted).length, averageHumanRewriteRatio: observations.length ? observations.reduce((sum, item) => sum + item.humanRewriteRatio, 0) / observations.length : null }),
      claims: { unverifiedOutcomesStored: false, longTermSurvivalClaimedWithoutObservation: false },
    });
  }
}
