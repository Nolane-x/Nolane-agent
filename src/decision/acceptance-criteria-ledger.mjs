import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SHA256 = /^[a-f0-9]{64}$/;

function clean(value, label, max = 2_000) {
  const output = String(value ?? '').trim();
  if (!output) throw new TypeError(`${label} is required`);
  if (output.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return output;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeHash(value, label) {
  const output = String(value ?? '').trim().toLowerCase();
  if (!SHA256.test(output)) throw new TypeError(`${label} must be a SHA-256 digest`);
  return output;
}

function normalizeCriterion(item = {}) {
  const criterionId = clean(item.criterionId, 'criterionId', 256);
  const description = clean(item.description, 'criterion description', 4_000);
  const weight = Number(item.weight);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100) throw new TypeError('criterion weight must be greater than 0 and at most 100');
  return deepFreeze({
    criterionId,
    description,
    weight,
    sourceHash: normalizeHash(item.sourceHash, 'criterion sourceHash'),
  });
}

function validateReceipt(receipt, { taskId, criterion }) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) throw new TypeError('verification receipt is required');
  const claimedHash = normalizeHash(receipt.receiptSha256, 'receipt SHA-256');
  const { receiptSha256: _ignored, ...unsigned } = receipt;
  if (canonicalSha256(unsigned) !== claimedHash) throw new TypeError('verification receipt SHA-256 does not match its payload');
  if (clean(receipt.taskId, 'receipt taskId', 256) !== taskId) throw new TypeError('verification receipt taskId does not match');
  if (clean(receipt.criterionId, 'receipt criterionId', 256) !== criterion.criterionId) throw new TypeError('verification receipt criterionId does not match');
  if (normalizeHash(receipt.sourceHash, 'receipt sourceHash') !== criterion.sourceHash) throw new TypeError('verification receipt has a stale source hash');
  const status = String(receipt.status ?? '').trim().toLowerCase();
  if (!['pass', 'fail'].includes(status)) throw new TypeError('verification receipt status must be pass or fail');
  return deepFreeze({ ...unsigned, status, receiptSha256: claimedHash });
}

export class AcceptanceCriteriaLedger {
  constructor({ clock = () => Date.now(), maxTasks = 10_000 } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxTasks = Math.max(1, Math.floor(Number(maxTasks) || 10_000));
    this.tasks = new Map();
  }

  registerTask(taskId, criteria = []) {
    const id = clean(taskId, 'taskId', 256);
    if (this.tasks.has(id)) throw new Error(`task ${id} is already registered`);
    if (!Array.isArray(criteria) || criteria.length === 0) throw new TypeError('criteria must be a non-empty array');
    if (this.tasks.size >= this.maxTasks) throw new Error('acceptance criteria task limit reached');
    const normalized = criteria.map(normalizeCriterion);
    const ids = new Set();
    for (const item of normalized) {
      if (ids.has(item.criterionId)) throw new TypeError(`duplicate criterionId: ${item.criterionId}`);
      ids.add(item.criterionId);
    }
    const registeredAtMs = Math.trunc(Number(this.clock()) || 0);
    this.tasks.set(id, { taskId: id, criteria: normalized, receipts: new Map(), registeredAtMs, updatedAtMs: registeredAtMs });
    return this.snapshot(id);
  }

  recordVerification(taskId, criterionId, receipt) {
    const task = this.#task(taskId);
    const id = clean(criterionId, 'criterionId', 256);
    const criterion = task.criteria.find((item) => item.criterionId === id);
    if (!criterion) throw new Error(`unknown criterionId: ${id}`);
    const normalized = validateReceipt(receipt, { taskId: task.taskId, criterion });
    task.receipts.set(id, normalized);
    task.updatedAtMs = Math.trunc(Number(this.clock()) || task.updatedAtMs);
    return this.snapshot(task.taskId);
  }

  snapshot(taskId) {
    const task = this.#task(taskId);
    const criteria = task.criteria.map((criterion) => {
      const verification = task.receipts.get(criterion.criterionId) ?? null;
      const verified = verification?.status === 'pass';
      return deepFreeze({ ...criterion, verified, verifiedWeight: verified ? criterion.weight : 0, verification });
    });
    const totalCriteriaWeight = criteria.reduce((sum, item) => sum + item.weight, 0);
    const verifiedCriteriaScore = criteria.reduce((sum, item) => sum + item.verifiedWeight, 0);
    const base = {
      schema: 'forge.acceptance-criteria-ledger-snapshot.v1',
      taskId: task.taskId,
      registeredAtMs: task.registeredAtMs,
      updatedAtMs: task.updatedAtMs,
      totalCriteriaWeight,
      verifiedCriteriaScore,
      completionRatio: totalCriteriaWeight > 0 ? verifiedCriteriaScore / totalCriteriaWeight : 0,
      criteria,
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  #task(taskId) {
    const id = clean(taskId, 'taskId', 256);
    const task = this.tasks.get(id);
    if (!task) throw new Error(`unknown taskId: ${id}`);
    return task;
  }
}
