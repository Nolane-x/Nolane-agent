import { execFile } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const execFileAsync = promisify(execFile);
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.json', '.py', '.go', '.rs', '.java', '.c', '.h', '.cc', '.cpp', '.hpp', '.cs', '.rb', '.php', '.swift', '.kt', '.kts']);

function coded(code, message, statusCode = 400) { return Object.assign(new Error(message), { code, statusCode }); }
function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function quoteWindowsCommandArgument(value) {
  const text = String(value);
  if (/[\r\n&|<>()^%!]/.test(text)) throw coded('TREE_SITTER_COMMAND_ARGUMENT_DENIED', 'Tree-sitter cannot process Windows paths containing shell metacharacters', 400);
  return `"${text}"`;
}
function defaultRunner(command, args, options = {}) {
  if (process.platform === 'win32' && command === 'tree-sitter') {
    const commandLine = ['tree-sitter.cmd', ...args.map(quoteWindowsCommandArgument)].join(' ');
    return execFileAsync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', commandLine], { cwd: options.cwd, windowsHide: true, windowsVerbatimArguments: true, timeout: options.timeoutMs ?? 15_000, maxBuffer: options.maxOutputBytes ?? 2_000_000 });
  }
  return execFileAsync(command, args, { cwd: options.cwd, windowsHide: true, timeout: options.timeoutMs ?? 15_000, maxBuffer: options.maxOutputBytes ?? 2_000_000 });
}
function within(root, target) { const relative = path.relative(root, target); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); }
function versionFrom(stdout) { return String(stdout ?? '').match(/tree-sitter\s+v?([0-9]+(?:\.[0-9]+){1,3})/i)?.[1] ?? null; }
function freeze(value) { if (!value || typeof value !== 'object') return value; if (Array.isArray(value)) { value.forEach(freeze); return Object.freeze(value); } Object.values(value).forEach(freeze); return Object.freeze(value); }

export class TreeSitterRuntimeService {
  constructor({ projectResolver, runner = defaultRunner, command = 'tree-sitter', expectedVersion = null, configPath = null, timeoutMs = 15_000, maxOutputBytes = 2_000_000 } = {}) {
    if (typeof projectResolver !== 'function') throw new TypeError('projectResolver is required');
    this.projectResolver = projectResolver;
    this.runner = runner;
    this.command = required(command, 'tree-sitter command');
    this.expectedVersion = expectedVersion ? String(expectedVersion) : null;
    this.configPath = configPath ? path.resolve(required(configPath, 'tree-sitter config path')) : null;
    this.timeoutMs = Number(timeoutMs) || 15_000;
    this.maxOutputBytes = Number(maxOutputBytes) || 2_000_000;
  }

  async capabilities() {
    try {
      const { stdout = '' } = await this.runner(this.command, ['--version'], { timeoutMs: 5_000, maxOutputBytes: 64_000 });
      const version = versionFrom(stdout);
      const versionMatches = Boolean(version) && (!this.expectedVersion || version === this.expectedVersion);
      return freeze({
        schema: 'forge.tree-sitter-runtime-capabilities.v1', available: versionMatches, command: this.command,
        version, expectedVersion: this.expectedVersion, versionMatches, externalRuntime: true,
        reason: versionMatches ? null : version ? 'version-mismatch' : 'invalid-version-output',
      });
    } catch (error) {
      return freeze({ schema: 'forge.tree-sitter-runtime-capabilities.v1', available: false, command: this.command, version: null, expectedVersion: this.expectedVersion, versionMatches: false, externalRuntime: true, reason: error?.code === 'ENOENT' ? 'not-installed' : 'probe-failed' });
    }
  }

  async #resolveProjectFile(projectIdValue, fileValue) {
    const projectId = required(projectIdValue, 'projectId');
    const project = this.projectResolver(projectId);
    if (!project?.workspaceRoot) throw coded('TREE_SITTER_PROJECT_NOT_FOUND', `Unknown project: ${projectId}`, 404);
    const root = await realpath(path.resolve(project.workspaceRoot));
    const relativeFile = required(fileValue, 'file');
    if (path.isAbsolute(relativeFile)) throw coded('TREE_SITTER_PATH_DENIED', 'Tree-sitter file must be relative to the project workspace', 403);
    const candidate = path.resolve(root, relativeFile);
    if (!within(root, candidate)) throw coded('TREE_SITTER_PATH_DENIED', 'Tree-sitter file must remain inside the project workspace', 403);
    if (!SOURCE_EXTENSIONS.has(path.extname(candidate).toLowerCase())) throw coded('TREE_SITTER_FILE_UNSUPPORTED', 'Tree-sitter requires a supported source file', 415);
    let target;
    try { target = await realpath(candidate); } catch { throw coded('TREE_SITTER_FILE_NOT_FOUND', `Source file not found: ${relativeFile}`, 404); }
    if (!within(root, target)) throw coded('TREE_SITTER_PATH_DENIED', 'Tree-sitter file must remain inside the project workspace', 403);
    const info = await stat(target);
    if (!info.isFile()) throw coded('TREE_SITTER_FILE_UNSUPPORTED', 'Tree-sitter requires a supported source file', 415);
    return { projectId, root, target, relativeFile: path.relative(root, target).split(path.sep).join('/') };
  }

  async #resolveConfigPath() {
    if (!this.configPath) return null;
    try {
      const resolved = await realpath(this.configPath);
      const info = await stat(resolved);
      if (!info.isFile()) throw new Error('not a file');
      return resolved;
    } catch {
      throw coded('TREE_SITTER_CONFIG_INVALID', 'Tree-sitter grammar configuration is unavailable or invalid', 503);
    }
  }

  async parse({ projectId, principalId, file } = {}) {
    const principal = required(principalId, 'principalId');
    const resolved = await this.#resolveProjectFile(projectId, file);
    const configPath = await this.#resolveConfigPath();
    const capability = await this.capabilities();
    if (!capability.available) throw coded('TREE_SITTER_RUNTIME_UNAVAILABLE', `Tree-sitter runtime unavailable: ${capability.reason}`, 503);
    const { stdout = '', stderr = '' } = await this.runner(this.command, ['parse', '--json', '--quiet', ...(configPath ? ['--config-path', configPath] : []), '--', resolved.target], { cwd: resolved.root, timeoutMs: this.timeoutMs, maxOutputBytes: this.maxOutputBytes });
    if (Buffer.byteLength(String(stdout)) > this.maxOutputBytes) throw coded('TREE_SITTER_OUTPUT_TOO_LARGE', 'Tree-sitter output exceeds the configured limit', 413);
    let tree;
    try { tree = JSON.parse(String(stdout)); } catch { throw coded('TREE_SITTER_OUTPUT_INVALID', 'Tree-sitter returned invalid JSON', 502); }
    const base = {
      schema: 'forge.tree-sitter-parse.v1', projectId: resolved.projectId, principalId: principal,
      file: resolved.relativeFile, runtime: { command: capability.command, version: capability.version }, tree,
      diagnostics: String(stderr).trim() ? String(stderr).trim().slice(0, 16_384) : null,
    };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
