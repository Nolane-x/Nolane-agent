function mean(values) { return values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0; }
function variance(values) { if (values.length < 2) return 0; const m = mean(values); return values.reduce((sum, value) => sum + ((value - m) ** 2), 0) / (values.length - 1); }
function wilson(successes, total, z = 1.959963984540054) { if (!total) return Object.freeze({ low: 0, high: 1 }); const p = successes / total; const z2 = z * z; const denominator = 1 + z2 / total; const center = (p + z2 / (2 * total)) / denominator; const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / denominator; return Object.freeze({ low: Math.max(0, center - margin), high: Math.min(1, center + margin) }); }
export class BenchmarkScorer {
  scoreSystem(runs) {
    const successes = runs.filter((run) => run.verified === true).length;
    const latency = runs.map((run)=>Number(run.durationMs ?? run.latencyMs ?? 0));
    return Object.freeze({ tasks: new Set(runs.map((run)=>run.taskId)).size, runs: runs.length, successes, functional: mean(runs.map((run) => run.verified ? 1 : 0)), passAt1: mean(runs.map((run) => run.verified ? 1 : 0)), functionalConfidence95: wilson(successes, runs.length), verifiedCriteria: mean(runs.map((run) => Number(run.verifiedCriteria ?? (run.verified ? 1 : 0)) / Math.max(1, Number(run.totalCriteria ?? 1)))), regressionRate: mean(runs.map((run) => Number(run.regressions ?? 0) > 0 ? 1 : 0)), safety: mean(runs.map((run) => Number(run.safety ?? 0))), latencyMs: mean(latency), latencyVariance: variance(latency), peakRssMb: mean(runs.map((run) => Number(run.resources?.peakRssMb ?? 0))), rssMbSeconds: mean(runs.map((run) => Number(run.resources?.rssMbSeconds ?? 0))), processCount: mean(runs.map((run) => Number(run.resources?.processCount ?? 0))), correctionCycles: mean(runs.map((run) => Number(run.corrections?.cycles ?? 0))), revertedLines: mean(runs.map((run) => Number(run.corrections?.revertedLines ?? 0))), humanInterventions: mean(runs.map((run) => Number(run.corrections?.humanInterventions ?? 0))), firstPatchSuccess: mean(runs.map((run) => run.firstPatchPassed ? 1 : 0)), keepRate: mean(runs.filter((run) => run.keepRateEligible !== false).map((run) => run.retainedPatch ? 1 : 0)), tokens: mean(runs.map((run)=>Number(run.usage?.tokens ?? 0))), costUsd: mean(runs.map((run)=>Number(run.usage?.costUsd ?? run.costUsd ?? 0))), reproducibility: this.#reproducibility(runs) });
  }
  #reproducibility(runs) { const byTask = new Map(); for (const run of runs) { const key = `${run.system}:${run.taskId}`; const list = byTask.get(key) ?? []; list.push(run.verified ? 1 : 0); byTask.set(key,list); } const stable = [...byTask.values()].map((values)=>values.every((value)=>value===values[0]) ? 1 : 0); return mean(stable); }
  compareSystems(runs = [], { independentEvidence = null, minimumTasks = 20 } = {}) {
    const names = [...new Set(runs.map((run)=>String(run.system)))].sort();
    const systems = Object.fromEntries(names.map((name) => [name, this.scoreSystem(runs.filter((run)=>String(run.system)===name))]));
    const taskSets = names.map((name) => new Set(runs.filter((run) => String(run.system) === name).map((run) => String(run.taskId))));
    const commonTasks = taskSets.length ? [...taskSets[0]].filter((task) => taskSets.every((set) => set.has(task))) : [];
    const attested = independentEvidence?.verified === true;
    const claimantSystem = attested ? String(independentEvidence.claimantSystem ?? '') : null;
    let claimAllowed = false;
    let reason = 'A trusted signed independent-operator attestation is required; self-declared independence is insufficient.';
    if (attested && names.length < 2) reason = 'At least two systems are required for a comparative claim.';
    else if (attested && commonTasks.length < minimumTasks) reason = `Only ${commonTasks.length} common tasks; at least ${minimumTasks} are required.`;
    else if (attested && !systems[claimantSystem]) reason = 'The attested claimant system is not present.';
    else if (attested) { const claimant = systems[claimantSystem]; const competitors = names.filter((name) => name !== claimantSystem).map((name) => systems[name]); claimAllowed = competitors.length > 0 && competitors.every((score) => claimant.functionalConfidence95.low > score.functionalConfidence95.high); reason = claimAllowed ? 'Trusted attestation, common-task threshold, and non-overlapping 95% functional confidence intervals are satisfied.' : 'The claimant does not have a statistically separated verified-success interval over every comparator.'; }
    return Object.freeze({ independent: attested, independentEvidence: attested ? independentEvidence : null, minimumTasks, taskCount: new Set(runs.map((run)=>run.taskId)).size, commonTaskCount: commonTasks.length, claimantSystem, claimAllowed, reason, systems: Object.freeze(systems) });
  }
}
