import { createHash } from 'node:crypto';
import { evaluateEvalLanePolicy } from './eval-lane-policy.mjs';

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const sha256 = (value) => createHash('sha256').update(stable(value)).digest('hex');

function validateSuite(suite) {
  if (!suite || typeof suite !== 'object' || !String(suite.id ?? '').trim()) throw new TypeError('eval suite id is required');
  if (!Array.isArray(suite.cases) || !suite.cases.length) throw new TypeError('eval suite cases are required');
  const ids = new Set();
  for (const item of suite.cases) {
    const id = String(item?.id ?? '').trim();
    if (!id) throw new TypeError('eval case id is required');
    if (ids.has(id)) throw new Error(`Duplicate eval case: ${id}`);
    ids.add(id);
  }
}

function metric(result, key, fallback = 0) {
  const value = Number(result?.[key] ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function score(assertions = {}, result = {}) {
  const failures = [];
  if (assertions.state !== undefined && result.state !== assertions.state) failures.push(`state expected ${assertions.state}, received ${result.state ?? 'undefined'}`);
  for (const needle of assertions.outputIncludes ?? []) if (!String(result.output ?? '').includes(String(needle))) failures.push(`output missing ${needle}`);
  const toolCalls = metric(result, 'toolCalls', Array.isArray(result.toolCalls) ? result.toolCalls.length : 0);
  if (assertions.maxToolCalls !== undefined && toolCalls > Number(assertions.maxToolCalls)) failures.push(`toolCalls ${toolCalls} exceeds ${assertions.maxToolCalls}`);
  const evidence = Array.isArray(result.evidence) ? result.evidence : [];
  if (assertions.evidenceComplete === true && (!evidence.length || evidence.some((item) => item?.status !== 'pass' || !/^[a-f0-9]{64}$/i.test(String(item?.receiptSha256 ?? ''))))) failures.push('evidence incomplete');
  return { passed: failures.length === 0, failures, toolCalls, evidenceCount: evidence.length };
}

export class EvalRunner {
  constructor({ executor, hiddenVerifier = null, clock = () => performance.now() } = {}) {
    if (typeof executor !== 'function') throw new TypeError('eval executor is required');
    if (hiddenVerifier !== null && typeof hiddenVerifier !== 'function') throw new TypeError('hiddenVerifier must be a function');
    this.executor = executor; this.hiddenVerifier = hiddenVerifier; this.clock = clock;
  }

  async runSuite(suite, { providerIds, timeoutMs = 120_000, executionMode = 'runtime', independentAttestation = null } = {}) {
    validateSuite(suite);
    const lanePolicy = evaluateEvalLanePolicy(suite, { executionMode, hiddenVerifierAvailable: typeof this.hiddenVerifier === 'function', independentAttestation });
    if (lanePolicy.status !== 'pass') throw Object.assign(new Error(`Eval lane policy failed: ${lanePolicy.failures.join(', ')}`), { statusCode: 400, code: 'EVAL_LANE_POLICY_FAILED' });
    const providers = [...new Set((providerIds ?? []).map(String).filter(Boolean))];
    if (!providers.length) throw new TypeError('at least one provider is required');
    const timeout = Number(timeoutMs);
    if (!Number.isFinite(timeout) || timeout < 1) throw new TypeError('timeoutMs is invalid');
    const cases = [];
    for (const providerId of providers) {
      for (const evalCase of suite.cases) cases.push(await this.#runCase(suite, evalCase, providerId, timeout, lanePolicy));
    }
    const summaries = {};
    for (const providerId of providers) {
      const items = cases.filter((item) => item.providerId === providerId);
      const passCount = items.filter((item) => item.status === 'pass').length;
      summaries[providerId] = Object.freeze({
        caseCount: items.length,
        passCount,
        failCount: items.length - passCount,
        passRate: items.length ? passCount / items.length : 0,
        totalToolCalls: items.reduce((sum, item) => sum + item.toolCalls, 0),
        totalEstimatedTokens: items.reduce((sum, item) => sum + item.estimatedTokens, 0),
        totalRetries: items.reduce((sum, item) => sum + item.retries, 0),
        totalElapsedMs: items.reduce((sum, item) => sum + item.elapsedMs, 0),
      });
    }
    const allPassed = cases.every((item) => item.status === 'pass');
    const nonClaimReasons = [...lanePolicy.nonClaimReasons];
    if (!allPassed) nonClaimReasons.push('one-or-more-cases-failed');
    const claimAllowed = lanePolicy.claimEligible && allPassed;
    const semantic = {
      suiteId: String(suite.id), lane: lanePolicy.lane, claimScope: lanePolicy.claimScope, claimAllowed,
      providers,
      cases: cases.map(({ elapsedMs: _elapsed, error: _error, ...item }) => item),
      providersSummary: Object.fromEntries(Object.entries(summaries).map(([id, item]) => [id, { ...item, totalElapsedMs: undefined }])),
      nonClaimReasons,
      lanePolicyReceiptSha256: lanePolicy.receiptSha256,
    };
    return Object.freeze({ suiteId: String(suite.id), lane: lanePolicy.lane, claimScope: claimAllowed ? lanePolicy.claimScope : 'none', claimAllowed, nonClaimReasons: Object.freeze(nonClaimReasons), cases: Object.freeze(cases), providers: Object.freeze(summaries), lanePolicyReceiptSha256: lanePolicy.receiptSha256, reportSha256: sha256(semantic) });
  }

  async #runCase(suite, evalCase, providerId, timeoutMs, lanePolicy) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(new Error('eval timeout')); }, timeoutMs);
    timer.unref?.();
    const started = this.clock();
    let result = null; let error = null;
    try { result = await this.executor({ suite, evalCase, providerId, signal: controller.signal }); }
    catch (caught) { error = String(caught?.message ?? caught); }
    finally { clearTimeout(timer); }
    const elapsedMs = Math.max(0, this.clock() - started);
    if (timedOut) return Object.freeze({ suiteId: suite.id, caseId: evalCase.id, providerId, status: 'timeout', failures: Object.freeze(['timeout']), toolCalls: 0, estimatedTokens: 0, retries: 0, evidenceCount: 0, elapsedMs, error });
    if (error) return Object.freeze({ suiteId: suite.id, caseId: evalCase.id, providerId, status: 'error', failures: Object.freeze([error]), toolCalls: 0, estimatedTokens: 0, retries: 0, evidenceCount: 0, elapsedMs, error });
    const evaluated = score(evalCase.assertions, result);
    let hiddenVerification = null;
    if (lanePolicy.lane !== 'evaluator-plumbing-smoke') {
      try {
        hiddenVerification = await this.hiddenVerifier({ suite: { id: suite.id, lane: suite.lane, repositorySnapshotSha256: suite.repositorySnapshotSha256, hiddenVerifier: suite.hiddenVerifier }, evalCase: { id: evalCase.id, input: evalCase.input }, providerId, result });
      } catch (caught) {
        evaluated.failures.push(`hidden verifier error: ${String(caught?.message ?? caught)}`);
      }
      if (hiddenVerification?.status !== 'pass' || hiddenVerification?.compositional !== true || !/^[a-f0-9]{64}$/i.test(String(hiddenVerification?.receiptSha256 ?? ''))) evaluated.failures.push('hidden compositional verification incomplete');
      evaluated.passed = evaluated.failures.length === 0;
    }
    return Object.freeze({
      suiteId: suite.id, caseId: evalCase.id, providerId,
      status: evaluated.passed ? 'pass' : 'fail', failures: Object.freeze(evaluated.failures),
      toolCalls: evaluated.toolCalls, estimatedTokens: metric(result, 'estimatedTokens'), retries: metric(result, 'retries'), evidenceCount: evaluated.evidenceCount,
      hiddenVerificationReceiptSha256: hiddenVerification?.receiptSha256 ?? null,
      elapsedMs, outputSha256: sha256(String(result?.output ?? '')), state: result?.state ?? null,
    });
  }
}
