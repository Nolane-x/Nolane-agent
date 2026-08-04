import { canonicalSha256 } from '../../../vendor/forge-os/src/core/canonical-json.mjs';
import { deepFreeze, nonEmpty, requireSha256, signed } from '../superiority-utils.mjs';

function environmentFingerprint(environment = {}) {
  return canonicalSha256({
    machine: String(environment.machine ?? ''), model: String(environment.model ?? ''), tokenBudget: Number(environment.tokenBudget) || 0,
    permissions: [...new Set((environment.permissions ?? []).map(String))].sort(), tools: [...new Set((environment.tools ?? []).map(String))].sort(),
  });
}

function binomialCoefficient(n, k) {
  const m = Math.min(k, n - k); let value = 1;
  for (let i = 1; i <= m; i += 1) value = value * (n - m + i) / i;
  return value;
}

function twoSidedSignP(wins, losses) {
  const n = wins + losses;
  if (!n) return 1;
  const tail = Math.min(wins, losses);
  let cumulative = 0;
  for (let k = 0; k <= tail; k += 1) cumulative += binomialCoefficient(n, k) * 0.5 ** n;
  return Math.min(1, cumulative * 2);
}

export class ComparativeBenchmarkLab {
  constructor({ clock = () => Date.now(), limits = {} } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxStudies = Math.max(1, Math.floor(Number(limits.maxStudies) || 100));
    this.studies = new Map();
  }

  createStudy(input = {}) {
    const studyId = nonEmpty(input.studyId, 'studyId');
    if (this.studies.has(studyId)) throw new Error(`Study already exists ${studyId}`);
    const state = { studyId, competitor: nonEmpty(input.competitor, 'competitor'), baselineVersion: nonEmpty(input.baselineVersion, 'baselineVersion'), minPairs: Math.max(2, Math.floor(Number(input.minPairs) || 20)), alpha: Math.min(0.2, Math.max(0.0001, Number(input.alpha) || 0.05)), minMeanEffect: Math.max(0, Number(input.minMeanEffect) || 0), runs: new Map(), createdAtMs: Number(this.clock()) };
    this.studies.set(studyId, state);
    while (this.studies.size > this.maxStudies) this.studies.delete(this.studies.keys().next().value);
    return this.#public(state);
  }

  ingestRun(studyId, input = {}) {
    const state = this.#state(studyId);
    const system = String(input.system ?? '').toLowerCase();
    if (!['nolane', 'nolane_native'].includes(system)) throw new TypeError('system must be nolane or nolane_native');
    if (input.real !== true) throw new Error('Benchmark artifact must be real');
    const tasksInput = Array.isArray(input.tasks) ? input.tasks : [];
    if (!tasksInput.length) throw new TypeError('tasks must not be empty');
    const taskIds = new Set();
    const tasks = tasksInput.map((task) => {
      const taskId = nonEmpty(task.taskId, 'taskId');
      if (taskIds.has(taskId)) throw new Error(`Duplicate benchmark task ${taskId}`);
      taskIds.add(taskId);
      return deepFreeze({ taskId, score: Number(task.score) || 0, passed: task.passed === true, tokens: Math.max(0, Number(task.tokens) || 0), elapsedMs: Math.max(0, Number(task.elapsedMs) || 0), costUsd: Math.max(0, Number(task.costUsd) || 0) });
    });
    const run = deepFreeze({ system, artifactId: nonEmpty(input.artifactId, 'artifactId'), real: true, independentProducer: input.independentProducer === true, artifactSha256: requireSha256(input.artifactSha256, 'artifactSha256'), environment: deepFreeze({ ...input.environment }), environmentFingerprint: environmentFingerprint(input.environment), tasks });
    state.runs.set(system, run);
    return signed({ schema: 'nolane.superiority.comparative-benchmark-run.v1', studyId, run: { ...run, tasks: run.tasks.length } });
  }

  evaluate(studyId) {
    const state = this.#state(studyId);
    const nolane = state.runs.get('nolane'); const nolane_native = state.runs.get('nolane_native');
    const blockers = [];
    if (!nolane || !nolane_native) blockers.push('paired-artifacts-missing');
    const environmentMatched = Boolean(nolane && nolane_native && nolane.environmentFingerprint === nolane_native.environmentFingerprint);
    if (nolane && nolane_native && !environmentMatched) blockers.push('environment-mismatch');
    if (nolane_native && !nolane_native.independentProducer) blockers.push('competitor-artifact-not-independent');
    const nolane_nativeTasks = new Map((nolane_native?.tasks ?? []).map((item) => [item.taskId, item]));
    const pairs = (nolane?.tasks ?? []).filter((item) => nolane_nativeTasks.has(item.taskId)).map((item) => ({ taskId: item.taskId, nolane: item, nolane_native: nolane_nativeTasks.get(item.taskId), delta: item.score - nolane_nativeTasks.get(item.taskId).score }));
    if (pairs.length < state.minPairs) blockers.push('insufficient-paired-tasks');
    const wins = pairs.filter((pair) => pair.delta > 1e-12).length;
    const losses = pairs.filter((pair) => pair.delta < -1e-12).length;
    const ties = pairs.length - wins - losses;
    const meanEffect = pairs.length ? pairs.reduce((sum, pair) => sum + pair.delta, 0) / pairs.length : 0;
    const pValue = twoSidedSignP(wins, losses);
    if (meanEffect < state.minMeanEffect) blockers.push('effect-below-threshold');
    if (pValue >= state.alpha) blockers.push('statistical-threshold-not-met');
    if (wins <= losses) blockers.push('win-rate-not-positive');
    const uniqueBlockers = [...new Set(blockers)];
    return signed({
      schema: 'nolane.superiority.comparative-benchmark-result.v1', studyId: state.studyId, competitor: state.competitor, baselineVersion: state.baselineVersion,
      pairedTasks: pairs.length, environmentMatched, statistics: deepFreeze({ wins, losses, ties, meanEffect, pValue, alpha: state.alpha, minMeanEffect: state.minMeanEffect }),
      blockers: uniqueBlockers, comparativeSuperiorityClaimAllowed: uniqueBlockers.length === 0, evaluatedAtMs: Number(this.clock()),
      claims: { mockCompetitorAccepted: false, unmatchedEnvironmentAccepted: false, selfAuthoredCompetitorAccepted: false },
    });
  }

  snapshot() { return signed({ schema: 'nolane.superiority.comparative-benchmark-lab.v1', studies: [...this.studies.values()].map((state) => this.#public(state)), claims: { comparativeSuperiorityClaimAllowed: false, mockCompetitorAccepted: false } }); }
  #state(id) { const key = nonEmpty(id, 'studyId'); const state = this.studies.get(key); if (!state) throw new Error(`Unknown study ${key}`); return state; }
  #public(state) { return signed({ schema: 'nolane.superiority.comparative-benchmark-study.v1', studyId: state.studyId, competitor: state.competitor, baselineVersion: state.baselineVersion, minPairs: state.minPairs, alpha: state.alpha, minMeanEffect: state.minMeanEffect, runSystems: [...state.runs.keys()].sort(), createdAtMs: state.createdAtMs }); }
}
