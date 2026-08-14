#!/usr/bin/env node
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ProviderRegistry, createBuiltInCliProviders } from '../src/providers/provider-registry.mjs';
import { runProviderDogfoodCandidate } from '../src/providers/provider-dogfood-candidate-runner.mjs';

const FORBIDDEN_CANDIDATE_KEYS = new Set(['prompt', 'output', 'stdout', 'stderr', 'transcript', 'messages', 'pass', 'passed']);

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

export function validateProviderDogfoodCandidate(candidate) {
  try {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('candidate object required');
    if (candidate.schema_version !== 'nolane.provider-dogfood-candidate.v1') throw new Error('candidate schema mismatch');
    if (candidate.evidence_kind !== 'provider_real_dogfood_candidate') throw new Error('candidate evidence kind mismatch');
    if (candidate.certification_state !== 'candidate_unverified') throw new Error('candidate cannot self-certify');
    if (candidate.final_decision !== 'external_gate') throw new Error('candidate cannot decide pass');
    walkCandidate(candidate, (key) => {
      if (FORBIDDEN_CANDIDATE_KEYS.has(String(key).toLowerCase())) throw new Error(`forbidden candidate field: ${key}`);
    });
    if (candidate.profile?.sha256 != null && !/^[0-9a-f]{64}$/.test(String(candidate.profile.sha256))) throw new Error('profile hash invalid');
    for (const item of Array.isArray(candidate.cases) ? candidate.cases : []) {
      if (!/^[0-9a-f]{64}$/.test(String(item.input_sha256 ?? ''))) throw new Error('input hash invalid');
      if (!/^[0-9a-f]{64}$/.test(String(item.output_sha256 ?? ''))) throw new Error('result hash invalid');
      if (!Number.isInteger(item.output_bytes) || item.output_bytes < 0) throw new Error('result byte count invalid');
    }
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
