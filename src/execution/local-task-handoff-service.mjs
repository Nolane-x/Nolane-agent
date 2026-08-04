import { access } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { createEvent } from '../protocol/events.mjs';

const ELIGIBLE_ROLES = new Set(['builder', 'integrator']);
const TERMINAL_STATUSES = new Set(['done', 'failed', 'cancelled', 'rolled-back']);

function codedError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function required(value, code, message) {
  const text = String(value ?? '').trim();
  if (!text) throw codedError(code, message);
  return text;
}

async function exists(target) {
  try { await access(target); return true; } catch { return false; }
}

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (!value || typeof value !== 'object') return value;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)])));
}

function publicWorktree(task) {
  const worktree = task.metadata?.worktree;
  if (!worktree?.path || !worktree?.branch) {
    throw codedError('LOCAL_HANDOFF_MANAGED_WORKTREE_REQUIRED', `Task ${task.id} has no managed worktree`, { taskId: task.id });
  }
  const worktreePath = path.resolve(worktree.path);
  const executionWorkspace = path.resolve(task.metadata?.executionWorkspace ?? '');
  if (executionWorkspace !== worktreePath) {
    throw codedError('LOCAL_HANDOFF_WORKSPACE_MISMATCH', `Task ${task.id} execution workspace does not match its managed worktree`, { taskId: task.id });
  }
  return freeze({ path: worktreePath, branch: String(worktree.branch), baseRef: String(worktree.baseRef ?? task.metadata?.baseRef ?? 'HEAD') });
}

function selectTask(tasks) {
  return tasks
    .filter((task) => ELIGIBLE_ROLES.has(task.role))
    .sort((left, right) => {
      const leftManaged = Number(Boolean(left.metadata?.worktree?.path));
      const rightManaged = Number(Boolean(right.metadata?.worktree?.path));
      if (leftManaged !== rightManaged) return rightManaged - leftManaged;
      const leftActive = Number(!TERMINAL_STATUSES.has(left.status));
      const rightActive = Number(!TERMINAL_STATUSES.has(right.status));
      if (leftActive !== rightActive) return rightActive - leftActive;
      return String(right.updatedAt ?? right.createdAt ?? '').localeCompare(String(left.updatedAt ?? left.createdAt ?? ''));
    })[0] ?? null;
}

export class LocalTaskHandoffService {
  constructor({ store, workspaceService, now = () => new Date().toISOString() } = {}) {
    if (!store?.getMission || !store?.getTask || !store?.listTasks || !store?.updateTask || !store?.appendEvent) {
      throw new TypeError('LocalTaskHandoffService store is required');
    }
    if (!workspaceService?.prepare) throw new TypeError('LocalTaskHandoffService workspaceService is required');
    this.store = store;
    this.workspaceService = workspaceService;
    this.now = now;
  }

  #principal(principalId) {
    return required(principalId, 'LOCAL_HANDOFF_PRINCIPAL_REQUIRED', 'An authenticated principal is required for local task handoff');
  }

  #mission(missionId) {
    const id = required(missionId, 'LOCAL_HANDOFF_MISSION_REQUIRED', 'missionId is required');
    const mission = this.store.getMission(id);
    if (!mission) throw codedError('LOCAL_HANDOFF_MISSION_UNKNOWN', `Unknown mission: ${id}`, { missionId: id });
    return mission;
  }

  #task(mission, taskId = null) {
    if (taskId != null && String(taskId).trim()) {
      const task = this.store.getTask(String(taskId).trim());
      if (!task) throw codedError('LOCAL_HANDOFF_TASK_UNKNOWN', `Unknown task: ${taskId}`, { taskId: String(taskId) });
      if (task.missionId !== mission.id) {
        throw codedError('LOCAL_HANDOFF_TASK_MISSION_MISMATCH', `Task ${task.id} does not belong to mission ${mission.id}`, { taskId: task.id, missionId: mission.id });
      }
      if (task.projectId !== mission.projectId) {
        throw codedError('LOCAL_HANDOFF_TASK_PROJECT_MISMATCH', `Task ${task.id} does not belong to project ${mission.projectId}`, { taskId: task.id, projectId: mission.projectId });
      }
      if (!ELIGIBLE_ROLES.has(task.role)) {
        throw codedError('LOCAL_HANDOFF_TASK_ROLE_UNSUPPORTED', `Task ${task.id} role ${task.role ?? 'none'} cannot be transferred to a managed local worktree`, { taskId: task.id, role: task.role ?? null });
      }
      return task;
    }
    const selected = selectTask(this.store.listTasks({ missionId: mission.id }));
    if (!selected) throw codedError('LOCAL_HANDOFF_TASK_NOT_FOUND', `Mission ${mission.id} has no eligible builder or integrator task`, { missionId: mission.id });
    return selected;
  }

  #dependencyHandoffs(task) {
    return task.dependencies
      .map((dependencyId) => this.store.getTask(dependencyId))
      .filter((dependency) => dependency?.metadata?.handoff?.handoffSha256)
      .map((dependency) => freeze({
        taskId: dependency.id,
        handoffSha256: String(dependency.metadata.handoff.handoffSha256),
        receiptSha256s: Object.freeze((dependency.metadata.handoff.receiptSha256s ?? []).map(String)),
      }));
  }

  async prepare({ missionId, taskId = null, principalId } = {}) {
    const principal = this.#principal(principalId);
    const mission = this.#mission(missionId);
    const selected = this.#task(mission, taskId);
    const existing = selected.metadata?.localHandoff;
    if (existing) {
      if (existing.principalId !== principal) {
        throw codedError('LOCAL_HANDOFF_PRINCIPAL_MISMATCH', `Task ${selected.id} local handoff belongs to another principal`, { taskId: selected.id });
      }
      if (existing.localWorkspace && await exists(existing.localWorkspace)) return freeze(structuredClone(existing));
    }

    const prepared = await this.workspaceService.prepare(selected);
    const worktree = publicWorktree(prepared);
    if (!await exists(worktree.path)) {
      throw codedError('LOCAL_HANDOFF_WORKTREE_MISSING', `Managed worktree for task ${prepared.id} does not exist`, { taskId: prepared.id });
    }

    const base = {
      schema: 'forge.local-task-handoff.v1',
      projectId: prepared.projectId,
      missionId: mission.id,
      taskId: prepared.id,
      title: prepared.title,
      objective: prepared.objective,
      role: prepared.role,
      status: prepared.status,
      executionTarget: 'local',
      principalId: principal,
      dependencies: Object.freeze([...prepared.dependencies]),
      allowedPaths: Object.freeze([...prepared.allowedPaths]),
      deniedPaths: Object.freeze([...prepared.deniedPaths]),
      dependencyHandoffs: Object.freeze(this.#dependencyHandoffs(prepared)),
      localWorkspace: worktree.path,
      worktree,
      preparedAt: String(this.now()),
    };
    const bundle = freeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.store.updateTask(prepared.id, {
      metadata: { ...prepared.metadata, executionTarget: 'local', localHandoff: bundle },
    });
    this.store.appendEvent(createEvent('task.local-handoff.prepared', {
      executionTarget: 'local',
      principalId: principal,
      worktreeBranch: worktree.branch,
      receiptSha256: bundle.receiptSha256,
    }, { projectId: prepared.projectId, missionId: mission.id, taskId: prepared.id }));
    return bundle;
  }

  get({ taskId, principalId } = {}) {
    const principal = this.#principal(principalId);
    const id = required(taskId, 'LOCAL_HANDOFF_TASK_REQUIRED', 'taskId is required');
    const task = this.store.getTask(id);
    if (!task) throw codedError('LOCAL_HANDOFF_TASK_UNKNOWN', `Unknown task: ${id}`, { taskId: id });
    const bundle = task.metadata?.localHandoff;
    if (!bundle) throw codedError('LOCAL_HANDOFF_NOT_FOUND', `Task ${id} has no persisted local handoff`, { taskId: id });
    if (bundle.principalId !== principal) {
      throw codedError('LOCAL_HANDOFF_PRINCIPAL_MISMATCH', `Task ${id} local handoff belongs to another principal`, { taskId: id });
    }
    return freeze(structuredClone(bundle));
  }
}
