import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { chmod, lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { safeRelativePath, signed, TIME_TRAVEL_SCHEMAS } from './time-travel-schema.mjs';

const exec = promisify(execFile);
function hash(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
async function gitBuffer(root, args) {
  try { return Buffer.from((await exec('git', args, { cwd: root, encoding: 'buffer', timeout: 120_000, maxBuffer: 100 * 1024 * 1024, windowsHide: true, env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', GIT_TERMINAL_PROMPT: '0' } })).stdout ?? Buffer.alloc(0)); }
  catch (cause) { throw Object.assign(new Error(`Checkpoint file is unavailable: ${String(cause?.stderr ?? cause?.message ?? cause).slice(0, 500)}`), { code: 'TIME_TRAVEL_FILE_NOT_IN_CHECKPOINT', statusCode: 404, cause }); }
}

async function assertDestination(root, relative) {
  const absolute = path.resolve(root, relative); const lexical = path.relative(root, absolute);
  if (lexical.startsWith('..') || path.isAbsolute(lexical)) throw Object.assign(new Error('Path escapes project workspace'), { code: 'TIME_TRAVEL_PATH_ESCAPE', statusCode: 403 });
  let cursor = root;
  for (const part of relative.split('/').slice(0, -1)) {
    cursor = path.join(cursor, part);
    try { if ((await lstat(cursor)).isSymbolicLink()) throw Object.assign(new Error('Restore path traverses a symlink'), { code: 'TIME_TRAVEL_SYMLINK_ESCAPE', statusCode: 403 }); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
  try { if ((await lstat(absolute)).isSymbolicLink()) throw Object.assign(new Error('Restore target is a symlink'), { code: 'TIME_TRAVEL_SYMLINK_ESCAPE', statusCode: 403 }); }
  catch (error) { if (error?.code !== 'ENOENT') throw error; }
  return absolute;
}

async function currentFile(absolute) {
  try {
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) throw Object.assign(new Error('Restore target is a symlink'), { code: 'TIME_TRAVEL_SYMLINK_ESCAPE', statusCode: 403 });
    if (!stat.isFile()) return { state: 'other', bytes: null, sha256: null, mode: stat.mode & 0o777 };
    const bytes = await readFile(absolute);
    return { state: 'present', bytes, sha256: hash(bytes), mode: stat.mode & 0o777 };
  } catch (error) {
    if (error?.code === 'ENOENT') return { state: 'deleted', bytes: null, sha256: null, mode: null };
    throw error;
  }
}

export class RestorePlanner {
  constructor({ index, store, clock = () => new Date().toISOString() } = {}) {
    if (!index?.get || !index?.readBlob || !index?.recordAction || !store?.getProject) throw new TypeError('RestorePlanner index and store are required');
    this.index = index; this.store = store; this.clock = clock;
  }

  async #checkpointContent(checkpoint, project, relative) {
    const captured = (checkpoint.manifest ?? []).find((entry) => entry.path === relative);
    if (captured?.state === 'deleted') return { state: 'deleted', bytes: null, sha256: null, mode: null, source: 'manifest' };
    if (captured?.state === 'present') return { state: 'present', bytes: await this.index.readBlob(captured.sha256), sha256: captured.sha256, mode: captured.mode ?? 0o644, source: 'manifest' };
    const bytes = await gitBuffer(project.workspaceRoot, ['show', `${checkpoint.git.commit}:${relative}`]);
    const tree = String((await exec('git', ['ls-tree', checkpoint.git.commit, '--', relative], { cwd: project.workspaceRoot, timeout: 30_000, windowsHide: true })).stdout ?? '');
    const mode = tree.startsWith('100755') ? 0o755 : 0o644;
    return { state: 'present', bytes, sha256: hash(bytes), mode, source: 'git' };
  }

  async plan({ checkpointId, path: requestedPath } = {}) {
    const checkpoint = await this.index.get(checkpointId); const project = this.store.getProject(checkpoint.projectId);
    if (!project) throw Object.assign(new Error(`Unknown project: ${checkpoint.projectId}`), { code: 'TIME_TRAVEL_PROJECT_NOT_FOUND', statusCode: 404 });
    const relative = safeRelativePath(requestedPath); const absolute = await assertDestination(path.resolve(project.workspaceRoot), relative);
    const [current, target] = await Promise.all([currentFile(absolute), this.#checkpointContent(checkpoint, project, relative)]);
    const differs = current.state !== target.state || current.sha256 !== target.sha256;
    const base = { schema: TIME_TRAVEL_SCHEMAS.restorePlan, checkpointId: checkpoint.id, projectId: project.id, missionId: checkpoint.missionId, path: relative, current: { state: current.state, sha256: current.sha256, bytes: current.bytes?.length ?? 0 }, target: { state: target.state, sha256: target.sha256, bytes: target.bytes?.length ?? 0, source: target.source }, differs, requiresConfirmation: differs && current.state !== 'deleted', generatedAt: this.clock() };
    return { plan: signed(base), checkpoint, project, absolute, current, target };
  }

  async apply({ checkpointId, path: requestedPath, confirmOverwrite = false } = {}) {
    const resolved = await this.plan({ checkpointId, path: requestedPath });
    if (resolved.plan.requiresConfirmation && confirmOverwrite !== true) throw Object.assign(new Error('Current file differs; explicit overwrite confirmation is required'), { code: 'TIME_TRAVEL_CONFIRMATION_REQUIRED', statusCode: 409, plan: resolved.plan });
    if (!resolved.plan.differs) return signed({ schema: TIME_TRAVEL_SCHEMAS.restoreReceipt, checkpointId: resolved.checkpoint.id, projectId: resolved.project.id, missionId: resolved.checkpoint.missionId, path: resolved.plan.path, state: 'unchanged', backup: null, restoredAt: this.clock(), restorePlanReceiptSha256: resolved.plan.receiptSha256 });
    let backup = null;
    if (resolved.current.state === 'present') backup = await this.index.storeBlob(resolved.current.bytes);
    if (resolved.target.state === 'deleted') {
      try { await unlink(resolved.absolute); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    } else {
      await mkdir(path.dirname(resolved.absolute), { recursive: true });
      const temporary = `${resolved.absolute}.nolane-restore-${process.pid}-${randomUUID()}.tmp`;
      await writeFile(temporary, resolved.target.bytes, { mode: resolved.target.mode ?? resolved.current.mode ?? 0o644 });
      await chmod(temporary, resolved.target.mode ?? resolved.current.mode ?? 0o644).catch(() => {});
      await rename(temporary, resolved.absolute);
    }
    const receipt = signed({ schema: TIME_TRAVEL_SCHEMAS.restoreReceipt, checkpointId: resolved.checkpoint.id, projectId: resolved.project.id, missionId: resolved.checkpoint.missionId, path: resolved.plan.path, state: resolved.target.state === 'deleted' ? 'deleted' : 'restored', targetSha256: resolved.target.sha256, backup, restoredAt: this.clock(), restorePlanReceiptSha256: resolved.plan.receiptSha256 });
    await this.index.recordAction({ checkpointId: resolved.checkpoint.id, action: 'restore-file', projectId: resolved.project.id, missionId: resolved.checkpoint.missionId, path: resolved.plan.path, details: { receiptSha256: receipt.receiptSha256, backup } });
    return receipt;
  }
}
