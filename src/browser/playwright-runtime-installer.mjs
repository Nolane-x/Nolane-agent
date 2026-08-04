import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chmod, copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

function required(value, label, max = 16_384) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  if (text.length > max) throw new TypeError(`${label} is too long`);
  return text;
}

async function defaultRunProcess({ executable, args, cwd = null, env = {}, timeoutMs = 600_000 }) {
  const child = spawn(executable, args, { cwd: cwd ?? undefined, env: { ...process.env, ...env }, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { if (Buffer.byteLength(stdout) < 2_000_000) stdout += chunk.toString('utf8'); });
  child.stderr.on('data', (chunk) => { if (Buffer.byteLength(stderr) < 2_000_000) stderr += chunk.toString('utf8'); });
  const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, Math.max(5_000, Number(timeoutMs) || 600_000));
  timer.unref?.();
  try {
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (exitCode, signal) => resolve({ exitCode: exitCode ?? 1, signal }));
    });
    return { ...result, stdout, stderr };
  } finally { clearTimeout(timer); }
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, file);
}

async function treeDigest(root, { maxFiles = 100_000, maxBytes = 3_000_000_000 } = {}) {
  const base = await realpath(root);
  const hash = createHash('sha256');
  let files = 0; let bytes = 0;
  async function walk(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw new Error(`Playwright runtime contains symlink: ${path.posix.join(prefix, entry.name)}`);
      const absolute = path.join(directory, entry.name);
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) await walk(absolute, relative);
      else if (entry.isFile()) {
        files += 1;
        if (files > maxFiles) throw new Error('Playwright runtime file count exceeds limit');
        const stat = await lstat(absolute);
        bytes += stat.size;
        if (bytes > maxBytes) throw new Error('Playwright runtime size exceeds limit');
        hash.update(relative); hash.update('\0'); hash.update(await readFile(absolute)); hash.update('\0');
      }
    }
  }
  await walk(base);
  return { sha256: hash.digest('hex'), files, bytes };
}

function packageBin(manifest) {
  if (typeof manifest?.bin === 'string') return manifest.bin;
  if (manifest?.bin && typeof manifest.bin === 'object') return manifest.bin['playwright-cli'] ?? manifest.bin.playwright ?? Object.values(manifest.bin)[0];
  return null;
}

export class PlaywrightRuntimeInstaller {
  constructor({ runtimeRoot, version = '0.1.17', runProcess = defaultRunProcess, npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm', nodeExecutable = process.execPath, timeoutMs = 900_000 } = {}) {
    this.runtimeRoot = path.resolve(required(runtimeRoot, 'Playwright runtime root'));
    this.version = required(version, 'Playwright CLI version', 64);
    if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9._-]+)?$/.test(this.version)) throw new TypeError('Playwright CLI version must be pinned');
    if (typeof runProcess !== 'function') throw new TypeError('runProcess is required');
    this.runProcess = runProcess;
    this.npmExecutable = required(npmExecutable, 'npm executable', 512);
    this.nodeExecutable = required(nodeExecutable, 'node executable', 4_096);
    this.timeoutMs = Math.max(60_000, Number(timeoutMs) || 900_000);
    this.installPromise = null;
  }

  async status() {
    let current;
    try { current = JSON.parse(await readFile(path.join(this.runtimeRoot, 'current.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return Object.freeze({ ready: false, version: this.version, reason: 'not-installed' }); throw error; }
    if (!current || current.version !== this.version || typeof current.installationId !== 'string' || typeof current.relativeRoot !== 'string') return Object.freeze({ ready: false, version: this.version, reason: 'metadata-invalid' });
    const root = path.resolve(this.runtimeRoot, current.relativeRoot);
    const rel = path.relative(this.runtimeRoot, root);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return Object.freeze({ ready: false, version: this.version, reason: 'metadata-path-invalid' });
    try {
      const manifestPath = path.join(root, 'package', 'node_modules', '@playwright', 'cli', 'package.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      const bin = packageBin(manifest);
      if (manifest.version !== this.version || !bin) throw new Error('package metadata mismatch');
      const entry = await realpath(path.resolve(path.dirname(manifestPath), bin));
      const packageRoot = await realpath(path.dirname(manifestPath));
      const entryRel = path.relative(packageRoot, entry);
      if (entryRel.startsWith('..') || path.isAbsolute(entryRel)) throw new Error('CLI entry escapes package');
      await lstat(path.join(root, 'browsers'));
      return Object.freeze({ ready: true, version: this.version, installationId: current.installationId, root, browsersPath: path.join(root, 'browsers'), integrity: current.integrity ?? null, command: Object.freeze({ executable: this.nodeExecutable, prefixArgs: Object.freeze([entry]) }) });
    } catch (error) { return Object.freeze({ ready: false, version: this.version, reason: `installation-invalid:${String(error.message).slice(0, 160)}` }); }
  }

  async install({ force = false } = {}) {
    if (!force) {
      const existing = await this.status();
      if (existing.ready) return existing;
    }
    if (this.installPromise) return this.installPromise;
    this.installPromise = this.#install().finally(() => { this.installPromise = null; });
    return this.installPromise;
  }

  async #install() {
    await mkdir(path.join(this.runtimeRoot, 'versions'), { recursive: true });
    await mkdir(path.join(this.runtimeRoot, 'staging'), { recursive: true });
    const staging = path.join(this.runtimeRoot, 'staging', randomUUID());
    const packageRoot = path.join(staging, 'package');
    const browsersPath = path.join(staging, 'browsers');
    try {
      await mkdir(packageRoot, { recursive: true });
      const npm = await this.runProcess({
        executable: this.npmExecutable,
        args: ['install', '--prefix', packageRoot, '--package-lock=true', '--ignore-scripts', '--no-audit', '--no-fund', '--omit=dev', `@playwright/cli@${this.version}`],
        cwd: staging,
        env: { npm_config_update_notifier: 'false', npm_config_fund: 'false', npm_config_audit: 'false' },
        timeoutMs: this.timeoutMs,
      });
      if (npm.exitCode !== 0) throw new Error(`Playwright CLI package installation failed: ${String(npm.stderr ?? npm.stdout ?? '').slice(0, 4_000)}`);

      const manifestPath = path.join(packageRoot, 'node_modules', '@playwright', 'cli', 'package.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      const bin = packageBin(manifest);
      if (manifest.name !== '@playwright/cli' || manifest.version !== this.version || !bin) throw new Error('installed Playwright CLI package does not match pinned version');
      const entry = path.resolve(path.dirname(manifestPath), bin);
      const browser = await this.runProcess({
        executable: this.nodeExecutable,
        args: [entry, 'install-browser', 'chromium'],
        cwd: staging,
        env: { PLAYWRIGHT_BROWSERS_PATH: browsersPath, PLAYWRIGHT_SKIP_BROWSER_GC: '1' },
        timeoutMs: this.timeoutMs,
      });
      if (browser.exitCode !== 0) throw new Error(`Playwright browser download failed: ${String(browser.stderr ?? browser.stdout ?? '').slice(0, 4_000)}`);
      await lstat(browsersPath);

      const lock = JSON.parse(await readFile(path.join(packageRoot, 'package-lock.json'), 'utf8'));
      const integrity = lock?.packages?.['node_modules/@playwright/cli']?.integrity ?? null;
      const digest = await treeDigest(staging);
      const installationId = `${this.version}-${digest.sha256.slice(0, 16)}`;
      const finalRoot = path.join(this.runtimeRoot, 'versions', installationId);
      try { await lstat(finalRoot); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await rename(staging, finalRoot);
      }
      await atomicJson(path.join(this.runtimeRoot, 'current.json'), { version: this.version, installationId, relativeRoot: path.relative(this.runtimeRoot, finalRoot), integrity, sha256: digest.sha256, files: digest.files, bytes: digest.bytes, installedAt: new Date().toISOString() });
      try {
        const finalManifest = path.join(finalRoot, 'package', 'node_modules', '@playwright', 'cli', 'package.json');
        const finalPackage = JSON.parse(await readFile(finalManifest, 'utf8'));
        const finalEntry = path.resolve(path.dirname(finalManifest), packageBin(finalPackage));
        const verify = await this.runProcess({ executable: this.nodeExecutable, args: [finalEntry, '--version'], cwd: finalRoot, env: { PLAYWRIGHT_BROWSERS_PATH: path.join(finalRoot, 'browsers') }, timeoutMs: 30_000 });
        if (verify.exitCode !== 0 || !String(verify.stdout ?? verify.stderr ?? '').includes(this.version)) throw new Error('installed Playwright CLI failed version verification');
      } catch (error) {
        await rm(path.join(this.runtimeRoot, 'current.json'), { force: true });
        throw error;
      }
      return this.status();
    } finally { await rm(staging, { recursive: true, force: true }); }
  }
}
