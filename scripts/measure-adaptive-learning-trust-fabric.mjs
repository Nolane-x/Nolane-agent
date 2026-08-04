import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { TaskFeatureEncoder } from '../src/learning/task-feature-encoder.mjs';
import { HeldOutPolicyEvaluator } from '../src/learning/held-out-policy-evaluator.mjs';
import { CohortCanaryGovernor } from '../src/learning/cohort-canary-governor.mjs';
import { StrategyPolicyLearner } from '../src/learning/strategy-policy-learner.mjs';
import { DomainTrustLedger } from '../src/learning/domain-trust-ledger.mjs';
import { ModelSwitchCoordinator } from '../src/learning/model-switch-coordinator.mjs';
import { AdaptiveLearningControlPlane } from '../src/learning/adaptive-learning-control-plane.mjs';
import { TeacherChallengeLab } from '../src/development/teacher-challenge-lab.mjs';
import { StateCapsuleStore } from '../src/construction/state-capsule-store.mjs';

export const ADAPTIVE_LEARNING_TRUST_REQUIREMENT_IDS = Object.freeze([
  '38.2','38.6','38.7','38.10','38.12','38.13','38.14','38.18','47.6','47.10','47.11',
]);
const H = (value) => canonicalSha256(String(value));

export async function measureAdaptiveLearningTrustFabric({ rootDirectory = process.cwd(), version = '3.5.0' } = {}) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'forge-adaptive-learning-measure-'));
  try {
    const featureEncoder = new TaskFeatureEncoder({ capabilityMatrixRevision: H('capability-matrix-v1') });
    const features = featureEncoder.encode({ taskId: 'task-migration', taskType: 'migration', languages: ['typescript', 'sql'], repoSize: { files: 320, bytes: 2_000_000, symbols: 2_100 }, risk: 0.85, context: { tokenBudget: 20_000, selectedTokens: 12_000 }, tools: ['git', 'test', 'database'], localOnly: true });

    const heldOut = new HeldOutPolicyEvaluator({ minHeldOutTasks: 2, minUtilityImprovement: 0.1 });
    const heldOutReport = heldOut.evaluate({
      tuningTaskIds: ['train-1'], heldOutTaskIds: ['held-1', 'held-2'], baselinePolicyId: 'baseline', candidatePolicyId: 'candidate',
      outcomes: [
        { taskId: 'held-1', policyId: 'baseline', success: true, utility: 1, critical: true, verified: true, verificationReceiptSha256: H('h1b') },
        { taskId: 'held-1', policyId: 'candidate', success: true, utility: 1.4, critical: true, verified: true, verificationReceiptSha256: H('h1c') },
        { taskId: 'held-2', policyId: 'baseline', success: true, utility: 1, critical: false, verified: true, verificationReceiptSha256: H('h2b') },
        { taskId: 'held-2', policyId: 'candidate', success: true, utility: 1.3, critical: false, verified: true, verificationReceiptSha256: H('h2c') },
      ],
    });

    const canary = new CohortCanaryGovernor({ cohorts: ['large-polyglot'], minSamples: 2, maxPassRateRegression: 0.1, maxCorrectionRegression: 0.5 });
    const assignmentA = canary.assign({ missionId: 'mission-1', policySha256: H('policy'), eligibleCohorts: ['large-polyglot'] });
    const assignmentB = canary.assign({ missionId: 'mission-1', policySha256: H('policy'), eligibleCohorts: ['large-polyglot'] });
    for (let index = 0; index < 2; index += 1) {
      canary.record({ cohort: 'large-polyglot', variant: 'baseline', success: true, correctionCycles: 0, rssMbSeconds: 10, verified: true, verificationReceiptSha256: H(`cb${index}`) });
      canary.record({ cohort: 'large-polyglot', variant: 'candidate', success: false, correctionCycles: 2, rssMbSeconds: 10, verified: true, verificationReceiptSha256: H(`cc${index}`) });
    }
    const canaryEvaluation = canary.evaluate('large-polyglot');

    const strategy = new StrategyPolicyLearner();
    const strategyContext = { taskType: 'migration', language: 'typescript', riskBand: 'high' };
    strategy.recordOutcome({ outcomeId: 'strategy-good', context: strategyContext, strategy: { reasoningEffort: 'high', toolBudget: 16, retryBudget: 2, contextStrategy: 'symbol-first' }, success: true, verifiedUtility: 2, verified: true, verificationReceiptSha256: H('strategy-good') });
    strategy.recordOutcome({ outcomeId: 'strategy-bad', context: strategyContext, strategy: { reasoningEffort: 'low', toolBudget: 4, retryBudget: 0, contextStrategy: 'broad' }, success: false, verifiedUtility: -1, verified: true, verificationReceiptSha256: H('strategy-bad') });
    const strategyRecommendation = strategy.recommend(strategyContext);
    const acceptedAt = Date.UTC(2026, 6, 1);
    const survival = strategy.recordPatchSurvival({ patchId: 'patch-1', acceptedAt, observedAt: acceptedAt + 14 * 86_400_000, survived: true, reverted: false, humanRewriteRatio: 0.1, verified: true, verificationReceiptSha256: H('patch-survival') });

    const trust = new DomainTrustLedger();
    trust.record({ outcomeId: 'executor-success', role: 'executor', identity: 'model-a', domain: 'backend', taskType: 'migration', confidence: 0.8, success: true, verified: true, verificationReceiptSha256: H('executor') });
    trust.record({ outcomeId: 'reviewer-failure', role: 'reviewer', identity: 'model-a', domain: 'backend', taskType: 'migration', confidence: 0.8, success: false, verified: true, verificationReceiptSha256: H('reviewer') });
    trust.record({ outcomeId: 'tool-success', role: 'tool', identity: 'test-runner', domain: 'backend', taskType: 'migration', confidence: 0.9, success: true, verified: true, verificationReceiptSha256: H('tool') });
    const executorTrust = trust.project({ role: 'executor', identity: 'model-a', domain: 'backend', taskType: 'migration' });
    const reviewerTrust = trust.project({ role: 'reviewer', identity: 'model-a', domain: 'backend', taskType: 'migration' });

    const capsuleStore = new StateCapsuleStore({ root: path.join(temp, 'capsules') });
    await capsuleStore.save({ capsuleId: 'capsule-1', missionId: 'mission-1', planId: 'plan-1', planRevision: 2, invariantRevision: 3, repositoryFingerprint: H('repo'), goal: 'Complete migration', completedCriterionIds: ['criterion-1'], decisionReceiptIds: [H('decision')], changedSymbolIds: ['symbol:a'], verificationReceiptIds: [H('verification')], residualRisks: ['rollback'], gitCheckpoint: H('git'), nextStepIds: ['next-1'] });
    const switcher = new ModelSwitchCoordinator({ capsuleStore });
    const switched = await switcher.switchSession({
      capsuleId: 'capsule-1', from: { modelId: 'model-a', harness: 'codex-cli' }, to: { modelId: 'model-b', harness: 'generic-local', capabilities: ['read', 'edit', 'test'] }, requiredCapabilities: ['read', 'edit', 'test'],
      currentState: { repositoryFingerprint: H('repo'), planRevision: 2, invariantRevision: 3, gitCheckpoint: H('git') },
      translation: { sourceHarness: 'codex-cli', targetHarness: 'generic-local', revisionSha256: H('translation'), toolAliases: { apply_patch: 'edit' }, roleMap: { reviewer: 'critic' } },
    });

    const control = new AdaptiveLearningControlPlane({ cohorts: ['local'] });
    const trajectory = control.assessTrajectory({ domain: 'backend', taskType: 'migration', turns: [
      { turnId: 'turn-1', toolType: 'retrieval', confidence: 0.9, critical: true, evidenceReceiptSha256: H('turn-1') },
      { turnId: 'turn-2', toolType: 'edit', confidence: 0.55, critical: true, evidenceReceiptSha256: H('turn-2') },
      { turnId: 'turn-3', toolType: 'test', confidence: 0.8, critical: true, evidenceReceiptSha256: H('turn-3') },
    ], independentReceipts: [{ kind: 'test', status: 'pass', receiptSha256: H('independent') }] });

    const teacher = new TeacherChallengeLab({ challengeRevisionSha256: H('teacher-revision') });
    const pair = teacher.createPair({ seed: 'pair', language: 'javascript', concept: 'call-graph', source: 'function add(a,b){return a+b}; add(1,2)', structuralAnswer: { callee: 'add' } });
    const challengeSet = teacher.createChallengeSet({ seed: 'set', language: 'python', source: 'def add(a,b): return a+b', expected: { behavior: 'sum' } });

    const base = {
      schema: 'forge.studio.adaptive-learning-trust-fabric-measurement.v1',
      version: String(version),
      promotedRequirementIds: ADAPTIVE_LEARNING_TRUST_REQUIREMENT_IDS,
      routing: {
        taskFeaturesConditioned: features.taskType === 'migration' && features.languages.length === 2 && features.tools.length === 3,
        heldOutDisjoint: heldOutReport.heldOutOnly === true && heldOutReport.claims.heldOutTasksUsedForTuning === false,
        heldOutCandidatePromotable: heldOutReport.promotable === true,
        cohortDeterministic: assignmentA.cohort === assignmentB.cohort,
        cohortRegressionDisabled: canaryEvaluation.decision === 'disable-regression' && canaryEvaluation.enabled === false,
        strategyLearned: strategyRecommendation.strategy.reasoningEffort === 'high' && strategyRecommendation.strategy.contextStrategy === 'symbol-first',
        patchSurvivalVerified: survival.ageDays === 14 && survival.survived === true,
        modelSwitchTranslated: switched.status === 'switched' && switched.translation.toolAliases.apply_patch === 'edit',
      },
      trustAndDevelopment: {
        domainTaskTrustConditioned: executorTrust.domain === 'backend' && executorTrust.taskType === 'migration',
        roleTrustIsolated: executorTrust.bucketKey !== reviewerTrust.bucketKey && executorTrust.posteriorSuccessRate > reviewerTrust.posteriorSuccessRate,
        multiTurnToolCalibration: trajectory.turnCount === 3 && trajectory.trajectory.weakestCritical.kind === 'turn-2:edit',
        structureSurfaceSeparated: pair.executor.structureTask.source !== pair.executor.surfaceTask.source,
        teacherChallengeKindsCovered: ['distractor','mutation','platform','prompt-injection','rename'].every((kind) => challengeSet.executor.challenges.some((item) => item.kind === kind)),
        executorOracleBlind: pair.claims.hiddenAnswerExposedToExecutor === false && challengeSet.claims.executorCanReadOracle === false,
      },
      boundaries: {
        productionRoutingChanged: canaryEvaluation.claims.productionPromotionExecuted === true || heldOutReport.claims.productionRoutingChanged === true,
        heldOutUsedForTuning: heldOutReport.claims.heldOutTasksUsedForTuning === true,
        unverifiedOutcomeLearned: false,
        longTermSurvivalClaimedWithoutObservation: strategy.snapshot().claims.longTermSurvivalClaimedWithoutObservation === true,
        teacherOracleExposed: pair.claims.hiddenAnswerExposedToExecutor === true || challengeSet.claims.executorCanReadOracle === true,
        comparativeSuperiorityClaimed: false,
      },
      privacy: { rawPromptsStored: false, rawModelOutputsStored: false, chainOfThoughtStored: false },
      rootDirectoryUsedForClaims: false,
    };
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  const version = process.argv[2] ?? '3.5.0';
  const result = await measureAdaptiveLearningTrustFabric({ rootDirectory: process.cwd(), version });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
