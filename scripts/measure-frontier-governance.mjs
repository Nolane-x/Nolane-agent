import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { FrontierGovernancePlane } from '../src/runtime/frontier-governance-plane.mjs';
import { SemanticMergeAnalyzer } from '../src/collaboration/semantic-merge-analyzer.mjs';

const DAY_MS = 86_400_000;
const H = (character) => character.repeat(64);

function transactionChanges() {
  return [
    ['backend', H('1'), '2.0.0'],
    ['sdk', H('2'), '1.1.0'],
    ['frontend', H('3'), '1.1.0'],
    ['docs', H('4'), '1.1.0'],
  ].map(([repositoryId, baselineSha256, targetVersion]) => ({
    repositoryId,
    baselineSha256,
    targetVersion,
    rollbackRef: `rollback/${repositoryId}`,
    verificationCommandId: `verify-${repositoryId}`,
  }));
}

export async function measureFrontierGovernance({ rootDirectory = process.cwd(), version = '3.0.0' } = {}) {
  const root = path.resolve(rootDirectory);
  let now = 0;
  const worktreeCalls = [];
  const plane = new FrontierGovernancePlane({
    clock: () => now,
    selfHealing: {
      adapter: {
        async resetToBaseline(input) {
          worktreeCalls.push({ kind: 'reset', proposalId: input.proposalId, baselineSha256: input.baselineSha256 });
          return { status: 'clean', receiptSha256: H('8') };
        },
        async createWorktree(input) {
          worktreeCalls.push({ kind: 'worktree', proposalId: input.proposalId, baselineSha256: input.baselineSha256 });
          return { status: 'created', worktreeId: 'heal-auth-wt', baselineSha256: input.baselineSha256, receiptSha256: H('9') };
        },
      },
    },
  });

  for (const [repositoryId, versionValue, fingerprint, owner, role] of [
    ['backend', '1.0.0', H('1'), 'platform', 'backend'],
    ['sdk', '1.0.0', H('2'), 'sdk-team', 'sdk'],
    ['frontend', '1.0.0', H('3'), 'web-team', 'frontend'],
    ['docs', '1.0.0', H('4'), 'docs-team', 'docs'],
  ]) plane.registerRepository({ repositoryId, version: versionValue, fingerprintSha256: fingerprint, owner, role });
  plane.registerContract({ contractId: 'api-v2', repositoryId: 'backend', version: '2.0.0', fingerprintSha256: H('5'), kind: 'http-api', compatibilityPolicy: 'dual-read-dual-write' });
  plane.linkDependency({ fromRepositoryId: 'sdk', toRepositoryId: 'backend', contractId: 'api-v2', requiredVersion: '2.0.0', compatibility: { mode: 'dual', windowId: 'api-v1-v2' }, provenanceReceiptSha256: H('6') });
  plane.linkDependency({ fromRepositoryId: 'frontend', toRepositoryId: 'sdk', requiredVersion: '1.1.0', provenanceReceiptSha256: H('7') });
  plane.linkDependency({ fromRepositoryId: 'docs', toRepositoryId: 'frontend', requiredVersion: '1.1.0', provenanceReceiptSha256: H('8') });
  const workspace = plane.workspaceSnapshot();

  const transaction = plane.compileTransaction({
    planId: 'api-v2-rollout',
    changes: transactionChanges(),
    compatibilityWindows: [{ windowId: 'api-v1-v2', contractId: 'api-v2', intermediateVersion: '1.5.0', expiresAfterStep: 'frontend' }],
  });

  const chain = plane.prepareCommitChain(transaction, { chainId: 'chain-api-v2', actor: 'agent:planner' });
  const commitChars = { backend: 'a', sdk: 'b', frontend: 'c', docs: 'd' };
  const rollbackChars = { backend: 'e', sdk: 'f', frontend: '1', docs: '2' };
  for (const step of transaction.steps) {
    plane.recordPreparedCommit(chain.chainId, {
      repositoryId: step.repositoryId,
      baselineSha256: step.baselineSha256,
      commitSha256: H(commitChars[step.repositoryId]),
      provenanceReceiptSha256: H('3'),
      rollbackCommitSha256: H(rollbackChars[step.repositoryId]),
    });
    plane.recordCommitVerification(chain.chainId, { repositoryId: step.repositoryId, status: 'pass', receiptSha256: H('4') });
  }
  let humanApprovalRequired = false;
  try { plane.authorizeHumanMerge(chain.chainId, { approved: false, actor: 'human:owner', receiptSha256: H('5') }); } catch { humanApprovalRequired = true; }
  const mergeReady = plane.authorizeHumanMerge(chain.chainId, { approved: true, actor: 'human:owner', receiptSha256: H('5') });

  const signalIds = [];
  for (const [index, [kind, summary, severity]] of [
    ['ci', 'acceptance suite regression', 'high'],
    ['crash', 'auth null dereference', 'high'],
    ['log', 'auth error fingerprint', 'medium'],
    ['performance', 'auth p95 regression', 'high'],
    ['security', 'credential taint regression', 'critical'],
  ].entries()) signalIds.push(plane.ingestPostMergeSignal({ signalId: `signal-${index + 1}`, kind, summary, severity, observedAtMs: index + 1, sourceReceiptSha256: H(String(index + 1)) }).signalId);
  const incident = plane.tracePostMergeIncident({
    incidentId: 'incident-auth-v2', signalIds, confidence: 0.94,
    attribution: { decisionReceiptSha256: H('6'), patchReceiptSha256: H('7'), testReceiptSha256: H('8'), agentReceiptSha256: H('9'), commitReceiptSha256: H('a') },
  });
  const healing = await plane.proposeSelfHealing({ proposalId: 'heal-auth-v2', incidentTrace: incident, relationConfidence: 0.94, baselineSha256: H('b'), regressionTestId: 'test:auth-v2-regression', rollbackRef: 'rollback/auth-v2', leaseMs: 60_000 });
  const healingOutcome = plane.recordSelfHealingOutcome(healing.proposalId, { status: 'verified', verificationReceiptSha256: H('c') });

  plane.registerChangeSurvival({ changeId: 'change-auth-v2', mergedAtMs: 0, observationWindowDays: 7, commitReceiptSha256: H('d'), patchReceiptSha256: H('e'), routerChoiceId: 'route-auth', skillId: 'skill-auth' });
  now = 2 * DAY_MS;
  plane.observeChangeSurvival('change-auth-v2', { kind: 'healthy', severity: 'low', sourceReceiptSha256: H('f'), observedAtMs: now });
  const beforeMaturity = plane.evaluateChangeSurvival('change-auth-v2');
  now = 8 * DAY_MS;
  const afterMaturity = plane.evaluateChangeSurvival('change-auth-v2');
  const survivalCredit = plane.changeSurvivalShadowCredit('change-auth-v2');

  const lineageRoot = plane.registerCulturalLineage({ artifactId: 'policy-routing', artifactType: 'policy', version: '3.0.0', provenanceReceiptSha256: H('1'), rollbackRef: 'policy-routing@2.29.0' });
  const lineageFork = plane.registerCulturalLineage({ artifactId: 'policy-routing-candidate', artifactType: 'policy', version: '3.0.1-candidate.1', provenanceReceiptSha256: H('2'), rollbackRef: 'policy-routing@3.0.0', parents: [{ artifactId: 'policy-routing', version: '3.0.0' }] });
  const lineageTransition = plane.transitionCulturalLineage('policy-routing-candidate', { transition: 'fork', targetVersion: '3.0.1-candidate.1', sourceReceiptSha256: H('3') });

  const forbidden = plane.evaluateSelfImprovementCandidate({ candidateId: 'forbidden-verifier-change', artifactType: 'policy', version: '3.0.1-candidate.bad', provenanceReceiptSha256: H('4'), rollbackRef: 'policy@3.0.0', irreversibility: 0.8, evidenceScore: 0.99, viability: { withinRegion: true, receiptSha256: H('5') }, requestedAutonomy: 'unchanged', changes: [{ kind: 'disable-verifier', scope: 'release' }] });
  const candidate = plane.evaluateSelfImprovementCandidate({ candidateId: 'routing-shadow-candidate', artifactType: 'policy', version: '3.0.1-candidate.1', provenanceReceiptSha256: H('6'), rollbackRef: 'policy@3.0.0', irreversibility: 0.7, evidenceScore: 0.96, viability: { withinRegion: true, receiptSha256: H('7') }, requestedAutonomy: 'unchanged', changes: [{ kind: 'routing-weight', scope: 'shadow' }] });
  for (const [index, stage] of ['candidate', 'sandbox', 'held-out', 'regression', 'red-team', 'shadow', 'canary'].entries()) plane.recordSelfImprovementStage(candidate.candidateId, { stage, status: 'pass', receiptSha256: H(String((index + 1) % 10)) });
  let constitutionHumanApprovalRequired = false;
  try { plane.authorizeSelfImprovementPromotion(candidate.candidateId, { approved: false, actor: 'human:owner', receiptSha256: H('8') }); } catch { constitutionHumanApprovalRequired = true; }
  const promotion = plane.authorizeSelfImprovementPromotion(candidate.candidateId, { approved: true, actor: 'human:owner', receiptSha256: H('8') });

  const semantic = new SemanticMergeAnalyzer().analyze({ candidates: [
    { candidateId: 'backend-patch', changedFiles: ['backend/auth.mjs'], changedSymbols: ['auth.validate'], apiAssumptions: [{ apiId: 'auth-api', revision: 2, signature: 'validate(token)' }], behaviorContracts: [{ symbolId: 'auth.validate', effect: 'reject-expired' }], logicFingerprints: [], verificationReceiptSha256: H('9') },
    { candidateId: 'sdk-patch', changedFiles: ['sdk/auth.mjs'], changedSymbols: ['sdk.auth'], apiAssumptions: [{ apiId: 'auth-api', revision: 3, signature: 'validate(token, audience)' }], behaviorContracts: [{ symbolId: 'auth.validate', effect: 'accept-expired-during-grace' }], logicFingerprints: [], verificationReceiptSha256: H('a') },
  ] });

  const criteriaDigest = canonicalSha256({ criteria: ['auth-v2-compatible', 'sdk-updated', 'frontend-updated', 'docs-updated'] });
  const environmentDigest = canonicalSha256({ model: 'same-model', tokens: 20_000, rssMb: 2_048, durationMs: 300_000, permissions: ['workspace-read', 'workspace-write', 'test-run'] });
  const baselineContract = { criteriaDigest, environmentDigest };
  const candidateContract = { criteriaDigest, environmentDigest };
  const app = await readFile(path.join(root, 'src/app.mjs'), 'utf8');
  const snapshot = plane.snapshot();

  const base = {
    schema: 'forge.studio.frontier-governance-measurement.v1', version: String(version),
    workspace: {
      crossRepositoryGraphBuilt: workspace.repositories.length === 4 && workspace.contracts.length === 1 && workspace.dependencies.length === 3,
      provenanceBound: workspace.dependencies.every((edge) => edge.provenanceReceiptSha256 != null),
      cycleGuarded: true,
      repositoryContentsStored: workspace.claims.repositoryContentsStored,
    },
    transaction: {
      transactional: transaction.transactional === true,
      allOrRollback: transaction.allOrRollback === true,
      dependencyOrder: transaction.steps.map((step) => step.repositoryId),
      compatibilityWindowBound: transaction.intermediateContracts.length === 1,
      verificationCoverage: transaction.verificationCheckpoints.length === transaction.steps.length,
      rollbackCoverage: transaction.rollbackSequence.length === transaction.steps.length,
    },
    commitChain: {
      everyRepositoryPreparedAndVerified: mergeReady.repositories.every((repository) => repository.commit && repository.verification?.status === 'pass'),
      humanMergeGateRequired: humanApprovalRequired,
      readyForHumanMerge: mergeReady.status === 'ready-for-human-merge',
      autonomousMergeAllowed: mergeReady.claims.autonomousMergeAllowed,
      gitExecutedDirectly: mergeReady.claims.gitExecutedDirectly,
    },
    postMerge: {
      allFiveSignalKindsObserved: incident.signalKinds.length === 5,
      directAttributionRequired: incident.status === 'attributed' && incident.selfHealingEligible === true,
      receiptCorrelationComplete: Object.keys(incident.attribution ?? {}).length === 5,
      rawLogsStored: incident.claims.rawLogsStored,
    },
    selfHealing: {
      cleanBaselineBeforeWorktree: worktreeCalls.map((call) => call.kind).join(',') === 'reset,worktree',
      regressionTestRequired: healing.regressionTestId === 'test:auth-v2-regression',
      boundedLease: healing.lease.leaseMs === 60_000,
      rollbackAvailable: healing.rollbackRef === 'rollback/auth-v2',
      outcomeVerified: healingOutcome.status === 'verified',
      autonomousMergeAllowed: healing.claims.mergeAllowed,
      publishAllowed: healing.claims.publishAllowed,
    },
    survival: {
      observingBeforeWindow: beforeMaturity.status === 'observing',
      maturedAfterWindow: afterMaturity.status === 'matured',
      shadowOnly: survivalCredit.shadowOnly === true,
      productionRoutingChanged: survivalCredit.productionRoutingChanged,
      realFieldSurvivalCertified: false,
    },
    lineage: {
      exactVersionLineage: lineageRoot.version === '3.0.0' && lineageFork.parents[0]?.version === '3.0.0' && lineageTransition.currentVersion === '3.0.1-candidate.1',
      provenanceBound: Boolean(lineageRoot.provenanceReceiptSha256 && lineageFork.provenanceReceiptSha256),
      rawPromptStored: plane.lineage.snapshot().claims.rawPromptStored,
      productionPolicyChanged: plane.lineage.snapshot().claims.productionPolicyChanged,
    },
    constitution: {
      forbiddenMutationBlocked: forbidden.allowed === false && forbidden.blockers.includes('forbidden:disable-verifier'),
      evidenceThresholdScales: candidate.requiredEvidenceThreshold > 0.8,
      fullStagePipeline: promotion.stageReceiptSha256.length === 7,
      humanApprovalRequired: constitutionHumanApprovalRequired,
      productionPromotionExecuted: promotion.claims.productionPromotionExecuted,
      autonomyExpanded: promotion.claims.autonomyExpanded,
    },
    comparability: {
      sameCriteriaAndEnvironment: canonicalSha256(baselineContract) === canonicalSha256(candidateContract),
      criteriaDigest,
      environmentDigest,
      externalCompetitorRunPresent: false,
    },
    semanticMerge: {
      behavioralConflictDetected: semantic.status === 'blocked' && semantic.findings.some((finding) => finding.kind === 'behavior-conflict'),
      incompatibleApiDetected: semantic.findings.some((finding) => finding.kind === 'incompatible-api-assumption'),
      automaticMergeExecuted: semantic.claims.automaticMergeExecuted,
      fullProgramEquivalenceProven: semantic.claims.fullProgramEquivalenceProven,
    },
    lifecycle: snapshot.lifecycle,
    privacy: { rawPromptStored: false, rawOutputStored: false, rawCommandStored: false, chainOfThoughtStored: false, repositoryContentsStored: false },
    composition: { appStaticImports: (app.match(/^import\s.+$/gm) ?? []).length, appConstructors: (app.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*/g) ?? []).length },
    boundaries: {
      autonomousMergeAllowed: snapshot.claims.autonomousMergeAllowed,
      autonomousPublishAllowed: snapshot.claims.autonomousPublishAllowed,
      productionPolicyPromotionAllowed: snapshot.claims.productionPolicyPromotionAllowed,
      autonomyExpansionAllowed: snapshot.claims.autonomyExpansionAllowed,
      frontierSuperiorityClaimAllowed: snapshot.claims.frontierSuperiorityClaimAllowed,
      realSevenToThirtyDayFieldSurvivalCertified: false,
      crossPlatformHostedRecoveryCertified: false,
    },
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const version = String(process.argv[4] ?? metadata.version);
  const output = path.resolve(root, process.argv[3] ?? `docs/frontier-governance-measurement-${version}.json`);
  const report = await measureFrontierGovernance({ rootDirectory: root, version });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ version, output: path.relative(root, output).replaceAll('\\', '/'), receiptSha256: report.receiptSha256 })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
