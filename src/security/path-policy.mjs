import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

const within = (root, candidate) => candidate === root || candidate.startsWith(`${root}${path.sep}`);

function boundaryError(message, statusCode, code) { return Object.assign(new Error(message), { statusCode, code }); }

async function existsStat(target) {
  try { return await lstat(target); } catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}

function normalizePattern(value) {
  const pattern = String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
  return pattern || '.';
}

function normalizeRelative(value) {
  const relative = String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
  return relative || '.';
}

function escapeRegex(value) { return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&'); }

function globRegex(pattern) {
  if (pattern === '**' || pattern === '*') return /^.*$/;
  const parts = normalizePattern(pattern).split('/');
  let source = '^';
  for (let index = 0; index < parts.length; index += 1) {
    if (index) source += '/';
    const segment = parts[index];
    if (segment === '**') {
      if (index === parts.length - 1) source = source.slice(0, -1) + '(?:/.*)?';
      else source += '(?:[^/]+/)*';
      continue;
    }
    source += escapeRegex(segment).replaceAll('**', '.*').replaceAll('*', '[^/]*');
  }
  source += '$';
  return new RegExp(source);
}

function compilePatterns(values, fallback) {
  const source = values === undefined ? fallback : values;
  if (!Array.isArray(source) || source.some((item) => typeof item !== 'string')) throw new TypeError('Path patterns must be strings');
  return source.map((pattern) => ({ pattern: normalizePattern(pattern), regex: globRegex(pattern) }));
}

export class WorkspacePolicy {
  constructor(workspaceRoot, { allowedPaths, deniedPaths } = {}) {
    if (!workspaceRoot) throw new TypeError('workspaceRoot is required');
    this.root = path.resolve(workspaceRoot);
    this.rootReal = null;
    this.allowed = compilePatterns(allowedPaths, ['**']);
    this.denied = compilePatterns(deniedPaths, []);
  }

  async #realRoot() { return this.rootReal ??= await realpath(this.root); }

  #assertOwned(relativePath) {
    const relative = normalizeRelative(relativePath);
    const denied = this.denied.find(({ regex }) => regex.test(relative));
    if (denied) throw boundaryError(`Path is a denied task path: ${denied.pattern}`, 403, 'PATH_DENIED');
    if (!this.allowed.some(({ regex }) => regex.test(relative))) throw boundaryError(`Path is outside task-owned paths: ${relative}`, 403, 'PATH_SCOPE_DENIED');
  }

  #lexical(relativePath) {
    const relative = String(relativePath ?? '').trim() || '.';
    if (path.isAbsolute(relative)) throw boundaryError('Absolute paths are not allowed', 400, 'INVALID_PATH');
    const candidate = path.resolve(this.root, relative);
    if (!within(this.root, candidate)) throw boundaryError('Path escapes workspace', 403, 'PATH_ESCAPE');
    this.#assertOwned(path.relative(this.root, candidate) || '.');
    return candidate;
  }

  async resolveRead(relativePath) {
    const candidate = this.#lexical(relativePath);
    const [rootReal, candidateReal] = await Promise.all([this.#realRoot(), realpath(candidate)]);
    if (!within(rootReal, candidateReal)) throw boundaryError('Path escapes workspace through symlink', 403, 'PATH_SYMLINK_ESCAPE');
    return candidateReal;
  }

  async resolveWrite(relativePath) {
    const candidate = this.#lexical(relativePath);
    const rootReal = await this.#realRoot();
    const relative = path.relative(this.root, candidate);
    let cursor = this.root;
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, segment);
      const stat = await existsStat(cursor);
      if (!stat) break;
      if (stat.isSymbolicLink()) throw boundaryError('Write path crosses a symlink', 403, 'PATH_SYMLINK_ESCAPE');
      const cursorReal = await realpath(cursor);
      if (!within(rootReal, cursorReal)) throw boundaryError('Write path escapes workspace through symlink', 403, 'PATH_SYMLINK_ESCAPE');
    }
    return candidate;
  }

  relative(absolutePath) {
    const candidate = path.resolve(absolutePath);
    if (!within(this.root, candidate)) throw boundaryError('Path escapes workspace', 403, 'PATH_ESCAPE');
    return path.relative(this.root, candidate) || '.';
  }
}
