import { number, receipt, signed, text, uniqueStrings } from './learning-utils.mjs';

function normalizeOutcome(item, index, heldOut, policies) {
  if (!item || typeof item !== 'object') throw new TypeError(`outcomes[${index}] must be an object`);
  if (item.verified !== true) throw new TypeError('verified outcome is required');
  const taskId = text(item.taskId, `outcomes[${index}].taskId`, 256).toLowerCase();
  const policyId = text(item.policyId, `outcomes[${index}].policyId`, 256);
  if (!heldOut.has(taskId)) throw new TypeError(`outcome task is not held-out: ${taskId}`);
  if (!policies.has(policyId)) throw new TypeError(`unknown policy outcome: ${policyId}`);
  if (typeof item.success !== 'boolean') throw new TypeError(`outcomes[${index}].success must be boolean`);
  return Object.freeze({
    taskId, policyId, success: item.success,
    utility: number(item.utility, `outcomes[${index}].utility`, { min: -1_000_000, max: 1_000_000 }),
    critical: item.critical === true,
    verificationReceiptSha256: receipt(item.verificationReceiptSha256, `outcomes[${index}].verificationReceiptSha256`),
  });
}

function summarize(policyId, tasks, outcomes) {
  const rows = tasks.map((taskId) => outcomes.find((item) => item.taskId === taskId && item.policyId === policyId));
  if (rows.some((item) => !item)) throw new TypeError(`missing held-out outcome for policy ${policyId}`);
  const successCount = rows.filter((item) => item.success).length;
  return Object.freeze({
    policyId,
    verifiedTasks: rows.length,
    successCount,
    passRate: rows.length ? successCount / rows.length : 0,
    meanUtility: rows.length ? rows.reduce((sum, item) => sum + item.utility, 0) / rows.length : 0,
  });
}

export class HeldOutPolicyEvaluator {
  constructor({ minHeldOutTasks = 4, minUtilityImprovement = 0.01 } = {}) {
    this.minHeldOutTasks = number(minHeldOutTasks, 'minHeldOutTasks', { min: 1, max: 100_000, integer: true });
    this.minUtilityImprovement = number(minUtilityImprovement, 'minUtilityImprovement', { min: 0, max: 1_000_000 });
  }

  evaluate(input = {}) {
    const tuningTaskIds = uniqueStrings(input.tuningTaskIds ?? [], 'tuningTaskIds', 100_000);
    const heldOutTaskIds = uniqueStrings(input.heldOutTaskIds ?? [], 'heldOutTaskIds', 100_000);
    if (heldOutTaskIds.length < this.minHeldOutTasks) throw new TypeError(`at least ${this.minHeldOutTasks} held-out tasks are required`);
    const tuning = new Set(tuningTaskIds);
    const overlap = heldOutTaskIds.filter((id) => tuning.has(id));
    if (overlap.length) throw new TypeError(`held-out leakage detected: ${overlap.join(', ')}`);
    const baselinePolicyId = text(input.baselinePolicyId, 'baselinePolicyId', 256);
    const candidatePolicyId = text(input.candidatePolicyId, 'candidatePolicyId', 256);
    if (baselinePolicyId === candidatePolicyId) throw new TypeError('baseline and candidate policies must differ');
    const heldOut = new Set(heldOutTaskIds);
    const policies = new Set([baselinePolicyId, candidatePolicyId]);
    const outcomes = (input.outcomes ?? []).map((item, index) => normalizeOutcome(item, index, heldOut, policies));
    const baseline = summarize(baselinePolicyId, heldOutTaskIds, outcomes);
    const candidate = summarize(candidatePolicyId, heldOutTaskIds, outcomes);
    let criticalRegressions = 0;
    for (const taskId of heldOutTaskIds) {
      const base = outcomes.find((item) => item.taskId === taskId && item.policyId === baselinePolicyId);
      const next = outcomes.find((item) => item.taskId === taskId && item.policyId === candidatePolicyId);
      if (base.critical && base.success && !next.success) criticalRegressions += 1;
    }
    const utilityImprovement = candidate.meanUtility - baseline.meanUtility;
    const reasons = [];
    if (candidate.passRate < baseline.passRate) reasons.push('candidate pass rate regressed on held-out tasks');
    if (criticalRegressions) reasons.push(`${criticalRegressions} critical regression(s) detected`);
    if (utilityImprovement < this.minUtilityImprovement) reasons.push('candidate utility improvement is below threshold');
    return signed({
      schema: 'forge.held-out-policy-evaluation.v1', baselinePolicyId, candidatePolicyId,
      tuningTaskIds, heldOutTaskIds, heldOutOnly: true, baseline, candidate,
      utilityImprovement, criticalRegressions, promotable: reasons.length === 0, reasons: Object.freeze(reasons),
      claims: Object.freeze({ heldOutTasksUsedForTuning: false, unverifiedOutcomeAccepted: false, productionRoutingChanged: false }),
    });
  }
}
