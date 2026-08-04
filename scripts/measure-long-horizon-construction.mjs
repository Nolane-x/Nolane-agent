import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { ConstructionControlPlane } from '../src/construction/construction-control-plane.mjs';

export async function measureLongHorizonConstruction({ rootDirectory = process.cwd(), version } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version);
  const capsuleRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-long-horizon-measurement-'));
  try {
    const plane = new ConstructionControlPlane({ capsuleRoot });
    const ready = plane.compileSpecification({
      specificationId: 'session-expiration',
      goal: 'Repair expired session behavior without changing the public API',
      criteria: [{ criterionId: 'expired-rejected', statement: 'Expired sessions are rejected', weight: 4 }],
      nonGoals: ['Rewrite the complete session subsystem'],
      constraints: [{ constraintId: 'api-stable', kind: 'hard', statement: 'Preserve public API', rule: 'preserve-public-api' }],
      interfaces: [{ interfaceId: 'session-api', path: 'src/session.mjs', compatibility: 'backward-compatible' }],
      invariants: [{ invariantId: 'no-secret-log', severity: 'critical', statement: 'Secrets are never logged', verifierId: 'secret-scan' }],
      verificationPlan: [{ verificationId: 'targeted-session-test', criterionIds: ['expired-rejected'], kind: 'test' }],
    });
    const blocked = plane.compileSpecification({
      specificationId: 'conflicting-rename', goal: 'Rename session API',
      criteria: [{ criterionId: 'renamed', statement: 'API is renamed', weight: 1 }],
      constraints: [
        { constraintId: 'stable', kind: 'hard', statement: 'Preserve API', rule: 'preserve-public-api' },
        { constraintId: 'rename', kind: 'hard', statement: 'Rename without adapter', rule: 'rename-public-api-without-adapter' },
      ],
      verificationPlan: [{ verificationId: 'rename-test', criterionIds: ['renamed'], kind: 'test' }],
    });

    plane.registerTraceNode(ready.specificationId, { type: 'decision', id: 'decision-1', receiptId: 'decision-receipt' });
    plane.registerTraceNode(ready.specificationId, { type: 'plan-step', id: 'step-1', receiptId: 'step-receipt' });
    plane.registerTraceNode(ready.specificationId, { type: 'symbol', id: 'validateSession', sourceHash: 'source-v1' });
    plane.registerTraceNode(ready.specificationId, { type: 'test', id: 'session-test', sourceHash: 'test-v1' });
    plane.registerTraceNode(ready.specificationId, { type: 'verification', id: 'targeted-session-test', status: 'passed', sourceHash: 'verify-v1', receiptId: 'verification-receipt' });
    const chain = [
      ['criterion', 'expired-rejected', 'decision', 'decision-1', 'drives'],
      ['decision', 'decision-1', 'plan-step', 'step-1', 'implemented-by'],
      ['plan-step', 'step-1', 'symbol', 'validateSession', 'changes'],
      ['symbol', 'validateSession', 'test', 'session-test', 'covered-by'],
      ['test', 'session-test', 'verification', 'targeted-session-test', 'verified-by'],
    ];
    for (const [fromType, fromId, toType, toId, relation] of chain) plane.linkTrace(ready.specificationId, { fromType, fromId, toType, toId, relation, receiptId: `${fromId}-${toId}` });
    const criterion = plane.criterionCompletion(ready.specificationId, 'expired-rejected', { currentSourceHashes: { 'targeted-session-test': 'verify-v1' } });

    plane.verifyInvariant(ready.specificationId, 'no-secret-log', { status: 'passed', sourceHash: ready.receiptSha256, receiptId: 'secret-scan-pass' });
    const invariantAllowed = plane.authorizeInvariants(ready.specificationId, { changedPaths: ['src/session.mjs'], currentSourceHashes: { 'no-secret-log': ready.receiptSha256 } });
    const invariantStale = plane.authorizeInvariants(ready.specificationId, { changedPaths: ['src/session.mjs'], currentSourceHashes: { 'no-secret-log': 'changed-source' } });

    const plan = plane.createPlan({
      planId: 'plan-1', missionId: 'mission-1', specificationId: ready.specificationId,
      repositoryFingerprint: 'repo-v1', assumptionReceiptSha256: 'assumption-v1',
      milestones: [{ milestoneId: 'm1', title: 'Session repair', capabilities: [{ capabilityId: 'cap1', title: 'Expiration correctness', contracts: [{ contractId: 'contract1', stepIds: ['step-1', 'step-2'] }] }] }],
      steps: [
        { stepId: 'step-1', milestoneId: 'm1', capabilityId: 'cap1', contractId: 'contract1', title: 'Apply bounded fix', dependencies: [], preconditions: ['root-cause-verified'], allowedFiles: ['src/session.mjs'], forbiddenChanges: ['public-api'], expectedState: 'targeted-test-pass', expectedEffect: 'Expired sessions are rejected', verificationIds: ['targeted-session-test'], maxAttempts: 1 },
        { stepId: 'step-2', milestoneId: 'm1', capabilityId: 'cap1', contractId: 'contract1', title: 'Run compatibility verification', dependencies: ['step-1'], preconditions: [], allowedFiles: ['tests/**'], forbiddenChanges: ['weaken-test'], expectedState: 'compatibility-pass', expectedEffect: 'Existing clients remain compatible', verificationIds: ['compatibility-test'], maxAttempts: 1 },
      ],
    });
    plane.transitionPlan(plan.planId, 'step-1', { type: 'start', preconditionsSatisfied: ['root-cause-verified'] });
    plane.transitionPlan(plan.planId, 'step-1', { type: 'begin-verification' });
    plane.transitionPlan(plan.planId, 'step-1', { type: 'verification-passed', receiptId: 'targeted-session-test-pass', actualState: 'targeted-test-pass' });
    const afterStep = plane.planSnapshot(plan.planId);
    const revalidation = plane.revalidatePlan(plan.planId, { repositoryFingerprint: 'repo-v2', assumptionReceiptSha256: 'assumption-v1' });

    const capsule = await plane.saveCapsule({
      capsuleId: 'capsule-1', missionId: 'mission-1', planId: plan.planId,
      planRevision: afterStep.revision, invariantRevision: 1, repositoryFingerprint: 'repo-v1',
      goal: ready.goal, completedCriterionIds: ['expired-rejected'], decisionReceiptIds: ['decision-receipt'],
      changedSymbolIds: ['validateSession'], verificationReceiptIds: ['verification-receipt'], residualRisks: [],
      gitCheckpoint: 'commit-base', nextStepIds: ['step-2'],
    });
    const exactResume = await plane.resumeCapsule(capsule.capsuleId, { planRevision: afterStep.revision, invariantRevision: 1, repositoryFingerprint: 'repo-v1', gitCheckpoint: 'commit-base' });
    const driftResume = await plane.resumeCapsule(capsule.capsuleId, { planRevision: afterStep.revision, invariantRevision: 1, repositoryFingerprint: 'repo-v2', gitCheckpoint: 'commit-base' });

    plane.registerObligation({ obligationId: 'compatibility-after-target', trigger: { type: 'verification', key: 'targeted-session-test', equals: 'passed' }, action: 'run compatibility suite', requiredVerificationIds: ['compatibility-test'] });
    const obligationObservation = plane.observeObligation({ eventId: 'verification-event', type: 'verification', key: 'targeted-session-test', value: 'passed', receiptId: 'targeted-session-test-pass' });
    const obligation = plane.completeObligation('compatibility-after-target', { verificationIds: ['compatibility-test'], receiptId: 'compatibility-pass' });

    const goals = plane.resolveGoalConflict({
      hardConstraints: [{ constraintId: 'api-stable' }], negotiableGoals: [{ goalId: 'speed', weight: 2 }, { goalId: 'clarity', weight: 1 }],
      options: [
        { optionId: 'break-api', satisfies: [], violates: ['api-stable'], tradeoffs: { speed: 1, clarity: 1 } },
        { optionId: 'adapter', satisfies: ['api-stable'], violates: [], tradeoffs: { speed: 0.7, clarity: 0.9 } },
      ],
    });

    const safePatch = plane.analyzePatch({ taskKind: 'bugfix', risk: 'low', changedFiles: 1, changedLines: 7, changedSymbols: ['validateSession'], callerCount: 2, controlFlowChanges: 1 });
    const dangerousPatch = plane.analyzePatch({ taskKind: 'bugfix', risk: 'high', changedFiles: 1, changedLines: 4, changedSymbols: ['validateSession'], publicApiChanges: [{ symbolId: 'validateSession', compatibility: 'breaking' }] });
    const overBudgetPatch = plane.analyzePatch({ taskKind: 'bugfix', risk: 'low', changedFiles: 3, changedLines: 120, changedSymbols: ['a', 'b', 'c'] });

    const correctnessSelection = plane.selectCandidate({ verificationContractSha256: 'contract-v1', candidates: [
      { candidateId: 'cheap-wrong', verificationContractSha256: 'contract-v1', isolated: true, isolationReceiptId: 'worktree-a', criticalInvariantFailures: 0, regressionFailures: 1, verifiedCriteriaScore: 4, requiredCriteriaScore: 4, semanticFootprint: 1, tokenCost: 1, rssMbSeconds: 1, editCost: 1, changedLines: 2 },
      { candidateId: 'safe-correct', verificationContractSha256: 'contract-v1', isolated: true, isolationReceiptId: 'worktree-b', criticalInvariantFailures: 0, regressionFailures: 0, verifiedCriteriaScore: 4, requiredCriteriaScore: 4, semanticFootprint: 4, tokenCost: 20, rssMbSeconds: 20, editCost: 5, changedLines: 7 },
    ] });
    const footprintSelection = plane.selectCandidate({ verificationContractSha256: 'contract-v2', candidates: [
      { candidateId: 'smaller-footprint', verificationContractSha256: 'contract-v2', isolated: true, isolationReceiptId: 'worktree-c', criticalInvariantFailures: 0, regressionFailures: 0, verifiedCriteriaScore: 4, requiredCriteriaScore: 4, semanticFootprint: 3, tokenCost: 100, rssMbSeconds: 100, editCost: 10, changedLines: 20 },
      { candidateId: 'cheaper-but-wide', verificationContractSha256: 'contract-v2', isolated: true, isolationReceiptId: 'worktree-d', criticalInvariantFailures: 0, regressionFailures: 0, verifiedCriteriaScore: 4, requiredCriteriaScore: 4, semanticFootprint: 8, tokenCost: 1, rssMbSeconds: 1, editCost: 1, changedLines: 3 },
    ] });

    const completeProof = plane.buildCompletionProof({ missionId: 'mission-1', specificationId: ready.specificationId, criteria: [{ criterionId: 'expired-rejected', complete: true, receiptSha256: criterion.receiptSha256 }], traceabilityReceiptSha256: plane.traceabilitySnapshot(ready.specificationId).receiptSha256, invariantVerification: invariantAllowed, changedSymbols: ['validateSession'], semanticFootprint: safePatch.report.semanticFootprint, decisionReceiptIds: ['decision-receipt'], verificationReceiptIds: ['verification-receipt'], residualRisks: [], limitations: ['Candidate worktrees are supplied by an external adapter'], rollbackPoint: 'commit-base' });
    const incompleteProof = plane.buildCompletionProof({ missionId: 'mission-1', specificationId: ready.specificationId, criteria: [{ criterionId: 'expired-rejected', complete: false }], changedSymbols: ['validateSession'], semanticFootprint: 1, rollbackPoint: '' });

    const app = await readFile(path.join(root, 'src/app.mjs'), 'utf8');
    const base = {
      schema: 'forge.studio.long-horizon-construction-measurement.v1', version: releaseVersion,
      specification: { readyStatus: ready.status, conflictBlocked: blocked.status === 'blocked' && blocked.editAuthorized === false, conflictCount: blocked.conflicts.length },
      traceability: { criterionCompleted: criterion.complete, verificationIds: criterion.verificationIds, receiptSha256: criterion.receiptSha256 },
      invariants: { currentAllows: invariantAllowed.allowed, staleBlocks: invariantStale.allowed === false && invariantStale.staleInvariantIds.includes('no-secret-log') },
      plan: { hierarchical: plan.milestones.length === 1, nextStepReady: afterStep.steps.find((item) => item.stepId === 'step-2')?.state === 'ready', repositoryDriftBlocks: revalidation.valid === false && revalidation.invalidReasons.includes('repository-fingerprint-changed') },
      capsule: { exactResume: exactResume.status === 'resumable', driftRequiresRevalidation: driftResume.status === 'revalidation-required', receiptSha256: capsule.receiptSha256 },
      obligation: { triggered: obligationObservation.triggeredObligationIds.includes('compatibility-after-target'), completedAfterTrigger: obligation.status === 'completed' },
      goals: { hardConstraintPreserved: goals.selectedOptionId === 'adapter', hardConstraintsWeakened: goals.claims.hardConstraintsWeakened },
      patch: { safePatchAllowed: safePatch.authorization.allowed, publicApiBreakBlocked: dangerousPatch.authorization.allowed === false, overBudgetBlocked: overBudgetPatch.authorization.allowed === false, safeSemanticFootprint: safePatch.report.semanticFootprint },
      candidates: { correctnessFirst: correctnessSelection.selectedCandidateId === 'safe-correct', semanticFootprintSelected: footprintSelection.selectedCandidateId === 'smaller-footprint', worktreesCreatedDirectly: correctnessSelection.claims.worktreesCreatedDirectly },
      proof: { completeWithReceipts: completeProof.status === 'complete' && completeProof.claims.completionClaimAllowed, incompleteWithoutReceipts: incompleteProof.status === 'incomplete' && incompleteProof.claims.completionClaimAllowed === false },
      lifecycle: plane.snapshot().lifecycle,
      composition: { appStaticImports: (app.match(/^import\s.+$/gm) ?? []).length, appConstructors: (app.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*/g) ?? []).length },
      boundaries: { directFileMutationClaimed: false, worktreeCreationClaimed: false, crossRebootProductionCertified: false, naturalLanguageUnderstandingClaimed: false, causalSimulationCompleteClaimed: false, hostedLifecycleClaimed: false, comparativeSuperiorityClaimed: false },
    };
    plane.close();
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  } finally {
    await rm(capsuleRoot, { recursive: true, force: true });
  }
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const releaseVersion = String(process.argv[4] ?? metadata.version);
  const output = path.resolve(root, process.argv[3] ?? `docs/long-horizon-construction-measurement-${releaseVersion}.json`);
  const report = await measureLongHorizonConstruction({ rootDirectory: root, version: releaseVersion });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ version: releaseVersion, output: path.relative(root, output).replaceAll('\\', '/'), receiptSha256: report.receiptSha256 })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
