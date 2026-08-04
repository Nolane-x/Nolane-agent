export function classifyBenchmarkFailure(run = {}) {
  if (run.verified === true) return Object.freeze({ code: 'success', family: 'success' });
  if (run.budgetExceeded === true) return Object.freeze({ code: 'budget-exceeded', family: 'resource' });
  if (Number(run.agentExitCode ?? 0) === 137 || Number(run.resources?.peakRssMb ?? 0) > Number(run.budgets?.maxRssMb ?? Infinity)) return Object.freeze({ code: 'resource-exhaustion', family: 'resource' });
  if (run.timedOut === true || run.failureCode === 'timeout') return Object.freeze({ code: 'timeout', family: 'execution' });
  if (Number(run.agentExitCode ?? 0) !== 0) return Object.freeze({ code: 'agent-execution-failure', family: 'execution' });
  if (Number(run.regressions ?? 0) > 0) return Object.freeze({ code: 'regression', family: 'verification' });
  if (run.verification?.some?.((entry) => Number(entry.exitCode ?? 0) !== 0)) return Object.freeze({ code: 'verification-failure', family: 'verification' });
  return Object.freeze({ code: 'unverified-outcome', family: 'outcome' });
}
