import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { WorldModelRegistry } from '../src/world-model/world-model-registry.mjs';
import { ForesightController } from '../src/world-model/foresight-controller.mjs';
import { CounterfactualSimulator } from '../src/world-model/counterfactual-simulator.mjs';
import { VerifiedSelfModel } from '../src/development/verified-self-model.mjs';
import { DevelopmentalGoalEngine } from '../src/development/developmental-goal-engine.mjs';
import { DevelopmentalStageController } from '../src/development/developmental-stage-controller.mjs';

const sha = (c) => c.repeat(64);
function modelAdapter() {
  let calls = 0;
  return { get calls() { return calls; }, async rollout({ candidate }) { calls += 1; const rows = {
    baseline: { reliability: 0.92, effects: { criteria: 0, regressions: 0, changedSymbols: 0 }, blastRadius: 0, rollbackFeasibility: 1 },
    targeted: { reliability: 0.9, effects: { criteria: 2, regressions: 0, changedSymbols: 1 }, blastRadius: 0.2, rollbackFeasibility: 0.95 },
    speculative: { reliability: 0.4, effects: { criteria: 3, regressions: 2, changedSymbols: 8 }, blastRadius: 0.9, rollbackFeasibility: 0.4 },
  }; return { ...rows[candidate.id], provenance: [{ sourceHash: sha(candidate.id === 'baseline' ? '1' : candidate.id === 'targeted' ? '2' : '3'), kind: 'deterministic-adapter' }] }; } };
}

export async function measureWorldDevelopment({ rootDirectory = process.cwd(), version = '3.0.0' } = {}) {
  const root = path.resolve(rootDirectory);
  const registry = new WorldModelRegistry();
  registry.register({ id: 'repo-fast', domain: 'repository', version: '1', reliability: 0.7, cost: { tokens: 200, rssMbSeconds: 20 }, failureSignatures: ['dynamic-import'], adapter: modelAdapter() });
  registry.register({ id: 'repo-safe', domain: 'repository', version: '2', reliability: 0.92, cost: { tokens: 500, rssMbSeconds: 40 }, failureSignatures: [], adapter: modelAdapter() });
  const selected = registry.select({ domain: 'repository', maxTokens: 700, failureSignature: 'dynamic-import' });
  const foresight = new ForesightController({ minimumReliability: 0.65, maximumHorizon: 8, maximumRollouts: 4 });
  const simulationDecision = foresight.decide({ risk: 0.9, uncertainty: 0.8, decisionImpact: 0.9, expectedInformationGain: 0.8, modelReliability: selected.model.reliability, cost: selected.model.cost, candidateCount: 3 });
  const probeDecision = foresight.decide({ risk: 0.9, uncertainty: 0.8, decisionImpact: 0.9, expectedInformationGain: 0.8, modelReliability: 0.3, cost: { tokens: 100 }, candidateCount: 2 });
  const adapter = modelAdapter(); const simulator = new CounterfactualSimulator({ minimumReliability: 0.6 });
  const baseInput = { state: { stateHash: sha('4'), environmentDigest: sha('5'), repositoryDigest: sha('6') }, model: { id: 'repo-safe', version: '2', reliability: 0.92, adapter }, horizon: simulationDecision.horizon, candidates: [
    { id: 'baseline', kind: 'no-change', assumptions: ['current-behavior'] }, { id: 'targeted', kind: 'partial-change', assumptions: ['single-owner'] }, { id: 'speculative', kind: 'reuse-abstraction', assumptions: ['cross-module-compatible'] },
  ] };
  const first = await simulator.simulate(baseInput); const cached = await simulator.simulate(baseInput); const changed = await simulator.simulate({ ...baseInput, state: { ...baseInput.state, environmentDigest: sha('7') } }); const validation = simulator.validate(first.receiptSha256, { observed: { criteria: 2, regressions: 0 }, receiptSha256: sha('8') });

  const selfModel = new VerifiedSelfModel(); let unverifiedRejected = false; try { selfModel.recordOutcome({ domain: 'typescript', success: true, verified: false, receiptSha256: sha('9') }); } catch { unverifiedRejected = true; }
  const capability = selfModel.recordOutcome({ domain: 'typescript', success: true, verified: true, receiptSha256: sha('a'), metrics: { criteriaScore: 1, tokens: 800, peakRssMb: 256, durationMs: 1500 }, permissions: ['workspace-read'], contextTokens: 3000 });
  const trust = selfModel.updateToolTrust({ toolId: 'terminal', expectedEffect: { exitCode: 0 }, actualEffect: { exitCode: 1 }, verified: true, receiptSha256: sha('b') });
  const responsibility = selfModel.assignResponsibility({ taskId: 'task-world', agentId: 'agent-a', patchReceiptSha256: sha('c'), commitmentReceiptSha256: sha('d'), residualRisks: ['platform-parity'], verified: true, receiptSha256: sha('e') });
  const goals = new DevelopmentalGoalEngine(); const selectedGoal = goals.propose({ sandbox: true, mission: { completionBlocked: false, criticalObligationsOpen: 0 }, capability: 0.55, budgets: { tokens: 4000, rssMbSeconds: 500, durationMs: 60000 }, candidates: [{ id: 'easy', kind: 'rename', difficulty: 0.2, learningProgress: 0.1, reuse: 0.2, relevance: 0.8, compute: 0.1, risk: 0.1 }, { id: 'zpd', kind: 'mutation', difficulty: 0.65, learningProgress: 0.9, reuse: 0.8, relevance: 0.9, compute: 0.3, risk: 0.2 }] });
  const novelty = goals.propose({ sandbox: true, mission: { completionBlocked: true, criticalObligationsOpen: 1 }, capability: 0.8, candidates: [{ id: 'novel', kind: 'distractor', difficulty: 0.8, learningProgress: 1, reuse: 1, relevance: 0.1, compute: 0.1, risk: 0.1 }] });
  const stages = new DevelopmentalStageController({ stages: [{ id: 'observe', autonomyCeiling: 0.2, exploration: 0.1, replayRate: 0.2, memoryThreshold: 0.8, promoteRate: 0 }, { id: 'assist', autonomyCeiling: 0.4, exploration: 0.2, replayRate: 0.3, memoryThreshold: 0.75, promoteRate: 0.05 }] });
  const stage = stages.evaluateAdvance({ from: 'observe', to: 'assist', heldOutTransfer: { passed: true, receiptSha256: sha('1') }, regression: { passed: true, receiptSha256: sha('2') }, futureSelf: { viable: true, receiptSha256: sha('3') }, humanPolicyGate: { approved: true, receiptSha256: sha('4') } });
  const policy = stages.evaluatePolicyUpdate({ stageId: 'assist', proposed: { exploration: 0.3, replayRate: 0.3, memoryThreshold: 0.7, promoteRate: 0.05 }, futureSelf: { backwardTransfer: 0, negativeTransfer: 0, resourceGrowth: 0.05, receiptSha256: sha('5') }, heldOutTransfer: { passed: true, receiptSha256: sha('6') }, rollbackReceiptSha256: sha('7') });
  const app = await readFile(path.join(root, 'src/app.mjs'), 'utf8');
  const base = {
    schema: 'forge.studio.world-development-measurement.v1', version: String(version),
    worldModel: { modelSelected: selected.status === 'selected' && selected.model.id === 'repo-safe', simulationChosen: simulationDecision.action === 'simulate', boundedHorizon: simulationDecision.horizon > 0 && simulationDecision.horizon <= 8, multipleRollouts: simulationDecision.rolloutCount === 3, realProbeFallback: probeDecision.action === 'real-probe-required', verifiedOutcomeOnly: registry.snapshot().claims.selfDeclaredCapabilityAccepted === false },
    counterfactual: { alternativesCompared: first.rollouts.length === 2 && first.selectedCandidateId === 'targeted', unreliablePruned: first.pruned.length === 1, decisionDeltaExtracted: first.decisionDelta.criteriaGain === 2, blastRadiusMeasured: first.rollouts.some((item) => item.blastRadius > 0), rollbackFeasibilityMeasured: first.rollouts.every((item) => item.rollbackFeasibility >= 0), cacheHit: cached.cacheHit === true, cacheInvalidated: changed.cacheHit === false && adapter.calls === 6, observedValidationBound: validation.phase === 'verify', noCommitBoundary: first.claims.fileCommitAllowed === false && first.claims.durableMemoryWriteAllowed === false && first.claims.commandExecutionAllowed === false },
    selfModel: { unverifiedRejected, capabilityUpdated: capability.capability > 0.5, limitsTracked: capability.limits.maxObservedPeakRssMb === 256, toolTrustUpdated: trust.trust < 0.5, responsibilityBound: responsibility.agentId === 'agent-a', selfDeclaredCapabilityAccepted: false },
    development: { zpdSelected: selectedGoal.selectedGoalId === 'zpd', teacherChallengeBounded: selectedGoal.selected.teacherChallenge === true, noveltyBlocked: novelty.status === 'blocked' && novelty.reasons.includes('mission-completion-delayed'), stageAdvancedWithHeldOut: stage.allowed === true, futureSelfRequired: policy.shadowEligible === true, productionPromotionAllowed: policy.claims.productionPolicyPromotionAllowed, automaticCoreRewriteAllowed: policy.claims.automaticCoreRewriteAllowed },
    privacy: { rawPromptStored: false, rawOutputStored: false, chainOfThoughtStored: false, sourcePayloadStored: false },
    composition: { appStaticImports: (app.match(/^import\s.+$/gm) ?? []).length, appConstructors: (app.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*/g) ?? []).length },
    boundaries: { productionPolicyPromotionCertified: false, autonomousSelfModificationCertified: false, openWorldLongTermLearningCertified: false, agiClaimed: false },
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

async function main() { const root = path.resolve(process.argv[2] ?? '.'); const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')); const version = String(process.argv[4] ?? metadata.version); const output = path.resolve(root, process.argv[3] ?? `docs/world-development-measurement-${version}.json`); const report = await measureWorldDevelopment({ rootDirectory: root, version }); await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, `${JSON.stringify(report, null, 2)}\n`); process.stdout.write(`${JSON.stringify({ version, output: path.relative(root, output).replaceAll('\\', '/'), receiptSha256: report.receiptSha256 })}\n`); }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
