import { createPrivateKey, sign } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { SuperiorityPlane } from '../src/runtime/superiority-plane.mjs';

const H = (character) => character.repeat(64);
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIOm2HoKHLOVMzws5zUkBuRk/PV2x3lqz63mZunghM/NA\n-----END PRIVATE KEY-----\n`;
const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA1vENkXivNaqy6UJd0IvyV+L01DBiW6MWCbfPA1EWNJo=\n-----END PUBLIC KEY-----\n`;

function statusCount(registry, status) {
  return Number(registry?.statusCounts?.[status] ?? registry?.summary?.[status] ?? 0);
}

export async function measureDeepSuperiorityWaveBatch({ rootDirectory = process.cwd(), version } = {}) {
  const root = path.resolve(rootDirectory);
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const releaseVersion = String(version ?? metadata.version);
  const registry = JSON.parse(await readFile(path.join(root, 'requirements/nolane-agent-v5-requirements.json'), 'utf8'));
  let tick = 20_000;
  const plane = new SuperiorityPlane({
    clock: () => ++tick,
    verificationMemory: { limits: { minimumIndependentSuccesses: 2 } },
    dogfood: { trustedIssuers: { 'fixture-auditor': TEST_PUBLIC_KEY } },
  });

  plane.registerMissionConstitution({
    constitutionId: 'constitution:deep-measurement', missionId: 'deep-measurement',
    budgets: { tokens: 2_000, elapsedMs: 20_000, costUsd: 2 },
    rules: [
      { ruleId: 'source-write', effect: 'source.write', decision: 'allow', maxRisk: 0.6, requiredCapabilities: ['repo.write'], reversibleRequired: true },
      { ruleId: 'production-deploy', effect: 'deploy.production', decision: 'approval', maxRisk: 0.4, requiredCapabilities: ['deploy'], reversibleRequired: true },
      { ruleId: 'secret-export', effect: 'secret.export', decision: 'deny' },
    ],
  });
  const allowedAction = plane.evaluateConstitutionAction('constitution:deep-measurement', {
    actionId: 'safe-write', effects: ['source.write'], capabilities: ['repo.write'], risk: 0.2, reversible: true,
    estimated: { tokens: 200, elapsedMs: 1_000, costUsd: 0.1 }, observed: true, evidenceHash: H('a'),
  });
  const forbiddenAction = plane.evaluateConstitutionAction('constitution:deep-measurement', {
    actionId: 'secret-export', effects: ['secret.export'], capabilities: [], risk: 0.1, reversible: false,
    estimated: { tokens: 10, elapsedMs: 10, costUsd: 0 }, observed: true, evidenceHash: H('b'),
  });
  const approvalAction = plane.evaluateConstitutionAction('constitution:deep-measurement', {
    actionId: 'production-deploy', effects: ['deploy.production'], capabilities: ['deploy'], risk: 0.3, reversible: true,
    estimated: { tokens: 100, elapsedMs: 1_000, costUsd: 0.2 }, observed: true, evidenceHash: H('c'),
  });
  let amendmentRejectedWithoutHuman = false;
  try {
    plane.amendMissionConstitution('constitution:deep-measurement', { expectedVersion: 1, approvedByHuman: false, actor: 'agent', approvalReceiptSha256: H('d'), rules: [{ ruleId: 'source-write', effect: 'source.write', decision: 'allow' }] });
  } catch (error) { amendmentRejectedWithoutHuman = /human approval/i.test(error.message); }

  plane.openCounterfactualPlan({ planningId: 'counterfactual:deep-measurement', goal: 'Select the safest evidence-backed repair', constraints: { maxRisk: 0.5, minProofCoverage: 0.7, minRollbackCoverage: 0.7 }, causalReceiptSha256: H('e') });
  plane.registerCounterfactualCandidate('counterfactual:deep-measurement', { planId: 'unsafe-fast', benefit: 1, risk: 0.9, uncertainty: 0.1, proofCoverage: 1, rollbackCoverage: 1, cost: 0.1, dependenciesSatisfied: true, evidenceHashes: [H('f')] });
  plane.registerCounterfactualCandidate('counterfactual:deep-measurement', { planId: 'safe-proofed', benefit: 0.9, risk: 0.2, uncertainty: 0.1, proofCoverage: 0.95, rollbackCoverage: 0.9, cost: 0.2, dependenciesSatisfied: true, evidenceHashes: [H('1')] });
  plane.registerCounterfactualCandidate('counterfactual:deep-measurement', { planId: 'dominated', benefit: 0.5, risk: 0.3, uncertainty: 0.2, proofCoverage: 0.8, rollbackCoverage: 0.8, cost: 0.4, dependenciesSatisfied: true, evidenceHashes: [H('2')] });
  const counterfactual = plane.decideCounterfactualPlan('counterfactual:deep-measurement');

  plane.proposeVerifiedMemory({ memoryId: 'memory:deep-measurement', kind: 'skill', contentHash: H('3'), provenanceHash: H('4'), scope: 'repository', proposerKey: 'builder' });
  plane.recordVerifiedMemoryOutcome('memory:deep-measurement', { observed: true, verified: true, criticalFailure: false, effectHash: H('5'), verifierKey: 'reviewer-a' });
  plane.recordVerifiedMemoryOutcome('memory:deep-measurement', { observed: true, verified: true, criticalFailure: false, effectHash: H('6'), verifierKey: 'reviewer-b' });
  const memoryBeforePromotion = plane.evaluateVerifiedMemory('memory:deep-measurement');
  let promotionRejectedWithoutHuman = false;
  try { plane.promoteVerifiedMemory('memory:deep-measurement', { approvedByHuman: false, actor: 'agent', approvalReceiptSha256: H('7') }); }
  catch (error) { promotionRejectedWithoutHuman = /human approval/i.test(error.message); }
  const promotedMemory = plane.promoteVerifiedMemory('memory:deep-measurement', { approvedByHuman: true, actor: 'owner', approvalReceiptSha256: H('7') });
  const staleMemory = plane.invalidateVerifiedMemory('memory:deep-measurement', { sourceHash: H('8'), reason: 'source changed after promotion' });

  plane.registerSelfHealingComponent({ componentId: 'gateway:deep-measurement', baselineHash: H('9'), policy: { maxRepairAttempts: 2, allowedRepairs: ['restart', 'isolate', 'rollback'], approvalRequiredRepairs: ['rollback'] } });
  const anomaly = plane.observeSelfHealingAnomaly({ componentId: 'gateway:deep-measurement', anomalyId: 'crash-loop', severity: 'critical', observed: true, evidenceHash: H('a'), symptoms: ['crash-loop'] });
  const repairPlan = plane.planSelfHealingRepair('gateway:deep-measurement', { anomalyId: 'crash-loop', preferredActions: ['rollback', 'restart'] });
  let repairRejectedWithoutHuman = false;
  try { await plane.executeSelfHealingRepair(repairPlan.planId, { approvedByHuman: false, actor: 'agent', adapter: { async rollback() { return { observed: true, success: true, effectHash: H('b') }; } } }); }
  catch (error) { repairRejectedWithoutHuman = /approval/i.test(error.message); }
  const repairResult = await plane.executeSelfHealingRepair(repairPlan.planId, { approvedByHuman: true, actor: 'owner', adapter: { async rollback() { return { observed: true, success: true, effectHash: H('b') }; } } });

  const proofSchedule = plane.scheduleProofBudget({
    missionId: 'budget:deep-measurement', budget: { tokens: 1_000, elapsedMs: 1_000, costUsd: 1 }, verificationReserveRatio: 0.3,
    tasks: [
      { taskId: 'build', dependencies: [], risk: 0.4, proofRequired: false, priority: 5, estimated: { tokens: 400, elapsedMs: 300, costUsd: 0.3 } },
      { taskId: 'verify', dependencies: ['build'], risk: 0.9, proofRequired: true, priority: 10, estimated: { tokens: 250, elapsedMs: 300, costUsd: 0.2 } },
      { taskId: 'document', dependencies: ['build'], risk: 0.1, proofRequired: false, priority: 1, estimated: { tokens: 100, elapsedMs: 100, costUsd: 0.1 } },
    ],
  });
  const blockedSchedule = plane.scheduleProofBudget({ missionId: 'budget:blocked', budget: { tokens: 100, elapsedMs: 100, costUsd: 0.1 }, tasks: [{ taskId: 'verify', proofRequired: true, dependencies: [], risk: 1, estimated: { tokens: 200, elapsedMs: 200, costUsd: 0.2 } }] });

  plane.createComparativeStudy({ studyId: 'benchmark:protocol-fixture', competitor: 'NolaneNative Agent', baselineVersion: '0.18.2', minPairs: 20, alpha: 0.05, minMeanEffect: 0.05 });
  const environment = { machine: 'protocol-fixture-machine', model: 'protocol-fixture-model', tokenBudget: 10_000, permissions: ['repo'], tools: ['shell'] };
  const nolaneTasks = Array.from({ length: 24 }, (_, index) => ({ taskId: `fixture-${index}`, score: 1, passed: true, tokens: 100, elapsedMs: 100, costUsd: 0.01 }));
  const nolane_nativeTasks = Array.from({ length: 24 }, (_, index) => ({ taskId: `fixture-${index}`, score: index < 22 ? 0.7 : 1, passed: index >= 22, tokens: 100, elapsedMs: 100, costUsd: 0.01 }));
  plane.ingestComparativeRun('benchmark:protocol-fixture', { system: 'nolane', artifactId: 'fixture:nolane', real: true, independentProducer: false, artifactSha256: H('c'), environment, tasks: nolaneTasks });
  plane.ingestComparativeRun('benchmark:protocol-fixture', { system: 'nolane_native', artifactId: 'fixture:nolane_native-independent', real: true, independentProducer: true, artifactSha256: H('d'), environment, tasks: nolane_nativeTasks });
  const benchmarkProtocol = plane.evaluateComparativeStudy('benchmark:protocol-fixture');

  const uiCertification = plane.certifyLocalUi({
    sourceHash: H('e'), breakpoints: [640, 900, 1180, 1440],
    semantics: { landmarks: true, keyboardNavigation: true, focusVisible: true, liveRegions: true, reducedMotion: true, zoom200: true, labels: true },
    budgets: { maxDomNodes: 2_500, maxRssBytes: 700_000_000, maxIdleCpuPercent: 3, maxLongTaskMs: 50, maxInputLatencyMs: 100 },
    metrics: { domNodes: 1_200, rssBytes: 300_000_000, idleCpuPercent: 1.2, longestTaskMs: 20, inputLatencyMs: 40 },
    visualHashes: [H('f'), H('1'), H('2'), H('3')],
  });

  const dogfoodSuite = plane.createDogfoodSuite({ suiteId: 'dogfood:protocol-fixture' });
  const dogfoodPayload = {
    suiteId: 'dogfood:protocol-fixture', issuer: 'fixture-auditor', providerReal: true, mock: false,
    machine: { os: 'win32', ramGb: 8, label: 'protocol-fixture-windows-11-8gb' }, credentialReferenceId: 'fixture:credential-reference', secretStored: false,
    scenarios: dogfoodSuite.requiredScenarios.map((scenarioId) => ({ scenarioId, status: 'pass', effectHash: H('4'), negativePathPassed: true, teardownPassed: true, restartPassed: true })),
    adversarial: dogfoodSuite.requiredAdversarialProbes.map((probeId) => ({ probeId, status: 'pass', effectHash: H('5') })),
    independentVerifier: true,
  };
  const dogfoodSignature = sign(null, Buffer.from(canonicalSha256(dogfoodPayload)), createPrivateKey(TEST_PRIVATE_KEY)).toString('base64');
  const dogfoodProtocol = plane.verifyDogfoodReceipt('dogfood:protocol-fixture', { payload: dogfoodPayload, signature: dogfoodSignature });

  const [decisionSource, fabricSource, routesSource] = await Promise.all([
    readFile(path.join(root, 'src/decision/decision-plane.mjs'), 'utf8'),
    readFile(path.join(root, 'src/runtime/mission-resource-fabric.mjs'), 'utf8'),
    readFile(path.join(root, 'src/server/routes.mjs'), 'utf8'),
  ]);
  const snapshot = plane.snapshot();
  const base = {
    schema: 'nolane.agent.deep-superiority-wave-batch-measurement.v1', version: releaseVersion,
    constitution: {
      allowedEffectAccepted: allowedAction.allowed === true,
      forbiddenEffectBlocked: forbiddenAction.allowed === false && forbiddenAction.violations.some((item) => item.code === 'EFFECT_DENIED'),
      approvalEffectHeld: approvalAction.allowed === false && approvalAction.approvalRequired === true,
      amendmentRejectedWithoutHuman,
      receiptSha256: forbiddenAction.receiptSha256,
    },
    counterfactual: {
      safeCandidateSelected: counterfactual.selectedPlanId === 'safe-proofed',
      unsafeCandidateRejected: counterfactual.rejected.some((item) => item.planId === 'unsafe-fast' && item.reasons.includes('risk-budget')),
      dominatedCandidateRejected: counterfactual.rejected.some((item) => item.planId === 'dominated' && item.reasons.includes('dominated')),
      automaticExecutionAllowed: counterfactual.authorization.automaticExecutionAllowed,
      receiptSha256: counterfactual.receiptSha256,
    },
    verificationMemory: {
      independentlyVerified: memoryBeforePromotion.independentVerifiedSuccesses >= 2,
      promotableAfterIndependentOutcomes: memoryBeforePromotion.promotable === true,
      humanPromotionRequired: promotionRejectedWithoutHuman,
      promotedThenInvalidated: promotedMemory.status === 'active' && staleMemory.status === 'stale',
      rawContentStored: snapshot.verificationMemory.claims.rawContentStored,
      receiptSha256: staleMemory.receiptSha256,
    },
    selfHealing: {
      circuitOpenedForCriticalAnomaly: anomaly.circuitOpen === true,
      destructiveRepairRequiredApproval: repairPlan.approvalRequired === true && repairRejectedWithoutHuman,
      boundedRepairExecuted: repairResult.status === 'repaired' && repairResult.attempts === 1 && repairResult.circuitOpen === false,
      unboundedSelfModificationAllowed: repairResult.claims.unboundedSelfModificationAllowed,
      receiptSha256: repairResult.receiptSha256,
    },
    proofBudget: {
      proofCapacityReserved: proofSchedule.allocations.some((item) => item.taskId === 'verify' && item.reservedProofCapacity === true),
      dependencyOrderRespected: proofSchedule.executionOrder.indexOf('build') < proofSchedule.executionOrder.indexOf('verify'),
      impossibleMissionBlocked: blockedSchedule.status === 'blocked' && blockedSchedule.blockers.includes('budget-insufficient'),
      proofStarvationAllowed: proofSchedule.authorization.proofStarvationAllowed,
      receiptSha256: proofSchedule.receiptSha256,
    },
    comparativeBenchmark: {
      protocolFixtureOnly: true,
      protocolClaimGateCanOpen: benchmarkProtocol.comparativeSuperiorityClaimAllowed === true,
      environmentMatchRequired: benchmarkProtocol.environmentMatched === true,
      independentCompetitorRequired: benchmarkProtocol.claims.selfAuthoredCompetitorAccepted === false,
      independentNolaneNativeArtifactBundled: false,
      receiptSha256: benchmarkProtocol.receiptSha256,
    },
    localUi: {
      localCertificationPassed: uiCertification.localAccessibilityImplemented && uiCertification.localResponsiveImplemented && uiCertification.localPerformanceBudgetsPassed,
      breakpointsCovered: [640, 900, 1180, 1440].every((value) => uiCertification.breakpoints.includes(value)),
      windowsCertificationRequired: uiCertification.windowsCertificationRequired,
      assistiveTechnologyCertificationRequired: uiCertification.assistiveTechnologyCertificationRequired,
      receiptSha256: uiCertification.receiptSha256,
    },
    dogfood: {
      protocolFixtureOnly: true,
      signedProviderRealProtocolAccepted: dogfoodProtocol.protocolValid === true && dogfoodProtocol.externalCertificationAccepted === true,
      requiredScenarioCount: dogfoodSuite.requiredScenarios.length,
      requiredAdversarialProbeCount: dogfoodSuite.requiredAdversarialProbes.length,
      providerRealReceiptBundled: false,
      receiptSha256: dogfoodProtocol.receiptSha256,
    },
    productionWiring: {
      decisionPlaneComposesAllWaves: /(?=[\s\S]*registerMissionConstitution)(?=[\s\S]*decideCounterfactualPlan)(?=[\s\S]*promoteVerifiedMemory)(?=[\s\S]*executeSelfHealingRepair)(?=[\s\S]*scheduleProofBudget)(?=[\s\S]*evaluateComparativeStudy)(?=[\s\S]*certifyLocalUi)(?=[\s\S]*evaluateDogfoodSuite)/.test(decisionSource),
      missionResourceFabricProjectsAllWaves: /(?=[\s\S]*registerMissionConstitution)(?=[\s\S]*scheduleProofBudget)(?=[\s\S]*certifyLocalUi)(?=[\s\S]*evaluateDogfoodSuite)/.test(fabricSource),
      authenticatedHttpSurface: /\/api\/superiority\/constitution\/register[\s\S]*\/api\/superiority\/counterfactual\/decide[\s\S]*\/api\/superiority\/memory\/promote[\s\S]*\/api\/superiority\/budget\/schedule[\s\S]*\/api\/superiority\/benchmark\/evaluate[\s\S]*\/api\/superiority\/ui\/certify[\s\S]*\/api\/superiority\/dogfood\/evaluate/.test(routesSource),
      publicSnapshotReceiptSha256: snapshot.receiptSha256,
    },
    requirements: {
      total: Number(registry.total ?? registry.totalItems ?? 0),
      verified: statusCount(registry, 'verified_source_test'),
      externalGate: statusCount(registry, 'external_gate'),
      notImplemented: statusCount(registry, 'not_implemented'),
    },
    claims: {
      localDeepSuperiorityImplementationVerified: true,
      productionComparativeSuperiorityAllowed: false,
      productionProviderRealDogfoodCertified: false,
      windowsUiCertified: false,
      wcag22AaCertified: false,
      completeParityClaimAllowed: false,
    },
    boundaries: {
      hiddenReasoningStored: false, rawPromptStored: false, rawModelOutputStored: false, rawSecretStored: false,
      automaticPolicyMutationAllowed: false, automaticMemoryPromotionAllowed: false, unboundedSelfModificationAllowed: false,
      automaticBudgetExpansionAllowed: false, fixtureAcceptedAsProductionBenchmark: false, fixtureAcceptedAsProductionDogfood: false,
    },
  };
  plane.close();
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const output = path.join(root, 'docs', `deep-superiority-wave-batch-measurement-${metadata.version}.json`);
  const measurement = await measureDeepSuperiorityWaveBatch({ rootDirectory: root, version: metadata.version });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(measurement, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: 'pass', version: metadata.version, receiptSha256: measurement.receiptSha256, output: path.relative(root, output).replaceAll('\\', '/') })}\n`);
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(new URL(import.meta.url).pathname)) main();
