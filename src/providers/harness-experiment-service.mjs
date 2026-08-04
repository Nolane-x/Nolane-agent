import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { EvalRunner } from '../eval/eval-runner.mjs';

function profile(input, label) {
  if (!input?.id || !input?.family || !/^[a-f0-9]{64}$/i.test(String(input?.profileSha256 ?? ''))) throw new TypeError(`${label} harness profile is invalid`);
  return input;
}

function summary(value) {
  const caseCount = Number(value.caseCount ?? 0);
  const passCount = Number(value.passCount ?? 0);
  const passRate = caseCount ? passCount / caseCount : 0;
  const totalToolCalls = Number(value.totalToolCalls ?? 0);
  const totalRetries = Number(value.totalRetries ?? 0);
  const totalEstimatedTokens = Number(value.totalEstimatedTokens ?? 0);
  const totalElapsedMs = Number(value.totalElapsedMs ?? 0);
  const weightedScore = (passRate * 1000) - (totalToolCalls * 2) - (totalRetries * 5) - (totalEstimatedTokens * 0.001) - (totalElapsedMs * 0.001);
  return Object.freeze({ caseCount, passCount, failCount: caseCount - passCount, passRate, totalToolCalls, totalRetries, totalEstimatedTokens, totalElapsedMs, weightedScore });
}

function stableCase(item) {
  const { elapsedMs: _elapsed, error: _error, ...stable } = item;
  return stable;
}

export class HarnessExperimentService {
  constructor({ clock = () => performance.now(), minImprovement = 0.01 } = {}) {
    if (typeof clock !== 'function') throw new TypeError('clock must be a function');
    const threshold = Number(minImprovement);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new TypeError('minImprovement must be between 0 and 1');
    this.clock = clock;
    this.minImprovement = threshold;
  }

  async compare({ family, baseline: baselineInput, candidate: candidateInput, suite, executor, timeoutMs = 120_000 } = {}) {
    const baseline = profile(baselineInput, 'baseline');
    const candidate = profile(candidateInput, 'candidate');
    const cleanFamily = String(family ?? '').trim();
    if (!cleanFamily || baseline.family !== cleanFamily || candidate.family !== cleanFamily) throw new TypeError('baseline and candidate family must match the experiment family');
    if (!Array.isArray(suite?.cases) || suite.cases.length < 4) throw new TypeError('harness experiment suite must contain at least 4 cases');
    if (typeof executor !== 'function') throw new TypeError('harness experiment executor is required');

    const profiles = new Map([[baseline.id, baseline], [candidate.id, candidate]]);
    const runner = new EvalRunner({
      clock: this.clock,
      executor: ({ suite: runSuite, evalCase, providerId, signal }) => executor({ suite: runSuite, evalCase, profile: profiles.get(providerId), signal }),
    });
    const replay = await runner.runSuite(suite, { providerIds: [baseline.id, candidate.id], timeoutMs });
    const baselineSummary = summary(replay.providers[baseline.id]);
    const candidateSummary = summary(replay.providers[candidate.id]);
    const baselineCases = new Map(replay.cases.filter((item) => item.providerId === baseline.id).map((item) => [item.caseId, item]));
    const candidateCases = new Map(replay.cases.filter((item) => item.providerId === candidate.id).map((item) => [item.caseId, item]));
    let criticalRegressions = 0;
    for (const evalCase of suite.cases) {
      if (evalCase.critical === true && baselineCases.get(evalCase.id)?.status === 'pass' && candidateCases.get(evalCase.id)?.status !== 'pass') criticalRegressions += 1;
    }
    const improvement = (candidateSummary.weightedScore - baselineSummary.weightedScore) / Math.max(Math.abs(baselineSummary.weightedScore), 1);
    const failures = [];
    if (candidateSummary.passRate < baselineSummary.passRate) failures.push(`candidate pass rate ${candidateSummary.passRate.toFixed(4)} is below baseline ${baselineSummary.passRate.toFixed(4)}`);
    if (criticalRegressions > 0) failures.push(`candidate introduced ${criticalRegressions} critical regression(s)`);
    if (improvement < this.minImprovement) failures.push(`candidate weighted improvement ${improvement.toFixed(6)} is below threshold ${this.minImprovement.toFixed(6)}`);
    const promotable = failures.length === 0;

    const semantic = {
      schema: 'forge.harness-experiment-report.v1',
      family: cleanFamily,
      suiteId: String(suite.id),
      baselineProfileId: baseline.id,
      baselineProfileSha256: baseline.profileSha256,
      candidateProfileId: candidate.id,
      candidateProfileSha256: candidate.profileSha256,
      baseline: { ...baselineSummary, totalElapsedMs: undefined },
      candidate: { ...candidateSummary, totalElapsedMs: undefined },
      improvement,
      criticalRegressions,
      promotable,
      failures,
      cases: replay.cases.map(stableCase),
    };
    return Object.freeze({
      schema: semantic.schema,
      status: 'pass',
      family: cleanFamily,
      suiteId: semantic.suiteId,
      baselineProfileId: baseline.id,
      baselineProfileSha256: baseline.profileSha256,
      candidateProfileId: candidate.id,
      candidateProfileSha256: candidate.profileSha256,
      baseline: baselineSummary,
      candidate: candidateSummary,
      improvement,
      criticalRegressions,
      promotable,
      failures: Object.freeze(failures),
      cases: replay.cases,
      receiptSha256: canonicalSha256(semantic),
    });
  }
}
