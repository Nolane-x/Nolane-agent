import { deepFreeze, nonEmpty, signed, uniqueStrings } from '../superiority-utils.mjs';

function estimate(input = {}) { return deepFreeze({ tokens: Math.max(0, Number(input.tokens) || 0), elapsedMs: Math.max(0, Number(input.elapsedMs) || 0), costUsd: Math.max(0, Number(input.costUsd) || 0) }); }

export class ProofBudgetScheduler {
  schedule(input = {}) {
    const missionId = nonEmpty(input.missionId, 'missionId');
    const budget = estimate(input.budget);
    const verificationReserveRatio = Math.min(0.9, Math.max(0.1, Number(input.verificationReserveRatio) || 0.25));
    const tasksInput = Array.isArray(input.tasks) ? input.tasks : [];
    if (!tasksInput.length) throw new TypeError('tasks must not be empty');
    const ids = new Set();
    const tasks = tasksInput.map((item) => {
      const taskId = nonEmpty(item.taskId, 'taskId');
      if (ids.has(taskId)) throw new Error(`Duplicate taskId ${taskId}`);
      ids.add(taskId);
      return { taskId, dependencies: uniqueStrings(item.dependencies), risk: Math.min(1, Math.max(0, Number(item.risk) || 0)), proofRequired: item.proofRequired === true, priority: Number(item.priority) || 0, estimated: estimate(item.estimated) };
    });
    for (const task of tasks) for (const dep of task.dependencies) if (!ids.has(dep)) throw new Error(`Unknown dependency ${dep}`);
    const totals = tasks.reduce((acc, task) => ({ tokens: acc.tokens + task.estimated.tokens, elapsedMs: acc.elapsedMs + task.estimated.elapsedMs, costUsd: acc.costUsd + task.estimated.costUsd }), { tokens: 0, elapsedMs: 0, costUsd: 0 });
    const proofTotals = tasks.filter((task) => task.proofRequired).reduce((acc, task) => ({ tokens: acc.tokens + task.estimated.tokens, elapsedMs: acc.elapsedMs + task.estimated.elapsedMs, costUsd: acc.costUsd + task.estimated.costUsd }), { tokens: 0, elapsedMs: 0, costUsd: 0 });
    const blockers = [];
    if (totals.tokens > budget.tokens || totals.elapsedMs > budget.elapsedMs || totals.costUsd > budget.costUsd) blockers.push('budget-insufficient');
    if (!tasks.some((task) => task.proofRequired)) blockers.push('proof-task-missing');
    const reserve = { tokens: budget.tokens * verificationReserveRatio, elapsedMs: budget.elapsedMs * verificationReserveRatio, costUsd: budget.costUsd * verificationReserveRatio };
    if (proofTotals.tokens > reserve.tokens || proofTotals.elapsedMs > reserve.elapsedMs || proofTotals.costUsd > reserve.costUsd) blockers.push('verification-reserve-insufficient');

    const completed = new Set();
    const executionOrder = [];
    while (executionOrder.length < tasks.length) {
      const ready = tasks.filter((task) => !completed.has(task.taskId) && task.dependencies.every((dep) => completed.has(dep)))
        .sort((a, b) => Number(b.proofRequired) - Number(a.proofRequired) || b.risk - a.risk || b.priority - a.priority || a.taskId.localeCompare(b.taskId));
      if (!ready.length) { blockers.push('dependency-cycle'); break; }
      const next = ready[0]; completed.add(next.taskId); executionOrder.push(next.taskId);
    }
    const uniqueBlockers = [...new Set(blockers)];
    return signed({
      schema: 'nolane.superiority.proof-budget-schedule.v1', missionId, status: uniqueBlockers.length ? 'blocked' : 'scheduled', budget, verificationReserveRatio,
      verificationReserve: deepFreeze(reserve), estimatedTotals: deepFreeze(totals), proofEstimatedTotals: deepFreeze(proofTotals), executionOrder,
      allocations: deepFreeze(executionOrder.map((taskId) => { const task = tasks.find((item) => item.taskId === taskId); return { taskId, proofRequired: task.proofRequired, reservedProofCapacity: task.proofRequired, estimated: task.estimated }; })),
      blockers: uniqueBlockers, authorization: { proofStarvationAllowed: false, executionAllowed: uniqueBlockers.length === 0, automaticBudgetExpansionAllowed: false },
    });
  }

  snapshot() { return signed({ schema: 'nolane.superiority.proof-budget-scheduler.v1', claims: { proofStarvationAllowed: false, automaticBudgetExpansionAllowed: false } }); }
}
