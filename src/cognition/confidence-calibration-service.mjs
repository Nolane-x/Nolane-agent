import { finite, signed, text } from './cognition-utils.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
export const CONFIDENCE_LANES = Object.freeze(['requirement', 'retrieval', 'hypothesis', 'plan', 'execution', 'patch', 'verification']);
const LANE_SET = new Set(CONFIDENCE_LANES);

function lane(value) {
  const output = String(value ?? '').trim().toLowerCase();
  if (!LANE_SET.has(output)) throw new TypeError(`unknown confidence lane: ${output || '<empty>'}`);
  return output;
}
function receipt(value, label) {
  const output = String(value ?? '').trim().toLowerCase();
  if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`);
  return output;
}
function keyOf(laneId, domain, taskKind) { return `${laneId}\0${domain}\0${taskKind}`; }

export class ConfidenceCalibrationService {
  constructor({ maxBuckets = 10_000, maxOutcomes = 100_000, maxIndependentEvidenceBonus = 0.15, evidenceBonusPerFamily = 0.05 } = {}) {
    this.maxBuckets = Math.max(1, Math.min(100_000, Math.floor(Number(maxBuckets) || 10_000)));
    this.maxOutcomes = Math.max(1, Math.min(1_000_000, Math.floor(Number(maxOutcomes) || 100_000)));
    this.maxIndependentEvidenceBonus = finite(maxIndependentEvidenceBonus, 'maxIndependentEvidenceBonus', { min: 0, max: 0.5 });
    this.evidenceBonusPerFamily = finite(evidenceBonusPerFamily, 'evidenceBonusPerFamily', { min: 0, max: 0.5 });
    this.buckets = new Map();
    this.outcomes = new Map();
  }

  recordOutcome(input = {}) {
    if (input.verified !== true) throw new TypeError('verified outcome is required for calibration');
    const outcomeId = text(input.outcomeId, 'outcomeId', 256);
    const laneId = lane(input.lane);
    const domain = text(input.domain ?? 'general', 'domain', 128);
    const taskKind = text(input.taskKind ?? 'general', 'taskKind', 128);
    const predictedConfidence = finite(input.predictedConfidence, 'predictedConfidence', { min: 0, max: 1 });
    if (typeof input.success !== 'boolean') throw new TypeError('success must be a boolean');
    const verificationReceiptSha256 = receipt(input.verificationReceiptSha256, 'verificationReceiptSha256');
    const existing = this.outcomes.get(outcomeId);
    if (existing) {
      const same = existing.lane === laneId && existing.domain === domain && existing.taskKind === taskKind
        && existing.predictedConfidence === predictedConfidence && existing.success === input.success
        && existing.verificationReceiptSha256 === verificationReceiptSha256;
      if (!same) throw new TypeError(`calibration outcome conflict: ${outcomeId}`);
      return signed({ schema: 'forge.confidence-calibration-outcome.v1', ...existing, duplicate: true });
    }
    if (this.outcomes.size >= this.maxOutcomes) throw new RangeError(`calibration outcome capacity exceeded: ${this.maxOutcomes}`);
    const bucketKey = keyOf(laneId, domain, taskKind);
    let bucket = this.buckets.get(bucketKey);
    if (!bucket) {
      if (this.buckets.size >= this.maxBuckets) throw new RangeError(`calibration bucket capacity exceeded: ${this.maxBuckets}`);
      bucket = { lane: laneId, domain, taskKind, alpha: 1, beta: 1, sampleCount: 0, brierTotal: 0 };
      this.buckets.set(bucketKey, bucket);
    }
    const success = input.success;
    if (success) bucket.alpha += 1; else bucket.beta += 1;
    bucket.sampleCount += 1;
    bucket.brierTotal += (predictedConfidence - (success ? 1 : 0)) ** 2;
    const record = Object.freeze({ outcomeId, lane: laneId, domain, taskKind, predictedConfidence, success, verificationReceiptSha256 });
    this.outcomes.set(outcomeId, record);
    return signed({ schema: 'forge.confidence-calibration-outcome.v1', ...record, duplicate: false });
  }

  calibrate(input = {}) {
    const laneId = lane(input.lane);
    const domain = text(input.domain ?? 'general', 'domain', 128);
    const taskKind = text(input.taskKind ?? 'general', 'taskKind', 128);
    const rawConfidence = finite(input.rawConfidence, 'rawConfidence', { min: 0, max: 1 });
    const bucket = this.buckets.get(keyOf(laneId, domain, taskKind));
    const sampleCount = bucket?.sampleCount ?? 0;
    const alpha = bucket?.alpha ?? 1;
    const beta = bucket?.beta ?? 1;
    const posteriorSuccessRate = alpha / (alpha + beta);
    const evidenceWeight = Math.min(20, sampleCount);
    const calibratedConfidence = sampleCount === 0
      ? rawConfidence
      : ((rawConfidence * 2) + (posteriorSuccessRate * evidenceWeight)) / (2 + evidenceWeight);
    return signed({
      schema: 'forge.confidence-lane-calibration.v1', lane: laneId, domain, taskKind,
      rawConfidence, calibratedConfidence, sampleCount, alpha, beta, posteriorSuccessRate,
      claims: { verifiedOutcomesOnly: true, laneSpecific: true, domainSpecific: true, taskKindSpecific: true },
    });
  }

  finalConfidence(input = {}) {
    const domain = text(input.domain ?? 'general', 'domain', 128);
    const taskKind = text(input.taskKind ?? 'general', 'taskKind', 128);
    if (!input.lanes || typeof input.lanes !== 'object' || Array.isArray(input.lanes)) throw new TypeError('lanes must be an object');
    const calibratedLanes = CONFIDENCE_LANES.map((laneId) => {
      if (!Object.hasOwn(input.lanes, laneId)) throw new TypeError(`missing confidence lane: ${laneId}`);
      const projection = this.calibrate({ lane: laneId, domain, taskKind, rawConfidence: input.lanes[laneId] });
      return Object.freeze({ lane: laneId, rawConfidence: projection.rawConfidence, calibratedConfidence: projection.calibratedConfidence, calibrationReceiptSha256: projection.receiptSha256 });
    });
    const weakestLane = [...calibratedLanes].sort((a, b) => a.calibratedConfidence - b.calibratedConfidence || a.lane.localeCompare(b.lane))[0];
    if (!Array.isArray(input.independentEvidence ?? [])) throw new TypeError('independentEvidence must be an array');
    if ((input.independentEvidence ?? []).length > 256) throw new TypeError('independentEvidence must contain at most 256 items');
    const families = new Map();
    for (const [index, item] of (input.independentEvidence ?? []).entries()) {
      const family = text(item?.family, `independentEvidence[${index}].family`, 128);
      const confidence = finite(item?.confidence, `independentEvidence[${index}].confidence`, { min: 0, max: 1 });
      const receiptSha256 = receipt(item?.receiptSha256, `independentEvidence[${index}].receiptSha256`);
      const current = families.get(family);
      if (!current || confidence > current.confidence || (confidence === current.confidence && receiptSha256 < current.receiptSha256)) families.set(family, { family, confidence, receiptSha256 });
    }
    const independentEvidenceFamilies = [...families.values()].sort((a, b) => a.family.localeCompare(b.family));
    const evidenceBonus = Math.min(this.maxIndependentEvidenceBonus, independentEvidenceFamilies.reduce((sum, item) => sum + (this.evidenceBonusPerFamily * item.confidence), 0));
    const finalConfidence = Math.min(1, weakestLane.calibratedConfidence + evidenceBonus);
    return signed({
      schema: 'forge.final-confidence.v1', domain, taskKind, calibratedLanes, weakestLane,
      independentEvidenceFamilies, evidenceBonus, finalConfidence,
      claims: { simpleAverageUsed: false, weakestLaneIsBase: true, correlatedEvidenceDeduplicated: true, evidenceBonusCapped: true },
    });
  }

  snapshot() {
    const buckets = [...this.buckets.values()].map((bucket) => Object.freeze({
      lane: bucket.lane, domain: bucket.domain, taskKind: bucket.taskKind,
      alpha: bucket.alpha, beta: bucket.beta, sampleCount: bucket.sampleCount,
      posteriorSuccessRate: bucket.alpha / (bucket.alpha + bucket.beta),
      brierError: bucket.sampleCount ? bucket.brierTotal / bucket.sampleCount : null,
    })).sort((a, b) => a.lane.localeCompare(b.lane) || a.domain.localeCompare(b.domain) || a.taskKind.localeCompare(b.taskKind));
    return signed({
      schema: 'forge.confidence-calibration-snapshot.v1', buckets, outcomeCount: this.outcomes.size,
      maxBuckets: this.maxBuckets, maxOutcomes: this.maxOutcomes,
      claims: { unverifiedOutcomesStored: false, rawPromptsStored: false, chainOfThoughtStored: false },
    });
  }
}
