import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { VerificationControlPlane } from '../src/verification/verification-control-plane.mjs';

const hash = (char) => char.repeat(64);

export async function measureVerificationLearnedRouting({ rootDirectory = process.cwd(), version } = {}) {
  const root = path.resolve(rootDirectory);
  let reviewRequest = null;
  const findingFingerprint = hash('e');
  const reviewService = {
    async review(input) {
      reviewRequest = input;
      return {
        reviewId: 'review-auth',
        receiptSha256: hash('f'),
        findings: [{ fingerprint: findingFingerprint, severity: 'critical', category: 'security', message: 'Auth bypass remains possible', path: 'src/auth.mjs', line: 4 }],
      };
    },
  };
  let now = 1_000;
  const plane = new VerificationControlPlane({ reviewService, bandit: { exploration: 0, shadowRolloutPercent: 100 }, clock: () => (now += 10) });
  try {
    const lowPlan = plane.planVerification({ risk: 'low', changedSymbols: ['normalizeExpiry'], impactedTests: ['session-unit'], criterionIds: ['criterion-expiry'] });
    const highPlan = plane.planVerification({
      risk: 'critical',
      changedSymbols: ['authenticateRequest'],
      semanticFindings: [{ kind: 'breaking-public-api' }, { kind: 'permission-expansion' }, { kind: 'hot-path-change' }],
      impactedTests: ['auth-unit', 'api-contract'], historicalFailures: ['auth-regression'], criterionIds: ['criterion-auth'], runtimeSurfaces: ['api'],
    });
    const weakTest = plane.assessTestIntegrity({
      sourceHash: hash('a'),
      diff: `diff --git a/tests/auth.test.mjs b/tests/auth.test.mjs\n--- a/tests/auth.test.mjs\n+++ b/tests/auth.test.mjs\n@@ -1,3 +1,3 @@\n-test('rejects expired', () => assert.equal(status, 401));\n+test.skip('rejects expired', () => assert.ok(status));\n`,
      testRuns: [{ testId: 'auth-full-suite', status: 'pass', flaky: false, receiptSha256: hash('b') }],
    });
    const missingApi = plane.verifyApiExistence({ request: { kind: 'symbol', name: 'imaginaryAuth', package: 'auth-lib', platform: 'linux' }, evidence: [], required: true });
    const passedApi = plane.verifyApiExistence({ request: { kind: 'symbol', name: 'validateAuth', package: 'auth-lib', signature: '(token)' }, evidence: [{ kind: 'lsp-symbol', name: 'validateAuth', package: 'auth-lib', signature: '(token)', deprecated: false, platforms: ['linux'], receiptSha256: hash('c') }], required: true });

    const reviewInput = {
      projectId: 'project-auth', executor: { id: 'executor', providerId: 'openai', model: 'code-model', harnessProfile: 'implementation' },
      reviewerCandidates: [{ id: 'reviewer', providerId: 'anthropic', model: 'review-model', harnessProfile: 'adversarial-review', role: 'reviewer' }],
      diff: '+validateAuth(token);', requirements: [{ id: 'criterion-auth', text: 'Reject invalid tokens' }], evidence: [{ evidenceId: 'ev-auth', claim: 'Input reaches validator', receiptSha256: hash('d') }], testReceipts: [{ kind: 'security', status: 'pass', receiptSha256: hash('1') }], residualRisks: ['platform difference'],
    };
    const blockedReview = await plane.runAdversarialReview(reviewInput);
    const resolvedReview = await plane.runAdversarialReview({ ...reviewInput, resolutions: [{ findingFingerprint, status: 'repaired', receiptSha256: hash('2') }] });

    const failureProof = await plane.runFailureInjection({
      taskId: 'task-auth', criterionId: 'criterion-auth', faultType: 'network-loss', lease: { maxAttempts: 1, maxDurationMs: 1_000 },
      checkpointAdapter: { save: async () => ({ checkpointId: 'cp-auth', sourceHash: hash('3'), receiptSha256: hash('4') }), resume: async () => ({ status: 'pass', checkpointId: 'cp-auth', receiptSha256: hash('5') }) },
      faultAdapter: { inject: async () => ({ status: 'injected', reversible: true, receiptSha256: hash('6') }), clear: async () => ({ status: 'pass', receiptSha256: hash('7') }) },
      operation: async () => ({ status: 'degraded', irreversibleActions: 0, receiptSha256: hash('8') }),
      recoveryAdapter: { recover: async () => ({ status: 'pass', strategy: 'resume-checkpoint', receiptSha256: hash('9') }) },
      verify: async () => ({ status: 'pass', criterionId: 'criterion-auth', receiptSha256: hash('a') }),
    });

    const confidence = plane.calibrateTrajectory({ domain: 'security', taskType: 'debug', stages: [
      { kind: 'requirement', confidence: 0.91, critical: true }, { kind: 'root-cause', confidence: 0.72, critical: true }, { kind: 'verification', confidence: 0.94, critical: true },
    ], independentReceipts: [{ kind: 'independent-review', status: 'pass', receiptSha256: hash('b') }] });
    let unverifiedRejected = false;
    try { plane.recordBanditOutcome({ providerId: 'p', harnessProfile: 'h', features: { taskType: 'debug' }, verified: false, verificationReceiptSha256: hash('c') }); }
    catch { unverifiedRejected = true; }
    const recorded = plane.recordBanditOutcome({ providerId: 'steady', harnessProfile: 'review-aware', features: { taskType: 'debug', language: 'js', risk: 'critical', repoSize: 100, symbolCount: 2, contextTokens: 3000, toolCount: 5 }, verified: true, verifiedCriteriaScore: 5, firstPatchPassed: true, retainedPatch: true, tokenCost: 2500, latencyMs: 900, peakRssMb: 300, rssMbSeconds: 4000, correctionCycles: 0, humanInterventions: 0, verificationReceiptSha256: hash('d') });
    const ranking = plane.rankBandit({ taskId: 'task-auth', features: { taskType: 'debug', language: 'js', risk: 'critical', repoSize: 100, symbolCount: 2, contextTokens: 3000, toolCount: 5 }, candidates: [
      { providerId: 'blocked', harnessProfile: 'unsafe', eligible: false, reason: 'hard-constraint-blocked' }, { providerId: 'steady', harnessProfile: 'review-aware', eligible: true },
    ] });

    const stageReceipts = highPlan.stages.map((stage, index) => ({ kind: stage.kind, status: 'pass', receiptSha256: String((index % 9) + 1).repeat(64) }));
    const falseGreen = plane.decideSemanticCompletion({
      pyramidPlan: highPlan, criteria: [{ criterionId: 'criterion-auth', complete: true, receiptSha256: hash('e') }], stageReceipts,
      testIntegrity: weakTest, apiDecisions: [missingApi], reviewDecision: blockedReview, failureProofs: [failureProof], trajectory: confidence, residualRisks: [], rollbackPoint: 'commit-base',
    });
    const completion = plane.decideSemanticCompletion({
      pyramidPlan: highPlan, criteria: [{ criterionId: 'criterion-auth', complete: true, receiptSha256: hash('e') }], stageReceipts,
      testIntegrity: { allowedAsCompletionEvidence: true, blockingFindings: 0, receiptSha256: hash('f') }, apiDecisions: [passedApi], reviewDecision: resolvedReview, failureProofs: [failureProof], trajectory: confidence, residualRisks: [], rollbackPoint: 'commit-base',
    });
    const app = await readFile(path.join(root, 'src/app.mjs'), 'utf8');
    const snapshot = plane.snapshot();
    const base = {
      schema: 'forge.studio.verification-learned-routing-measurement.v1', version: String(version),
      pyramid: { lowRiskNarrow: lowPlan.stages.map((x) => x.kind).join(',') === 'parse-type,targeted', highRiskExpanded: ['contract','integration','api-journey','mutation-probe','performance','security','independent-review','full-suite'].every((kind) => highPlan.stages.some((x) => x.kind === kind)), highRiskStageCount: highPlan.stages.length },
      testIntegrity: { falseGreenBlocked: weakTest.allowedAsCompletionEvidence === false, categories: weakTest.findings.map((x) => x.category) },
      api: { missingApiBlocked: missingApi.allowed === false && missingApi.status === 'unknown', exactApiAllowed: passedApi.allowed === true },
      review: { independentReviewerSelected: blockedReview.independence.kind === 'provider-model', rationaleOmitted: !JSON.stringify(reviewRequest).includes('private'), disagreementBlocked: blockedReview.status === 'blocked', resolvedAfterReceipt: resolvedReview.status === 'pass' },
      failure: { recoveredAndReverified: failureProof.status === 'pass' && failureProof.claims.criterionReverifiedAfterRecovery, directOsFaultInjected: failureProof.claims.directOsFaultInjected },
      confidence: { weakestLinkBounded: confidence.weakestCritical.kind === 'root-cause' && confidence.finalConfidence <= confidence.weakestCritical.confidence, finalConfidence: confidence.finalConfidence },
      bandit: { verifiedOnly: unverifiedRejected && recorded.recorded === true, shadowOnly: ranking.mode === 'shadow' && ranking.claims.productionTrafficChanged === false, hardConstraintsPreserved: ranking.claims.hardConstraintsRelaxed === false, providerHarnessPaired: ranking.claims.providerAndHarnessPaired === true },
      completion: { greenSuiteInsufficient: falseGreen.status === 'blocked' && falseGreen.claims.greenSuiteAloneSufficient === false, passWithAllEvidence: completion.status === 'pass' && completion.completionAllowed === true },
      lifecycle: snapshot.lifecycle,
      privacy: { privateReasoningStored: snapshot.claims.privateReasoningStored, rawPromptsStored: snapshot.claims.rawPromptsStored, rawModelOutputsStored: snapshot.claims.rawModelOutputsStored },
      composition: { appStaticImports: (app.match(/^import\s.+$/gm) ?? []).length, appConstructors: (app.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*/g) ?? []).length },
      boundaries: { productionTrafficChanged: false, productionMultiProviderReviewCertified: false, hiddenRegressionSetCertified: false, directOsFaultInjectionCertified: false, longTermPatchSurvivalCertified: false, heldOutRouterPromotionCertified: false, comparativeSuperiorityClaimed: false },
    };
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  } finally { plane.close(); }
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const releaseVersion = String(process.argv[4] ?? metadata.version);
  const output = path.resolve(root, process.argv[3] ?? `docs/verification-learned-routing-measurement-${releaseVersion}.json`);
  const report = await measureVerificationLearnedRouting({ rootDirectory: root, version: releaseVersion });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ version: releaseVersion, output: path.relative(root, output).replaceAll('\\', '/'), receiptSha256: report.receiptSha256 })}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
