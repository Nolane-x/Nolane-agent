import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256, canonicalStringify, deepFreeze } from './shared.mjs';
import { validateTrajectoryEpisode } from './trajectory-schema.mjs';

const HIDDEN = /(?:chain.?of.?thought|hidden.?reasoning|reasoning.?trace|private.?scratchpad)/i;
const SHA256 = /^[a-f0-9]{64}$/;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
function canonicalText(value) { return String(value).replace(/\r\n?/g, '\n'); }

function scanPublic(value, cursor = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (HIDDEN.test(key)) throw new TypeError(`Hidden reasoning is forbidden at ${cursor}.${key}`);
    scanPublic(child, `${cursor}.${key}`);
  }
}

async function resolveRepositoryFile(root, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0 || path.isAbsolute(relativePath)) {
    throw new TypeError('Repository path must be a non-empty relative path');
  }
  const rootReal = await fs.realpath(root);
  const candidate = path.resolve(rootReal, relativePath);
  const relative = path.relative(rootReal, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Path is outside repository root: ${relativePath}`);
  const stat = await fs.lstat(candidate);
  if (stat.isSymbolicLink()) throw new Error(`Repository trajectory paths cannot be symbolic links: ${relativePath}`);
  if (!stat.isFile()) throw new Error(`Repository trajectory path must be a file: ${relativePath}`);
  const real = await fs.realpath(candidate);
  const realRelative = path.relative(rootReal, real);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new Error(`Path is outside repository root: ${relativePath}`);
  return { absolutePath: real, relativePath: relativePath.replaceAll('\\', '/') };
}

async function fileSha256(filePath) {
  return sha256(await fs.readFile(filePath));
}

async function discoverSourcePaths(root, test) {
  const source = await fs.readFile(test.absolutePath, 'utf8');
  const imports = new Set();
  const pattern = /(?:from\s*|import\s*\()(['"])([^'"]+)\1/g;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[2];
    if (!specifier.startsWith('.')) continue;
    const absolute = path.resolve(path.dirname(test.absolutePath), specifier);
    const relative = path.relative(root, absolute).replaceAll('\\', '/');
    if (relative === 'src' || relative.startsWith('src/')) imports.add(relative);
  }
  if (imports.size === 0) throw new Error(`No repository source imports discovered for ${test.relativePath}`);
  return [...imports].sort();
}

function runNodeTest({ cwd, testPath, timeoutMs, maxOutputBytes }) {
  return new Promise((resolve, reject) => {
    const argv = ['--test', testPath];
    const child = spawn(process.execPath, argv, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: Object.assign({}, process.env, { NO_COLOR: '1', FORCE_COLOR: '0' }, { NODE_TEST_CONTEXT: undefined }),
    });
    const started = process.hrtime.bigint();
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    const append = (chunks, chunk, kind) => {
      const current = kind === 'stdout' ? stdoutBytes : stderrBytes;
      const remaining = Math.max(0, maxOutputBytes - current);
      if (remaining > 0) chunks.push(chunk.subarray(0, remaining));
      if (kind === 'stdout') stdoutBytes += chunk.length;
      else stderrBytes += chunk.length;
    };
    child.stdout.on('data', (chunk) => append(stdout, chunk, 'stdout'));
    child.stderr.on('data', (chunk) => append(stderr, chunk, 'stderr'));
    child.on('error', reject);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    timer.unref?.();
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      const stdoutBuffer = Buffer.concat(stdout);
      const stderrBuffer = Buffer.concat(stderr);
      resolve({
        executable: process.execPath,
        argv: [process.execPath, ...argv],
        exitCode: Number.isInteger(code) ? code : null,
        signal: signal ?? null,
        timedOut,
        durationMs: Math.round(durationMs * 1000) / 1000,
        stdoutSha256: sha256(stdoutBuffer),
        stderrSha256: sha256(stderrBuffer),
        stdoutBytes,
        stderrBytes,
        outputTruncated: stdoutBytes > maxOutputBytes || stderrBytes > maxOutputBytes,
      });
    });
  });
}

function validateProbe(probe) {
  if (!probe || typeof probe !== 'object') throw new TypeError('Repository trajectory probe is required');
  scanPublic(probe);
  for (const key of ['id', 'kind', 'actionType', 'testPath', 'state']) {
    if (probe[key] === undefined) throw new TypeError(`Repository trajectory probe requires ${key}`);
  }
  if (probe.sourcePaths !== 'auto' && !Array.isArray(probe.sourcePaths)) throw new TypeError('Repository trajectory probe sourcePaths must be an array or auto');
  return structuredClone(probe);
}

export async function collectRepositoryTrajectories({
  root,
  probes,
  timeoutMs = 30_000,
  maxOutputBytes = 1_048_576,
} = {}) {
  if (!root) throw new TypeError('Repository root is required');
  if (!Array.isArray(probes) || probes.length === 0) throw new TypeError('At least one repository trajectory probe is required');
  const rootReal = await fs.realpath(root);
  const episodes = [];
  const attempts = [];
  const excluded = [];
  const ids = new Set();

  for (const rawProbe of probes) {
    const probe = validateProbe(rawProbe);
    if (ids.has(probe.id)) throw new Error(`Duplicate repository trajectory probe: ${probe.id}`);
    ids.add(probe.id);
    const test = await resolveRepositoryFile(rootReal, probe.testPath);
    const sourcePaths = probe.sourcePaths === 'auto' ? await discoverSourcePaths(rootReal, test) : probe.sourcePaths;
    const sources = await Promise.all(sourcePaths.map((entry) => resolveRepositoryFile(rootReal, entry)));
    const sourceSha256ByPath = Object.fromEntries(await Promise.all(sources.map(async (entry) => [entry.relativePath, await fileSha256(entry.absolutePath)])));
    const testSha256 = await fileSha256(test.absolutePath);
    const execution = await runNodeTest({ cwd: rootReal, testPath: test.relativePath, timeoutMs, maxOutputBytes });
    const attemptBase = {
      id: String(probe.id),
      testPath: test.relativePath,
      testSha256,
      sourceSha256ByPath,
      execution,
    };
    const attempt = deepFreeze({ ...attemptBase, receiptSha256: canonicalSha256(attemptBase) });
    attempts.push(attempt);

    if (execution.exitCode !== 0 || execution.timedOut) {
      excluded.push(deepFreeze({
        id: String(probe.id),
        reason: execution.timedOut ? 'verifier-timeout' : 'verifier-failed',
        exitCode: execution.exitCode,
        signal: execution.signal,
        attemptReceiptSha256: attempt.receiptSha256,
      }));
      continue;
    }

    const validated = validateTrajectoryEpisode({
      id: String(probe.id),
      kind: probe.kind,
      state: {
        ...structuredClone(probe.state),
        repositoryRootIdentity: sha256(rootReal),
        testPath: test.relativePath,
        testSha256,
        sourceSha256ByPath,
      },
      action: {
        type: probe.actionType,
        executable: process.execPath,
        argv: execution.argv,
        shell: false,
      },
      expectedEffect: probe.expectedEffect ?? { verifierExitCode: 0 },
      actualEffect: {
        changed: true,
        criterionDelta: 1,
        informationGain: 1,
        verifierExitCode: execution.exitCode,
      },
      verifier: {
        id: 'node-test-runner',
        valid: true,
        rewardHacking: false,
        exitCode: execution.exitCode,
        timedOut: execution.timedOut,
        stdoutSha256: execution.stdoutSha256,
        stderrSha256: execution.stderrSha256,
        attemptReceiptSha256: attempt.receiptSha256,
      },
      cost: {
        durationMs: execution.durationMs,
        stdoutBytes: execution.stdoutBytes,
        stderrBytes: execution.stderrBytes,
      },
    });
    const episodeBase = structuredClone(validated);
    episodes.push(deepFreeze({ ...episodeBase, receiptSha256: canonicalSha256(episodeBase) }));
  }

  const summaryBase = {
    schema: 'nolane.small-model.repository-trajectory-collection.v1',
    attempts: attempts.map((entry) => entry.receiptSha256),
    episodes: episodes.map((entry) => entry.receiptSha256),
    excluded: excluded.map((entry) => ({ id: entry.id, reason: entry.reason, attemptReceiptSha256: entry.attemptReceiptSha256 })),
  };
  return deepFreeze({
    schema: summaryBase.schema,
    attempts,
    episodes,
    excluded,
    receiptSha256: canonicalSha256(summaryBase),
  });
}

export async function writeRepositoryTrajectoryDataset({ outputDir, collection } = {}) {
  if (!outputDir) throw new TypeError('Repository trajectory outputDir is required');
  if (!collection || !Array.isArray(collection.episodes)) throw new TypeError('Repository trajectory collection is required');
  await fs.mkdir(outputDir, { recursive: true });
  const orderedEpisodes = [...collection.episodes].sort((a, b) => a.id.localeCompare(b.id));
  const episodesText = orderedEpisodes.map((entry) => canonicalStringify(entry)).join('\n') + (orderedEpisodes.length ? '\n' : '');
  const canonicalEpisodesText = canonicalText(episodesText);
  const episodesSha256 = sha256(canonicalEpisodesText);
  await fs.writeFile(path.join(outputDir, 'episodes.jsonl'), canonicalEpisodesText);
  const base = {
    schema: 'nolane.small-model.repository-trajectory-dataset.v1',
    episodeCount: orderedEpisodes.length,
    attemptCount: collection.attempts?.length ?? orderedEpisodes.length,
    excludedCount: collection.excluded?.length ?? 0,
    episodeIds: orderedEpisodes.map((entry) => entry.id),
    episodeReceipts: orderedEpisodes.map((entry) => entry.receiptSha256),
    episodesSha256,
    collectionReceiptSha256: collection.receiptSha256,
  };
  const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  await fs.writeFile(path.join(outputDir, 'receipt.json'), `${canonicalStringify(receipt)}\n`);
  return receipt;
}

export async function verifyRepositoryTrajectoryDataset({ outputDir } = {}) {
  if (!outputDir) throw new TypeError('Repository trajectory outputDir is required');
  const episodesText = await fs.readFile(path.join(outputDir, 'episodes.jsonl'), 'utf8');
  const receipt = JSON.parse(await fs.readFile(path.join(outputDir, 'receipt.json'), 'utf8'));
  const canonicalEpisodesText = canonicalText(episodesText);
  const actualEpisodesSha256 = sha256(canonicalEpisodesText);
  if (!SHA256.test(receipt.episodesSha256) || actualEpisodesSha256 !== receipt.episodesSha256) throw new Error('Repository trajectory dataset hash mismatch');
  const lines = canonicalEpisodesText.split('\n').filter(Boolean);
  const episodes = lines.map((line) => JSON.parse(line));
  if (episodes.length !== receipt.episodeCount) throw new Error('Repository trajectory dataset episode count mismatch');
  for (const episode of episodes) {
    const { receiptSha256, ...base } = episode;
    validateTrajectoryEpisode(base);
    if (!SHA256.test(receiptSha256) || canonicalSha256(base) !== receiptSha256) throw new Error(`Repository trajectory episode hash mismatch: ${episode.id}`);
  }
  const { receiptSha256, ...base } = receipt;
  if (!SHA256.test(receiptSha256) || canonicalSha256(base) !== receiptSha256) throw new Error('Repository trajectory receipt hash mismatch');
  return deepFreeze({ valid: true, episodeCount: episodes.length, episodes, receiptSha256 });
}
