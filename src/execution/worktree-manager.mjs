import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
function safeTaskId(value) { const id = String(value ?? '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, ''); if (!id) throw new TypeError('taskId is required'); return id.slice(0, 80); }

export class WorktreeManager {
  constructor({ repositoryRoot, worktreesRoot } = {}) {
    this.repositoryRoot = path.resolve(String(repositoryRoot ?? ''));
    this.worktreesRoot = path.resolve(worktreesRoot ?? path.join(this.repositoryRoot, '.forge-worktrees'));
  }

  async create({ taskId, baseRef = 'HEAD' } = {}) {
    const safe = safeTaskId(taskId);
    await mkdir(this.worktreesRoot, { recursive: true });
    await exec('git', ['rev-parse', '--is-inside-work-tree'], { cwd: this.repositoryRoot });
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
    const branch = `forge/${safe}-${suffix}`;
    const location = path.join(this.worktreesRoot, `${safe}-${suffix}`);
    await exec('git', ['worktree', 'add', '-b', branch, location, String(baseRef)], { cwd: this.repositoryRoot });
    return Object.freeze({ taskId: safe, path: location, branch, baseRef: String(baseRef) });
  }

  async remove(worktree, { force = false, deleteBranch = false } = {}) {
    const location = path.resolve(worktree.path);
    const relative = path.relative(this.worktreesRoot, location);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Worktree is outside the managed root');
    const args = ['worktree', 'remove'];
    if (force) args.push('--force');
    args.push(location);
    await exec('git', args, { cwd: this.repositoryRoot });
    if (deleteBranch && worktree.branch) await exec('git', ['branch', '-D', worktree.branch], { cwd: this.repositoryRoot });
  }
}
