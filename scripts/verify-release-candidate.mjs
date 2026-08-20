import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateReleaseCandidate } from '../src/release/release-candidate-gate.mjs';
import { verifyExternalGateCertificationFreshness } from '../src/release/external-gate-certification.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${key}`);
    values[key.slice(2)] = value;
    index += 1;
  }
  return values;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.resolve(root, file), 'utf8'));
}

async function writeJson(file, value) {
  const target = path.resolve(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function workflowRunsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.workflow_runs)) return payload.workflow_runs;
  throw new Error('workflow-runs JSON must be an array or GitHub actions workflow_runs payload');
}

export async function verifyReleaseCandidateFromFiles({
  expectedSha,
  tagSha,
  workflowRunsPath,
  externalCertificationPath,
  productPerfectionPath = 'requirements/product-perfection-matrix.json',
  outputPath = null
}) {
  if (!expectedSha || !tagSha || !workflowRunsPath || !externalCertificationPath) {
    throw new Error('expected-sha, tag-sha, workflow-runs, and external-certification are required');
  }

  const [workflowPayload, productMatrix, externalCertification] = await Promise.all([
    readJson(workflowRunsPath),
    readJson(productPerfectionPath),
    readJson(externalCertificationPath)
  ]);

  const externalVerification = await verifyExternalGateCertificationFreshness(externalCertification, {
    rootDirectory: root,
    expectedSourceSha: expectedSha
  });

  const report = evaluateReleaseCandidate({
    expectedSha,
    tagSha,
    workflowRuns: workflowRunsFromPayload(workflowPayload),
    productPerfectionCounts: productMatrix?.summary ?? productMatrix?.counts ?? {},
    externalCertification: {
      status: externalVerification.status,
      sourceCommitSha: externalVerification.sourceCommitSha,
      artifacts: externalCertification.artifacts
    }
  });

  const receipt = {
    ...report,
    externalVerification,
    generatedAt: new Date().toISOString()
  };

  if (outputPath) await writeJson(outputPath, receipt);
  return receipt;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await verifyReleaseCandidateFromFiles({
    expectedSha: args['expected-sha'] ?? process.env.GITHUB_SHA,
    tagSha: args['tag-sha'] ?? process.env.GITHUB_SHA,
    workflowRunsPath: args['workflow-runs'],
    externalCertificationPath: args['external-certification'],
    productPerfectionPath: args['product-perfection'] ?? 'requirements/product-perfection-matrix.json',
    outputPath: args.output ?? 'release/release-candidate-gate.json'
  });
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (!report.pass) process.exitCode = 1;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(error?.stack ?? String(error));
    process.exitCode = 1;
  });
}
