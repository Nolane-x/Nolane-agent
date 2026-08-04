import { canonicalSha256, canonicalStringify, deepFreeze, clone, boundedNumber } from './shared.mjs';

const KINDS = new Set(['localization', 'tool-policy', 'planning', 'recovery', 'verification']);
const HIDDEN = /(?:chain.?of.?thought|hidden.?reasoning|private.?scratchpad|reasoning.?trace)/i;

function scanHidden(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (HIDDEN.test(key)) throw new TypeError(`Hidden reasoning is forbidden at ${path}.${key}`);
    scanHidden(child, `${path}.${key}`);
  }
}

function assertStep(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Distillation step is required');
  scanHidden(input);
  for (const key of ['id', 'episodeId', 'kind', 'repositoryId', 'domain', 'state', 'teacher', 'student', 'expectedEffect', 'actualEffect', 'oracle']) {
    if (input[key] === undefined || input[key] === null) throw new TypeError(`Distillation step requires ${key}`);
  }
  if (!KINDS.has(input.kind)) throw new TypeError('Distillation step kind is unsupported');
  if (input.oracle.valid !== true) throw new Error('Distillation step oracle must verify the observation');
  if (input.oracle.independent !== true) throw new Error('Distillation step oracle must be independent');
  if (input.oracle.readOnly !== true) throw new Error('Distillation step oracle must be read-only');
  if (input.hallucination === true || input.oracle.hallucination === true) throw new Error('Distillation step rejected for hallucination');
  if (input.safety?.rewardHacking === true) throw new Error('Distillation step rejected for reward hacking');
  if (input.safety?.unsafe === true) throw new Error('Distillation step rejected as unsafe');
  const changed = input.actualEffect.changed === true
    || Number(input.actualEffect.criterionDelta ?? 0) !== 0
    || Number(input.actualEffect.informationGain ?? 0) > 0;
  if (!changed) throw new Error('Distillation step rejected as effectless');
  if (!input.teacher?.id || !input.teacher?.action?.type || !input.student?.action?.type) throw new TypeError('Teacher and student actions are required');
  return clone(input);
}

function actionKey(action) {
  return canonicalStringify({ type: action?.type ?? null, parameters: action?.parameters ?? {} });
}

function divergenceFor(teacherAction, studentAction) {
  return actionKey(teacherAction) === actionKey(studentAction) ? 0 : 1;
}

export class DistillationOrchestrator {
  #steps = new Map();
  #teachers = new Map();
  #policies = new Map();
  #signatures = new Set();
  #divergenceCutoff;

  constructor({ divergenceCutoff = 0.65 } = {}) {
    this.#divergenceCutoff = boundedNumber(divergenceCutoff, 'divergenceCutoff');
  }

  registerTeacher({ id, domains, trust = 0.5 } = {}) {
    if (!id || !Array.isArray(domains) || domains.length === 0) throw new TypeError('Teacher id and domains are required');
    const record = deepFreeze({ id: String(id), domains: [...new Set(domains.map(String))].sort(), trust: boundedNumber(trust, 'teacher trust') });
    this.#teachers.set(record.id, record);
    return record;
  }

  recordStep(input) {
    return this.#record(input, 'offline');
  }

  recordOnPolicyStep(input) {
    return this.#record(input, 'on-policy');
  }

  #record(input, lane) {
    const step = assertStep(input);
    if (this.#steps.has(step.id)) throw new Error(`Duplicate distillation step: ${step.id}`);
    const loopSignature = canonicalSha256({ episodeId: step.episodeId, state: step.state, action: step.student.action });
    if (this.#signatures.has(loopSignature)) throw new Error('Distillation step rejected as repeated loop');
    const divergence = divergenceFor(step.teacher.action, step.student.action);
    const supervisionWeight = divergence >= this.#divergenceCutoff ? 0 : Number((1 - divergence).toFixed(6));
    const base = { ...step, lane, divergence, supervisionWeight, recordedAt: new Date().toISOString() };
    const stored = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#steps.set(stored.id, stored);
    this.#signatures.add(loopSignature);
    return stored;
  }

  buildOfflineDataset({ kind = null, domain = null } = {}) {
    return deepFreeze([...this.#steps.values()].filter((step) => step.lane === 'offline' && (!kind || step.kind === kind) && (!domain || step.domain === domain)));
  }

  selfConsistentAction({ domain, candidates } = {}) {
    if (!domain || !Array.isArray(candidates) || candidates.length === 0) throw new TypeError('domain and candidates are required');
    const groups = new Map();
    for (const candidate of candidates) {
      const teacher = this.#teachers.get(candidate.teacherId);
      if (!teacher || !teacher.domains.includes(domain)) continue;
      const key = actionKey(candidate.action);
      const group = groups.get(key) ?? { action: clone(candidate.action), teacherIds: [], weight: 0 };
      group.teacherIds.push(teacher.id);
      group.weight += teacher.trust;
      groups.set(key, group);
    }
    if (groups.size === 0) throw new Error(`No trusted teacher candidates for domain: ${domain}`);
    const selected = [...groups.values()].sort((a, b) => b.weight - a.weight || b.teacherIds.length - a.teacherIds.length || actionKey(a.action).localeCompare(actionKey(b.action)))[0];
    const base = { schema: 'nolane.small-model.self-consistent-action.v1', domain, action: selected.action, votes: selected.teacherIds.length, teacherIds: selected.teacherIds.sort(), domainTrustWeight: Number(selected.weight.toFixed(6)) };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  promoteStudentPolicy({ id, version, stepIds, heldOut } = {}) {
    if (!id || !version || !Array.isArray(stepIds) || stepIds.length === 0) throw new TypeError('Policy id, version and stepIds are required');
    if (!Array.isArray(heldOut) || heldOut.length === 0) throw new Error('Held-out repository promotion evidence is required');
    const steps = stepIds.map((stepId) => {
      const step = this.#steps.get(stepId);
      if (!step) throw new Error(`Unknown distillation step: ${stepId}`);
      return step;
    });
    const trainingRepositories = new Set(steps.map((step) => step.repositoryId));
    for (const result of heldOut) {
      if (!result?.repositoryId || result.passed !== true || result.tuned !== false) throw new Error('Every held-out repository must be untuned and pass');
      if (trainingRepositories.has(result.repositoryId)) throw new Error(`Repository is not held-out: ${result.repositoryId}`);
    }
    const history = this.#policies.get(id) ?? [];
    const base = {
      schema: 'nolane.small-model.student-policy.v1', id: String(id), version: String(version),
      stepIds: [...stepIds], heldOut: clone(heldOut), previousVersion: history.at(-1)?.version ?? null,
    };
    const policy = deepFreeze({ ...base, policySha256: canonicalSha256(base) });
    this.#policies.set(id, [...history, policy]);
    return policy;
  }

  rollbackStudentPolicy(id) {
    const history = this.#policies.get(id) ?? [];
    if (history.length < 2) throw new Error(`No rollback student policy for: ${id}`);
    history.pop();
    this.#policies.set(id, history);
    return history.at(-1);
  }

  snapshot() {
    const offline = [...this.#steps.values()].filter((step) => step.lane === 'offline').length;
    return deepFreeze({
      schema: 'nolane.small-model.distillation-orchestrator.v1', steps: this.#steps.size,
      lanes: { offline, onPolicy: this.#steps.size - offline }, teachers: this.#teachers.size,
      policies: Object.fromEntries([...this.#policies].map(([id, history]) => [id, history.at(-1)?.version ?? null])),
      divergenceCutoff: this.#divergenceCutoff,
    });
  }
}
