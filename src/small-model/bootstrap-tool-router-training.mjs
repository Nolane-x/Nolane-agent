import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildBootstrapToolRoutingDataset } from './bootstrap-tool-routing-dataset.mjs';
import { buildDeterministicSplit } from './verified-dataset.mjs';
import { trainLinearPolicy } from './linear-policy-trainer.mjs';
import { createModelArtifact, loadModelArtifact, serializeModelArtifact } from './model-artifact.mjs';
import { evaluateSpecialistArtifact } from './specialist-evaluation.mjs';
import { canonicalSha256, deepFreeze } from './shared.mjs';

const DEFAULT_CONFIG = Object.freeze({ dimensions: 256, epochs: 100, learningRate: 0.12, l2: 0.0001, seed: 'nolane-bootstrap-tool-router-v1' });
function directory(root, outputDir) { return path.isAbsolute(outputDir) ? outputDir : path.join(root, outputDir); }
function withReceipt(base) { return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export async function trainBootstrapToolRouter({
  root = process.cwd(), variants = 30, writeOutputs = false,
  outputDir = 'models/tool-router/bootstrap-v1', trainingConfig = DEFAULT_CONFIG,
} = {}) {
  const dataset = await buildBootstrapToolRoutingDataset({ root, variants });
  const split = buildDeterministicSplit({ examples: dataset.examples, seed: 'forensic-recovery-checkpoint-3', heldOutRatio: 0.2, validationRatio: 0.2 });
  const config = { ...DEFAULT_CONFIG, ...trainingConfig };
  const model = trainLinearPolicy({ examples: split.train, ...config });
  const artifact = createModelArtifact({ model, datasetReceiptSha256: split.receiptSha256, trainingConfig: config, specialist: 'tool-router' });
  const validation = evaluateSpecialistArtifact({ artifact, examples: split.validation, independent: true, heldOut: true, minAccuracy: 0.95, baselineSafetyViolations: 0 });
  const heldOut = evaluateSpecialistArtifact({ artifact, examples: split.heldOut, independent: true, heldOut: true, minAccuracy: 0.95, baselineSafetyViolations: 0 });
  if (!validation.allowed || !heldOut.allowed) throw new Error('Bootstrap tool-router failed independent evaluation');
  const datasetReceipt = withReceipt({
    schema: 'nolane.small-model.bootstrap-tool-router-dataset-receipt.v1', datasetReceiptSha256: dataset.receiptSha256,
    splitReceiptSha256: split.receiptSha256, labels: dataset.labels, variants, counts: { total: dataset.examples.length, train: split.train.length, validation: split.validation.length, heldOut: split.heldOut.length },
    disjointBy: split.disjointBy, groupCounts: split.groups, hiddenChainOfThoughtStored: false,
  });
  const benchmark = withReceipt({
    schema: 'nolane.small-model.bootstrap-tool-router-benchmark.v1', artifactSha256: artifact.artifactSha256,
    datasetReceiptSha256: datasetReceipt.receiptSha256, validation, heldOut,
    resourceProfile: { runtime: 'node-js-linear-policy', dimensions: model.dimensions, parameters: model.labels.length * model.dimensions + model.biases.length },
    claims: { boundedToolRoutingSpecialist: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
  });
  if (writeOutputs) {
    const target = directory(root, outputDir); await mkdir(target, { recursive: true });
    await Promise.all([
      writeFile(path.join(target, 'model.json'), `${serializeModelArtifact(artifact)}\n`),
      writeFile(path.join(target, 'benchmark.json'), `${JSON.stringify(benchmark, null, 2)}\n`),
      writeFile(path.join(target, 'dataset-receipt.json'), `${JSON.stringify(datasetReceipt, null, 2)}\n`),
    ]);
  }
  return deepFreeze({ artifact, benchmark, datasetReceipt, split });
}

export async function verifyBootstrapToolRouter({ root = process.cwd(), outputDir = 'models/tool-router/bootstrap-v1', artifactOverride } = {}) {
  const target = directory(root, outputDir);
  const [artifactBytes, benchmarkBytes, datasetBytes] = await Promise.all([
    artifactOverride ? Promise.resolve(artifactOverride) : readFile(path.join(target, 'model.json')),
    readFile(path.join(target, 'benchmark.json'), 'utf8'),
    readFile(path.join(target, 'dataset-receipt.json'), 'utf8'),
  ]);
  const artifact = loadModelArtifact(artifactBytes); const benchmark = JSON.parse(benchmarkBytes); const datasetReceipt = JSON.parse(datasetBytes);
  const { receiptSha256: benchmarkReceipt, ...benchmarkBase } = benchmark;
  if (canonicalSha256(benchmarkBase) !== benchmarkReceipt) throw new Error('Bootstrap benchmark hash mismatch');
  const { receiptSha256: datasetHash, ...datasetBase } = datasetReceipt;
  if (canonicalSha256(datasetBase) !== datasetHash) throw new Error('Bootstrap dataset receipt hash mismatch');
  if (benchmark.artifactSha256 !== artifact.artifactSha256) throw new Error('Bootstrap benchmark artifact mismatch');
  if (benchmark.datasetReceiptSha256 !== datasetReceipt.receiptSha256) throw new Error('Bootstrap benchmark dataset mismatch');
  if (benchmark.validation?.allowed !== true || benchmark.heldOut?.allowed !== true || benchmark.validation?.independent !== true || benchmark.heldOut?.independent !== true) throw new Error('Independent allowed benchmark receipts are required');
  if (benchmark.claims?.generalCodingIntelligence !== false || benchmark.claims?.competitorSuperiority !== false) throw new Error('Bootstrap non-claims must remain locked');
  const base = { schema: 'nolane.small-model.bootstrap-tool-router-verification.v1', status: 'pass', artifactSha256: artifact.artifactSha256, benchmarkReceiptSha256: benchmark.receiptSha256, datasetReceiptSha256: datasetReceipt.receiptSha256 };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
