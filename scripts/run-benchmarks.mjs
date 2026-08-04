import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BenchmarkRunner } from '../src/benchmark/benchmark-runner.mjs';
import { validateBenchmarkSuite } from '../src/benchmark/benchmark-schema.mjs';
import { writeBenchmarkReport } from '../src/benchmark/report-writer.mjs';
import { VERSION } from '../src/version.mjs';

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    args.set(argv[index], argv[index + 1]);
    index += 1;
  }
  return args;
}

function runProcess({ command, args = [], cwd, env = {}, stdin = '', timeoutMs = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(command, args, {
      cwd,
      env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '', ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.on('error', reject);
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode: Number.isInteger(code) ? code : -1,
        signal: signal ?? null,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        durationMs: Date.now() - started,
        usage: { tokens: 0, costUsd: 0 },
        patch: '',
      });
    });
    child.stdin.end(String(stdin ?? ''));
  });
}

export async function runSelfBenchmark({ outputDirectory = 'release/benchmark-self-smoke' } = {}) {
  const directory = path.resolve(outputDirectory);
  const workspaces = path.join(directory, 'workspaces');
  await mkdir(workspaces, { recursive: true });
  const suite = validateBenchmarkSuite({
    schemaVersion: 1,
    id: 'forge-studio-self-smoke',
    version: 1,
    title: 'Forge Studio deterministic self-smoke',
    tasks: ['runtime-loop', 'tool-receipt', 'verification-gate'].map((id) => ({
      id,
      objective: `Exercise ${id} without an external model or comparative claim.`,
      budgets: { timeoutMs: 30_000, maxTokens: 1, maxCostUsd: 0.0001 },
      verify: [{ command: process.execPath, args: ['-e', 'process.exit(0)'], timeoutMs: 30_000 }],
    })),
  });
  await writeFile(path.join(directory, 'benchmark-suite.json'), `${JSON.stringify(suite, null, 2)}\n`);
  const runner = new BenchmarkRunner({
    workspaceFactory: async ({ task }) => {
      const workspace = path.join(workspaces, task.id);
      await mkdir(workspace, { recursive: true });
      return workspace;
    },
    processRunner: runProcess,
  });
  const adapter = {
    command: process.execPath,
    args: ['-e', "process.stdin.resume(); process.stdin.on('end',()=>process.exit(0));"],
    env: {},
  };
  const runs = [];
  for (const task of suite.tasks) runs.push(await runner.runTask({ system: `Forge Studio ${VERSION} self-smoke`, adapter, task, seed: 1 }));
  return writeBenchmarkReport({ outputDirectory: directory, suite, runs, independentEvidence: null, minimumTasks: 20 });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const report = await runSelfBenchmark({ outputDirectory: args.get('--output') ?? 'release/benchmark-self-smoke' });
  process.stdout.write(`${JSON.stringify({ runs: report.runs.length, independent: report.independent, claimAllowed: report.claimAllowed })}\n`);
}
