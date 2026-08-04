import { boundedNumber, signed, strings, text } from './construction-utils.mjs';

const TERMINAL = new Set(['completed', 'failed', 'rolled_back', 'superseded']);
const TRANSITIONS = Object.freeze({
  ready: { start: 'running', block: 'blocked', supersede: 'superseded' },
  pending: { block: 'blocked', supersede: 'superseded' },
  running: { 'begin-verification': 'verifying', fail: 'failed', block: 'blocked', rollback: 'rolled_back' },
  verifying: { 'verification-passed': 'completed', 'verification-failed': 'failed', block: 'blocked', rollback: 'rolled_back' },
  blocked: { unblock: 'ready', supersede: 'superseded', rollback: 'rolled_back' },
  failed: { retry: 'ready', rollback: 'rolled_back', supersede: 'superseded' },
});

function normalizeHierarchy(value = []) {
  if (!Array.isArray(value) || value.length > 128) throw new TypeError('milestones must be a bounded array');
  return value.map((milestone, mi) => ({
    milestoneId: text(milestone.milestoneId, `milestones[${mi}].milestoneId`, 256),
    title: text(milestone.title, `milestones[${mi}].title`, 1024),
    capabilities: Array.isArray(milestone.capabilities) ? milestone.capabilities.map((capability, ci) => ({
      capabilityId: text(capability.capabilityId, `capabilities[${ci}].capabilityId`, 256),
      title: text(capability.title, `capabilities[${ci}].title`, 1024),
      contracts: Array.isArray(capability.contracts) ? capability.contracts.map((contract, xi) => ({
        contractId: text(contract.contractId, `contracts[${xi}].contractId`, 256),
        stepIds: strings(contract.stepIds ?? [], `contracts[${xi}].stepIds`, 128, 256),
      })) : [],
    })) : [],
  }));
}

export class ExecutablePlanEngine {
  constructor({ maxPlans = 1_000, maxStepsPerPlan = 256 } = {}) {
    this.maxPlans = Math.max(1, Number(maxPlans) || 1_000);
    this.maxStepsPerPlan = Math.max(1, Number(maxStepsPerPlan) || 256);
    this.plans = new Map();
  }

  createPlan(input = {}) {
    const planId = text(input.planId, 'planId', 256);
    if (this.plans.has(planId)) throw new TypeError(`duplicate executable plan: ${planId}`);
    if (this.plans.size >= this.maxPlans) throw new RangeError('executable plan limit exceeded');
    if (!Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > this.maxStepsPerPlan) throw new TypeError(`steps must contain 1-${this.maxStepsPerPlan} items`);
    const ids = new Set();
    const steps = input.steps.map((step, index) => {
      const stepId = text(step.stepId, `steps[${index}].stepId`, 256);
      if (ids.has(stepId)) throw new TypeError(`duplicate plan step: ${stepId}`);
      ids.add(stepId);
      return {
        stepId,
        milestoneId: text(step.milestoneId, `steps[${index}].milestoneId`, 256),
        capabilityId: text(step.capabilityId, `steps[${index}].capabilityId`, 256),
        contractId: text(step.contractId, `steps[${index}].contractId`, 256),
        title: text(step.title, `steps[${index}].title`, 1_024),
        dependencies: strings(step.dependencies ?? [], `steps[${index}].dependencies`, 128, 256),
        preconditions: strings(step.preconditions ?? [], `steps[${index}].preconditions`, 128, 512),
        allowedFiles: strings(step.allowedFiles ?? ['**'], `steps[${index}].allowedFiles`, 256, 1_024),
        forbiddenChanges: strings(step.forbiddenChanges ?? [], `steps[${index}].forbiddenChanges`, 256, 512),
        expectedState: text(step.expectedState, `steps[${index}].expectedState`, 512),
        expectedEffect: text(step.expectedEffect, `steps[${index}].expectedEffect`, 2_048),
        verificationIds: strings(step.verificationIds ?? [], `steps[${index}].verificationIds`, 128, 256),
        stopCondition: step.stopCondition ? String(step.stopCondition).slice(0, 2_048) : null,
        fallbackStepId: step.fallbackStepId ? String(step.fallbackStepId) : null,
        maxAttempts: Math.floor(boundedNumber(step.maxAttempts, 1, 1, 5, `steps[${index}].maxAttempts`)),
        attempts: 0,
        state: step.dependencies?.length ? 'pending' : 'ready',
        verificationReceiptId: null,
        actualState: null,
        invalidReasons: [],
      };
    });
    for (const step of steps) for (const dependency of step.dependencies) if (!ids.has(dependency) || dependency === step.stepId) throw new TypeError(`invalid dependency ${dependency} for ${step.stepId}`);
    const plan = {
      schema: 'forge.executable-construction-plan.v1', planId,
      missionId: text(input.missionId, 'missionId', 256),
      specificationId: text(input.specificationId, 'specificationId', 256),
      repositoryFingerprint: text(input.repositoryFingerprint, 'repositoryFingerprint', 512),
      assumptionReceiptSha256: text(input.assumptionReceiptSha256, 'assumptionReceiptSha256', 512),
      revision: 1, milestones: normalizeHierarchy(input.milestones ?? []), steps,
    };
    this.plans.set(planId, plan);
    return this.snapshot(planId);
  }

  transition(planId, stepId, event = {}) {
    const plan = this.#plan(planId);
    const step = this.#step(plan, stepId);
    const type = text(event.type, 'event.type', 128);
    const next = TRANSITIONS[step.state]?.[type];
    if (!next) throw new Error(`invalid transition ${step.state} -> ${type}`);
    if (type === 'start') {
      const satisfied = new Set(strings(event.preconditionsSatisfied ?? [], 'preconditionsSatisfied', 128, 512));
      const missing = step.preconditions.filter((item) => !satisfied.has(item));
      if (missing.length) throw new Error(`preconditions not satisfied: ${missing.join(', ')}`);
      step.attempts += 1;
      if (step.attempts > step.maxAttempts) throw new Error(`attempt budget exhausted for ${step.stepId}`);
    }
    if (type === 'retry' && step.attempts >= step.maxAttempts) throw new Error(`attempt budget exhausted for ${step.stepId}`);
    if (type === 'verification-passed') {
      step.verificationReceiptId = text(event.receiptId, 'verification receiptId', 512);
      step.actualState = text(event.actualState, 'actualState', 512);
      if (step.actualState !== step.expectedState) throw new Error(`actual state does not match expected state for ${step.stepId}`);
    }
    step.state = next;
    if (next === 'completed') this.#refreshReadiness(plan);
    plan.revision += 1;
    return signed({ schema: 'forge.plan-transition.v1', planId: plan.planId, stepId: step.stepId, eventType: type, state: step.state, revision: plan.revision, verificationReceiptId: step.verificationReceiptId });
  }

  revalidate(planId, evidence = {}) {
    const plan = this.#plan(planId);
    const invalidReasons = [];
    if (String(evidence.repositoryFingerprint ?? '') !== plan.repositoryFingerprint) invalidReasons.push('repository-fingerprint-changed');
    if (String(evidence.assumptionReceiptSha256 ?? '') !== plan.assumptionReceiptSha256) invalidReasons.push('assumption-revision-changed');
    if (invalidReasons.length) for (const step of plan.steps) if (!TERMINAL.has(step.state)) { step.state = 'blocked'; step.invalidReasons = [...invalidReasons]; }
    plan.revision += 1;
    return signed({ schema: 'forge.plan-revalidation.v1', planId: plan.planId, valid: invalidReasons.length === 0, invalidReasons, revision: plan.revision });
  }

  readySteps(planId) { return this.snapshot(planId).steps.filter((step) => step.state === 'ready'); }

  snapshot(planId) {
    const plan = this.#plan(planId);
    return signed({ schema: plan.schema, planId: plan.planId, missionId: plan.missionId, specificationId: plan.specificationId, repositoryFingerprint: plan.repositoryFingerprint, assumptionReceiptSha256: plan.assumptionReceiptSha256, revision: plan.revision, milestones: plan.milestones, steps: plan.steps.map((step) => ({ ...step })) });
  }

  #refreshReadiness(plan) {
    const completed = new Set(plan.steps.filter((step) => step.state === 'completed').map((step) => step.stepId));
    for (const step of plan.steps) if (step.state === 'pending' && step.dependencies.every((id) => completed.has(id))) step.state = 'ready';
  }
  #plan(planId) { const plan = this.plans.get(text(planId, 'planId', 256)); if (!plan) throw new RangeError(`unknown plan: ${planId}`); return plan; }
  #step(plan, stepId) { const step = plan.steps.find((item) => item.stepId === String(stepId)); if (!step) throw new RangeError(`unknown step: ${stepId}`); return step; }
}
