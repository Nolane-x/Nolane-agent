import { access } from 'node:fs/promises';
import path from 'node:path';

import { WorktreeManager } from './worktree-manager.mjs';

const ISOLATED_ROLES = new Set(['builder', 'integrator']);

async function exists(target) {
  try { await access(target); return true; } catch { return false; }
}

export class TaskWorkspaceService {
  constructor({ store, worktreesRoot, managerFactory = (options) => new WorktreeManager(options) } = {}) {
    if (!store || !worktreesRoot) throw new TypeError('TaskWorkspaceService store and worktreesRoot are required');
    this.store = store;
    this.worktreesRoot = path.resolve(worktreesRoot);
    this.managerFactory = managerFactory;
    this.managers = new Map();
  }

  #project(task) {
    const project = this.store.getProject(task.projectId);
    if (!project) throw new Error(`Unknown project: ${task.projectId}`);
    return project;
  }

  #manager(project) {
    let manager = this.managers.get(project.id);
    if (!manager) {
      manager = this.managerFactory({ repositoryRoot: project.workspaceRoot, worktreesRoot: path.join(this.worktreesRoot, project.id) });
      this.managers.set(project.id, manager);
    }
    return manager;
  }

  #persist(task, metadata) { return this.store.updateTask(task.id, { metadata: { ...task.metadata, ...metadata } }); }

  async prepare(inputTask) {
    const task = this.store.getTask(inputTask.id) ?? inputTask;
    const project = this.#project(task);
    const existing = task.metadata?.executionWorkspace;
    if (existing && await exists(existing)) return task;

    if (task.role === 'reviewer') {
      const dependencies = task.dependencies.map((id) => this.store.getTask(id)).filter(Boolean);
      const candidate = dependencies.find((item) => item.role === 'builder' && item.metadata?.worktree?.path);
      if (candidate && await exists(candidate.metadata.worktree.path)) {
        return this.#persist(task, {
          executionWorkspace: candidate.metadata.worktree.path,
          worktree: structuredClone(candidate.metadata.worktree),
          reviewOfTaskId: candidate.id,
        });
      }
    }

    if (!ISOLATED_ROLES.has(task.role)) return this.#persist(task, { executionWorkspace: project.workspaceRoot });

    const worktree = await this.#manager(project).create({ taskId: task.id, baseRef: task.metadata?.baseRef ?? 'HEAD' });
    return this.#persist(task, { executionWorkspace: worktree.path, worktree: structuredClone(worktree) });
  }
  async rollbackMission(missionId) {
    const mission = this.store.getMission(String(missionId ?? ''));
    if (!mission) throw new Error(`Unknown mission: ${missionId}`);
    const project = this.store.getProject(mission.projectId);
    if (!project) throw new Error(`Unknown project: ${mission.projectId}`);
    const tasks = this.store.listTasks({ missionId: mission.id });
    const unique = new Map();
    for (const task of tasks) {
      const worktree = task.metadata?.worktree;
      if (worktree?.path) unique.set(path.resolve(worktree.path), structuredClone(worktree));
    }

    let removedWorktrees = 0;
    const manager = this.#manager(project);
    for (const worktree of unique.values()) {
      if (await exists(worktree.path)) {
        await manager.remove(worktree, { force: true, deleteBranch: true });
        removedWorktrees += 1;
      }
    }

    const rolledBackAt = new Date().toISOString();
    for (const task of tasks) {
      if (!task.metadata?.worktree?.path) continue;
      this.store.updateTask(task.id, {
        leaseOwner: null,
        leaseExpiresAt: null,
        metadata: { ...task.metadata, executionWorkspace: null, worktree: null, rolledBackAt },
      });
    }
    this.store.updateMission(mission.id, { status: 'rolled-back', metadata: { ...mission.metadata, rolledBackAt, removedWorktrees } });
    return Object.freeze({ missionId: mission.id, status: 'rolled-back', removedWorktrees, rolledBackAt });
  }

}
