import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { SecretScanner } from '../security/secret-scanner.mjs';

const exec = promisify(execFile);

function codedError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function boundedText(value, limit) {
  const text = String(value ?? '');
  const buffer = Buffer.from(text);
  return buffer.length <= limit ? text : `${buffer.subarray(0, limit).toString('utf8')}\n[TRUNCATED]`;
}

function parseStatus(text) {
  return Object.freeze(String(text).split(/\r?\n/).filter(Boolean).map((line) => {
    const code = line.slice(0, 2);
    const rawPath = line.slice(3);
    const pathname = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) : rawPath;
    return Object.freeze({ code, path: pathname, rawPath });
  }));
}

function validOperation(value) {
  const operation = String(value ?? '');
  if (!['merge', 'rebase', 'cherry-pick', 'revert'].includes(operation)) throw codedError('GIT_ABORT_OPERATION_INVALID', `Unsupported abort operation: ${operation}`);
  return operation;
}

export class GitGateway {
  constructor({ repositoryRoot, secretScanner = new SecretScanner(), approval = null, maxOutputBytes = 100_000, timeoutMs = 120_000 } = {}) {
    this.repositoryRoot = path.resolve(String(repositoryRoot ?? ''));
    if (!this.repositoryRoot) throw new TypeError('repositoryRoot is required');
    if (!secretScanner || typeof secretScanner.assertClean !== 'function') throw new TypeError('secretScanner is required');
    if (approval !== null && typeof approval !== 'function') throw new TypeError('approval must be a function');
    this.secretScanner = secretScanner;
    this.approval = approval;
    this.maxOutputBytes = Number(maxOutputBytes);
    this.timeoutMs = Number(timeoutMs);
  }

  async #run(args, { allowFailure = false, operation = null, beforeHead = null } = {}) {
    const normalized = args.map(String);
    try {
      const result = await exec('git', normalized, {
        cwd: this.repositoryRoot,
        timeout: this.timeoutMs,
        maxBuffer: this.maxOutputBytes * 2,
        windowsHide: true,
        env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', HOME: process.env.HOME ?? '', GIT_TERMINAL_PROMPT: '0' },
      });
      return Object.freeze({ status: 'pass', command: 'git', args: Object.freeze(normalized), shell: false, stdout: boundedText(result.stdout, this.maxOutputBytes), stderr: boundedText(result.stderr, this.maxOutputBytes), operation, beforeHead });
    } catch (cause) {
      const output = Object.freeze({ status: 'fail', command: 'git', args: Object.freeze(normalized), shell: false, stdout: boundedText(cause.stdout, this.maxOutputBytes), stderr: boundedText(cause.stderr, this.maxOutputBytes), operation, beforeHead, exitCode: cause.code });
      if (allowFailure) return output;
      const conflicts = await this.#conflictPaths().catch(() => []);
      if (conflicts.length > 0) throw codedError('GIT_OPERATION_CONFLICT', `${operation ?? normalized[0]} produced conflicts`, { conflicts: Object.freeze(conflicts), output, cause });
      throw codedError('GIT_COMMAND_FAILED', `git ${normalized[0]} failed: ${output.stderr.trim() || output.stdout.trim() || cause.message}`, { output, cause });
    }
  }

  async #assertRepository() {
    const result = await this.#run(['rev-parse', '--is-inside-work-tree']);
    if (result.stdout.trim() !== 'true') throw codedError('GIT_REPOSITORY_REQUIRED', 'repositoryRoot is not a Git worktree');
  }

  async head() {
    await this.#assertRepository();
    return (await this.#run(['rev-parse', 'HEAD'])).stdout.trim();
  }

  async status() {
    const result = await this.#run(['status', '--porcelain=v1', '--untracked-files=normal']);
    const entries = parseStatus(result.stdout);
    return Object.freeze({ schema: 'forge.git.status.v1', clean: entries.length === 0, entries });
  }

  async remotes() {
    const result = await this.#run(['remote', '-v']);
    const remotes = result.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
      return match ? Object.freeze({ name: match[1], url: match[2], direction: match[3] }) : null;
    }).filter(Boolean);
    return Object.freeze(remotes);
  }

  async diff({ staged = false, paths = [] } = {}) {
    const safePaths = await this.#validatePaths(paths, { allowEmpty: true, requireExisting: false });
    const args = ['diff', '--no-ext-diff', '--unified=3'];
    if (staged) args.push('--cached');
    if (safePaths.length) args.push('--', ...safePaths);
    const result = await this.#run(args);
    return Object.freeze({ staged: Boolean(staged), paths: Object.freeze(safePaths), content: result.stdout, sha256: canonicalSha256(result.stdout) });
  }

  async #assertHead(expectedHead) {
    if (!expectedHead) throw codedError('GIT_EXPECTED_HEAD_REQUIRED', 'expectedHead is required for Git mutations');
    const actual = await this.head();
    if (actual !== String(expectedHead)) throw codedError('GIT_HEAD_MISMATCH', `Git HEAD mismatch: expected ${expectedHead}, got ${actual}`, { expectedHead: String(expectedHead), actualHead: actual });
    return actual;
  }

  async #validatePaths(paths, { allowEmpty = false, requireExisting = true } = {}) {
    if (!Array.isArray(paths) || (!allowEmpty && paths.length === 0) || paths.some((item) => typeof item !== 'string' || !item.trim())) throw new TypeError('paths must be a non-empty array of strings');
    const result = [];
    for (const item of paths) {
      const absolute = path.resolve(this.repositoryRoot, item);
      const relative = path.relative(this.repositoryRoot, absolute).split(path.sep).join('/');
      if (!relative || relative === '.git' || relative.startsWith('../') || path.isAbsolute(relative) || relative.startsWith('.git/')) throw codedError('GIT_PATH_OUTSIDE_REPOSITORY', `Path is outside repository or protected: ${item}`);
      if (requireExisting) {
        const info = await stat(absolute).catch(() => null);
        if (!info || !info.isFile()) throw codedError('GIT_PATH_NOT_FILE', `Git path is not a regular file: ${relative}`);
      }
      result.push(relative);
    }
    return [...new Set(result)].sort();
  }

  async #scanPaths(paths) {
    const findings = [];
    for (const relative of paths) {
      const absolute = path.join(this.repositoryRoot, relative);
      const buffer = await readFile(absolute);
      if (buffer.includes(0)) continue;
      const result = this.secretScanner.scanText(buffer.toString('utf8'), { source: relative });
      findings.push(...result.findings);
    }
    if (findings.length) throw codedError('SECRET_SCAN_BLOCKED', `Secret scan blocked ${findings.length} finding(s)`, { findings: Object.freeze(findings) });
  }

  async #scanIndex() {
    const names = (await this.#run(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])).stdout.split(/\r?\n/).filter(Boolean);
    const findings = [];
    for (const name of names) {
      const shown = await this.#run(['show', `:${name}`], { allowFailure: true });
      if (shown.status !== 'pass' || shown.stdout.includes('\0')) continue;
      const result = this.secretScanner.scanText(shown.stdout, { source: name });
      findings.push(...result.findings);
    }
    if (findings.length) throw codedError('SECRET_SCAN_BLOCKED', `Secret scan blocked ${findings.length} staged finding(s)`, { findings: Object.freeze(findings) });
  }

  async #approve(operation, details) {
    if (!this.approval) throw codedError('GIT_APPROVAL_REQUIRED', `Approval is required for ${operation}`);
    const decision = await this.approval(Object.freeze({ schema: 'forge.git.approval-request.v1', operation, repositoryRoot: this.repositoryRoot, details: Object.freeze(details) }));
    if (!decision || decision.approved !== true) throw codedError('GIT_APPROVAL_DENIED', `Approval denied for ${operation}`);
    return Object.freeze({ id: decision.id ? String(decision.id) : null });
  }

  async #assertClean() {
    const current = await this.status();
    if (!current.clean) throw codedError('GIT_DIRTY_WORKTREE', 'Git worktree contains user changes', { entries: current.entries });
  }

  #receipt(run, { beforeHead, afterHead, approval = null, extra = {} } = {}) {
    const base = {
      schema: 'forge.git.operation-receipt.v1',
      command: run.command,
      args: run.args,
      shell: false,
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      beforeHead,
      afterHead,
      approvalId: approval?.id ?? null,
      ...extra,
    };
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  async stage({ paths, expectedHead } = {}) {
    const beforeHead = await this.#assertHead(expectedHead);
    const safePaths = await this.#validatePaths(paths);
    await this.#scanPaths(safePaths);
    const run = await this.#run(['add', '--', ...safePaths], { operation: 'stage', beforeHead });
    return this.#receipt(run, { beforeHead, afterHead: await this.head(), extra: { paths: Object.freeze(safePaths) } });
  }

  async commit({ message, paths = null, expectedHead } = {}) {
    const beforeHead = await this.#assertHead(expectedHead);
    const cleanMessage = String(message ?? '').trim();
    if (!cleanMessage || cleanMessage.length > 10_000 || /[\0\r\n]/.test(cleanMessage)) throw codedError('GIT_COMMIT_MESSAGE_INVALID', 'Commit message must be one non-empty line up to 10000 characters');
    if (paths !== null) await this.stage({ paths, expectedHead: beforeHead });
    await this.#scanIndex();
    const staged = await this.#run(['diff', '--cached', '--quiet'], { allowFailure: true });
    if (staged.status === 'pass') throw codedError('GIT_NOTHING_TO_COMMIT', 'No staged changes to commit');
    const run = await this.#run(['commit', '-m', cleanMessage], { operation: 'commit', beforeHead });
    return this.#receipt(run, { beforeHead, afterHead: await this.head() });
  }

  async createBranch({ name, expectedHead, checkout = true } = {}) {
    const beforeHead = await this.#assertHead(expectedHead);
    const branch = String(name ?? '').trim();
    if (!branch || branch.length > 200) throw codedError('GIT_BRANCH_INVALID', 'Branch name is required');
    const checked = await this.#run(['check-ref-format', '--branch', branch], { allowFailure: true });
    if (checked.status !== 'pass') throw codedError('GIT_BRANCH_INVALID', `Invalid branch name: ${branch}`);
    const run = await this.#run(checkout ? ['switch', '-c', branch] : ['branch', branch], { operation: 'create-branch', beforeHead });
    return this.#receipt(run, { beforeHead, afterHead: await this.head(), extra: { branch, checkedOut: Boolean(checkout) } });
  }

  async #dangerous(operation, args, expectedHead, details = {}) {
    const beforeHead = await this.#assertHead(expectedHead);
    await this.#assertClean();
    const approval = await this.#approve(operation, { args: Object.freeze(args), beforeHead, ...details });
    const run = await this.#run(args, { operation, beforeHead });
    return this.#receipt(run, { beforeHead, afterHead: await this.head(), approval });
  }

  async merge({ ref, expectedHead, noCommit = false } = {}) {
    const args = ['merge', '--no-edit'];
    if (noCommit) args.push('--no-commit');
    args.push(String(ref ?? ''));
    return this.#dangerous('merge', args, expectedHead, { ref: String(ref ?? '') });
  }

  async rebase({ onto, expectedHead } = {}) {
    return this.#dangerous('rebase', ['rebase', String(onto ?? '')], expectedHead, { onto: String(onto ?? '') });
  }

  async cherryPick({ commit, expectedHead } = {}) {
    return this.#dangerous('cherry-pick', ['cherry-pick', String(commit ?? '')], expectedHead, { commit: String(commit ?? '') });
  }

  async revert({ commit, expectedHead } = {}) {
    return this.#dangerous('revert', ['revert', '--no-edit', String(commit ?? '')], expectedHead, { commit: String(commit ?? '') });
  }

  async reset({ mode = 'mixed', ref = 'HEAD', expectedHead } = {}) {
    const normalized = String(mode);
    if (!['soft', 'mixed'].includes(normalized)) throw codedError('GIT_RESET_MODE_DENIED', `Reset mode is denied: ${normalized}`);
    return this.#dangerous('reset', ['reset', `--${normalized}`, String(ref)], expectedHead, { mode: normalized, ref: String(ref) });
  }

  async #conflictPaths() {
    const result = await this.#run(['diff', '--name-only', '--diff-filter=U'], { allowFailure: true });
    return result.stdout.split(/\r?\n/).filter(Boolean).sort();
  }

  async conflicts() {
    return Object.freeze({ schema: 'forge.git.conflicts.v1', paths: Object.freeze(await this.#conflictPaths()) });
  }

  async abort({ operation } = {}) {
    const normalized = validOperation(operation);
    const args = normalized === 'cherry-pick' ? ['cherry-pick', '--abort'] : normalized === 'revert' ? ['revert', '--abort'] : [normalized, '--abort'];
    const beforeHead = await this.head();
    const run = await this.#run(args, { operation: `${normalized}-abort`, beforeHead });
    return this.#receipt(run, { beforeHead, afterHead: await this.head(), extra: { operation: normalized } });
  }
}
