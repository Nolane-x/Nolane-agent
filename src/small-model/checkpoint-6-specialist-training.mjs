import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildCheckpoint6SpecialistDataset,
  buildCheckpoint6SpecialistSplit,
  CHECKPOINT_6_SPECIALISTS,
} from './checkpoint-6-specialist-dataset.mjs';
import { runCheckpoint6Ablation } from './checkpoint-6-ablation-runner.mjs';
import { trainLinearPolicy } from './linear-policy-trainer.mjs';
import { createModelArtifact, loadModelArtifact, serializeModelArtifact } from './model-artifact.mjs';
import { evaluateSpecialistArtifact } from './specialist-evaluation.mjs';
import { canonicalSha256, deepFreeze } from './shared.mjs';

const VERSION = 'multi-runtime-v1';
const DEFAULT_CONFIG = Object.freeze({ dimensions: 1024, epochs: 420, learningRate: 0.1, l2: 0.0001 });
const SHA256 = /^[a-f0-9]{64}$/;

function targetDir(root, specialist) { return path.join(root, specialist, VERSION); }
function withReceipt(base) { return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) }); }
function verifyReceipt(value, label) {
  if (!value || typeof value !== 'object' || !SHA256.test(String(value.receiptSha256 ?? ''))) throw new Error(`${label} receipt is missing`);
  const { receiptSha256, ...base } = value;
  if (canonicalSha256(base) !== receiptSha256) throw new Error(`${label} hash mismatch`);
  return value;
}

export async function trainCheckpoint6SpecialistSuite({
  repositoryTrajectoryDir = path.join(process.cwd(), 'datasets', 'trajectories', 'repository-v1'),
  multiRuntimeDir = path.join(process.cwd(), 'datasets', 'trajectories', 'multi-runtime-v1'),
  outputRoot = path.join(process.cwd(), 'models', 'specialists-checkpoint-6'),
  writeOutputs = false,
  trainingConfig = {},
  minLift = 0.1,
} = {}) {
  const specialists = {};
  for (const specialist of CHECKPOINT_6_SPECIALISTS) {
    const dataset = await buildCheckpoint6SpecialistDataset({ repositoryTrajectoryDir, multiRuntimeDir, specialist });
    const split = buildCheckpoint6SpecialistSplit({ dataset, seed: `forensic-recovery-checkpoint-6:${specialist}` });
    const config = { ...DEFAULT_CONFIG, ...trainingConfig, seed: `nolane-checkpoint-6-${specialist}-v1` };
    const model = trainLinearPolicy({ examples: split.train, ...config });
    const artifact = createModelArtifact({ model, datasetReceiptSha256: split.receiptSha256, trainingConfig: config, specialist });
    const validation = evaluateSpecialistArtifact({ artifact, examples: split.validation, independent: true, heldOut: true, minAccuracy: 0.8, baselineSafetyViolations: 0 });
    const heldOut = evaluateSpecialistArtifact({ artifact, examples: split.heldOut, independent: true, heldOut: true, minAccuracy: 0.8, baselineSafetyViolations: 0 });
    const ablation = runCheckpoint6Ablation({ artifact, train: split.train, heldOut: split.heldOut, minLift, baselineSafetyViolations: 0 });
    if (!validation.allowed || !heldOut.allowed) throw new Error(`Checkpoint 6 ${specialist} failed independent evaluation: validation=${validation.accuracy}, heldOut=${heldOut.accuracy}`);
    if (!ablation.allowed) throw new Error(`Checkpoint 6 ${specialist} failed ablation: ${ablation.reasons.join('; ')}`);
    const datasetReceipt = withReceipt({
      schema: 'nolane.small-model.checkpoint-6-specialist-dataset-receipt.v1',
      specialist,
      datasetReceiptSha256: dataset.receiptSha256,
      splitReceiptSha256: split.receiptSha256,
      labels: dataset.labels,
      counts: { total: dataset.examples.length, train: split.train.length, validation: split.validation.length, heldOut: split.heldOut.length },
      disjointBy: split.disjointBy,
      groupCounts: split.groups,
      lineage: dataset.lineage,
      hiddenChainOfThoughtStored: false,
    });
    const benchmark = withReceipt({
      schema: 'nolane.small-model.checkpoint-6-specialist-benchmark.v1',
      specialist,
      artifactSha256: artifact.artifactSha256,
      datasetReceiptSha256: datasetReceipt.receiptSha256,
      validation,
      heldOut,
      ablationReceiptSha256: ablation.receiptSha256,
      resourceProfile: { runtime: 'node-js-linear-policy', dimensions: model.dimensions, parameters: model.labels.length * model.dimensions + model.biases.length },
      lineage: dataset.lineage,
      claims: { boundedMultiRuntimeSpecialist: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    });
    specialists[specialist] = deepFreeze({ artifact, validation, heldOut, ablation, datasetReceipt, benchmark, split });
    if (writeOutputs) {
      const directory = targetDir(outputRoot, specialist);
      await mkdir(directory, { recursive: true });
      await Promise.all([
        writeFile(path.join(directory, 'model.json'), `${serializeModelArtifact(artifact)}\n`),
        writeFile(path.join(directory, 'benchmark.json'), `${JSON.stringify(benchmark, null, 2)}\n`),
        writeFile(path.join(directory, 'dataset-receipt.json'), `${JSON.stringify(datasetReceipt, null, 2)}\n`),
        writeFile(path.join(directory, 'ablation.json'), `${JSON.stringify(ablation, null, 2)}\n`),
      ]);
    }
  }
  const summaryBase = {
    schema: 'nolane.small-model.checkpoint-6-specialist-suite.v1',
    version: VERSION,
    specialistSummary: Object.fromEntries(Object.entries(specialists).map(([key, value]) => [key, {
      artifactSha256: value.artifact.artifactSha256,
      benchmarkReceiptSha256: value.benchmark.receiptSha256,
      datasetReceiptSha256: value.datasetReceipt.receiptSha256,
      ablationReceiptSha256: value.ablation.receiptSha256,
      validationAccuracy: value.validation.accuracy,
      heldOutAccuracy: value.heldOut.accuracy,
      lift: value.ablation.lift,
    }])),
    lineage: specialists['tool-router'].datasetReceipt.lineage,
    claims: { boundedMultiRuntimeSpecialistSuite: true, generalCodingIntelligence: false, competitorSuperiority: false },
  };
  return deepFreeze({ ...summaryBase, specialists, receiptSha256: canonicalSha256(summaryBase) });
}

export async function verifyCheckpoint6SpecialistSuite({ outputRoot = path.join(process.cwd(), 'models', 'specialists-checkpoint-6'), artifactOverrides = {} } = {}) {
  const artifactSha256BySpecialist = {};
  const benchmarkReceiptSha256BySpecialist = {};
  const ablationReceiptSha256BySpecialist = {};
  let lineageReceipt = null;
  for (const specialist of CHECKPOINT_6_SPECIALISTS) {
    const directory = targetDir(outputRoot, specialist);
    const [artifactBytes, benchmarkText, datasetText, ablationText] = await Promise.all([
      artifactOverrides[specialist] ? Promise.resolve(artifactOverrides[specialist]) : readFile(path.join(directory, 'model.json')),
      readFile(path.join(directory, 'benchmark.json'), 'utf8'),
      readFile(path.join(directory, 'dataset-receipt.json'), 'utf8'),
      readFile(path.join(directory, 'ablation.json'), 'utf8'),
    ]);
    const artifact = loadModelArtifact(artifactBytes);
    const benchmark = verifyReceipt(JSON.parse(benchmarkText), `${specialist} checkpoint 6 benchmark`);
    const datasetReceipt = verifyReceipt(JSON.parse(datasetText), `${specialist} checkpoint 6 dataset`);
    const ablation = verifyReceipt(JSON.parse(ablationText), `${specialist} checkpoint 6 ablation`);
    if (artifact.specialist !== specialist || benchmark.specialist !== specialist || datasetReceipt.specialist !== specialist || ablation.specialist !== specialist) throw new Error(`${specialist} checkpoint 6 identity mismatch`);
    if (benchmark.artifactSha256 !== artifact.artifactSha256 || ablation.artifactSha256 !== artifact.artifactSha256) throw new Error(`${specialist} checkpoint 6 artifact mismatch`);
    if (benchmark.datasetReceiptSha256 !== datasetReceipt.receiptSha256) throw new Error(`${specialist} checkpoint 6 dataset mismatch`);
    if (benchmark.ablationReceiptSha256 !== ablation.receiptSha256) throw new Error(`${specialist} checkpoint 6 ablation mismatch`);
    if (benchmark.validation?.allowed !== true || benchmark.heldOut?.allowed !== true || benchmark.validation?.accuracy < 0.8 || benchmark.heldOut?.accuracy < 0.8) throw new Error(`${specialist} checkpoint 6 held-out evidence is insufficient`);
    if (ablation.allowed !== true || ablation.lift < 0.1 || ablation.model?.safetyViolations > ablation.baselineEvaluation?.safetyViolations) throw new Error(`${specialist} checkpoint 6 ablation evidence is insufficient`);
    const lineage = datasetReceipt.lineage;
    if (!Array.isArray(lineage?.runtimes) || lineage.runtimes.length < 3 || !Array.isArray(lineage?.projects) || lineage.projects.length < 3 || lineage.mutationObserved !== true || lineage.recoveryObserved !== true) throw new Error(`${specialist} checkpoint 6 lineage is insufficient`);
    const lineageHash = canonicalSha256(lineage);
    lineageReceipt ??= lineageHash;
    if (lineageReceipt !== lineageHash) throw new Error('Checkpoint 6 specialist lineage mismatch');
    if (benchmark.claims?.generalCodingIntelligence !== false || benchmark.claims?.competitorSuperiority !== false) throw new Error(`${specialist} checkpoint 6 non-claims must remain locked`);
    artifactSha256BySpecialist[specialist] = artifact.artifactSha256;
    benchmarkReceiptSha256BySpecialist[specialist] = benchmark.receiptSha256;
    ablationReceiptSha256BySpecialist[specialist] = ablation.receiptSha256;
  }
  const base = {
    schema: 'nolane.small-model.checkpoint-6-specialist-suite-verification.v1',
    status: 'pass',
    lineageReceiptSha256: lineageReceipt,
    artifactSha256BySpecialist,
    benchmarkReceiptSha256BySpecialist,
    ablationReceiptSha256BySpecialist,
    claims: { generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
