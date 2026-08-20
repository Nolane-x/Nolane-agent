#!/usr/bin/env node
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ISOLATED_TESTS = new Set([
  'electron-packaging.test.mjs',
  'packaging.test.mjs',
  'performance.test.mjs',
  'project-manifest-generation.test.mjs',
  'release-artifacts.test.mjs',
  'release-tooling.test.mjs',
  'source-reconstruction.test.mjs',
  'update-release-tools.test.mjs',
  'worktree-integration-service.test.mjs',
  'nolane-program-registry.test.mjs',
  'vscode-collaboration-experience.test.mjs',
  'vscode-legacy-migration.test.mjs',
  'vscode-local-worktree-handoff.test.mjs',
  'vscode-mission-state-bridge.test.mjs',
  'vscode-security-certification-state.test.mjs',
  'tool-broker.test.mjs',
  'terminal-service.test.mjs',
  'adaptive-microkernel-app-wiring.test.mjs',
  'model-provider.test.mjs',
  'nolane-native-capability-pack.test.mjs',
  'small-model-checkpoint-6-foundation.test.mjs',
  'small-model-checkpoint-7-foundation.test.mjs',
  'small-model-checkpoint-7-http.test.mjs',
  'code-intelligence-v2.test.mjs',
  'codex-session-reuse.test.mjs',
  'codex-app-server.test.mjs',
  'execution-process-lifecycle-contracts.test.mjs',
]);
const PARALLEL_BATCH_SIZE = 32;
const GIBIBYTE = 1024 ** 3;
const LOCAL_PACKAGING_SMOKE_TESTS = new Set([
  'electron-packaging.test.mjs',
  'packaging.test.mjs',
]);
const SERIAL_TESTS = new Set([
  'packaging.test.mjs',
  'release-artifacts.test.mjs',
  'release-tooling.test.mjs',
  'nolane-program-registry.test.mjs',
  'vscode-collaboration-experience.test.mjs',
  'vscode-legacy-migration.test.mjs',
  'vscode-local-worktree-handoff.test.mjs',
  'vscode-mission-state-bridge.test.mjs',
  'vscode-security-certification-state.test.mjs',
  'adaptive-microkernel-app-wiring.test.mjs',
  'model-provider.test.mjs',
  'nolane-native-capability-pack.test.mjs',
  'small-model-checkpoint-6-foundation.test.mjs',
  'small-model-checkpoint-7-foundation.test.mjs',
  'small-model-checkpoint-7-http.test.mjs',
  'code-intelligence-v2.test.mjs',
  'codex-session-reuse.test.mjs',
  'codex-app-server.test.mjs',
  'execution-process-lifecycle-contracts.test.mjs',
]);

export async function buildNodeTestPlan(testsDirectory = path.resolve('tests'), {
  skipLocalPackagingSmoke = process.env.NOLANE_AGENT_SKIP_LOCAL_PACKAGING_SMOKE === '1',
} = {}) {
  const entries = await readdir(testsDirectory, { withFileTypes: true });
  const discovered = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.mjs'))
    .map((entry) => path.join(testsDirectory, entry.name))
    .sort();
  const skipped = skipLocalPackagingSmoke
    ? discovered.filter((file) => LOCAL_PACKAGING_SMOKE_TESTS.has(path.basename(file)))
    : [];
  const skippedNames = new Set(skipped.map((file) => path.basename(file)));
  const scheduledCandidates = discovered.filter((file) => !skipped.includes(file));

  const isolated = scheduledCandidates.filter((file) => ISOLATED_TESTS.has(path.basename(file)));
  const parallel = scheduledCandidates.filter((file) => !ISOLATED_TESTS.has(path.basename(file)));
  const scheduled = [...parallel, ...isolated];

  if (scheduled.length !== scheduledCandidates.length || new Set(scheduled).size !== scheduledCandidates.length) {
    throw new Error('Node test plan must schedule every discovered test exactly once');
  }
  const requiredIsolated = [...ISOLATED_TESTS].filter((name) => !skippedNames.has(name));
  if (isolated.length !== requiredIsolated.length) {
    const missing = requiredIsolated.filter((name) => !isolated.some((file) => path.basename(file) === name));
    throw new Error(`Missing isolated test files: ${missing.join(', ')}`);
  }

  const parallelBatches = [];
  for (let index = 0; index < parallel.length; index += PARALLEL_BATCH_SIZE) {
    parallelBatches.push(Object.freeze(parallel.slice(index, index + PARALLEL_BATCH_SIZE)));
  }

  const serial = isolated.filter((file) => SERIAL_TESTS.has(path.basename(file)));
  const isolatedBatch = isolated.filter((file) => !SERIAL_TESTS.has(path.basename(file)));
  const requiredSerial = [...SERIAL_TESTS].filter((name) => !skippedNames.has(name));
  if (serial.length !== requiredSerial.length) {
    const missing = requiredSerial.filter((name) => !serial.some((file) => path.basename(file) === name));
    throw new Error(`Missing serial test files: ${missing.join(', ')}`);
  }

  return Object.freeze({
    testsDirectory,
    discovered: Object.freeze(discovered),
    skipped: Object.freeze(skipped),
    parallel: Object.freeze(parallel),
    parallelBatches: Object.freeze(parallelBatches),
    isolated: Object.freeze(isolated),
    isolatedBatch: Object.freeze(isolatedBatch),
    serial: Object.freeze(serial),
  });
}

export function buildNodeTestArgs(files, { concurrency }) {
  const noForceExit = new Set(['agent-modes-http-api.test.mjs', 'agent-operations-http-api.test.mjs', 'alpha4-foundation-http.test.mjs', 'alpha5-production-wiring.test.mjs', 'code-relationship-http-api.test.mjs', 'codebase-knowledge-http-api.test.mjs', 'diff-review-http-api.test.mjs', 'evidence-runtime-http-api.test.mjs', 'http-boundary-errors.test.mjs', 'lsp-intelligence.test.mjs', 'route-security-telemetry.test.mjs', 'web-intelligence.test.mjs']);
  const shouldAvoidForceExit = files.length > 0 && files.every((file) => {
    const name = path.basename(file);
    return noForceExit.has(name) || /(?:^|-)http(?:-|\.|$)/.test(name) || /(?:-app-wiring|-api)\.test\.mjs$/.test(name);
  });
  return [
    '--test',
    `--test-concurrency=${concurrency}`,
    '--test-reporter=dot',
    ...(shouldAvoidForceExit ? [] : ['--test-force-exit']),
    ...files,
  ];
}

export function countDotReporterTests(output) {
  return String(output)
    .replace(/\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    .split(/\r?\n/)
    .filter((line) => /^[.X]+$/.test(line))
    .reduce((total, line) => total + line.length, 0);
}

export function resolveParallelWorkerCount({
  configuredWorkers = Number(process.env.NOLANE_AGENT_TEST_WORKERS),
  cleanRoom = process.env.NOLANE_AGENT_CLEAN_ROOM === '1',
  freeMemoryBytes = os.freemem(),
} = {}) {
  if (Number.isInteger(configuredWorkers) && configuredWorkers > 0) return Math.min(configuredWorkers, 32);
  if (cleanRoom) return 32;
  const free = Number(freeMemoryBytes);
  if (!Number.isFinite(free) || free < 1.5 * GIBIBYTE) return 1;
  if (free < 3 * GIBIBYTE) return 2;
  return 4;
}

export function runNodeTests(files, { concurrency, label, quiet = false }) {
  if (files.length === 0) return Promise.resolve(0);
  const args = buildNodeTestArgs(files, { concurrency });
  if (!quiet) process.stdout.write(`\n=== ${label}: ${files.length} test files (concurrency ${concurrency}) ===\n`);
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env };
    delete childEnv.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'inherit'],
      env: childEnv,
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      if (!quiet) process.stdout.write(text);
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve(countDotReporterTests(output));
        return;
      }
      reject(new Error(`${label} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}\n${output}`));
    });
  });
}

async function createTestCache() {
  let commit = 'unknown';
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
  let workspaceDirty = false;
  try {
    workspaceDirty = Boolean(execFileSync('git', ['status', '--porcelain=v1'], { encoding: 'utf8', maxBuffer: 4_000_000 }).trim());
  } catch {
    // A non-git checkout is never safe to cache by commit identity alone.
    workspaceDirty = true;
  }
  const cacheDirectory = path.resolve('release/.cache/node-test-suite');
  // Generated receipts are only reusable from a clean checkout. A dirty tree
  // changes independently of HEAD (including untracked tests), so allocate a
  // per-run cache namespace instead of silently reusing stale test results.
  const cacheKey = workspaceDirty ? `${commit}-dirty-${process.pid}-${Date.now()}` : commit;
  const cachePath = path.join(cacheDirectory, `${cacheKey}-${process.platform}-${process.arch}-${process.version.replaceAll('/', '_')}.json`);
  await mkdir(cacheDirectory, { recursive: true });
  let state = { schema: 'nolane.node-test-cache.v1', commit, workspaceDirty, platform: process.platform, arch: process.arch, node: process.version, passed: {} };
  if (!workspaceDirty) {
    try {
      const parsed = JSON.parse(await readFile(cachePath, 'utf8'));
      if (parsed.commit === commit && parsed.workspaceDirty === false && parsed.platform === process.platform && parsed.arch === process.arch && parsed.node === process.version) state = parsed;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let saveChain = Promise.resolve();
  const persist = () => {
    saveChain = saveChain.then(async () => {
      const temporary = `${cachePath}.${process.pid}.tmp`;
      await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
      await rename(temporary, cachePath);
    });
    return saveChain;
  };
  return {
    commit,
    cachePath,
    has(file) { return Number.isInteger(state.passed[path.relative(process.cwd(), file)]); },
    count(file) { return Number(state.passed[path.relative(process.cwd(), file)] ?? 0); },
    async record(file, count) { state.passed[path.relative(process.cwd(), file)] = Number(count); await persist(); },
    async flush() { await saveChain; },
    summary() { return { cachedFiles: Object.keys(state.passed).length, cachePath: path.relative(process.cwd(), cachePath), commit, workspaceDirty }; },
  };
}

export async function runNodeTestFilePool(files, { concurrency = 8, label = 'Parallel file pool', cache = null } = {}) {
  if (files.length === 0) return 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, files.length));
  const cached = cache ? files.filter((file) => cache.has(file)) : [];
  const pending = cache ? files.filter((file) => !cache.has(file)) : files;
  process.stdout.write(`\n=== ${label}: ${files.length} isolated test files (workers ${workerCount}, cached ${cached.length}) ===\n`);
  let cursor = 0;
  let completed = cached.length;
  let passedTests = cached.reduce((sum, file) => sum + cache.count(file), 0);
  if (cached.length) process.stdout.write(`Reused ${cached.length} same-commit file receipts.\n`);
  const failedFiles = [];
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= pending.length) return;
      const file = pending[index];
      try {
        const count = await runNodeTests([file], { concurrency: 1, label: path.basename(file), quiet: true });
        passedTests += count;
        await cache?.record(file, count);
        completed += 1;
        process.stdout.write(completed % 50 === 0 ? `. ${completed}/${files.length}\n` : '.');
      } catch (error) {
        // Defer one bounded retry until every sibling has exited. This keeps
        // a transient PTY/LSP/MCP startup failure from retrying inside the
        // same resource contention window, while preserving a real second
        // failure as a hard suite failure.
        failedFiles.push(Object.freeze({ file, error }));
      }
    }
  };
  await Promise.all(Array.from({ length: workerCount }, worker));
  for (const { file, error: firstError } of failedFiles) {
    process.stdout.write(`\nRetrying ${path.basename(file)} once after isolated failure.\n`);
    try {
      const count = await runNodeTests([file], { concurrency: 1, label: `${path.basename(file)} retry`, quiet: true });
      passedTests += count;
      await cache?.record(file, count);
      completed += 1;
      process.stdout.write(completed % 50 === 0 ? `. ${completed}/${files.length}\n` : '.');
    } catch (retryError) {
      retryError.cause = firstError;
      throw retryError;
    }
  }
  await cache?.flush();
  if (completed % 50 !== 0) process.stdout.write(` ${completed}/${files.length}\n`);
  return passedTests;
}

async function runCachedSingle(file, cache, label) {
  if (cache.has(file)) {
    process.stdout.write(`\n=== ${label}: cached same-commit receipt ===\n`);
    return cache.count(file);
  }
  const count = await runNodeTests([file], { concurrency: 1, label });
  await cache.record(file, count);
  return count;
}

export async function runNodeTestSuite() {
  const plan = await buildNodeTestPlan();
  const cache = await createTestCache();
  process.stdout.write(`Discovered ${plan.discovered.length} Node test files; every file is scheduled exactly once.\n`);
  if (plan.skipped.length) process.stdout.write(`Local policy skipped packaging smoke: ${plan.skipped.map((file) => path.basename(file)).join(', ')}.\n`);
  process.stdout.write(`Test cache: ${cache.summary().cachePath} @ ${cache.commit}\n`);
  let passedTests = 0;
  const parallelWorkers = resolveParallelWorkerCount();
  passedTests += await runNodeTestFilePool(plan.parallel, { concurrency: parallelWorkers, label: 'Parallel isolated-file pool', cache });
  passedTests += await runNodeTestFilePool(plan.isolatedBatch, { concurrency: 4, label: 'Bounded packaging and integration pool', cache });
  for (const file of plan.serial) passedTests += await runCachedSingle(file, cache, `Serial ${path.basename(file)}`);
  await cache.flush();
  process.stdout.write(`\nNode test suite complete: ${passedTests} tests across ${plan.discovered.length}/${plan.discovered.length} files passed.\n`);
  process.stdout.write(`Cached receipts: ${cache.summary().cachedFiles}/${plan.discovered.length} files.\n`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runNodeTestSuite().catch((error) => {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  });
}
