import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildRepositorySpecialistDataset, buildRepositorySpecialistSplit, REPOSITORY_SPECIALISTS } from './repository-specialist-suite-dataset.mjs';
import { trainLinearPolicy } from './linear-policy-trainer.mjs';
import { createModelArtifact, loadModelArtifact, serializeModelArtifact } from './model-artifact.mjs';
import { evaluateSpecialistArtifact } from './specialist-evaluation.mjs';
import { canonicalSha256, deepFreeze } from './shared.mjs';

const DEFAULT_CONFIG = Object.freeze({ dimensions: 512, epochs: 360, learningRate: 0.11, l2: 0.0001 });
const VERSION = 'repository-v1';
function targetDir(root, specialist) { return path.join(root, specialist, VERSION); }
function withReceipt(base) { return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export async function trainRepositorySpecialistSuite({
  trajectoryDir = path.join(process.cwd(), 'datasets', 'trajectories', 'repository-v1'),
  outputRoot = path.join(process.cwd(), 'models', 'specialists-repository'),
  writeOutputs = false,
  trainingConfig = {},
} = {}) {
  const specialists = {};
  for (const specialist of REPOSITORY_SPECIALISTS) {
    const dataset = await buildRepositorySpecialistDataset({ trajectoryDir, specialist });
    const split = buildRepositorySpecialistSplit({ dataset, seed: `forensic-recovery-checkpoint-5:${specialist}` });
    const config = { ...DEFAULT_CONFIG, ...trainingConfig, seed: `nolane-repository-${specialist}-v1` };
    const model = trainLinearPolicy({ examples: split.train, ...config });
    const artifact = createModelArtifact({ model, datasetReceiptSha256: split.receiptSha256, trainingConfig: config, specialist });
    const validation = evaluateSpecialistArtifact({ artifact, examples: split.validation, independent: true, heldOut: true, minAccuracy: 0.8, baselineSafetyViolations: 0 });
    const heldOut = evaluateSpecialistArtifact({ artifact, examples: split.heldOut, independent: true, heldOut: true, minAccuracy: 0.8, baselineSafetyViolations: 0 });
    if (!validation.allowed || !heldOut.allowed) throw new Error(`Repository ${specialist} failed independent evaluation: validation=${validation.accuracy}, heldOut=${heldOut.accuracy}`);
    const datasetReceipt = withReceipt({
      schema: 'nolane.small-model.repository-specialist-dataset-receipt.v1',
      specialist,
      trajectoryDatasetReceiptSha256: dataset.trajectoryDatasetReceiptSha256,
      datasetReceiptSha256: dataset.receiptSha256,
      splitReceiptSha256: split.receiptSha256,
      labels: dataset.labels,
      counts: { total: dataset.examples.length, train: split.train.length, validation: split.validation.length, heldOut: split.heldOut.length },
      disjointBy: split.disjointBy,
      groupCounts: split.groups,
      hiddenChainOfThoughtStored: false,
    });
    const benchmark = withReceipt({
      schema: 'nolane.small-model.repository-specialist-benchmark.v1',
      specialist,
      artifactSha256: artifact.artifactSha256,
      datasetReceiptSha256: datasetReceipt.receiptSha256,
      validation,
      heldOut,
      resourceProfile: { runtime: 'node-js-linear-policy', dimensions: model.dimensions, parameters: model.labels.length * model.dimensions + model.biases.length },
      lineage: { trajectoryDatasetReceiptSha256: dataset.trajectoryDatasetReceiptSha256, observedEpisodes: dataset.examples.length },
      claims: { boundedRepositorySpecialist: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    });
    specialists[specialist] = deepFreeze({ artifact, validation, heldOut, datasetReceipt, benchmark, split });
    if (writeOutputs) {
      const directory = targetDir(outputRoot, specialist);
      await mkdir(directory, { recursive: true });
      await Promise.all([
        writeFile(path.join(directory, 'model.json'), `${serializeModelArtifact(artifact)}\n`),
        writeFile(path.join(directory, 'benchmark.json'), `${JSON.stringify(benchmark, null, 2)}\n`),
        writeFile(path.join(directory, 'dataset-receipt.json'), `${JSON.stringify(datasetReceipt, null, 2)}\n`),
      ]);
    }
  }
  const summaryBase = {
    schema: 'nolane.small-model.repository-specialist-suite.v1',
    version: VERSION,
    trajectoryDatasetReceiptSha256: specialists['tool-router'].datasetReceipt.trajectoryDatasetReceiptSha256,
    specialistSummary: Object.fromEntries(Object.entries(specialists).map(([key, value]) => [key, {
      artifactSha256: value.artifact.artifactSha256,
      benchmarkReceiptSha256: value.benchmark.receiptSha256,
      datasetReceiptSha256: value.datasetReceipt.receiptSha256,
      validationAccuracy: value.validation.accuracy,
      heldOutAccuracy: value.heldOut.accuracy,
    }])),
    claims: { boundedRepositorySpecialistSuite: true, generalCodingIntelligence: false, competitorSuperiority: false },
  };
  return deepFreeze({ ...summaryBase, specialists, receiptSha256: canonicalSha256(summaryBase) });
}

export async function verifyRepositorySpecialistSuite({ outputRoot = path.join(process.cwd(), 'models', 'specialists-repository'), artifactOverrides = {} } = {}) {
  const artifactSha256BySpecialist = {};
  const benchmarkReceiptSha256BySpecialist = {};
  let trajectoryDatasetReceiptSha256 = null;
  for (const specialist of REPOSITORY_SPECIALISTS) {
    const directory = targetDir(outputRoot, specialist);
    const [artifactBytes, benchmarkBytes, datasetBytes] = await Promise.all([
      artifactOverrides[specialist] ? Promise.resolve(artifactOverrides[specialist]) : readFile(path.join(directory, 'model.json')),
      readFile(path.join(directory, 'benchmark.json'), 'utf8'),
      readFile(path.join(directory, 'dataset-receipt.json'), 'utf8'),
    ]);
    const artifact = loadModelArtifact(artifactBytes);
    const benchmark = JSON.parse(benchmarkBytes);
    const datasetReceipt = JSON.parse(datasetBytes);
    const { receiptSha256: benchmarkHash, ...benchmarkBase } = benchmark;
    const { receiptSha256: datasetHash, ...datasetBase } = datasetReceipt;
    if (canonicalSha256(benchmarkBase) !== benchmarkHash) throw new Error(`${specialist} repository benchmark hash mismatch`);
    if (canonicalSha256(datasetBase) !== datasetHash) throw new Error(`${specialist} repository dataset receipt hash mismatch`);
    if (artifact.specialist !== specialist || benchmark.specialist !== specialist || datasetReceipt.specialist !== specialist) throw new Error(`${specialist} repository identity mismatch`);
    if (benchmark.artifactSha256 !== artifact.artifactSha256) throw new Error(`${specialist} repository benchmark artifact mismatch`);
    if (benchmark.datasetReceiptSha256 !== datasetReceipt.receiptSha256) throw new Error(`${specialist} repository benchmark dataset mismatch`);
    if (benchmark.validation?.allowed !== true || benchmark.heldOut?.allowed !== true || benchmark.validation?.accuracy < 0.8 || benchmark.heldOut?.accuracy < 0.8) throw new Error(`${specialist} repository held-out evidence is insufficient`);
    if (benchmark.validation?.independent !== true || benchmark.heldOut?.independent !== true) throw new Error(`${specialist} repository evaluation must be independent`);
    if (benchmark.claims?.generalCodingIntelligence !== false || benchmark.claims?.competitorSuperiority !== false) throw new Error(`${specialist} repository non-claims must remain locked`);
    trajectoryDatasetReceiptSha256 ??= datasetReceipt.trajectoryDatasetReceiptSha256;
    if (trajectoryDatasetReceiptSha256 !== datasetReceipt.trajectoryDatasetReceiptSha256) throw new Error('Repository specialist trajectory lineage mismatch');
    artifactSha256BySpecialist[specialist] = artifact.artifactSha256;
    benchmarkReceiptSha256BySpecialist[specialist] = benchmark.receiptSha256;
  }
  const base = {
    schema: 'nolane.small-model.repository-specialist-suite-verification.v1',
    status: 'pass',
    trajectoryDatasetReceiptSha256,
    artifactSha256BySpecialist,
    benchmarkReceiptSha256BySpecialist,
    claims: { generalCodingIntelligence: false, competitorSuperiority: false },
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
