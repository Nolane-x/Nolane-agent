import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { SuperiorityPlane } from '../src/runtime/superiority-plane.mjs';

const H = (c) => c.repeat(64);

export async function measureNolaneProofIntelligence({ rootDirectory = process.cwd(), version } = {}) {
  const root = path.resolve(rootDirectory);
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const releaseVersion = String(version ?? metadata.version);
  let tick = 1000;
  const plane = new SuperiorityPlane({ clock: () => ++tick, modelGovernor: { limits: { minimumPromotionSamples: 3 } } });

  const plan = plane.compileProofMission({
    missionId: 'superiority-measurement', goal: 'Produce a proof-carrying verified change',
    rollback: { required: true, target: 'measurement-baseline' },
    criteria: [{ claimId: 'runtime', claim: 'Runtime behavior is correct', proposerKey: 'builder', positiveEvidenceKinds: ['direct-test'], falsificationProbeIds: ['mutation-kill'], minIndependentVerifiers: 1 }],
    invariants: [{ invariantId: 'privacy', claim: 'No private reasoning or secrets are persisted', evidenceKinds: ['security-test'] }],
  });
  const before = plane.evaluateProofMission(plan.planId);
  plane.recordProofEvidence(plan.planId, { claimId: 'runtime', evidenceType: 'positive', kind: 'direct-test', status: 'pass', observed: true, sourceHash: H('a'), effectHash: H('b'), verifierId: 'direct-verifier', independenceKey: 'verification-lane' });
  plane.recordProofEvidence(plan.planId, { claimId: 'runtime', evidenceType: 'falsification', probeId: 'mutation-kill', status: 'pass', observed: true, sourceHash: H('c'), effectHash: H('d'), verifierId: 'mutation-verifier', independenceKey: 'red-team-lane' });
  plane.recordProofEvidence(plan.planId, { claimId: 'invariant:privacy', evidenceType: 'positive', kind: 'security-test', status: 'pass', observed: true, sourceHash: H('e'), effectHash: H('f'), verifierId: 'security-verifier', independenceKey: 'security-lane' });
  const after = plane.evaluateProofMission(plan.planId);

  for (const node of [
    { nodeId: 'file:runtime', kind: 'file', locator: 'src/runtime.mjs' },
    { nodeId: 'symbol:execute', kind: 'symbol', locator: 'src/runtime.mjs#execute' },
    { nodeId: 'test:runtime', kind: 'test', locator: 'tests/runtime.test.mjs' },
    { nodeId: 'contract:runtime', kind: 'contract', locator: 'NOL-RUNTIME' },
  ]) plane.registerCausalTwinNode(node);
  plane.linkCausalTwin({ from: 'file:runtime', to: 'symbol:execute', relation: 'defines', confidence: 0.95, sourceHash: H('1') });
  plane.linkCausalTwin({ from: 'symbol:execute', to: 'test:runtime', relation: 'verified-by', confidence: 0.9, sourceHash: H('2') });
  plane.linkCausalTwin({ from: 'symbol:execute', to: 'contract:runtime', relation: 'implements', confidence: 0.85, sourceHash: H('3') });
  const impactBeforeInvalidation = plane.predictCausalImpact({ changedNodeIds: ['file:runtime'], minimumConfidence: 0.5 });
  const observedOutcome = plane.recordCausalOutcome({ predictionReceiptSha256: impactBeforeInvalidation.receiptSha256, observedNodeIds: ['symbol:execute', 'test:runtime'], observed: true, verificationReceiptSha256: H('4') });
  plane.invalidateCausalEvidence(H('2'));
  const impactAfterInvalidation = plane.predictCausalImpact({ changedNodeIds: ['file:runtime'], minimumConfidence: 0.5 });

  plane.openAdversarialTournament({ tournamentId: 'measurement-tournament', missionPlanReceiptSha256: after.receiptSha256, minimumProofCoverage: 0.9 });
  const baseCandidate = { proposerKey: 'builder', proofPlanReceiptSha256: after.receiptSha256, reversibility: { score: 0.95, rollbackReceiptSha256: H('5') } };
  plane.registerTournamentCandidate('measurement-tournament', { ...baseCandidate, candidateId: 'fast-but-unsafe', patchHash: H('6'), expectedEffectHash: H('7'), resourceCost: { tokens: 100, elapsedMs: 10 } });
  plane.registerTournamentCandidate('measurement-tournament', { ...baseCandidate, candidateId: 'verified-safe', patchHash: H('8'), expectedEffectHash: H('9'), resourceCost: { tokens: 180, elapsedMs: 20 } });
  plane.recordTournamentAttack('measurement-tournament', { candidateId: 'fast-but-unsafe', attackId: 'secret-exfiltration', severity: 'critical', status: 'confirmed', falsifierKey: 'red-team', evidenceHash: H('a') });
  plane.recordTournamentAttack('measurement-tournament', { candidateId: 'verified-safe', attackId: 'path-escape', severity: 'critical', status: 'refuted', falsifierKey: 'red-team', evidenceHash: H('b') });
  plane.recordTournamentVerification('measurement-tournament', { candidateId: 'fast-but-unsafe', status: 'pass', observed: true, proofCoverage: 1, correctnessScore: 0.99, verifierKey: 'judge-a', evidenceHash: H('c') });
  plane.recordTournamentVerification('measurement-tournament', { candidateId: 'verified-safe', status: 'pass', observed: true, proofCoverage: 0.96, correctnessScore: 0.97, verifierKey: 'judge-b', evidenceHash: H('d') });
  const tournament = plane.decideAdversarialTournament('measurement-tournament');

  for (const model of [
    { modelId: 'small', tier: 'small', privacy: 'remote', status: 'active', costPer1kTokens: 0.1, latencyMs: 40, baselineReliability: 0.88, capabilities: ['coding', 'verification'] },
    { modelId: 'large', tier: 'large', privacy: 'remote', status: 'active', costPer1kTokens: 2, latencyMs: 250, baselineReliability: 0.98, capabilities: ['coding', 'verification'] },
    { modelId: 'local', tier: 'local', privacy: 'local', status: 'active', costPer1kTokens: 0, latencyMs: 90, baselineReliability: 0.82, capabilities: ['coding', 'verification'] },
  ]) plane.registerGovernedModel(model);
  const easyRoute = plane.routeGovernedModel({ taskId: 'easy', taskFamily: 'coding', difficulty: 0.2, uncertainty: 0.1, blastRadius: 0.1, tokenBudget: 2000 });
  const riskyRoute = plane.routeGovernedModel({ taskId: 'risky', taskFamily: 'coding', difficulty: 0.9, uncertainty: 0.9, blastRadius: 0.9, verificationCritical: true, tokenBudget: 10000 });
  const privateRoute = plane.routeGovernedModel({ taskId: 'private', taskFamily: 'coding', difficulty: 0.3, uncertainty: 0.2, blastRadius: 0.2, privacyRequired: true, tokenBudget: 2000 });
  const modelOutcome = plane.recordGovernedModelOutcome({ routeReceiptSha256: easyRoute.receiptSha256, modelId: easyRoute.primaryModelId, observed: true, verified: true, verifierReceiptSha256: H('e'), latencyMs: 35, cost: 0.05 });

  const planeSnapshot = plane.snapshot();
  const decisionSource = await readFile(path.join(root, 'src/decision/decision-plane.mjs'), 'utf8');
  const routesSource = await readFile(path.join(root, 'src/server/routes.mjs'), 'utf8');
  const base = {
    schema: 'nolane.agent.nolane-proof-intelligence-measurement.v1',
    version: releaseVersion,
    proof: {
      deployDeniedBeforeEvidence: before.authorization.deployAllowed === false,
      deployAllowedAfterEvidence: after.authorization.deployAllowed === true,
      proofCoverage: after.proofCoverage,
      independentVerificationRequired: after.claims.every((claim) => claim.minIndependentVerifiers >= 1),
      rollbackBound: after.rollback.satisfied,
      receiptSha256: after.receiptSha256,
    },
    repositoryTwin: {
      predictedTest: impactBeforeInvalidation.requiredTestNodeIds.includes('test:runtime'),
      staleEdgeExcluded: !impactAfterInvalidation.requiredTestNodeIds.includes('test:runtime') && impactAfterInvalidation.excludedStaleEdges > 0,
      observedCalibrationRecorded: observedOutcome.truePositiveNodeIds.includes('test:runtime'),
      falsePositiveDetected: observedOutcome.falsePositiveNodeIds.includes('contract:runtime'),
      receiptSha256: impactAfterInvalidation.receiptSha256,
    },
    tournament: {
      criticalCandidateRejected: tournament.rejected.some((item) => item.candidateId === 'fast-but-unsafe' && item.reasons.includes('critical-counterexample-confirmed')),
      independentCandidateSelected: tournament.selectedCandidateId === 'verified-safe',
      automaticCommitAllowed: tournament.authorization.automaticCommitAllowed,
      receiptSha256: tournament.receiptSha256,
    },
    modelGovernor: {
      easyUsesSmall: easyRoute.primaryModelId === 'small',
      riskyUsesLarge: riskyRoute.primaryModelId === 'large',
      riskyUsesIndependentVerifier: riskyRoute.independentVerificationRequired && riskyRoute.verifierModelId && riskyRoute.verifierModelId !== riskyRoute.primaryModelId,
      privateUsesLocal: privateRoute.primaryModelId === 'local',
      verifiedOutcomeLearned: modelOutcome.verified === true,
      automaticPromotionAllowed: planeSnapshot.modelGovernor.claims.automaticPromotionAllowed,
      receiptSha256: modelOutcome.receiptSha256,
    },
    productionWiring: {
      decisionPlaneLazyIntegration: /(?=[\s\S]*superiorityLoaded)(?=[\s\S]*compileProofMission)(?=[\s\S]*routeGovernedModel)/.test(decisionSource),
      authenticatedHttpSurface: /\/api\/superiority\/proof\/compile[\s\S]*\/api\/superiority\/tournament\/decide[\s\S]*\/api\/superiority\/models\/route/.test(routesSource),
      publicSnapshotReceiptSha256: planeSnapshot.receiptSha256,
    },
    comparativeReadiness: {
      independentReferenceArtifactPresent: false,
      sameModelMachineTokenPermissionContractRequired: true,
      claimAllowed: false,
    },
    boundaries: {
      hiddenReasoningStored: false,
      rawPromptStored: false,
      rawModelOutputStored: false,
      automaticSourceMutationClaimed: false,
      automaticCommitClaimed: false,
      automaticDeploymentClaimed: false,
      automaticModelPromotionClaimed: false,
      comparativeSuperiorityClaimed: false,
    },
  };
  plane.close();
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const version = String(process.argv[4] ?? metadata.version);
  const output = path.resolve(root, process.argv[3] ?? `docs/nolane-proof-intelligence-measurement-${version}.json`);
  const report = await measureNolaneProofIntelligence({ rootDirectory: root, version });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ output: path.relative(root, output).replaceAll('\\', '/'), receiptSha256: report.receiptSha256 })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
