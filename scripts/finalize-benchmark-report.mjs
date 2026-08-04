import { createPublicKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBenchmarkSuite } from '../src/benchmark/benchmark-schema.mjs';
import { verifyIndependentAttestation } from '../src/benchmark/independent-attestation.mjs';
import { writeBenchmarkReport } from '../src/benchmark/report-writer.mjs';

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    args.set(argv[index], argv[index + 1]);
    index += 1;
  }
  return args;
}

export async function finalizeBenchmarkReport({ suiteFile, runsFile, attestationFile, publicKeyFile, outputDirectory, minimumTasks = 20 } = {}) {
  for (const [name, value] of Object.entries({ suiteFile, runsFile, attestationFile, publicKeyFile, outputDirectory })) {
    if (!value) throw new TypeError(`${name} is required`);
  }
  const suite = validateBenchmarkSuite(JSON.parse(await readFile(path.resolve(suiteFile), 'utf8')));
  const runs = JSON.parse(await readFile(path.resolve(runsFile), 'utf8'));
  if (!Array.isArray(runs) || !runs.length) throw new TypeError('benchmark runs must be a non-empty array');
  const attestation = JSON.parse(await readFile(path.resolve(attestationFile), 'utf8'));
  const publicKey = createPublicKey(await readFile(path.resolve(publicKeyFile), 'utf8'));
  const independentEvidence = verifyIndependentAttestation({ attestation, publicKey, suite, runs });
  return writeBenchmarkReport({ outputDirectory, suite, runs, independentEvidence, minimumTasks: Number(minimumTasks) });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const report = await finalizeBenchmarkReport({
    suiteFile: args.get('--suite'), runsFile: args.get('--runs'), attestationFile: args.get('--attestation'),
    publicKeyFile: args.get('--public-key'), outputDirectory: args.get('--output'), minimumTasks: args.get('--minimum-tasks') ?? 20,
  });
  process.stdout.write(`${JSON.stringify({ independent: report.independent, claimAllowed: report.claimAllowed, reason: report.claimReason })}\n`);
}
