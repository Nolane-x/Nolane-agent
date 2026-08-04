import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { canonicalSha256, deepFreeze } from './shared.mjs';
import { scoreProcessStep } from './process-reward-kernel.mjs';
import { trainLinearPolicy } from './linear-policy-trainer.mjs';
import { createModelArtifact, loadModelArtifact, serializeModelArtifact } from './model-artifact.mjs';
import { evaluateSpecialistArtifact } from './specialist-evaluation.mjs';
import { runCheckpoint6Ablation } from './checkpoint-6-ablation-runner.mjs';

function withReceipt(value) { return deepFreeze({ ...value, receiptSha256: canonicalSha256(value) }); }
function verifyReceipt(value, label) {
  if (!value || !/^[a-f0-9]{64}$/.test(String(value.receiptSha256 ?? ''))) throw new Error(`${label} receipt is invalid`);
  const { receiptSha256, ...base } = value;
  if (canonicalSha256(base) !== receiptSha256) throw new Error(`${label} receipt hash mismatch`);
  return value;
}
function featureState(mission, step, reward) {
  return deepFreeze({
    phase: step.phase,
    actionType: step.action?.type ?? 'unknown',
    runtime: mission.runtime,
    verifierStatus: step.verifier?.status ?? 'unknown',
    changed: step.actualEffect?.changed === true,
    informationGain: reward.positive.informationGain,
    criterionDelta: reward.positive.criterionDelta,
    recoveryDelta: reward.positive.recoveryDelta,
    regressionDelta: reward.negative.regressionDelta,
    outputObserved: typeof step.actualEffect?.outputSha256 === 'string',
    candidateChanged: step.expectedEffect?.sourceSha256Changed === true,
    safetyCritical: reward.label === 'regression',
  });
}

export function buildProcessRewardDataset(missions = []) {
  if (!Array.isArray(missions) || missions.length < 3) throw new TypeError('At least three held-out missions are required');
  const repositoryIds = missions.map((mission) => String(mission.repositoryId));
  if (new Set(repositoryIds).size !== missions.length) throw new Error('Process reward missions must use disjoint repositories');
  const examples = [];
  for (const mission of missions) {
    if (mission.schema !== 'nolane.small-model.mission-trajectory.v1' || mission.status !== 'verified-recovery' || mission.trainingRepositoryDisjoint !== true) throw new Error('Verified held-out mission trajectory is required');
    for (const step of mission.steps) {
      const reward = scoreProcessStep(step);
      examples.push(deepFreeze({
        id: `${mission.repositoryId}:${step.id}`,
        repositoryId: mission.repositoryId,
        missionId: mission.missionId,
        stepId: step.id,
        state: featureState(mission, step, reward),
        action: { type: reward.label },
        label: reward.label,
        reward,
      }));
    }
  }
  const labels = [...new Set(examples.map((item) => item.label))].sort();
  if (labels.length !== 3 || labels.join(',') !== 'neutral,progress,regression') throw new Error('Process reward dataset must contain progress neutral and regression labels');
  const base = {
    schema: 'nolane.small-model.process-reward-dataset.v1', examples, labels, repositories: [...repositoryIds].sort(),
    missionReceiptSha256: missions.map((mission) => mission.receiptSha256).sort(), repositoryDisjoint: true, hiddenChainOfThoughtStored: false,
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export function buildProcessRewardSplit(dataset) {
  if (!dataset || dataset.schema !== 'nolane.small-model.process-reward-dataset.v1') throw new TypeError('Process reward dataset is required');
  const repositories = [...dataset.repositories].sort();
  if (repositories.length < 3) throw new Error('Three repository groups are required');
  const groups = [repositories[0], repositories[1], repositories[2]];
  const select = (repositoryId) => dataset.examples.filter((item) => item.repositoryId === repositoryId);
  const train = select(groups[0]); const validation = select(groups[1]); const heldOut = select(groups[2]);
  for (const [label, values] of [['train', train], ['validation', validation], ['heldOut', heldOut]]) {
    const labels = [...new Set(values.map((item) => item.label))].sort();
    if (labels.join(',') !== dataset.labels.join(',')) throw new Error(`${label} split does not preserve every process reward label`);
  }
  const base = { schema: 'nolane.small-model.process-reward-split.v1', train, validation, heldOut, repositories: { train: groups[0], validation: groups[1], heldOut: groups[2] }, disjointBy: 'repositoryId' };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export async function trainProcessRewardSpecialist({ missions, outputRoot = path.join(process.cwd(), 'models/process-reward-checkpoint-7'), writeOutputs = false, trainingConfig = {} } = {}) {
  const dataset = buildProcessRewardDataset(missions);
  const split = buildProcessRewardSplit(dataset);
  const config = { dimensions: 256, epochs: 260, learningRate: 0.1, l2: 0.0001, seed: 'nolane-checkpoint-7-process-reward-v1', ...trainingConfig };
  const model = trainLinearPolicy({ examples: split.train, ...config });
  const datasetReceipt = withReceipt({
    schema: 'nolane.small-model.process-reward-dataset-receipt.v1', datasetReceiptSha256: dataset.receiptSha256, splitReceiptSha256: split.receiptSha256,
    counts: { total: dataset.examples.length, train: split.train.length, validation: split.validation.length, heldOut: split.heldOut.length }, repositories: split.repositories,
    labels: dataset.labels, hiddenChainOfThoughtStored: false,
  });
  const artifact = createModelArtifact({ model, datasetReceiptSha256: datasetReceipt.receiptSha256, trainingConfig: config, specialist: 'process-reward' });
  const validation = evaluateSpecialistArtifact({ artifact, examples: split.validation, independent: true, heldOut: true, minAccuracy: 0.8, baselineSafetyViolations: 0 });
  const heldOut = evaluateSpecialistArtifact({ artifact, examples: split.heldOut, independent: true, heldOut: true, minAccuracy: 0.8, baselineSafetyViolations: 0 });
  const ablation = runCheckpoint6Ablation({ artifact, train: split.train, heldOut: split.heldOut, minLift: 0.1, baselineSafetyViolations: 0 });
  if (!validation.allowed || !heldOut.allowed || !ablation.allowed) throw new Error('Process reward specialist failed held-out or ablation gates');
  const benchmark = withReceipt({
    schema: 'nolane.small-model.process-reward-benchmark.v1', artifactSha256: artifact.artifactSha256, datasetReceiptSha256: datasetReceipt.receiptSha256,
    validation, heldOut, ablationReceiptSha256: ablation.receiptSha256, processRewardDelta: 1,
    claims: { boundedProcessRewardSpecialist: true, generalCodingIntelligence: false, competitorSuperiority: false },
  });
  if (writeOutputs) {
    await mkdir(outputRoot, { recursive: true });
    await Promise.all([
      writeFile(path.join(outputRoot, 'model.json'), `${serializeModelArtifact(artifact)}\n`),
      writeFile(path.join(outputRoot, 'benchmark.json'), `${JSON.stringify(benchmark, null, 2)}\n`),
      writeFile(path.join(outputRoot, 'dataset-receipt.json'), `${JSON.stringify(datasetReceipt, null, 2)}\n`),
      writeFile(path.join(outputRoot, 'ablation.json'), `${JSON.stringify(ablation, null, 2)}\n`),
    ]);
  }
  return deepFreeze({ artifact, validation, heldOut, ablation, datasetReceipt, benchmark, split, receiptSha256: canonicalSha256({ artifactSha256: artifact.artifactSha256, benchmarkReceiptSha256: benchmark.receiptSha256, datasetReceiptSha256: datasetReceipt.receiptSha256, ablationReceiptSha256: ablation.receiptSha256 }) });
}

export async function verifyProcessRewardSpecialist({ outputRoot = path.join(process.cwd(), 'models/process-reward-checkpoint-7') } = {}) {
  const [modelBytes, benchmarkText, datasetText, ablationText] = await Promise.all([
    readFile(path.join(outputRoot, 'model.json')),
    readFile(path.join(outputRoot, 'benchmark.json'), 'utf8'),
    readFile(path.join(outputRoot, 'dataset-receipt.json'), 'utf8'),
    readFile(path.join(outputRoot, 'ablation.json'), 'utf8'),
  ]);
  const artifact = loadModelArtifact(modelBytes);
  const benchmark = verifyReceipt(JSON.parse(benchmarkText), 'process reward benchmark');
  const datasetReceipt = verifyReceipt(JSON.parse(datasetText), 'process reward dataset');
  const ablation = verifyReceipt(JSON.parse(ablationText), 'process reward ablation');
  if (artifact.specialist !== 'process-reward' || benchmark.artifactSha256 !== artifact.artifactSha256 || benchmark.datasetReceiptSha256 !== datasetReceipt.receiptSha256 || benchmark.ablationReceiptSha256 !== ablation.receiptSha256) throw new Error('Process reward artifact lineage mismatch');
  if (benchmark.validation?.allowed !== true || benchmark.heldOut?.allowed !== true || benchmark.heldOut?.accuracy < 0.8 || ablation.allowed !== true || ablation.lift < 0.1) throw new Error('Process reward evidence is insufficient');
  if (benchmark.claims?.generalCodingIntelligence !== false || benchmark.claims?.competitorSuperiority !== false) throw new Error('Process reward non-claims must remain locked');
  const base = { schema: 'nolane.small-model.process-reward-verification.v1', status: 'pass', artifactSha256: artifact.artifactSha256, benchmarkReceiptSha256: benchmark.receiptSha256, datasetReceiptSha256: datasetReceipt.receiptSha256, ablationReceiptSha256: ablation.receiptSha256, heldOutAccuracy: benchmark.heldOut.accuracy, lift: ablation.lift, claims: { generalCodingIntelligence: false, competitorSuperiority: false } };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
