import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { canonicalSha256, canonicalStringify, deepFreeze } from './shared.mjs';
import { validateTrajectoryEpisode } from './trajectory-schema.mjs';

const RUNTIME_EXECUTABLE = Object.freeze({
  node: () => process.execPath,
  go: () => process.env.GO_BINARY || 'go',
  python: () => process.env.PYTHON_BINARY || 'python3',
});
const HIDDEN = /(?:chain.?of.?thought|hidden.?reasoning|reasoning.?trace|private.?scratchpad)/i;

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function canonicalText(value) { return String(value).replace(/\r\n?/g, '\n'); }
function scanPublic(value, cursor = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (HIDDEN.test(key)) throw new TypeError(`Hidden reasoning is forbidden at ${cursor}.${key}`);
    scanPublic(child, `${cursor}.${key}`);
  }
}
function relativePath(value, label) {
  const text = String(value ?? '').trim();
  if (!text || path.isAbsolute(text)) throw new TypeError(`${label} must be a non-empty relative path`);
  return text.replaceAll('\\', '/');
}
async function safeDirectory(root, relative, label) {
  const normalized = relativePath(relative, label);
  const candidate = path.resolve(root, normalized);
  const rel = path.relative(root, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`${label} is outside repository root: ${normalized}`);
  const stat = await lstat(candidate);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${label} must be a real directory: ${normalized}`);
  const real = await realpath(candidate);
  const realRel = path.relative(root, real);
  if (realRel.startsWith('..') || path.isAbsolute(realRel)) throw new Error(`${label} is outside repository root: ${normalized}`);
  return { absolutePath: real, relativePath: normalized };
}
async function safeFile(root, relative, label) {
  const normalized = relativePath(relative, label);
  const candidate = path.resolve(root, normalized);
  const rel = path.relative(root, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`${label} is outside project root: ${normalized}`);
  const stat = await lstat(candidate);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} must be a real file: ${normalized}`);
  const real = await realpath(candidate);
  const realRel = path.relative(root, real);
  if (realRel.startsWith('..') || path.isAbsolute(realRel)) throw new Error(`${label} is outside project root: ${normalized}`);
  return { absolutePath: real, relativePath: normalized };
}
function executable(runtime) {
  const key = String(runtime ?? '').trim();
  const resolver = RUNTIME_EXECUTABLE[key];
  if (!resolver) throw new TypeError(`Unsupported runtime: ${key || '(missing)'}`);
  return { runtime: key, executable: resolver() };
}
function argv(value) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError('argv must be a non-empty array');
  return value.map((item, index) => {
    const text = String(item ?? '');
    if (!text || text.includes('\0')) throw new TypeError(`argv[${index}] is invalid`);
    return text;
  });
}
function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0; let offset = 0;
  while (true) {
    const index = text.indexOf(needle, offset);
    if (index < 0) return count;
    count += 1; offset = index + needle.length;
  }
}
function execute({ cwd, executable: command, args, timeoutMs, maxOutputBytes }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', PYTHONDONTWRITEBYTECODE: '1', NODE_TEST_CONTEXT: undefined } });
    const started = process.hrtime.bigint();
    const stdout = []; const stderr = []; let stdoutBytes = 0; let stderrBytes = 0; let timedOut = false;
    const append = (target, chunk, kind) => {
      const current = kind === 'stdout' ? stdoutBytes : stderrBytes;
      const remaining = Math.max(0, maxOutputBytes - current);
      if (remaining > 0) target.push(chunk.subarray(0, remaining));
      if (kind === 'stdout') stdoutBytes += chunk.length; else stderrBytes += chunk.length;
    };
    child.stdout.on('data', (chunk) => append(stdout, chunk, 'stdout'));
    child.stderr.on('data', (chunk) => append(stderr, chunk, 'stderr'));
    child.on('error', reject);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    timer.unref?.();
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      resolve(deepFreeze({
        executable: command, argv: [command, ...args], exitCode: Number.isInteger(code) ? code : null, signal: signal ?? null, timedOut,
        durationMs: Number(durationMs.toFixed(3)), stdoutSha256: sha256(Buffer.concat(stdout)), stderrSha256: sha256(Buffer.concat(stderr)),
        stdoutBytes, stderrBytes, outputTruncated: stdoutBytes > maxOutputBytes || stderrBytes > maxOutputBytes,
      }));
    });
  });
}
function validateScenario(raw) {
  if (!raw || typeof raw !== 'object') throw new TypeError('Recovery scenario is required');
  scanPublic(raw);
  const value = structuredClone(raw);
  for (const key of ['id', 'projectId', 'projectRoot', 'runtime', 'argv', 'sourcePath', 'testPaths', 'mutation', 'repair', 'state']) {
    if (value[key] === undefined) throw new TypeError(`Recovery scenario requires ${key}`);
  }
  value.argv = argv(value.argv);
  if (!Array.isArray(value.testPaths) || value.testPaths.length === 0) throw new TypeError('testPaths must be a non-empty array');
  for (const phase of ['mutation', 'repair']) {
    if (!value[phase] || typeof value[phase] !== 'object' || !String(value[phase].from ?? '') || !String(value[phase].to ?? '')) throw new TypeError(`${phase} requires from and to`);
  }
  return value;
}
function phaseReceipt({ scenarioId, phase, execution, sourceSha256, workspaceIdentity }) {
  const base = { schema: 'nolane.small-model.mutation-recovery-phase.v1', scenarioId, phase, exitCode: execution.exitCode, timedOut: execution.timedOut, execution, sourceSha256, workspaceIdentity };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
function trajectory({ scenario, phase, execution, phaseReceiptValue, sourceSha256, testSha256ByPath, labels, kind, actionType, expectedExitCode }) {
  const base = validateTrajectoryEpisode({
    id: `${scenario.id}:${phase}`, kind,
    state: {
      scenarioGroup: `${scenario.state.scenarioGroup}:${phase}`, evidenceFamily: scenario.state.evidenceFamily ?? 'mutation-recovery', projectId: String(scenario.projectId),
      runtime: String(scenario.runtime), recoveryPhase: phase, sourcePath: scenario.sourcePath, sourceSha256, testSha256ByPath, labels: structuredClone(labels),
      mutationObserved: phase === 'mutation-failure', recoveryObserved: phase === 'recovery-pass', safetyCritical: phase === 'mutation-failure',
    },
    action: { type: actionType, executable: execution.executable, argv: execution.argv, shell: false },
    expectedEffect: { verifierExitCode: expectedExitCode, phase },
    actualEffect: { changed: true, criterionDelta: 1, informationGain: 1, verifierExitCode: execution.exitCode },
    verifier: { id: `${scenario.runtime}-mutation-recovery-verifier`, valid: true, rewardHacking: false, exitCode: execution.exitCode, timedOut: execution.timedOut, stdoutSha256: execution.stdoutSha256, stderrSha256: execution.stderrSha256, attemptReceiptSha256: phaseReceiptValue.receiptSha256 },
    cost: { durationMs: execution.durationMs, stdoutBytes: execution.stdoutBytes, stderrBytes: execution.stderrBytes },
  });
  return deepFreeze({ ...structuredClone(base), receiptSha256: canonicalSha256(base) });
}

export async function runMutationRecoveryLab({ root, scenarios, timeoutMs = 60_000, maxOutputBytes = 1_048_576 } = {}) {
  if (!root) throw new TypeError('Repository root is required');
  if (!Array.isArray(scenarios) || scenarios.length === 0) throw new TypeError('At least one recovery scenario is required');
  const rootReal = await realpath(root);
  const ids = new Set(); const scenarioRecords = []; const episodes = [];
  for (const raw of scenarios) {
    const scenario = validateScenario(raw);
    if (ids.has(scenario.id)) throw new Error(`Duplicate recovery scenario: ${scenario.id}`);
    ids.add(scenario.id);
    const project = await safeDirectory(rootReal, scenario.projectRoot, 'project root');
    const sourceOriginal = await safeFile(project.absolutePath, scenario.sourcePath, 'source path');
    const originalBytes = await readFile(sourceOriginal.absolutePath);
    const originalSha256 = sha256(originalBytes);
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), `nolane-recovery-${String(scenario.id).replace(/[^a-z0-9-]/gi, '-')}-`));
    try {
      const workspace = path.join(tempRoot, 'project');
      await cp(project.absolutePath, workspace, { recursive: true, dereference: false, errorOnExist: true });
      const source = await safeFile(workspace, scenario.sourcePath, 'source path');
      const tests = await Promise.all(scenario.testPaths.map((entry, index) => safeFile(workspace, entry, `testPaths[${index}]`)));
      const testSha256ByPath = Object.fromEntries(await Promise.all(tests.map(async (entry) => [entry.relativePath, sha256(await readFile(entry.absolutePath))])));
      const runtime = executable(scenario.runtime);
      const workspaceIdentity = sha256(workspace);
      const baselineExecution = await execute({ cwd: workspace, executable: runtime.executable, args: scenario.argv, timeoutMs, maxOutputBytes });
      if (baselineExecution.timedOut || baselineExecution.exitCode !== 0) throw new Error(`Baseline verifier must pass for ${scenario.id}`);
      const baselineReceipt = phaseReceipt({ scenarioId: scenario.id, phase: 'baseline-pass', execution: baselineExecution, sourceSha256: sha256(await readFile(source.absolutePath)), workspaceIdentity });

      const beforeMutation = await readFile(source.absolutePath, 'utf8');
      if (countOccurrences(beforeMutation, String(scenario.mutation.from)) !== 1) throw new Error(`Mutation token must occur exactly once for ${scenario.id}`);
      const mutatedText = beforeMutation.replace(String(scenario.mutation.from), String(scenario.mutation.to));
      await writeFile(source.absolutePath, mutatedText);
      const mutatedSha256 = sha256(mutatedText);
      if (mutatedSha256 === originalSha256) throw new Error(`Mutation did not change source for ${scenario.id}`);
      const mutationExecution = await execute({ cwd: workspace, executable: runtime.executable, args: scenario.argv, timeoutMs, maxOutputBytes });
      if (mutationExecution.timedOut || mutationExecution.exitCode === 0) throw new Error(`Mutation verifier must fail for ${scenario.id}`);
      const mutationReceipt = phaseReceipt({ scenarioId: scenario.id, phase: 'mutation-failure', execution: mutationExecution, sourceSha256: mutatedSha256, workspaceIdentity });
      episodes.push(trajectory({ scenario, phase: 'mutation-failure', execution: mutationExecution, phaseReceiptValue: mutationReceipt, sourceSha256: mutatedSha256, testSha256ByPath, labels: scenario.state.failureLabels, kind: 'verification', actionType: 'stop', expectedExitCode: mutationExecution.exitCode }));

      const beforeRepair = await readFile(source.absolutePath, 'utf8');
      if (countOccurrences(beforeRepair, String(scenario.repair.from)) !== 1) throw new Error(`Repair token must occur exactly once for ${scenario.id}`);
      const repairedText = beforeRepair.replace(String(scenario.repair.from), String(scenario.repair.to));
      await writeFile(source.absolutePath, repairedText);
      const repairedSha256 = sha256(repairedText);
      const recoveryExecution = await execute({ cwd: workspace, executable: runtime.executable, args: scenario.argv, timeoutMs, maxOutputBytes });
      if (recoveryExecution.timedOut || recoveryExecution.exitCode !== 0) throw new Error(`Recovery verifier must pass for ${scenario.id}`);
      const recoveryReceipt = phaseReceipt({ scenarioId: scenario.id, phase: 'recovery-pass', execution: recoveryExecution, sourceSha256: repairedSha256, workspaceIdentity });
      episodes.push(trajectory({ scenario, phase: 'recovery-pass', execution: recoveryExecution, phaseReceiptValue: recoveryReceipt, sourceSha256: repairedSha256, testSha256ByPath, labels: scenario.state.recoveryLabels, kind: 'recovery', actionType: 'rollback', expectedExitCode: 0 }));

      const recordBase = {
        schema: 'nolane.small-model.mutation-recovery-scenario.v1', id: String(scenario.id), projectId: String(scenario.projectId), runtime: runtime.runtime,
        projectRoot: project.relativePath, sourcePath: source.relativePath, originalSourceSha256: originalSha256, mutatedSourceSha256: mutatedSha256, repairedSourceSha256: repairedSha256,
        mutationObserved: mutationExecution.exitCode !== 0, recoveryObserved: recoveryExecution.exitCode === 0,
        phases: [baselineReceipt, mutationReceipt, recoveryReceipt],
      };
      scenarioRecords.push(deepFreeze({ ...recordBase, receiptSha256: canonicalSha256(recordBase) }));
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
    if (sha256(await readFile(sourceOriginal.absolutePath)) !== originalSha256) throw new Error(`Original source was modified for ${scenario.id}`);
  }
  const base = { schema: 'nolane.small-model.mutation-recovery-collection.v1', scenarios: scenarioRecords.map((entry) => entry.receiptSha256), episodes: episodes.map((entry) => entry.receiptSha256) };
  return deepFreeze({ ...base, scenarios: scenarioRecords, episodes, receiptSha256: canonicalSha256(base) });
}

export async function writeMutationRecoveryDataset({ outputDir, result } = {}) {
  if (!outputDir) throw new TypeError('outputDir is required');
  if (!result?.episodes || !Array.isArray(result.episodes)) throw new TypeError('result is required');
  await mkdir(outputDir, { recursive: true });
  const episodes = [...result.episodes].sort((a, b) => a.id.localeCompare(b.id));
  const scenarios = [...result.scenarios].sort((a, b) => a.id.localeCompare(b.id));
  const episodeText = canonicalText(episodes.map((entry) => canonicalStringify(entry)).join('\n') + (episodes.length ? '\n' : ''));
  const scenarioText = canonicalText(`${JSON.stringify(scenarios, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'recovery-episodes.jsonl'), episodeText);
  await writeFile(path.join(outputDir, 'recovery-scenarios.json'), scenarioText);
  const base = {
    schema: 'nolane.small-model.mutation-recovery-dataset.v1', episodeCount: episodes.length, scenarioCount: scenarios.length,
    recoveryEpisodesSha256: sha256(episodeText), recoveryScenariosSha256: sha256(scenarioText), collectionReceiptSha256: result.receiptSha256,
    runtimes: [...new Set(scenarios.map((entry) => entry.runtime))].sort(), projects: [...new Set(scenarios.map((entry) => entry.projectId))].sort(),
    mutationFailures: episodes.filter((entry) => entry.state.recoveryPhase === 'mutation-failure').length,
    recoveryPasses: episodes.filter((entry) => entry.state.recoveryPhase === 'recovery-pass').length,
    hiddenChainOfThoughtStored: false,
  };
  const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  await writeFile(path.join(outputDir, 'recovery-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

export async function verifyMutationRecoveryDataset({ outputDir } = {}) {
  if (!outputDir) throw new TypeError('outputDir is required');
  const [episodeText, scenarioText, receiptText] = await Promise.all([
    readFile(path.join(outputDir, 'recovery-episodes.jsonl'), 'utf8'),
    readFile(path.join(outputDir, 'recovery-scenarios.json'), 'utf8'),
    readFile(path.join(outputDir, 'recovery-receipt.json'), 'utf8'),
  ]);
  const receipt = JSON.parse(receiptText); const { receiptSha256, ...base } = receipt;
  if (canonicalSha256(base) !== receiptSha256) throw new Error('Mutation recovery receipt hash mismatch');
  const canonicalEpisodeText = canonicalText(episodeText);
  const canonicalScenarioText = canonicalText(scenarioText);
  if (sha256(canonicalEpisodeText) !== receipt.recoveryEpisodesSha256 || sha256(canonicalScenarioText) !== receipt.recoveryScenariosSha256) throw new Error('Mutation recovery dataset hash mismatch');
  const lines = canonicalEpisodeText.split('\n').filter(Boolean);
  if (lines.length !== receipt.episodeCount) throw new Error('Mutation recovery episode count mismatch');
  const episodes = lines.map((line, index) => {
    const value = JSON.parse(line); const { receiptSha256: episodeHash, ...episodeBase } = value;
    if (canonicalSha256(episodeBase) !== episodeHash) throw new Error(`Mutation recovery episode ${index} hash mismatch`);
    return deepFreeze(value);
  });
  const scenarios = JSON.parse(canonicalScenarioText);
  if (!Array.isArray(scenarios) || scenarios.length !== receipt.scenarioCount) throw new Error('Mutation recovery scenario count mismatch');
  if (episodes.filter((entry) => entry.state.recoveryPhase === 'mutation-failure').length !== receipt.mutationFailures) throw new Error('Mutation failure count mismatch');
  if (episodes.filter((entry) => entry.state.recoveryPhase === 'recovery-pass').length !== receipt.recoveryPasses) throw new Error('Recovery pass count mismatch');
  return deepFreeze({ ...receipt, episodes, scenarios });
}
