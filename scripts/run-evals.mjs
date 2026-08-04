import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { EvalRunner } from '../src/eval/eval-runner.mjs';

const suitePath = path.resolve(process.argv[2] ?? 'evals/smoke-suite.json');
const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : null;
const suite = JSON.parse(await readFile(suitePath, 'utf8'));
const executorModulePath = process.env.NOLANE_AGENT_EVAL_EXECUTOR ?? process.env.FORGE_STUDIO_EVAL_EXECUTOR ?? null;
let executionMode = 'fixture';
let executor = async ({ evalCase }) => structuredClone(evalCase.fixtureResult ?? {});
let hiddenVerifier = null;
if (executorModulePath) {
  const module = await import(pathToFileURL(path.resolve(executorModulePath)));
  if (typeof module.default !== 'function') throw new TypeError('NOLANE_AGENT_EVAL_EXECUTOR must export a default function');
  executor = module.default;
  hiddenVerifier = typeof module.hiddenVerifier === 'function' ? module.hiddenVerifier : null;
  executionMode = 'module';
}
const providers = String(process.env.NOLANE_AGENT_EVAL_PROVIDERS ?? process.env.FORGE_STUDIO_EVAL_PROVIDERS ?? 'fixture').split(',').map((item) => item.trim()).filter(Boolean);
let independentAttestation = null;
const attestationFile = process.env.NOLANE_AGENT_EVAL_ATTESTATION_FILE;
if (attestationFile) independentAttestation = JSON.parse(await readFile(path.resolve(attestationFile), 'utf8'));
const report = await new EvalRunner({ executor, hiddenVerifier }).runSuite(suite, {
  providerIds: providers,
  timeoutMs: Number(process.env.NOLANE_AGENT_EVAL_TIMEOUT_MS ?? process.env.FORGE_STUDIO_EVAL_TIMEOUT_MS ?? 120_000),
  executionMode,
  independentAttestation,
});
const text = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) await writeFile(outputPath, text);
process.stdout.write(text);
