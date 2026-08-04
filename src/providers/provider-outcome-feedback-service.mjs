const HASH = /^[a-f0-9]{64}$/i;

function principalSubject(principal) {
  const subject = String(principal?.subject ?? '').trim();
  if (!subject) throw Object.assign(new Error('An authenticated principal is required'), { statusCode: 401, code: 'OUTCOME_PRINCIPAL_REQUIRED' });
  return subject;
}

function boundedCount(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isInteger(number) || number < 0 || number > 10_000_000) throw new TypeError(`${label} must be an integer between 0 and 10000000`);
  return number;
}

export class ProviderOutcomeFeedbackService {
  constructor({ metrics, taskResolver, verifiedOutcomeBandit = null } = {}) {
    if (!metrics?.record || typeof taskResolver !== 'function') throw new TypeError('ProviderOutcomeFeedbackService metrics and taskResolver are required');
    this.metrics = metrics;
    this.taskResolver = taskResolver;
    this.verifiedOutcomeBandit = verifiedOutcomeBandit;
  }

  #provenance(taskId, evidenceReceiptSha256) {
    const id = String(taskId ?? '').trim();
    const receipt = String(evidenceReceiptSha256 ?? '');
    if (!HASH.test(receipt)) throw new TypeError('A valid evidence receipt SHA-256 is required');
    const task = this.taskResolver(id);
    if (!task) throw Object.assign(new Error(`Unknown task: ${id}`), { statusCode: 404, code: 'OUTCOME_TASK_NOT_FOUND' });
    const providerId = String(task.metadata?.handoff?.providerId ?? task.metadata?.candidateProviderId ?? '').trim();
    if (!providerId || providerId === 'auto') throw new Error('Task is missing concrete provider provenance');
    return { task, taskId: id, providerId, taskKind: String(task.metadata?.taskKind ?? task.role ?? 'general'), receipt };
  }

  recordVerification({ taskId, verified, evidenceReceiptSha256, costUsd = 0, latencyMs = 0 } = {}) {
    const provenance = this.#provenance(taskId, evidenceReceiptSha256);
    const outcome = this.metrics.record({
      eventKey: `verification:${provenance.taskId}:${provenance.receipt}`,
      taskId: provenance.taskId,
      actor: 'verification-gate',
      evidenceReceiptSha256: provenance.receipt,
      providerId: provenance.providerId,
      taskKind: provenance.taskKind,
      verified: verified === true,
      accepted: null,
      costUsd,
      latencyMs,
    });
    return Object.freeze({ ...outcome, taskId: provenance.taskId, actor: 'verification-gate', evidenceReceiptSha256: provenance.receipt });
  }

  recordVerifiedBanditOutcome({ taskId, features = {}, verificationReceiptSha256, ...outcome } = {}) {
    if (!this.verifiedOutcomeBandit?.recordOutcome) throw new Error('Verified outcome bandit is not configured');
    const provenance = this.#provenance(taskId, verificationReceiptSha256);
    const harnessProfile = String(provenance.task.metadata?.harnessProfile ?? provenance.task.metadata?.handoff?.harnessProfile ?? 'default');
    return this.verifiedOutcomeBandit.recordOutcome({ providerId: provenance.providerId, harnessProfile, features: { taskType: provenance.taskKind, ...features }, verificationReceiptSha256: provenance.receipt, ...outcome });
  }

  recordUserFeedback({ taskId, accepted, retainedLines = 0, generatedLines = 0, correctionCount = 0, evidenceReceiptSha256 } = {}, principal = null) {
    const actor = principalSubject(principal);
    if (typeof accepted !== 'boolean') throw new TypeError('accepted must be a boolean');
    const provenance = this.#provenance(taskId, evidenceReceiptSha256);
    const outcome = this.metrics.record({
      eventKey: `feedback:${provenance.taskId}:${provenance.receipt}:${actor}`,
      taskId: provenance.taskId,
      actor,
      evidenceReceiptSha256: provenance.receipt,
      providerId: provenance.providerId,
      taskKind: provenance.taskKind,
      verified: null,
      accepted,
      retainedLines: boundedCount(retainedLines, 'retainedLines'),
      generatedLines: boundedCount(generatedLines, 'generatedLines'),
      correctionCount: boundedCount(correctionCount, 'correctionCount'),
    });
    return Object.freeze({ ...outcome, taskId: provenance.taskId, actor, evidenceReceiptSha256: provenance.receipt });
  }
}
