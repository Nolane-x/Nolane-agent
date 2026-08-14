#!/usr/bin/env node
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ProviderRegistry, createBuiltInCliProviders } from '../src/providers/provider-registry.mjs';
import {
  PROVIDER_DOGFOOD_PROFILE_V1,
  providerDogfoodProfileDescriptor,
  runProviderDogfoodCandidate,
  sha256Text,
} from '../src/providers/provider-dogfood-candidate-runner.mjs';

const FORBIDDEN_CANDIDATE_KEYS = new Set(['prompt', 'output', 'stdout', 'stderr', 'transcript', 'messages', 'pass', 'passed']);
const HASH_PATTERN = /^[0-9a-f]{64}$/;

function dogfoodError(code, message) {
  return Object.assign(new Error(message), { code });
}

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

export function parseProviderDogfoodArgs(argv = []) {
  const parsed = { provider: null, workspace: null, output: null, model: null, machineLabel: null, acknowledgeRealProviderRun: false };
  const valueFlags = new Map([
    ['--provider', 'provider'], ['--workspace', 'workspace'], ['--output', 'output'], ['--model', 'model'], ['--machine-label', 'machineLabel'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index]);
    if (token === '--acknowledge-real-provider-run') {
      parsed.acknowledgeRealProviderRun = true;
      continue;
    }
    const key = valueFlags.get(token);
    if (!key) throw new TypeError(`Unknown provider dogfood argument: ${token}`);
    const value = argv[index + 1];
    if (value == null || String(value).startsWith('--')) throw new TypeError(`${key} is required`);
    parsed[key] = String(value);
    index += 1;
  }
  parsed.provider = required(parsed.provider, 'provider');
  parsed.workspace = required(parsed.workspace, 'workspace');
  parsed.output = required(parsed.output, 'output');
  if (!parsed.acknowledgeRealProviderRun) throw new TypeError('acknowledge-real-provider-run is required');
  return Object.freeze(parsed);
}

export function createDogfoodProviderRegistry() {
  const registry = new ProviderRegistry();
  for (const provider of createBuiltInCliProviders()) registry.register(provider);
  return registry;
}

function walkCandidate(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkCandidate(item, visit);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    visit(key, item);
    walkCandidate(item, visit);
  }
}

function exactProfile(candidateProfile) {
  if (!candidateProfile || typeof candidateProfile !== 'object' || Array.isArray(candidateProfile)) throw new Error('profile descriptor required');
  const expected = providerDogfoodProfileDescriptor();
  for (const key of ['version', 'sha256', 'total_cases', 'behavioral_cases', 'adversarial_probes']) {
    if (candidateProfile[key] !== expected[key]) throw new Error(`profile ${key} mismatch`);
  }
  if (!HASH_PATTERN.test(String(candidateProfile.sha256))) throw new Error('profile hash invalid');
}

function validateCases(candidateCases) {
  if (!Array.isArray(candidateCases)) throw new Error('candidate cases required');
  if (candidateCases.length !== PROVIDER_DOGFOOD_PROFILE_V1.cases.length) throw new Error('candidate case count mismatch');

  for (let index = 0; index < PROVIDER_DOGFOOD_PROFILE_V1.cases.length; index += 1) {
    const expected = PROVIDER_DOGFOOD_PROFILE_V1.cases[index];
    const item = candidateCases[index];
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`candidate case ${index + 1} invalid`);
    if (item.id !== expected.id) throw new Error(`candidate case ${index + 1} id mismatch`);
    if (item.kind !== expected.kind) throw new Error(`candidate case ${index + 1} kind mismatch`);
    if (item.input_sha256 !== sha256Text(expected.prompt)) throw new Error(`candidate case ${index + 1} input hash mismatch`);
    if (!HASH_PATTERN.test(String(item.output_sha256 ?? ''))) throw new Error(`candidate case ${index + 1} result hash invalid`);
    if (!Number.isInteger(item.output_bytes) || item.output_bytes < 0) throw new Error(`candidate case ${index + 1} result byte count invalid`);
    if (!['completed', 'failed'].includes(item.status)) throw new Error(`candidate case ${index + 1} status invalid`);
    if (item.status === 'failed' && !String(item.error_code ?? '').trim()) throw new Error(`candidate case ${index + 1} failure code required`);
  }
}

function validateSummary(summary, cases) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) throw new Error('candidate summary required');
  const failed = cases.filter((item) => item.status !== 'completed').length;
  if (summary.total !== cases.length) throw new Error('candidate summary total mismatch');
  // completed means the case execution reached a terminal outcome, including a
  // provider-level failure; failed is the subset with a non-completed status.
  if (summary.completed !== cases.length) throw new Error('candidate summary completed mismatch');
  if (summary.failed !== failed) throw new Error('candidate summary failed mismatch');
}

export function validateProviderDogfoodCandidate(candidate) {
  try {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('candidate object required');
    if (candidate.schema_version !== 'nolane.provider-dogfood-candidate.v1') throw new Error('candidate schema mismatch');
    if (candidate.evidence_kind !== 'provider_real_dogfood_candidate') throw new Error('candidate evidence kind mismatch');
    if (candidate.certification_state !== 'candidate_unverified') throw new Error('candidate cannot self-certify');
    if (candidate.final_decision !== 'external_gate') throw new Error('candidate cannot decide pass');
    if (!candidate.provider || typeof candidate.provider !== 'object' || Array.isArray(candidate.provider)) throw new Error('candidate provider metadata required');
    if (candidate.provider.execution_safety !== 'verified') throw new Error('candidate provider execution safety is not verified');
    walkCandidate(candidate, (key) => {
      if (FORBIDDEN_CANDIDATE_KEYS.has(String(key).toLowerCase())) throw new Error(`forbidden candidate field: ${key}`);
    });
    exactProfile(candidate.profile);
    validateCases(candidate.cases);
    validateSummary(candidate.summary, candidate.cases);
    return candidate;
  } catch (error) {
    throw dogfoodError('DOGFOOD_CANDIDATE_INVALID', `Provider dogfood candidate rejected: ${String(error?.message ?? 'invalid candidate').slice(0, 180)}`);
  }
}

export async function writeProviderDogfoodCandidate(candidate, outputPath) {
  validateProviderDogfoodCandidate(candidate);
  const target = path.resolve(required(outputPath, 'output'));
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(candidate, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, target);
  return target;
}

function resolveProvider(registry, providerId) {
  try {
    return registry.get(providerId);
  } catch {
    throw dogfoodError('DOGFOOD_PROVIDER_UNKNOWN', `Unknown provider for real dogfood: ${providerId}`);
  }
}

export async function runProviderDogfoodCommand({ argv = process.argv.slice(2), env = process.env, deps = {} } = {}) {
  const options = parseProviderDogfoodArgs(argv);
  if (env.NOLANE_PROVIDER_DOGFOOD_ALLOW_REAL_RUN !== '1') {
    throw dogfoodError('DOGFOOD_REAL_RUN_GUARD_REQUIRED', 'Real provider dogfood requires the explicit host environment guard.');
  }
  if (env.GITHUB_EVENT_NAME && env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
    throw dogfoodError('DOGFOOD_MANUAL_DISPATCH_REQUIRED', 'Real provider dogfood may only run from manual workflow dispatch on GitHub Actions.');
  }
  const registry = deps.registry ?? createDogfoodProviderRegistry();
  const provider = resolveProvider(registry, options.provider);
  const publicView = typeof provider.publicView === 'function' ? provider.publicView() : {};
  const executionSafety = provider.executionSafety ?? publicView.executionSafety;
  if (executionSafety !== 'verified') {
    throw dogfoodError('DOGFOOD_PROVIDER_EXECUTION_UNSAFE', 'Provider execution safety is not verified for real dogfood.');
  }

  const runCandidate = deps.runCandidate ?? runProviderDogfoodCandidate;
  const candidate = await runCandidate({
    provider,
    workspace: options.workspace,
    model: options.model,
    machineLabel: options.machineLabel,
  });
  validateProviderDogfoodCandidate(candidate);
  const writer = deps.writeCandidate ?? writeProviderDogfoodCandidate;
  await writer(candidate, options.output);
  return candidate;
}

async function cliMain() {
  try {
    const candidate = await runProviderDogfoodCommand();
    process.stdout.write(`${JSON.stringify({
      evidence_kind: candidate.evidence_kind,
      certification_state: candidate.certification_state,
      final_decision: candidate.final_decision,
      total_cases: candidate.summary?.total ?? null,
      failed_cases: candidate.summary?.failed ?? null,
    })}\n`);
    if ((candidate.summary?.failed ?? 0) > 0) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: error?.code ?? 'DOGFOOD_RUN_FAILED' })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await cliMain();
