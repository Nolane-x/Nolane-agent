import { spawn } from 'node:child_process';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const EXISTS = async (file) => access(file).then(() => true, () => false);
function freeze(value, seen = new WeakSet()) { if (!value || typeof value !== 'object' || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) freeze(child, seen); return Object.freeze(value); }
function bounded(value, fallback, min, max, label) { const number = value == null ? fallback : Number(value); if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${label} must be between ${min} and ${max}`); return number; }

async function defaultRunner({ command, args, cwd, timeoutMs = 120_000, signal }) {
  let stdout = ''; let stderr = ''; let timedOut = false;
  const child = spawn(command, args, { cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  child.stdout.on('data', (chunk) => { if (Buffer.byteLength(stdout) < 2_000_000) stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { if (Buffer.byteLength(stderr) < 2_000_000) stderr += chunk.toString(); });
  const kill = () => { try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {} };
  const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs); timer.unref?.();
  const abort = () => kill();
  if (signal?.aborted) abort(); else signal?.addEventListener?.('abort', abort, { once: true });
  const outcome = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (exitCode, signalName) => resolve({ exitCode, signalName })); })
    .finally(() => { clearTimeout(timer); signal?.removeEventListener?.('abort', abort); });
  return { ...outcome, stdout, stderr, timedOut };
}

function relativeInside(root, value, label = 'path') {
  const text = String(value ?? '').replaceAll('\\', '/');
  if (!text) throw new TypeError(`${label} is required`);
  const absolute = path.resolve(root, text);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} is outside workspace`);
  return relative.replaceAll('\\', '/');
}

function managerFor(files) {
  if (files.has('pnpm-lock.yaml')) return 'pnpm';
  if (files.has('yarn.lock')) return 'yarn';
  if (files.has('bun.lockb') || files.has('bun.lock')) return 'bun';
  return 'npm';
}

function npmRun(manager, script, extra = []) {
  if (manager === 'npm') return { command: 'npm', args: script === 'test' ? ['test', ...extra] : ['run', script, ...extra] };
  if (manager === 'yarn') return { command: 'yarn', args: [script, ...extra] };
  if (manager === 'bun') return { command: 'bun', args: ['run', script, ...extra] };
  return { command: 'pnpm', args: ['run', script, ...extra] };
}

export class TestEngine {
  constructor({ workspaceRoot, runner = defaultRunner, timeoutMs = 120_000, clock = () => Date.now() } = {}) {
    this.workspaceRoot = path.resolve(String(workspaceRoot ?? ''));
    this.runner = runner;
    this.timeoutMs = bounded(timeoutMs, 120_000, 100, 24 * 60 * 60_000, 'timeoutMs');
    this.clock = clock;
  }

  async #rootFiles() {
    const candidates = ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock', 'pyproject.toml', 'pytest.ini', 'tox.ini', 'go.mod', 'Cargo.toml'];
    const found = new Set();
    await Promise.all(candidates.map(async (name) => { if (await EXISTS(path.join(this.workspaceRoot, name))) found.add(name); }));
    return found;
  }

  async detect() {
    const files = await this.#rootFiles();
    const result = [];
    if (files.has('package.json')) {
      let pkg;
      try { pkg = JSON.parse(await readFile(path.join(this.workspaceRoot, 'package.json'), 'utf8')); } catch { throw new Error('package.json is invalid JSON'); }
      const dependencies = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      let id = 'node-test';
      if (dependencies.vitest) id = 'node-vitest'; else if (dependencies.jest) id = 'node-jest'; else if (dependencies.mocha) id = 'node-mocha';
      result.push(freeze({ id, language: 'javascript', packageManager: managerFor(files), scripts: { ...(pkg.scripts ?? {}) }, root: '.' }));
      return result;
    }
    if (files.has('pyproject.toml') || files.has('pytest.ini') || files.has('tox.ini')) {
      const content = files.has('pyproject.toml') ? await readFile(path.join(this.workspaceRoot, 'pyproject.toml'), 'utf8') : '';
      result.push(freeze({ id: /pytest/i.test(content) || files.has('pytest.ini') ? 'python-pytest' : 'python-unittest', language: 'python', root: '.' }));
      return result;
    }
    if (files.has('go.mod')) { result.push(freeze({ id: 'go-test', language: 'go', root: '.' })); return result; }
    if (files.has('Cargo.toml')) { result.push(freeze({ id: 'rust-cargo-test', language: 'rust', root: '.' })); return result; }
    return result;
  }

  #nodeStep(framework, scope, input = {}) {
    const manager = framework.packageManager;
    const scripts = framework.scripts ?? {};
    if (scope === 'unit' || scope === 'integration') {
      const script = `test:${scope}`;
      if (!scripts[script]) throw new Error(`No ${script} script is configured`);
      return { scope, ...npmRun(manager, script) };
    }
    if (framework.id === 'node-test' && scope === 'file') return { scope, command: 'node', args: ['--test', relativeInside(this.workspaceRoot, input.path)] };
    if (framework.id === 'node-test' && scope === 'module') return { scope, command: 'node', args: ['--test', relativeInside(this.workspaceRoot, input.path ?? 'tests')] };
    if (scope === 'file') {
      const executable = framework.id === 'node-vitest' ? 'vitest' : framework.id === 'node-jest' ? 'jest' : 'mocha';
      return { scope, ...npmRun(manager, 'test', ['--', executable === 'vitest' ? 'run' : '', relativeInside(this.workspaceRoot, input.path)].filter(Boolean)) };
    }
    if (scope === 'module') return { scope, ...npmRun(manager, 'test', ['--', relativeInside(this.workspaceRoot, input.path ?? 'tests')]) };
    if (scope === 'package') return { scope, ...npmRun(manager, 'test') };
    return { scope: 'full', ...npmRun(manager, 'test', ['--', '--test-reporter=spec']) };
  }

  #step(framework, scope, input = {}) {
    if (framework.id.startsWith('node-')) return this.#nodeStep(framework, scope, input);
    if (framework.id === 'python-pytest') {
      const args = ['-m', 'pytest']; if (scope === 'file' || scope === 'module') args.push(relativeInside(this.workspaceRoot, input.path));
      if (scope === 'unit') args.push('-m', 'unit'); if (scope === 'integration') args.push('-m', 'integration');
      return { scope, command: input.python ?? 'python3', args };
    }
    if (framework.id === 'python-unittest') return { scope, command: input.python ?? 'python3', args: ['-m', 'unittest', scope === 'file' ? relativeInside(this.workspaceRoot, input.path) : 'discover'] };
    if (framework.id === 'go-test') return { scope, command: 'go', args: ['test', scope === 'file' || scope === 'module' ? relativeInside(this.workspaceRoot, input.path) : './...'] };
    if (framework.id === 'rust-cargo-test') return { scope, command: 'cargo', args: ['test', ...(scope === 'file' && input.name ? [String(input.name)] : [])] };
    throw new Error(`Unsupported test framework: ${framework.id}`);
  }

  async plan({ changedPaths = [], relatedTests = [], includeFull = true } = {}) {
    const [framework] = await this.detect();
    if (!framework) throw Object.assign(new Error('No supported test framework detected'), { code: 'TEST_FRAMEWORK_NOT_FOUND' });
    const steps = [];
    if (relatedTests.length) steps.push(this.#step(framework, 'file', { path: relatedTests[0] }));
    if (changedPaths.length) {
      const related = relatedTests[0] ?? 'tests';
      steps.push(this.#step(framework, 'module', { path: path.posix.dirname(relativeInside(this.workspaceRoot, related)) || 'tests' }));
    }
    steps.push(this.#step(framework, 'package'));
    if (includeFull) steps.push(this.#step(framework, 'full'));
    return freeze({ schema: 'forge.test-plan.v1', framework, steps });
  }

  async run(input = {}) {
    const scope = String(input.scope ?? 'full');
    if (!['file', 'module', 'package', 'full', 'unit', 'integration'].includes(scope)) throw new TypeError('Unsupported test scope');
    const [framework] = await this.detect();
    if (!framework) throw Object.assign(new Error('No supported test framework detected'), { code: 'TEST_FRAMEWORK_NOT_FOUND' });
    const step = this.#step(framework, scope, input);
    const startedAt = new Date(this.clock()).toISOString();
    const result = await this.runner({ command: step.command, args: [...step.args], cwd: this.workspaceRoot, shell: false, timeoutMs: bounded(input.timeoutMs, this.timeoutMs, 100, 24 * 60 * 60_000, 'timeoutMs'), signal: input.signal });
    const status = result.timedOut ? 'timeout' : result.exitCode === 0 ? 'pass' : 'fail';
    const output = freeze({ exitCode: result.exitCode, signal: result.signalName ?? result.signal ?? null, timedOut: Boolean(result.timedOut), stdout: String(result.stdout ?? ''), stderr: String(result.stderr ?? '') });
    const base = { schema: 'forge.test-receipt.v1', framework: framework.id, scope, command: step.command, args: step.args, cwd: '.', status, startedAt, finishedAt: new Date(this.clock()).toISOString(), outputSha256: canonicalSha256(output) };
    return freeze({ status, framework, step, output, receipt: { ...base, receiptSha256: canonicalSha256(base) } });
  }
}
