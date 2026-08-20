function text(value, label, maxLength = 256) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new TypeError(`${label} must be a non-empty string no longer than ${maxLength} characters`);
  }
  return value;
}

function receiptHash(value, label = 'receiptSha256') {
  const hash = text(value, label, 64);
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new TypeError(`${label} must be a SHA-256 receipt hash`);
  return hash;
}

function atMs(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('atMs must be a non-negative safe integer');
  return value;
}

function receipt(input, schema, fields) {
  if (!input || typeof input !== 'object' || input.schema !== schema) {
    throw new TypeError(`receipt must use schema ${schema}`);
  }
  const result = { receiptSha256: receiptHash(input.receiptSha256) };
  for (const [field, maxLength] of Object.entries(fields)) result[field] = text(input[field], field, maxLength);
  return result;
}

function snapshotDecision(decision) {
  return Object.freeze({
    proposalId: decision.proposalId,
    taskId: decision.taskId,
    selectedActionId: decision.selectedActionId,
    proposalReceiptSha256: decision.proposalReceiptSha256,
    observedEventIds: Object.freeze([...decision.observedEventIds]),
    proposedAtMs: decision.proposedAtMs,
    status: decision.status,
    verifiedProposalId: decision.verifiedProposalId,
    verificationReceiptSha256: decision.verificationReceiptSha256,
    verifiedAtMs: decision.verifiedAtMs,
    commitReceiptSha256: decision.commitReceiptSha256,
    settledAtMs: decision.settledAtMs,
    ...(decision.reasons ? { reasons: Object.freeze([...decision.reasons]) } : {}),
    executionClaimed: false,
    observedToolEffectClaimed: false,
  });
}

function snapshotTask(task) {
  return Object.freeze({
    taskId: task.taskId,
    missionId: task.missionId,
    goal: task.goal,
    startReceiptSha256: task.startReceiptSha256,
    startedAtMs: task.startedAtMs,
    observations: Object.freeze(task.observations.map((observation) => Object.freeze({ ...observation }))),
    decisions: Object.freeze([...task.decisions.values()].map(snapshotDecision)),
    executionClaimed: false,
    observedToolEffectClaimed: false,
  });
}

/**
 * Records the cognitive decision lifecycle only. A committed state means the
 * cognitive gate allowed a proposal; it never claims that a tool was executed
 * or that an external effect was observed.
 */
export class CognitiveProposalLifecycle {
  constructor({ limits = {} } = {}) {
    this.maxTasks = Math.max(1, Math.min(10_000, Math.floor(Number(limits.maxTasks) || 1_000)));
    this.maxObservations = Math.max(1, Math.min(10_000, Math.floor(Number(limits.maxObservations) || 512)));
    this.maxDecisions = Math.max(1, Math.min(10_000, Math.floor(Number(limits.maxDecisions) || 512)));
    this.tasks = new Map();
  }

  start(input, { atMs: startedAtMs, missionId = null } = {}) {
    const task = receipt(input, 'forge.cognitive-task-start.v1', { taskId: 256, goal: 16_384 });
    if (this.tasks.has(task.taskId)) throw new RangeError(`duplicate cognitive lifecycle task: ${task.taskId}`);
    if (this.tasks.size >= this.maxTasks) throw new RangeError(`cognitive lifecycle task limit exceeded: ${this.maxTasks}`);
    this.tasks.set(task.taskId, {
      taskId: task.taskId,
      missionId: missionId == null ? null : text(missionId, 'missionId', 256),
      goal: task.goal,
      startReceiptSha256: task.receiptSha256,
      startedAtMs: atMs(startedAtMs),
      observations: [],
      observationIds: new Set(),
      decisions: new Map(),
      verifiedProposalIds: new Map(),
    });
    return this.snapshot(task.taskId);
  }

  observe(input, { atMs: observedAtMs } = {}) {
    const event = receipt(input, 'forge.cognitive-observation.v1', { taskId: 256, eventId: 256, type: 128 });
    const task = this.#task(event.taskId);
    if (task.observationIds.has(event.eventId)) throw new RangeError(`duplicate cognitive lifecycle observation: ${event.eventId}`);
    if (task.observations.length >= this.maxObservations) throw new RangeError(`cognitive lifecycle observation limit exceeded: ${this.maxObservations}`);
    task.observationIds.add(event.eventId);
    task.observations.push(Object.freeze({
      eventId: event.eventId,
      type: event.type,
      receiptSha256: event.receiptSha256,
      observedAtMs: atMs(observedAtMs),
    }));
    return this.snapshot(task.taskId);
  }

  propose(input, { atMs: proposedAtMs } = {}) {
    const proposal = receipt(input, 'forge.cognitive-proposal.v1', { taskId: 256, proposalId: 256, selectedActionId: 256 });
    const task = this.#task(proposal.taskId);
    if (task.decisions.has(proposal.proposalId)) throw new RangeError(`duplicate cognitive lifecycle proposal: ${proposal.proposalId}`);
    if (task.decisions.size >= this.maxDecisions) throw new RangeError(`cognitive lifecycle decision limit exceeded: ${this.maxDecisions}`);
    task.decisions.set(proposal.proposalId, {
      proposalId: proposal.proposalId,
      taskId: proposal.taskId,
      selectedActionId: proposal.selectedActionId,
      proposalReceiptSha256: proposal.receiptSha256,
      observedEventIds: task.observations.map((event) => event.eventId),
      proposedAtMs: atMs(proposedAtMs),
      status: 'proposed',
      verifiedProposalId: null,
      verificationReceiptSha256: null,
      verifiedAtMs: null,
      commitReceiptSha256: null,
      settledAtMs: null,
    });
    return this.snapshot(task.taskId);
  }

  verify(input, { atMs: verifiedAtMs } = {}) {
    const verified = receipt(input, 'forge.verified-cognitive-proposal.v1', {
      taskId: 256,
      proposalId: 256,
      verifiedProposalId: 256,
    });
    const task = this.#task(verified.taskId);
    const decision = task.decisions.get(verified.proposalId);
    if (!decision || decision.status !== 'proposed') throw new RangeError(`proposal is not awaiting verification: ${verified.proposalId}`);
    if (task.verifiedProposalIds.has(verified.verifiedProposalId)) throw new RangeError(`duplicate verified cognitive proposal: ${verified.verifiedProposalId}`);
    decision.status = 'verified';
    decision.verifiedProposalId = verified.verifiedProposalId;
    decision.verificationReceiptSha256 = verified.receiptSha256;
    decision.verifiedAtMs = atMs(verifiedAtMs);
    task.verifiedProposalIds.set(verified.verifiedProposalId, decision.proposalId);
    return this.snapshot(task.taskId);
  }

  settle(input, { atMs: settledAtMs } = {}) {
    if (!input || typeof input !== 'object' || input.schema !== 'forge.cognitive-commit-result.v1' || typeof input.allowed !== 'boolean') {
      throw new TypeError('receipt must be a cognitive commit result with a boolean allowed field');
    }
    const committed = receipt(input, 'forge.cognitive-commit-result.v1', { taskId: 256, verifiedProposalId: 256 });
    const task = this.#task(committed.taskId);
    const proposalId = task.verifiedProposalIds.get(committed.verifiedProposalId);
    const decision = proposalId ? task.decisions.get(proposalId) : null;
    if (!decision || decision.status !== 'verified') throw new RangeError(`verified proposal is not awaiting settlement: ${committed.verifiedProposalId}`);
    decision.status = input.allowed ? 'committed' : 'rejected';
    decision.commitReceiptSha256 = committed.receiptSha256;
    decision.settledAtMs = atMs(settledAtMs);
    if (!input.allowed) decision.reasons = Array.isArray(input.reasons) ? input.reasons.map((reason) => text(reason, 'reasons[]', 512)) : [];
    return this.snapshot(task.taskId);
  }

  snapshot(taskId = null) {
    if (taskId != null) return snapshotTask(this.#task(text(taskId, 'taskId', 256)));
    return Object.freeze({
      taskCount: this.tasks.size,
      tasks: Object.freeze([...this.tasks.values()].map(snapshotTask)),
      executionClaimed: false,
      observedToolEffectClaimed: false,
    });
  }

  #task(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new RangeError(`unknown cognitive lifecycle task: ${taskId}`);
    return task;
  }
}
