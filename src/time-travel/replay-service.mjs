import { randomUUID } from 'node:crypto';
import { lstat, mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { WorktreeManager } from '../execution/worktree-manager.mjs';
import { safeLabel, safeRelativePath, signed, TIME_TRAVEL_SCHEMAS } from './time-travel-schema.mjs';

async function safeTarget(root, relative) {
  const normalized = safeRelativePath(relative);
  const target = path.resolve(root, normalized);
  const lexical = path.relative(root, target);
  if (lexical.startsWith('..') || path.isAbsolute(lexical)) throw Object.assign(new Error('Path escapes Time Travel worktree'), { code: 'TIME_TRAVEL_PATH_ESCAPE', statusCode: 403 });
  let cursor = root;
  for (const part of normalized.split('/').slice(0, -1)) {
    cursor = path.join(cursor, part);
    try { if ((await lstat(cursor)).isSymbolicLink()) throw Object.assign(new Error('Checkpoint path traverses a symlink'), { code: 'TIME_TRAVEL_SYMLINK_ESCAPE', statusCode: 403 }); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
  return target;
}

export class ReplayService {
  constructor({ index, store, worktreesRoot, clock = () => new Date().toISOString(), managerFactory = (options) => new WorktreeManager(options) } = {}) {
    if (!index?.get || !index?.readBlob || !index?.recordAction || !store?.createMission || !worktreesRoot) throw new TypeError('ReplayService index, store, and worktreesRoot are required');
    this.index = index; this.store = store; this.worktreesRoot = path.resolve(worktreesRoot); this.clock = clock; this.managerFactory = managerFactory;
  }

  async createBranch({ checkpointId, label = null } = {}) {
    const checkpoint = await this.index.get(checkpointId); const project = this.store.getProject(checkpoint.projectId);
    if (!project) throw Object.assign(new Error(`Unknown project: ${checkpoint.projectId}`), { code: 'TIME_TRAVEL_PROJECT_NOT_FOUND', statusCode: 404 });
    const manager = this.managerFactory({ repositoryRoot: project.workspaceRoot, worktreesRoot: path.join(this.worktreesRoot, project.id) });
    const worktree = await manager.create({ taskId: `time-travel-${checkpoint.id.slice(-24)}`, baseRef: checkpoint.git.commit });
    for (const entry of checkpoint.manifest ?? []) {
      const target = await safeTarget(worktree.path, entry.path);
      if (entry.state === 'deleted') {
        try { await unlink(target); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
        continue;
      }
      if (entry.state !== 'present') continue;
      await mkdir(path.dirname(target), { recursive: true });
      const temporary = `${target}.nolane-time-travel-${process.pid}-${randomUUID()}.tmp`;
      await writeFile(temporary, await this.index.readBlob(entry.sha256), { mode: entry.mode ?? 0o644 });
      await rename(temporary, target);
    }
    const receipt = signed({ schema: TIME_TRAVEL_SCHEMAS.branchReceipt, checkpointId: checkpoint.id, projectId: project.id, missionId: checkpoint.missionId, label: safeLabel(label, checkpoint.label), worktree, appliedManifestEntries: checkpoint.manifest?.length ?? 0, excludedEntries: checkpoint.excluded ?? [], completeWorkingTreeCapture: checkpoint.completeWorkingTreeCapture === true, createdAt: this.clock() });
    await this.index.recordAction({ checkpointId: checkpoint.id, action: 'create-branch', projectId: project.id, missionId: checkpoint.missionId, details: { branch: worktree.branch, path: worktree.path, receiptSha256: receipt.receiptSha256 } });
    return receipt;
  }

  async replayMission({ checkpointId, objective = null } = {}) {
    const checkpoint = await this.index.get(checkpointId); const project = this.store.getProject(checkpoint.projectId);
    if (!project) throw Object.assign(new Error(`Unknown project: ${checkpoint.projectId}`), { code: 'TIME_TRAVEL_PROJECT_NOT_FOUND', statusCode: 404 });
    const mission = this.store.createMission({ projectId: project.id, objective: String(objective ?? checkpoint.missionState?.objective ?? `Replay ${checkpoint.label}`).slice(0, 20_000), status: 'planned', metadata: { replayedFromCheckpointId: checkpoint.id, replayedFromMissionId: checkpoint.missionId, checkpointReceiptSha256: checkpoint.receiptSha256, checkpointGitCommit: checkpoint.git.commit } });
    const sourceTasks = checkpoint.missionState?.tasks ?? [];
    const ids = new Map(sourceTasks.map((task) => [task.id, `task_${randomUUID().replaceAll('-', '')}`]));
    const tasks = sourceTasks.map((task) => this.store.createTask({
      id: ids.get(task.id), projectId: project.id, missionId: mission.id,
      title: task.title, objective: task.objective, status: 'todo', role: task.role,
      dependencies: (task.dependencies ?? []).map((id) => ids.get(id)).filter(Boolean),
      allowedPaths: task.allowedPaths ?? ['**'], deniedPaths: task.deniedPaths ?? [],
      metadata: { taskContract: task.metadata?.taskContract ?? undefined, replayedFromTaskId: task.id, replayedFromCheckpointId: checkpoint.id, baseRef: checkpoint.git.commit },
    }));
    const receipt = signed({ schema: TIME_TRAVEL_SCHEMAS.replayReceipt, checkpointId: checkpoint.id, sourceMissionId: checkpoint.missionId, mission, tasks: tasks.map((task) => ({ id: task.id, sourceTaskId: task.metadata.replayedFromTaskId, dependencies: task.dependencies })), createdAt: this.clock() });
    await this.index.recordAction({ checkpointId: checkpoint.id, action: 'replay-mission', projectId: project.id, missionId: mission.id, details: { sourceMissionId: checkpoint.missionId, taskCount: tasks.length, receiptSha256: receipt.receiptSha256 } });
    return receipt;
  }
}
