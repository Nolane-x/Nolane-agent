import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256, canonicalStringify, deepFreeze } from './shared.mjs';
import { validateTrajectoryEpisode } from './trajectory-schema.mjs';

const RUNTIMES = Object.freeze({
  node: () => process.execPath,
  go: () => process.env.GO_BINARY || 'go',
  python: () => process.env.PYTHON_BINARY || 'python3',
});
const HIDDEN = /(?:chain.?of.?thought|hidden.?reasoning|reasoning.?trace|private.?scratchpad)/i;

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function scanPublic(value, cursor = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (HIDDEN.test(key)) throw new TypeError(`Hidden reasoning is forbidden at ${cursor}.${key}`);
    scanPublic(child, `${cursor}.${key}`);
  }
}
function relativeString(value, label) {
  const text = String(value ?? '').trim();
  if (!text || path.isAbsolute(text)) throw new TypeError(`${label} must be a non-empty relative path`);
  return text.replaceAll('\\', '/');
}
async function safeDirectory(rootReal, relativePath, label) {
  const normalized = relativeString(relativePath, label);
  const candidate = path.resolve(rootReal, normalized);
  const relative = path.relative(rootReal, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} is outside repository root: ${normalized}`);
  const stat = await fs.lstat(candidate);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${label} must be a real directory: ${normalized}`);
  const real = await fs.realpath(candidate);
  const realRelative = path.relative(rootReal, real);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new Error(`${label} is outside repository root: ${normalized}`);
  return { absolutePath: real, relativePath: normalized };
}
async function safeFile(projectRoot, relativePath, label) {
  const normalized = relativeString(relativePath, label);
  const candidate = path.resolve(projectRoot, normalized);
  const relative = path.relative(projectRoot, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} is outside project root: ${normalized}`);
  const stat = await fs.lstat(candidate);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} must be a real file: ${normalized}`);
  const real = await fs.realpath(candidate);
  const realRelative = path.relative(projectRoot, real);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new Error(`${label} is outside project root: ${normalized}`);
  return { absolutePath: real, relativePath: normalized };
}
async function fileSha256(file) { return sha256(await fs.readFile(file)); }
function normalizedArgv(value) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError('argv must be a non-empty array');
  return value.map((item, index) => {
    const text = String(item ?? '');
    if (!text || text.includes('\0')) throw new TypeError(`argv[${index}] is invalid`);
    return text;
  });
}
function runtimeExecutable(runtime) {
  const key = String(runtime ?? '').trim();
  const resolver = RUNTIMES[key];
  if (!resolver) throw new TypeError(`Unsupported runtime: ${key || '(missing)'}`);
  return { runtime: key, executable: resolver() };
}
function execute({ cwd, executable, argv, timeoutMs, maxOutputBytes }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, argv, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', PYTHONDONTWRITEBYTECODE: '1' },
    });
    const started = process.hrtime.bigint();
    const stdout = []; const stderr = [];
    let stdoutBytes = 0; let stderrBytes = 0; let timedOut = false;
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
        executable,
        argv: [executable, ...argv],
        exitCode: Number.isInteger(code) ? code : null,
        signal: signal ?? null,
        timedOut,
        durationMs: Number(durationMs.toFixed(3)),
        stdoutSha256: sha256(Buffer.concat(stdout)),
        stderrSha256: sha256(Buffer.concat(stderr)),
        stdoutBytes,
        stderrBytes,
        outputTruncated: stdoutBytes > maxOutputBytes || stderrBytes > maxOutputBytes,
      }));
    });
  });
}
function validateProbe(raw) {
  if (!raw || typeof raw !== 'object') throw new TypeError('Multi-runtime probe is required');
  scanPublic(raw);
  const probe = structuredClone(raw);
  for (const key of ['id', 'projectId', 'projectRoot', 'runtime', 'argv', 'sourcePaths', 'testPaths', 'kind', 'actionType', 'state']) {
    if (probe[key] === undefined) throw new TypeError(`Multi-runtime probe requires ${key}`);
  }
  if (!Array.isArray(probe.sourcePaths) || probe.sourcePaths.length === 0) throw new TypeError('sourcePaths must be a non-empty array');
  if (!Array.isArray(probe.testPaths) || probe.testPaths.length === 0) throw new TypeError('testPaths must be a non-empty array');
  probe.argv = normalizedArgv(probe.argv);
  return probe;
}

export async function collectMultiRuntimeTrajectories({ root, probes, timeoutMs = 60_000, maxOutputBytes = 1_048_576 } = {}) {
  if (!root) throw new TypeError('Repository root is required');
  if (!Array.isArray(probes) || probes.length === 0) throw new TypeError('At least one multi-runtime probe is required');
  const rootReal = await fs.realpath(root);
  const ids = new Set(); const attempts = []; const episodes = []; const excluded = [];

  for (const raw of probes) {
    const probe = validateProbe(raw);
    if (ids.has(probe.id)) throw new Error(`Duplicate multi-runtime probe: ${probe.id}`);
    ids.add(probe.id);
    const project = await safeDirectory(rootReal, probe.projectRoot, 'project root');
    const { runtime, executable } = runtimeExecutable(probe.runtime);
    const sources = await Promise.all(probe.sourcePaths.map((entry, index) => safeFile(project.absolutePath, entry, `sourcePaths[${index}]`)));
    const tests = await Promise.all(probe.testPaths.map((entry, index) => safeFile(project.absolutePath, entry, `testPaths[${index}]`)));
    const sourceSha256ByPath = Object.fromEntries(await Promise.all(sources.map(async (entry) => [entry.relativePath, await fileSha256(entry.absolutePath)])));
    const testSha256ByPath = Object.fromEntries(await Promise.all(tests.map(async (entry) => [entry.relativePath, await fileSha256(entry.absolutePath)])));
    const execution = await execute({ cwd: project.absolutePath, executable, argv: probe.argv, timeoutMs, maxOutputBytes });
    const attemptBase = {
      schema: 'nolane.small-model.multi-runtime-attempt.v1', id: String(probe.id), projectId: String(probe.projectId), projectRoot: project.relativePath,
      runtime, sourceSha256ByPath, testSha256ByPath, execution,
    };
    const attempt = deepFreeze({ ...attemptBase, receiptSha256: canonicalSha256(attemptBase) });
    attempts.push(attempt);
    const expectedExitCode = Number.isInteger(probe.expectedExitCode) ? probe.expectedExitCode : 0;
    if (execution.timedOut || execution.exitCode !== expectedExitCode) {
      excluded.push(deepFreeze({ id: String(probe.id), projectId: String(probe.projectId), runtime, reason: execution.timedOut ? 'verifier-timeout' : 'unexpected-exit-code', expectedExitCode, exitCode: execution.exitCode, attemptReceiptSha256: attempt.receiptSha256 }));
      continue;
    }
    const episodeBase = validateTrajectoryEpisode({
      id: String(probe.id), kind: String(probe.kind),
      state: { ...structuredClone(probe.state), projectId: String(probe.projectId), projectRoot: project.relativePath, runtime, sourceSha256ByPath, testSha256ByPath },
      action: { type: String(probe.actionType), executable, argv: execution.argv, shell: false },
      expectedEffect: probe.expectedEffect ?? { verifierExitCode: expectedExitCode },
      actualEffect: { changed: true, criterionDelta: 1, informationGain: 1, verifierExitCode: execution.exitCode },
      verifier: { id: `${runtime}-test-runner`, valid: true, rewardHacking: false, exitCode: execution.exitCode, timedOut: execution.timedOut, stdoutSha256: execution.stdoutSha256, stderrSha256: execution.stderrSha256, attemptReceiptSha256: attempt.receiptSha256 },
      cost: { durationMs: execution.durationMs, stdoutBytes: execution.stdoutBytes, stderrBytes: execution.stderrBytes },
    });
    episodes.push(deepFreeze({ ...structuredClone(episodeBase), receiptSha256: canonicalSha256(episodeBase) }));
  }
  const summary = { schema: 'nolane.small-model.multi-runtime-trajectory-collection.v1', attempts: attempts.map((entry) => entry.receiptSha256), episodes: episodes.map((entry) => entry.receiptSha256), excluded: excluded.map((entry) => ({ id: entry.id, reason: entry.reason, attemptReceiptSha256: entry.attemptReceiptSha256 })) };
  return deepFreeze({ ...summary, attempts, episodes, excluded, receiptSha256: canonicalSha256(summary) });
}

export async function writeMultiRuntimeTrajectoryDataset({ outputDir, collection } = {}) {
  if (!outputDir) throw new TypeError('outputDir is required');
  if (!collection?.episodes || !Array.isArray(collection.episodes)) throw new TypeError('collection is required');
  await fs.mkdir(outputDir, { recursive: true });
  const ordered = [...collection.episodes].sort((a, b) => a.id.localeCompare(b.id));
  const text = ordered.map((entry) => canonicalStringify(entry)).join('\n') + (ordered.length ? '\n' : '');
  const executionEpisodesSha256 = sha256(text);
  await fs.writeFile(path.join(outputDir, 'execution-episodes.jsonl'), text);
  const runtimes = [...new Set(ordered.map((entry) => entry.state.runtime))].sort();
  const projects = [...new Set(ordered.map((entry) => entry.state.projectId))].sort();
  const base = { schema: 'nolane.small-model.multi-runtime-trajectory-dataset.v1', episodeCount: ordered.length, attemptCount: collection.attempts?.length ?? ordered.length, excludedCount: collection.excluded?.length ?? 0, executionEpisodesSha256, collectionReceiptSha256: collection.receiptSha256, runtimes, projects, hiddenChainOfThoughtStored: false };
  const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  await fs.writeFile(path.join(outputDir, 'execution-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

export async function verifyMultiRuntimeTrajectoryDataset({ outputDir } = {}) {
  if (!outputDir) throw new TypeError('outputDir is required');
  const [text, receiptText] = await Promise.all([
    fs.readFile(path.join(outputDir, 'execution-episodes.jsonl'), 'utf8'),
    fs.readFile(path.join(outputDir, 'execution-receipt.json'), 'utf8'),
  ]);
  const receipt = JSON.parse(receiptText);
  const { receiptSha256, ...base } = receipt;
  if (canonicalSha256(base) !== receiptSha256) throw new Error('Multi-runtime trajectory receipt hash mismatch');
  if (sha256(text) !== receipt.executionEpisodesSha256) throw new Error('Multi-runtime execution episodes hash mismatch');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length !== receipt.episodeCount) throw new Error('Multi-runtime trajectory episode count mismatch');
  const episodes = lines.map((line, index) => {
    const value = JSON.parse(line);
    const { receiptSha256: episodeHash, ...episodeBase } = value;
    if (canonicalSha256(episodeBase) !== episodeHash) throw new Error(`Multi-runtime episode ${index} hash mismatch`);
    return deepFreeze(value);
  });
  const runtimes = [...new Set(episodes.map((entry) => entry.state.runtime))].sort();
  const projects = [...new Set(episodes.map((entry) => entry.state.projectId))].sort();
  if (canonicalStringify(runtimes) !== canonicalStringify(receipt.runtimes) || canonicalStringify(projects) !== canonicalStringify(receipt.projects)) throw new Error('Multi-runtime dataset identity mismatch');
  return deepFreeze({ ...receipt, episodes });
}
