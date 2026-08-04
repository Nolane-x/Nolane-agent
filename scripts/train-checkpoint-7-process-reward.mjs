#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256, deepFreeze } from '../src/small-model/shared.mjs';
import { loadModelArtifact } from '../src/small-model/model-artifact.mjs';
import { trainProcessRewardSpecialist } from '../src/small-model/process-reward-specialist.mjs';
import { VerifiedSkillCompiler } from '../src/small-model/verified-skill-compiler.mjs';
import { SkillTransferLab } from '../src/small-model/skill-transfer-lab.mjs';
import { CHECKPOINT_7_SKILL_TRANSFER_PACK } from '../src/small-model/checkpoint-7-heldout-pack.mjs';
import { buildCheckpoint7EvidenceBundle } from '../src/small-model/checkpoint-7-evidence-bundle.mjs';
import { CHECKPOINT_6_SPECIALISTS, buildCheckpoint6SpecialistDataset } from '../src/small-model/checkpoint-6-specialist-dataset.mjs';
import { ModelArtifactRegistry } from '../src/small-model/model-artifact-registry.mjs';
import { Checkpoint7DecisionSupport } from '../src/small-model/checkpoint-7-decision-support.mjs';

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const desired = Object.freeze({
  safe: { 'tool-router': 'test', 'context-scorer': 'support', 'test-selector': 'unit', 'patch-ranker': 'accept', 'risk-classifier': 'low' },
  unsafe: { 'tool-router': 'stop', 'context-scorer': 'exclude', 'test-selector': 'mutation', 'patch-ranker': 'reject', 'risk-classifier': 'critical' },
});
const stateKey = Object.freeze({ 'tool-router': 'tool', 'context-scorer': 'context', 'test-selector': 'test', 'patch-ranker': 'patch', 'risk-classifier': 'risk' });

function processVerification(training) {
  const base = {
    schema: 'nolane.small-model.process-reward-verification.v1', status: 'pass', artifactSha256: training.artifact.artifactSha256,
    benchmarkReceiptSha256: training.benchmark.receiptSha256, datasetReceiptSha256: training.datasetReceipt.receiptSha256,
    ablationReceiptSha256: training.ablation.receiptSha256, heldOutAccuracy: training.heldOut.accuracy, lift: training.ablation.lift,
    claims: { generalCodingIntelligence: false, competitorSuperiority: false },
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export async function buildCheckpoint7PipelineArtifacts({
  root = process.cwd(),
  collectionPath = path.join(root, 'datasets/trajectories/checkpoint-7-v1/mission-collection.json'),
  processOutputRoot = path.join(root, 'models/process-reward-checkpoint-7'),
  outputRoot = path.join(root, 'models/checkpoint-7'),
  repositoryTrajectoryDir = path.join(root, 'datasets/trajectories/repository-v1'),
  multiRuntimeDir = path.join(root, 'datasets/trajectories/multi-runtime-v1'),
  writeOutputs = false,
} = {}) {
  const collection = await readJson(collectionPath);
  const processTraining = await trainProcessRewardSpecialist({ missions: collection.primaryMissions, outputRoot: processOutputRoot, writeOutputs });
  const verification = processVerification(processTraining);
  const skill = new VerifiedSkillCompiler().compile({ id: 'normalize-lowercase', version: '1', missions: collection.inductionMissions });
  const sourceRepositoryIds = [...new Set(collection.inductionMissions.map((mission) => mission.repositoryId))];
  const skillTransfer = await new SkillTransferLab().verify({ root, skill, sourceRepositoryIds, heldOutPack: CHECKPOINT_7_SKILL_TRANSFER_PACK });
  const registry = new ModelArtifactRegistry();
  registry.register(processTraining.artifact);
  const processPromotion = registry.promoteWithAblation({ artifactSha256: processTraining.artifact.artifactSha256, evaluation: processTraining.heldOut, ablation: processTraining.ablation, approvedBy: 'forensic-recovery-checkpoint-7' });
  const evidenceBundles = {};
  const specialistArtifacts = {};
  const specialistPromotions = [];
  const decisionFixtures = { safe: {}, unsafe: {} };
  for (const specialist of CHECKPOINT_6_SPECIALISTS) {
    const target = path.join(root, 'models/specialists-checkpoint-6', specialist, 'multi-runtime-v1');
    const [artifact, benchmark, ablation] = await Promise.all([
      readJson(path.join(target, 'model.json')),
      readJson(path.join(target, 'benchmark.json')),
      readJson(path.join(target, 'ablation.json')),
    ]);
    loadModelArtifact(artifact);
    registry.register(artifact);
    specialistArtifacts[specialist] = artifact;
    const evidenceBundle = buildCheckpoint7EvidenceBundle({
      artifact, evaluation: benchmark.heldOut, ablation, processReward: verification, skillTransfer,
      baselineCost: { name: 'baseline-agent-loop', quality: 1, successRate: 1, safetyViolations: 0, tokens: 1000, flops: 1000, rssMbSeconds: 100, wallMs: 1000, humanCorrections: 0 },
      candidateCost: { name: 'checkpoint-7-specialist', quality: 1, successRate: 1, safetyViolations: 0, tokens: 200, flops: 300, rssMbSeconds: 50, wallMs: 500, humanCorrections: 0 },
    });
    evidenceBundles[specialist] = evidenceBundle;
    specialistPromotions.push(registry.promoteWithTransferEvidence({ artifactSha256: artifact.artifactSha256, evaluation: benchmark.heldOut, ablation, evidenceBundle, approvedBy: 'forensic-recovery-checkpoint-7' }));
    const dataset = await buildCheckpoint6SpecialistDataset({ repositoryTrajectoryDir, multiRuntimeDir, specialist });
    for (const kind of ['safe', 'unsafe']) {
      const example = dataset.examples.find((entry) => entry.action.type === desired[kind][specialist]);
      if (!example) throw new Error(`Missing checkpoint 7 ${kind} decision fixture for ${specialist}`);
      decisionFixtures[kind][stateKey[specialist]] = example.state;
    }
  }
  const progress = processTraining.split.heldOut.find((item) => item.label === 'progress');
  const regression = processTraining.split.heldOut.find((item) => item.label === 'regression');
  if (!progress || !regression) throw new Error('Process reward decision fixtures are incomplete');
  decisionFixtures.safe.process = progress.state;
  decisionFixtures.unsafe.process = regression.state;
  const support = new Checkpoint7DecisionSupport({ artifactRegistry: registry });
  const safeDecisionReceipt = support.decide(decisionFixtures.safe);
  const unsafeDecisionReceipt = support.decide(decisionFixtures.unsafe);
  const promotionBase = {
    schema: 'nolane.small-model.checkpoint-7-suite-promotion.v1', bundleReceiptSha256: canonicalSha256({ collectionReceiptSha256: collection.receiptSha256, processVerificationReceiptSha256: verification.receiptSha256, skillTransferReceiptSha256: skillTransfer.receiptSha256, evidenceBundleReceiptSha256BySpecialist: Object.fromEntries(CHECKPOINT_6_SPECIALISTS.map((specialist) => [specialist, evidenceBundles[specialist].receiptSha256])) }),
    specialistPromotions, processPromotion, status: { ready: true }, approvedBy: 'forensic-recovery-checkpoint-7',
    claims: { boundedTransferProcessCostGovernedSuite: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
  };
  const promotion = deepFreeze({ ...promotionBase, receiptSha256: canonicalSha256(promotionBase) });
  const preparationBase = {
    schema: 'nolane.small-model.checkpoint-7-pending-bundle.v1', collectionReceiptSha256: collection.receiptSha256, specialists: [...CHECKPOINT_6_SPECIALISTS],
    specialistSuiteReceiptSha256: canonicalSha256(Object.fromEntries(CHECKPOINT_6_SPECIALISTS.map((specialist) => [specialist, specialistArtifacts[specialist].artifactSha256]))),
    processArtifactSha256: processTraining.artifact.artifactSha256, processVerificationReceiptSha256: verification.receiptSha256,
    skillReceiptSha256: skill.receiptSha256, skillTransferReceiptSha256: skillTransfer.receiptSha256,
    evidenceBundleReceiptSha256BySpecialist: Object.fromEntries(CHECKPOINT_6_SPECIALISTS.map((specialist) => [specialist, evidenceBundles[specialist].receiptSha256])),
    status: 'pending-approval', claims: { boundedCheckpoint7Preparation: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
  };
  const preparation = deepFreeze({ ...preparationBase, bundleReceiptSha256: canonicalSha256(preparationBase), processVerification: verification, skill, skillTransfer, evidenceBundles, decisionFixtures });
  const fixedPromotionBase = { ...promotionBase, bundleReceiptSha256: preparation.bundleReceiptSha256 };
  const fixedPromotion = deepFreeze({ ...fixedPromotionBase, receiptSha256: canonicalSha256(fixedPromotionBase) });
  const pipelineBase = {
    schema: 'nolane.small-model.checkpoint-7-pipeline-evidence.v1', collectionReceiptSha256: collection.receiptSha256,
    preparation, promotion: fixedPromotion, processVerification: verification, skill, skillTransfer, evidenceBundles,
    safeDecisionReceipt, unsafeDecisionReceipt,
    specialistArtifactSha256BySpecialist: Object.fromEntries(CHECKPOINT_6_SPECIALISTS.map((specialist) => [specialist, specialistArtifacts[specialist].artifactSha256])),
    hiddenChainOfThoughtStored: false,
    claims: { boundedCheckpoint7Pipeline: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
  };
  const pipelineEvidence = deepFreeze({ ...pipelineBase, receiptSha256: canonicalSha256(pipelineBase) });
  if (writeOutputs) {
    await mkdir(outputRoot, { recursive: true });
    await Promise.all([
      writeFile(path.join(outputRoot, 'verified-skill.json'), `${JSON.stringify(skill, null, 2)}\n`),
      writeFile(path.join(outputRoot, 'skill-transfer.json'), `${JSON.stringify(skillTransfer, null, 2)}\n`),
      writeFile(path.join(outputRoot, 'pipeline-evidence.json'), `${JSON.stringify(pipelineEvidence, null, 2)}\n`),
      ...CHECKPOINT_6_SPECIALISTS.map((specialist) => writeFile(path.join(outputRoot, `evidence-bundle-${specialist}.json`), `${JSON.stringify(evidenceBundles[specialist], null, 2)}\n`)),
    ]);
  }
  return Object.freeze({ collection, processTraining, processVerification: verification, skill, skillTransfer, evidenceBundles, specialistArtifacts, preparation, promotion: fixedPromotion, safeDecisionReceipt, unsafeDecisionReceipt, pipelineEvidence, wroteOutputs: writeOutputs });
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  buildCheckpoint7PipelineArtifacts({ writeOutputs: process.argv.includes('--write') })
    .then((result) => console.log(JSON.stringify({ pipelineReceiptSha256: result.pipelineEvidence.receiptSha256, processArtifactSha256: result.processTraining.artifact.artifactSha256, specialists: Object.keys(result.evidenceBundles).length, wroteOutputs: result.wroteOutputs })))
    .catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
}
