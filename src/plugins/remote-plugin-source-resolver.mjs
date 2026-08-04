import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chmod, copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';

function required(value, label, max = 16_384) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  if (text.length > max) throw new TypeError(`${label} is too long`);
  if(/[\u0000-\u001f\u007f]/.test(text)) throw new TypeError(`${label} contains control characters`);
  return text;
}

function safeRef(value) {
  if (value == null || value === '') return null;
  const ref = required(value, 'git ref', 512);
  if (ref.startsWith('-') || ref.includes('..') || ref.includes('@{') || /[~^:?*\\\[\s]/.test(ref)) throw new TypeError('git ref is invalid');
  return ref;
}

function safeSha(value) {
  if (value == null || value === '') return null;
  const sha = required(value, 'git sha', 64).toLowerCase();
  if (!/^[a-f0-9]{40,64}$/.test(sha)) throw new TypeError('git sha is invalid');
  return sha;
}

function safeSubpath(value) {
  if (value == null || value === '' || value === '.') return '';
  const raw = required(value, 'plugin path', 2_048).replaceAll('\\', '/');
  if (raw.startsWith('/') || /^[A-Za-z]:\//.test(raw)) throw new TypeError('plugin path must be relative');
  const normalized = path.posix.normalize(raw);
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) throw new TypeError('plugin path escapes repository');
  return normalized.replace(/^\.\//, '');
}

function httpsUrl(value) {
  const raw = required(value, 'git URL');
  let url;
  try { url = new URL(raw); } catch { throw new TypeError('git URL is invalid'); }
  if (url.protocol !== 'https:') throw new TypeError('remote plugin sources require HTTPS');
  if (url.username || url.password) throw new TypeError('embedded credentials are not allowed in git URL');
  if (url.hash) throw new TypeError('git URL fragments are not allowed');
  url.username = ''; url.password = '';
  return url.toString();
}

function githubUrl(repo) {
  const value = required(repo, 'GitHub repository', 512).replace(/^github:/i, '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(value)) throw new TypeError('GitHub repository must use owner/repo format');
  return `https://github.com/${value.replace(/\.git$/i, '')}.git`;
}

function normalizeSpec(input) {
  if (typeof input === 'string') {
    const text = required(input, 'remote plugin source');
    if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:@[^\s]+)?$/.test(text)) {
      const at = text.lastIndexOf('@');
      const repo = at > text.indexOf('/') ? text.slice(0, at) : text;
      const ref = at > text.indexOf('/') ? text.slice(at + 1) : null;
      return { url: githubUrl(repo), ref: safeRef(ref), sha: null, subpath: '' };
    }
    return { url: httpsUrl(text.endsWith('.git') ? text : text), ref: null, sha: null, subpath: '' };
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('remote plugin source must be a string or object');
  const kind = String(input.source ?? input.kind ?? '').toLowerCase();
  const ref = safeRef(input.ref);
  const sha = safeSha(input.sha);
  const subpath = safeSubpath(input.path ?? input.subpath);
  if (kind === 'github') return { url: githubUrl(input.repo), ref, sha, subpath };
  if (['git', 'url', 'git-subdir'].includes(kind)) return { url: httpsUrl(input.url), ref, sha, subpath };
  throw new TypeError(`unsupported remote plugin source: ${kind || 'unknown'}`);
}

async function defaultRunProcess({ executable, args, cwd = null, timeoutMs = 120_000 }) {
  const child = spawn(executable, args, { cwd: cwd ?? undefined, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { if (stdout.length < 1_000_000) stdout += chunk.toString('utf8'); });
  child.stderr.on('data', (chunk) => { if (stderr.length < 1_000_000) stderr += chunk.toString('utf8'); });
  const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, Math.max(1_000, Number(timeoutMs) || 120_000));
  timer.unref?.();
  try {
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (exitCode, signal) => resolve({ exitCode: exitCode ?? 1, signal }));
    });
    return { ...result, stdout, stderr };
  } finally { clearTimeout(timer); }
}

async function collectTree(root, { maxFiles, maxBytes }) {
  const base = await realpath(root);
  const files = []; let bytes = 0;
  async function walk(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name === '.git') continue;
      if (entry.isSymbolicLink()) throw new Error(`remote plugin source contains symlink: ${path.posix.join(prefix, entry.name)}`);
      const absolute = path.join(directory, entry.name);
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) await walk(absolute, relative);
      else if (entry.isFile()) {
        if (files.length >= maxFiles) throw new Error('remote plugin source file count exceeds limit');
        const stat = await lstat(absolute);
        bytes += stat.size;
        if (bytes > maxBytes) throw new Error('remote plugin source size exceeds limit');
        files.push({ absolute, relative, size: stat.size });
      }
    }
  }
  await walk(base);
  if (!files.length) throw new Error('remote plugin source is empty');
  return files;
}

async function hashTree(files) {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file.relative); hash.update('\0');
    hash.update(await readFile(file.absolute)); hash.update('\0');
  }
  return hash.digest('hex');
}

async function copyImmutable(files, destination) {
  await mkdir(destination, { recursive: true });
  for (const file of files) {
    const target = path.join(destination, ...file.relative.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(file.absolute, target);
    try { await chmod(target, 0o444); } catch {}
  }
}

export class RemotePluginSourceResolver {
  constructor({ cacheRoot, runProcess = defaultRunProcess, maxFiles = 20_000, maxBytes = 500_000_000, timeoutMs = 120_000 } = {}) {
    this.cacheRoot = path.resolve(required(cacheRoot, 'remote plugin cache root'));
    if (typeof runProcess !== 'function') throw new TypeError('runProcess is required');
    this.runProcess = runProcess;
    this.maxFiles = Math.max(1, Number(maxFiles) || 20_000);
    this.maxBytes = Math.max(1_024, Number(maxBytes) || 500_000_000);
    this.timeoutMs = Math.max(5_000, Number(timeoutMs) || 120_000);
  }

  async resolve(input, { kind = 'plugin' } = {}) {
    const spec = normalizeSpec(input);
    await mkdir(path.join(this.cacheRoot, 'objects'), { recursive: true });
    await mkdir(path.join(this.cacheRoot, 'tmp'), { recursive: true });
    const work = path.join(this.cacheRoot, 'tmp', `${String(kind).replace(/[^a-z0-9-]+/gi, '-')}-${randomUUID()}`);
    const cloneRoot = path.join(work, 'repo');
    try {
      await mkdir(work, { recursive: true });
      const cloneArgs = ['clone', '-c', 'submodule.recurse=false', '--depth', '1', '--no-tags', '--no-recurse-submodules'];
      if (spec.ref) cloneArgs.push('--branch', spec.ref);
      cloneArgs.push('--', spec.url, cloneRoot);
      const clone = await this.runProcess({ executable: 'git', args: cloneArgs, timeoutMs: this.timeoutMs });
      if (clone.exitCode !== 0) throw new Error(`git clone failed: ${String(clone.stderr ?? clone.stdout ?? '').slice(0, 4_000)}`);

      if (spec.sha) {
        const fetch = await this.runProcess({ executable: 'git', args: ['-C', cloneRoot, '-c', 'submodule.recurse=false', 'fetch', '--depth', '1', 'origin', spec.sha], timeoutMs: this.timeoutMs });
        if (fetch.exitCode !== 0) throw new Error(`git fetch failed: ${String(fetch.stderr ?? fetch.stdout ?? '').slice(0, 4_000)}`);
        const checkout = await this.runProcess({ executable: 'git', args: ['-C', cloneRoot, 'checkout', '--detach', spec.sha], timeoutMs: this.timeoutMs });
        if (checkout.exitCode !== 0) throw new Error(`git checkout failed: ${String(checkout.stderr ?? checkout.stdout ?? '').slice(0, 4_000)}`);
      }

      const rev = await this.runProcess({ executable: 'git', args: ['-C', cloneRoot, 'rev-parse', 'HEAD'], timeoutMs: 10_000 });
      if (rev.exitCode !== 0 || !/^[a-f0-9]{40,64}$/i.test(String(rev.stdout ?? '').trim())) throw new Error('git source did not resolve to a valid commit');
      const commit = String(rev.stdout).trim().toLowerCase();
      if (spec.sha && !commit.startsWith(spec.sha.toLowerCase()) && !spec.sha.toLowerCase().startsWith(commit)) throw new Error('resolved commit does not match requested sha');

      const sourceRoot = spec.subpath ? path.join(cloneRoot, ...spec.subpath.split('/')) : cloneRoot;
      const cloneReal = await realpath(cloneRoot);
      const sourceReal = await realpath(sourceRoot);
      const rel = path.relative(cloneReal, sourceReal);
      if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('plugin path escapes cloned repository');
      const files = await collectTree(sourceReal, { maxFiles: this.maxFiles, maxBytes: this.maxBytes });
      const contentSha256 = await hashTree(files);
      const objectPath = path.join(this.cacheRoot, 'objects', contentSha256);
      try {
        const existing = await realpath(objectPath);
        return existing;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }

      const staging = `${objectPath}.${randomUUID()}.tmp`;
      await copyImmutable(files, staging);
      try { await rename(staging, objectPath); }
      catch (error) {
        if (['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code)) await rm(staging, { recursive: true, force: true });
        else throw error;
      }
      return realpath(objectPath);
    } finally { await rm(work, { recursive: true, force: true }); }
  }
}
