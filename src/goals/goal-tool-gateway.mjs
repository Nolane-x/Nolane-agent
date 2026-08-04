import { randomUUID } from 'node:crypto';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';

const SCHEMAS = Object.freeze([
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'goal.record_finding', description: 'Record a sourced discovery for the durable goal and optionally propose a bounded plan patch. Use this whenever new evidence invalidates assumptions or changes the best plan.', parameters: Object.freeze({ type: 'object', additionalProperties: false, required: ['claim', 'impact'], properties: { claim: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 }, impact: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }, source: { type: 'object' }, receiptSha256: { type: ['string', 'null'] }, invalidatesAssumptionIds: { type: 'array', items: { type: 'string' } }, proposedPatch: { type: ['object', 'null'] }, reason: { type: ['string', 'null'] }, idempotencyKey: { type: ['string', 'null'] } } }) }) }),
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'goal.status', description: 'Read current durable goal, discoveries, plan revisions, and pending plan patches.', parameters: Object.freeze({ type: 'object', additionalProperties: false, properties: {} }) }) }),
]);

function goalId(task) { return String(task?.metadata?.goalId ?? '').trim(); }

export class GoalToolGateway {
  constructor({ goalService, replanner } = {}) {
    if (!goalService?.get || !goalService?.listFacts || !replanner?.observe) throw new TypeError('GoalToolGateway dependencies are required');
    this.goals = goalService;
    this.replanner = replanner;
  }

  schemasForTask(task) { return goalId(task) ? SCHEMAS : Object.freeze([]); }

  async execute(task, name, args = {}, context = {}) {
    const linkedGoalId = goalId(task);
    if (!linkedGoalId) throw new Error(`Task ${task?.id ?? 'unknown'} is not linked to a durable goal`);
    const tool = String(name);
    const startedAt = new Date().toISOString(); const started = Date.now();
    let output;
    if (tool === 'goal.status') {
      const goal = this.goals.get(linkedGoalId);
      if (!goal) throw new Error(`Unknown goal: ${linkedGoalId}`);
      output = { goal, facts: this.goals.listFacts(linkedGoalId), revisions: this.goals.listPlanRevisions?.(linkedGoalId) ?? [], patches: this.replanner.store?.listGoalPlanPatches?.(linkedGoalId) ?? [] };
    } else if (tool === 'goal.record_finding') {
      const observed = this.replanner.observe({
        goalId: linkedGoalId,
        finding: { claim: args.claim, confidence: args.confidence, impact: args.impact, source: args.source ?? { kind: 'agent-discovery', taskId: task.id }, receiptSha256: args.receiptSha256 ?? null, invalidatesAssumptionIds: args.invalidatesAssumptionIds ?? [] },
        proposedPatch: args.proposedPatch ?? null,
        reason: args.reason ?? null,
        idempotencyKey: args.idempotencyKey ?? null,
      });
      let patch = observed.patch;
      if (patch && task.metadata?.goalAutoApplyPlanPatches === true && patch.status === 'proposed') patch = this.replanner.apply(patch.id).patch;
      output = { fact: observed.fact, shouldReplan: observed.shouldReplan, patch };
    } else throw new Error(`Unsupported goal tool: ${tool}`);

    const safeOutput = redactSecrets(output);
    const finishedAt = new Date().toISOString();
    const base = {
      schema: 'forge.goal-tool.receipt.v1', id: `receipt_${randomUUID().replaceAll('-', '').slice(0, 24)}`, tool, status: 'pass', startedAt, finishedAt, durationMs: Date.now() - started,
      requestSha256: canonicalSha256(redactSecrets({ tool, goalId: linkedGoalId, args })), outputSha256: canonicalSha256(safeOutput),
      refs: redactSecrets({ ...(context.refs ?? {}), projectId: task.projectId, goalId: linkedGoalId, missionId: task.missionId, taskId: task.id }),
    };
    const receipt = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
    return Object.freeze({ status: 'pass', output: Object.freeze(safeOutput), receipt });
  }
}
