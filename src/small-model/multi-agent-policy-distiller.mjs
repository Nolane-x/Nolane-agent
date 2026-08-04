import { boundedNumber, canonicalSha256, deepFreeze } from './shared.mjs';

const SHA = /^[a-f0-9]{64}$/i;

function validateTeacher(teacher, index) {
  if (!teacher?.id || !teacher.role || !teacher.modelFamily || !SHA.test(String(teacher.receiptSha256 ?? ''))) throw new TypeError(`Teacher ${index} requires identity, role, model family and receipt`);
  if (!Array.isArray(teacher.trajectories) || teacher.trajectories.length === 0) throw new TypeError(`Teacher ${index} requires trajectories`);
  const trajectories = teacher.trajectories.map((item, trajectoryIndex) => {
    if (!item?.stateKey || !item.action || item.verified !== true || !SHA.test(String(item.receiptSha256 ?? ''))) throw new Error(`Teacher ${index} trajectory ${trajectoryIndex} must be verified with a receipt`);
    return { stateKey: String(item.stateKey), action: String(item.action), receiptSha256: String(item.receiptSha256) };
  });
  return { id: String(teacher.id), role: String(teacher.role), modelFamily: String(teacher.modelFamily), receiptSha256: String(teacher.receiptSha256), trajectories };
}

export class MultiAgentPolicyDistiller {
  #versions = new Map();
  #promoted = new Map();
  #receipts = [];

  distill({ id, version, teachers } = {}) {
    if (!id || !version || !Array.isArray(teachers) || teachers.length < 2) throw new TypeError('Policy id, version and at least two teachers are required');
    const normalized = teachers.map(validateTeacher);
    const diversity = new Set(normalized.map((teacher) => `${teacher.role}:${teacher.modelFamily}`));
    const modelFamilies = new Set(normalized.map((teacher) => teacher.modelFamily));
    const roles = new Set(normalized.map((teacher) => teacher.role));
    if (diversity.size < 2 || (modelFamilies.size < 2 && roles.size < 2)) throw new Error('Multi-agent distillation requires heterogeneous teacher evidence');
    const votes = new Map();
    for (const teacher of normalized) for (const trajectory of teacher.trajectories) {
      const actionVotes = votes.get(trajectory.stateKey) ?? new Map();
      const current = actionVotes.get(trajectory.action) ?? { action: trajectory.action, votes: 0, teachers: [] };
      current.votes += 1;
      current.teachers.push(teacher.id);
      actionVotes.set(trajectory.action, current);
      votes.set(trajectory.stateKey, actionVotes);
    }
    const actions = {};
    const disagreements = [];
    for (const [stateKey, actionVotes] of [...votes.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const candidates = [...actionVotes.values()].map((item) => ({ ...item, teachers: [...new Set(item.teachers)].sort() })).sort((a, b) => b.votes - a.votes || a.action.localeCompare(b.action));
      actions[stateKey] = candidates[0].action;
      if (candidates.length > 1) disagreements.push({ stateKey, candidates: candidates.sort((a, b) => a.action.localeCompare(b.action)) });
    }
    const history = this.#versions.get(String(id)) ?? [];
    const base = {
      schema: 'nolane.small-model.multi-agent-distilled-policy.v1', id: String(id), version: String(version), actions, disagreements,
      teachers: normalized.map(({ trajectories, ...teacher }) => ({ ...teacher, trajectoryReceipts: trajectories.map((item) => item.receiptSha256).sort() })).sort((a, b) => a.id.localeCompare(b.id)),
      previousVersion: history.at(-1)?.version ?? null,
      hiddenChainOfThoughtStored: false,
    };
    const policy = deepFreeze({ ...base, policySha256: canonicalSha256(base) });
    this.#versions.set(String(id), [...history, policy]);
    return policy;
  }

  promote({ id, version, independent, heldOut, tasks, success, baselineSuccess, safetyViolations, baselineSafetyViolations } = {}) {
    const policy = (this.#versions.get(String(id)) ?? []).find((item) => item.version === String(version));
    if (!policy) throw new Error(`Unknown policy version: ${id}@${version}`);
    if (independent !== true || heldOut !== true) throw new Error('Policy promotion requires independent held-out evidence');
    if (!Number.isInteger(Number(tasks)) || Number(tasks) < 10) throw new TypeError('Policy promotion requires at least 10 held-out tasks');
    const candidateSuccess = boundedNumber(success, 'success');
    const baseline = boundedNumber(baselineSuccess, 'baselineSuccess');
    if (![safetyViolations, baselineSafetyViolations].every((value) => Number.isInteger(Number(value)) && Number(value) >= 0)) throw new TypeError('Safety violation counts are required');
    if (candidateSuccess < baseline || Number(safetyViolations) > Number(baselineSafetyViolations)) throw new Error('Policy promotion gate failed');
    const base = { schema: 'nolane.small-model.multi-agent-policy-promotion.v1', id: String(id), version: String(version), policySha256: policy.policySha256, independent: true, heldOut: true, tasks: Number(tasks), success: candidateSuccess, baselineSuccess: baseline, safetyViolations: Number(safetyViolations), baselineSafetyViolations: Number(baselineSafetyViolations), promoted: true };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#promoted.set(String(id), policy);
    this.#receipts.push(receipt);
    return receipt;
  }

  rollback(id) {
    const history = this.#versions.get(String(id)) ?? [];
    if (history.length < 2) throw new Error(`No rollback policy version for: ${id}`);
    history.pop();
    this.#versions.set(String(id), history);
    const active = history.at(-1);
    this.#promoted.set(String(id), active);
    return active;
  }

  snapshot() {
    return deepFreeze({ schema: 'nolane.small-model.multi-agent-policy-distiller.v1', policies: this.#versions.size, promoted: this.#promoted.size, promotionReceipts: this.#receipts.length });
  }
}
