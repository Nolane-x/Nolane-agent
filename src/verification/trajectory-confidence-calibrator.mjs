import { boundedNumber, signed, text } from '../construction/construction-utils.mjs';

const HASH = /^[a-f0-9]{64}$/i;

function normalizeStage(stage, index) {
  if (!stage || typeof stage !== 'object') throw new TypeError(`stages[${index}] must be an object`);
  return Object.freeze({
    kind: text(stage.kind, `stages[${index}].kind`, 128),
    confidence: boundedNumber(stage.confidence, 0, 0, 1, `stages[${index}].confidence`),
    critical: stage.critical !== false,
    evidenceReceiptSha256: stage.evidenceReceiptSha256 == null ? null : validateReceipt(stage.evidenceReceiptSha256, `stages[${index}].evidenceReceiptSha256`),
  });
}

function validateReceipt(value, label) {
  const receipt = String(value ?? '').toLowerCase();
  if (!HASH.test(receipt)) throw new TypeError(`${label} requires a verification receipt SHA-256`);
  return receipt;
}

export class TrajectoryConfidenceCalibrator {
  constructor({ maxSamplesPerBucket = 500 } = {}) {
    this.maxSamplesPerBucket = Math.trunc(boundedNumber(maxSamplesPerBucket, 500, 1, 10_000, 'maxSamplesPerBucket'));
    this.buckets = new Map();
  }

  assess({ domain = 'general', taskType = 'general', stages = [], independentReceipts = [] } = {}) {
    if (!Array.isArray(stages) || stages.length === 0) throw new TypeError('stages must be a non-empty array');
    if (!Array.isArray(independentReceipts)) throw new TypeError('independentReceipts must be an array');
    const normalizedStages = stages.map(normalizeStage);
    const critical = normalizedStages.filter((stage) => stage.critical);
    if (!critical.length) throw new TypeError('at least one critical trajectory stage is required');
    const weakestCritical = [...critical].sort((a, b) => a.confidence - b.confidence || a.kind.localeCompare(b.kind))[0];
    const mean = normalizedStages.reduce((sum, stage) => sum + stage.confidence, 0) / normalizedStages.length;
    const independent = independentReceipts.map((item, index) => {
      if (!item || typeof item !== 'object') throw new TypeError(`independentReceipts[${index}] must be an object`);
      return Object.freeze({ kind: text(item.kind, `independentReceipts[${index}].kind`, 128), status: text(item.status, `independentReceipts[${index}].status`, 32), receiptSha256: validateReceipt(item.receiptSha256, `independentReceipts[${index}].receiptSha256`) });
    });
    const independentPasses = independent.filter((item) => item.status === 'pass').length;
    const conservativeBase = weakestCritical.confidence * mean;
    const finalConfidence = Math.min(weakestCritical.confidence, conservativeBase + Math.min(0.2, independentPasses * 0.1));
    return signed({
      schema: 'forge.trajectory-confidence-assessment.v1',
      domain: text(domain, 'domain', 128),
      taskType: text(taskType, 'taskType', 128),
      stages: normalizedStages,
      weakestCritical,
      meanStageConfidence: mean,
      independentReceipts: independent,
      independentPasses,
      finalConfidence,
      claims: { finalIsSimpleAverage: false, boundedByWeakestCriticalLink: true, selfReportedCapabilityTrusted: false },
    });
  }

  recordOutcome({ domain = 'general', taskType = 'general', confidence, success, verificationReceiptSha256 } = {}) {
    const normalizedDomain = text(domain, 'domain', 128);
    const normalizedTask = text(taskType, 'taskType', 128);
    const predicted = boundedNumber(confidence, 0, 0, 1, 'confidence');
    if (typeof success !== 'boolean') throw new TypeError('success must be a boolean');
    const receiptSha256 = validateReceipt(verificationReceiptSha256, 'verification receipt');
    const key = `${normalizedDomain}\0${normalizedTask}`;
    const samples = this.buckets.get(key) ?? [];
    const outcome = success ? 1 : 0;
    const record = Object.freeze({ confidence: predicted, success, brier: (predicted - outcome) ** 2, receiptSha256 });
    samples.push(record);
    if (samples.length > this.maxSamplesPerBucket) samples.splice(0, samples.length - this.maxSamplesPerBucket);
    this.buckets.set(key, samples);
    return signed({ schema: 'forge.trajectory-confidence-outcome.v1', domain: normalizedDomain, taskType: normalizedTask, confidence: predicted, success, brier: record.brier, verificationReceiptSha256: receiptSha256 });
  }

  snapshot() {
    const buckets = [];
    for (const [key, samples] of this.buckets) {
      const [domain, taskType] = key.split('\0');
      const brierError = samples.length ? samples.reduce((sum, item) => sum + item.brier, 0) / samples.length : null;
      const empiricalSuccessRate = samples.length ? samples.filter((item) => item.success).length / samples.length : null;
      buckets.push(Object.freeze({ domain, taskType, samples: samples.length, verifiedSamples: samples.length, brierError, empiricalSuccessRate }));
    }
    buckets.sort((a, b) => a.domain.localeCompare(b.domain) || a.taskType.localeCompare(b.taskType));
    return signed({ schema: 'forge.trajectory-confidence-calibration-snapshot.v1', buckets, maxSamplesPerBucket: this.maxSamplesPerBucket, claims: { unverifiedOutcomesStored: false } });
  }
}
