import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildBootstrapSpecialistDataset, SUPPORTED_BOOTSTRAP_SPECIALISTS } from './bootstrap-specialist-suite-dataset.mjs';
import { buildDeterministicSplit } from './verified-dataset.mjs';
import { trainLinearPolicy } from './linear-policy-trainer.mjs';
import { createModelArtifact, loadModelArtifact, serializeModelArtifact } from './model-artifact.mjs';
import { evaluateSpecialistArtifact } from './specialist-evaluation.mjs';
import { canonicalSha256, deepFreeze } from './shared.mjs';

const DEFAULT_CONFIG = Object.freeze({ dimensions: 256, epochs: 120, learningRate: 0.12, l2: 0.0001 });
function outputDir(root, specialist) { return path.join(root, specialist, 'bootstrap-v1'); }
function receipt(base) { return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export async function trainBootstrapSpecialistSuite({ root = process.cwd(), variants = 18, writeOutputs = false, outputRoot = path.join(root, 'models/specialists'), trainingConfig = {} } = {}) {
  const specialists = {};
  for (const specialist of SUPPORTED_BOOTSTRAP_SPECIALISTS) {
    const dataset = await buildBootstrapSpecialistDataset({ root, specialist, variants });
    const split = buildDeterministicSplit({ examples: dataset.examples, seed: `forensic-recovery-checkpoint-4:${specialist}`, heldOutRatio: 0.2, validationRatio: 0.2 });
    const config = { ...DEFAULT_CONFIG, ...trainingConfig, seed: `nolane-bootstrap-${specialist}-v1` };
    const model = trainLinearPolicy({ examples: split.train, ...config });
    const artifact = createModelArtifact({ model, datasetReceiptSha256: split.receiptSha256, trainingConfig: config, specialist });
    const validation = evaluateSpecialistArtifact({ artifact, examples: split.validation, independent: true, heldOut: true, minAccuracy: 0.95, baselineSafetyViolations: 0 });
    const heldOut = evaluateSpecialistArtifact({ artifact, examples: split.heldOut, independent: true, heldOut: true, minAccuracy: 0.95, baselineSafetyViolations: 0 });
    if (!validation.allowed || !heldOut.allowed) throw new Error(`Bootstrap ${specialist} failed independent evaluation`);
    const datasetReceipt = receipt({
      schema: 'nolane.small-model.bootstrap-specialist-dataset-receipt.v1', specialist, datasetReceiptSha256: dataset.receiptSha256,
      splitReceiptSha256: split.receiptSha256, labels: dataset.labels, variants,
      counts: { total: dataset.examples.length, train: split.train.length, validation: split.validation.length, heldOut: split.heldOut.length },
      disjointBy: split.disjointBy, groupCounts: split.groups, hiddenChainOfThoughtStored: false,
    });
    const benchmark = receipt({
      schema: 'nolane.small-model.bootstrap-specialist-benchmark.v1', specialist, artifactSha256: artifact.artifactSha256,
      datasetReceiptSha256: datasetReceipt.receiptSha256, validation, heldOut,
      resourceProfile: { runtime: 'node-js-linear-policy', dimensions: model.dimensions, parameters: model.labels.length * model.dimensions + model.biases.length },
      claims: { boundedSpecialistModel: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    });
    specialists[specialist] = deepFreeze({ artifact, validation, heldOut, datasetReceipt, benchmark, split });
    if (writeOutputs) {
      const target = outputDir(outputRoot, specialist); await mkdir(target, { recursive: true });
      await Promise.all([
        writeFile(path.join(target, 'model.json'), `${serializeModelArtifact(artifact)}\n`),
        writeFile(path.join(target, 'benchmark.json'), `${JSON.stringify(benchmark, null, 2)}\n`),
        writeFile(path.join(target, 'dataset-receipt.json'), `${JSON.stringify(datasetReceipt, null, 2)}\n`),
      ]);
    }
  }
  const summaryBase = {
    schema: 'nolane.small-model.bootstrap-specialist-suite.v1', specialistSummary: Object.fromEntries(Object.entries(specialists).map(([key, value]) => [key, {
      artifactSha256: value.artifact.artifactSha256, benchmarkReceiptSha256: value.benchmark.receiptSha256, datasetReceiptSha256: value.datasetReceipt.receiptSha256,
      validationAccuracy: value.validation.accuracy, heldOutAccuracy: value.heldOut.accuracy,
    }])),
    claims: { boundedSpecialistSuite: true, generalCodingIntelligence: false, competitorSuperiority: false },
  };
  return deepFreeze({ ...summaryBase, specialists, receiptSha256: canonicalSha256(summaryBase) });
}

export async function verifyBootstrapSpecialistSuite({ outputRoot = path.join(process.cwd(), 'models/specialists'), artifactOverrides = {} } = {}) {
  const artifactSha256BySpecialist = {};
  const benchmarkReceiptSha256BySpecialist = {};
  for (const specialist of SUPPORTED_BOOTSTRAP_SPECIALISTS) {
    const target = outputDir(outputRoot, specialist);
    const [artifactBytes, benchmarkBytes, datasetBytes] = await Promise.all([
      artifactOverrides[specialist] ? Promise.resolve(artifactOverrides[specialist]) : readFile(path.join(target, 'model.json')),
      readFile(path.join(target, 'benchmark.json'), 'utf8'), readFile(path.join(target, 'dataset-receipt.json'), 'utf8'),
    ]);
    const artifact = loadModelArtifact(artifactBytes); const benchmark = JSON.parse(benchmarkBytes); const datasetReceipt = JSON.parse(datasetBytes);
    const { receiptSha256: benchmarkHash, ...benchmarkBase } = benchmark;
    if (canonicalSha256(benchmarkBase) !== benchmarkHash) throw new Error(`${specialist} benchmark hash mismatch`);
    const { receiptSha256: datasetHash, ...datasetBase } = datasetReceipt;
    if (canonicalSha256(datasetBase) !== datasetHash) throw new Error(`${specialist} dataset receipt hash mismatch`);
    if (artifact.specialist !== specialist || benchmark.specialist !== specialist || datasetReceipt.specialist !== specialist) throw new Error(`${specialist} identity mismatch`);
    if (benchmark.artifactSha256 !== artifact.artifactSha256) throw new Error(`${specialist} benchmark artifact mismatch`);
    if (benchmark.datasetReceiptSha256 !== datasetReceipt.receiptSha256) throw new Error(`${specialist} benchmark dataset mismatch`);
    if (benchmark.validation?.allowed !== true || benchmark.heldOut?.allowed !== true || benchmark.validation?.independent !== true || benchmark.heldOut?.independent !== true) throw new Error(`${specialist} independent held-out evidence is required`);
    if (benchmark.claims?.generalCodingIntelligence !== false || benchmark.claims?.competitorSuperiority !== false) throw new Error(`${specialist} non-claims must remain locked`);
    artifactSha256BySpecialist[specialist] = artifact.artifactSha256;
    benchmarkReceiptSha256BySpecialist[specialist] = benchmark.receiptSha256;
  }
  const base = { schema: 'nolane.small-model.bootstrap-specialist-suite-verification.v1', status: 'pass', artifactSha256BySpecialist, benchmarkReceiptSha256BySpecialist };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
