import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { CognitiveKernel } from '../src/cognition/cognitive-kernel.mjs';
import { StructuredErrorRouter } from '../src/cognition/structured-error-router.mjs';
import { AgencyLedger } from '../src/cognition/agency-ledger.mjs';
import { evaluateStopGate } from '../src/cognition/cognitive-policy-gates.mjs';

export async function measureCognitiveDecisionKernel({ rootDirectory = process.cwd(), version } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version);
  let now = 1_000;
  const kernel = new CognitiveKernel({ clock: () => now, commitLimits: { files: 2, changedLines: 80 } });
  const taskId = 'measurement-cognitive-task';
  kernel.startTask({
    taskId,
    goal: 'repair an expired session without widening the patch',
    recoveryLeaseId: 'measurement-recovery-lease',
    recoveryLeaseTtlMs: 60_000,
    contexts: [
      { id: 'regression', probability: 0.5, claim: 'a code regression causes the failure' },
      { id: 'environment', probability: 0.5, claim: 'the test environment causes the failure' },
    ],
    hypotheses: [
      { id: 'cache', claim: 'cache invalidation is stale', probability: 0.55, predictions: ['cache-disabled probe passes'], falsificationCondition: 'cache-disabled probe still fails', testCost: 1 },
      { id: 'units', claim: 'expiration units are wrong', probability: 0.45, predictions: ['short ttl reproduces failure'], falsificationCondition: 'stored milliseconds are correct', testCost: 2 },
    ],
  });

  const before = kernel.snapshot(taskId);
  const actions = {
    uncertainty: 0.8,
    irreversibilityLimit: 0.2,
    actions: [
      { id: 'targeted-test', kind: 'probe', taskUtility: 0.55, informationGain: 0.95, tokenCost: 80, ramMbSeconds: 8, timeMs: 2_000, irreversibility: 0 },
      { id: 'read-twenty-files', kind: 'read', taskUtility: 0.25, informationGain: 0.35, tokenCost: 8_000, ramMbSeconds: 120, timeMs: 20_000, irreversibility: 0 },
      { id: 'rewrite-session-service', kind: 'patch', taskUtility: 0.9, informationGain: 0.2, tokenCost: 1_000, ramMbSeconds: 60, timeMs: 8_000, irreversibility: 0.9 },
    ],
  };
  const firstProposal = kernel.propose(taskId, actions);
  const firstVerified = kernel.verify(taskId, firstProposal.proposalId, {
    verificationProbeId: 'targeted-session-test',
    toolRunReceiptSha256: 'a'.repeat(64),
    declaredSuccess: true,
    effectProbes: [{ probeId: 'targeted-session-effect', independent: true, receiptSha256: 'b'.repeat(64), paths: ['targetTest'] }],
    scope: { files: 1, changedLines: 7 },
    expectedEffect: { targetTest: 'pass' },
    actualEffect: { targetTest: 'not-run' },
    verification: { targetedTests: 'pending' },
    blockedInvariantIds: [],
    rollbackPoint: 'measurement-base',
  });
  const deniedCommit = kernel.commit(taskId, firstVerified.verifiedProposalId);

  now += 100;
  kernel.observe(taskId, {
    eventId: 'evidence-1',
    type: 'evidence',
    contextEvidence: { evidenceId: 'evidence-1', supports: ['regression'], contradicts: ['environment'], supportLikelihood: 6, contradictionLikelihood: 0.15 },
    hypothesisEvidence: { evidenceId: 'evidence-1', supports: ['cache'], contradicts: ['units'], supportLikelihood: 4, contradictionLikelihood: 0.5 },
  });
  const survived = kernel.snapshot(taskId).hypothesisPopulation.hypotheses.find((item) => item.id === 'units');
  kernel.observe(taskId, { eventId: 'evidence-2', type: 'falsify-hypothesis', hypothesisId: 'units' });
  kernel.observe(taskId, { eventId: 'error-1', type: 'error', error: { category: 'missing-binary', code: 'ENOENT' } });
  kernel.observe(taskId, { eventId: 'strategy-1', type: 'strategy-failure', strategyFingerprint: 'repeat-broad-rewrite', failureReceiptId: 'failure-receipt-1' });
  const unverifiedAgencyObservation = kernel.observe(taskId, {
    eventId: 'agency-1', type: 'agency', agency: {
      actionId: 'action-1', taskId, intent: 'restart test server', commandKind: 'process-restart',
      commandFingerprint: 'sha256:measurement-command', expectedEffect: 'new listener appears', actualEffect: 'old listener remained',
      controllability: 0.25, responsibleActor: 'environment-supervisor',
    },
  });
  const recovery = kernel.tasks.get(taskId).recoveryLease.canUse('repeat-broad-rewrite');

  const secondProposal = kernel.propose(taskId, { ...actions, uncertainty: 0.15 });
  const secondVerified = kernel.verify(taskId, secondProposal.proposalId, {
    verificationProbeId: 'targeted-session-test',
    toolRunReceiptSha256: 'c'.repeat(64),
    declaredSuccess: true,
    effectProbes: [{ probeId: 'targeted-session-effect-final', independent: true, receiptSha256: 'd'.repeat(64), paths: ['targetTest', 'publicApi'] }],
    scope: { files: 1, changedLines: 7 },
    expectedEffect: { targetTest: 'pass', publicApi: 'unchanged' },
    actualEffect: { targetTest: 'pass', publicApi: 'unchanged' },
    verification: { targetedTests: 'passed', impactedTests: 'passed' },
    blockedInvariantIds: [],
    rollbackPoint: 'measurement-base',
    agency: {
      actionId: 'action-2', taskId, intent: 'apply bounded session fix', commandKind: 'atomic-patch',
      commandFingerprint: 'sha256:measurement-patch', expectedEffect: 'targeted test passes', actualEffect: 'targeted test passed',
      controllability: 0.95, responsibleActor: 'executor',
    },
  });
  const allowedCommit = kernel.commit(taskId, secondVerified.verifiedProposalId);
  const after = kernel.snapshot(taskId);
  const episode = kernel.episodes.get(allowedCommit.episodeId);

  const router = new StructuredErrorRouter();
  const missingBinary = router.route({ category: 'missing-binary', code: 'ENOENT' });
  const staleMemory = router.route({ category: 'stale-symbol-memory', code: 'STALE_SYMBOL' });
  const agencySnapshot = kernel.agency.snapshot();
  const agencyEntry = agencySnapshot.entries.find((entry) => entry.actionId === 'action-2');
  const source = await readFile(path.join(root, 'src/app.mjs'), 'utf8');
  const base = {
    schema: 'forge.studio.cognitive-decision-kernel-measurement.v1',
    version: releaseVersion,
    context: {
      memoryAllowedBefore: before.memoryWriteGate.allowed,
      memoryAllowedAfter: after.memoryWriteGate.allowed,
      entropyBefore: before.contextPosterior.normalizedEntropy,
      entropyAfter: after.contextPosterior.normalizedEntropy,
      leaderAfter: after.contextPosterior.contexts[0]?.id ?? null,
    },
    hypotheses: {
      alternativeSurvived: survived?.status === 'active' && survived.probability > 0,
      alternativeProbabilityBeforeFalsification: survived?.probability ?? 0,
      falsifiedExplicitly: after.hypothesisPopulation.hypotheses.find((item) => item.id === 'units')?.status === 'falsified',
      dominantAfter: after.hypothesisPopulation.dominantHypothesisId,
    },
    actions: {
      selectedProbe: firstProposal.selectedActionId,
      irreversibleRejected: firstProposal.selectedActionId !== 'rewrite-session-service',
      selectionReceiptSha256: firstProposal.selectionReceiptSha256,
    },
    errors: {
      missingBinaryPrimary: missingBinary.primarySubsystem,
      missingBinaryOwners: missingBinary.ownerMask,
      staleMemoryPrimary: staleMemory.primarySubsystem,
      staleMemoryOwners: staleMemory.ownerMask,
      unrelatedSubsystemsMasked: missingBinary.claims.unrelatedSubsystemsMasked,
    },
    agency: {
      unverifiedClaimExcluded: agencySnapshot.entries.every((entry) => entry.actionId !== 'action-1'),
      unverifiedClaimReceiptSha256: unverifiedAgencyObservation.effects.agencyClaim ?? null,
      verifiedEffectReceiptBound: agencyEntry?.effectVerificationReceiptSha256 === secondVerified.effectVerification.receiptSha256,
      expectedVerifiedMismatch: agencyEntry?.expectedEffect !== agencyEntry?.verifiedEffect,
      controllability: agencyEntry?.controllability ?? null,
      learningEligible: agencyEntry?.learningEligible ?? false,
      rawCommandStored: agencyEntry?.claims.rawCommandStored ?? true,
      receiptSha256: agencyEntry?.receiptSha256 ?? null,
    },
    episode: {
      bound: Boolean(episode),
      expectedEffectStored: episode?.expectedEffect?.targetTest === 'pass',
      actualEffectStored: episode?.actualEffect?.targetTest === 'pass',
      rollbackPoint: episode?.rollbackPoint ?? null,
      transcriptStored: episode?.claims.transcriptStored ?? true,
      receiptSha256: episode?.receiptSha256 ?? null,
    },
    recovery: {
      failedStrategyBanned: recovery.allowed === false,
      reason: recovery.reason,
      receiptSha256: recovery.receiptSha256,
    },
    commit: {
      deniedBeforeEvidence: deniedCommit.allowed === false,
      deniedReasons: deniedCommit.reasons,
      allowedAfterEvidence: allowedCommit.allowed === true,
      episodeId: allowedCommit.episodeId,
    },
    stop: {
      criteriaVerifiedStops: evaluateStopGate({ allCriteriaVerified: true, marginalInformationGain: 0.8, unresolvedCriticalRisks: 0 }).stop,
      lowInformationGainStops: evaluateStopGate({ allCriteriaVerified: false, marginalInformationGain: 0.01, minInformationGain: 0.05, unresolvedCriticalRisks: 0 }).stop,
      criticalRiskPreventsStop: evaluateStopGate({ allCriteriaVerified: false, marginalInformationGain: 0.01, minInformationGain: 0.05, unresolvedCriticalRisks: 1 }).stop === false,
    },
    lifecycle: {
      taskCount: kernel.snapshot().taskCount,
      cognitionClaims: kernel.snapshot().claims,
    },
    composition: {
      appStaticImports: (source.match(/^import\s.+$/gm) ?? []).length,
      appConstructors: (source.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*/g) ?? []).length,
    },
    boundaries: {
      chainOfThoughtStored: false,
      rawPromptsStored: false,
      autonomousSourceMutationClaimed: false,
      autonomousDurableMemoryClaimed: false,
      learnedPolicyClaimed: false,
      skillPromotionClaimed: false,
      causalInterventionProductionClaimed: false,
      comparativeSuperiorityClaimed: false,
    },
  };
  kernel.close();
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const releaseVersion = String(process.argv[4] ?? metadata.version);
  const output = path.resolve(root, process.argv[3] ?? `docs/cognitive-decision-kernel-measurement-${releaseVersion}.json`);
  const report = await measureCognitiveDecisionKernel({ rootDirectory: root, version: releaseVersion });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ output: path.relative(root, output).replaceAll('\\', '/'), receiptSha256: report.receiptSha256 })}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
