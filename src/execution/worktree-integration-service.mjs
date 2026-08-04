import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { TaskGraph } from '../orchestration/task-graph.mjs';

const exec = promisify(execFile);

function codedError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function validateCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Verification command must be an object');
  const command = String(value.command ?? '').trim();
  const args = Array.isArray(value.args) ? value.args.map(String) : [];
  if (!command || command.includes('\0')) throw new TypeError('Verification command is required');
  if (args.some((argument) => argument.includes('\0'))) throw new TypeError('Verification command arguments cannot contain NUL bytes');
  return Object.freeze({ command, args: Object.freeze(args), cwd: String(value.cwd ?? '.') });
}

function bounded(value, limit = 100_000) {
  const buffer = Buffer.from(String(value ?? ''));
  return buffer.length <= limit ? buffer.toString('utf8') : `${buffer.subarray(0, limit).toString('utf8')}\n[TRUNCATED]`;
}

export class WorktreeIntegrationService {
  constructor({ store, integrationsRoot, approval, commandRunner = null, collisionGovernance = null, now = () => new Date().toISOString() } = {}) {
    if (!store?.getMission || !store?.listTasks || !store?.updateMission) throw new TypeError('WorktreeIntegrationService store is required');
    if (!integrationsRoot) throw new TypeError('integrationsRoot is required');
    if (typeof approval !== 'function') throw new TypeError('approval is required');
    this.store = store;
    this.integrationsRoot = path.resolve(integrationsRoot);
    this.approval = approval;
    if (collisionGovernance !== null && typeof collisionGovernance?.collisionMap !== 'function') throw new TypeError('collisionGovernance must expose collisionMap');
    this.collisionGovernance = collisionGovernance;
    this.commandRunner = commandRunner ?? (async ({ command, args, cwd }) => exec(command, args, {
      cwd,
      timeout: 10 * 60_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', GIT_TERMINAL_PROMPT: '0' },
    }));
    this.now = now;
  }

  plan(missionId) {
    const mission = this.store.getMission(String(missionId ?? ''));
    if (!mission) throw codedError('WORKTREE_INTEGRATION_MISSION_UNKNOWN', `Unknown mission: ${missionId}`);
    const tasks = this.store.listTasks({ missionId: mission.id });
    const graph = TaskGraph.validate(tasks);
    const builders = graph.order.map((id) => graph.tasks.get(id)).filter((task) => task.role === 'builder' && task.metadata?.worktree?.path);
    if (builders.length === 0) throw codedError('WORKTREE_INTEGRATION_EMPTY', 'Mission has no managed builder worktrees');
    for (const task of builders) {
      if (task.status !== 'done') throw codedError('WORKTREE_INTEGRATION_TASK_NOT_VERIFIED', `Builder task ${task.id} is ${task.status}, not done`, { taskId: task.id, status: task.status });
      if (!task.metadata.worktree.branch) throw codedError('WORKTREE_INTEGRATION_BRANCH_REQUIRED', `Builder task ${task.id} has no branch metadata`, { taskId: task.id });
    }
    return Object.freeze({ mission, tasks: Object.freeze(builders), taskOrder: Object.freeze(builders.map((task) => task.id)) });
  }

  async #run(command, args, cwd, operation, extra = {}) {
    const started = Date.now();
    try {
      const result = await this.commandRunner({ command, args, cwd });
      const base = {
        schema: 'forge.worktree-integration-step.v1', operation, status: 'pass', command, args: Object.freeze(args.map(String)), cwd,
        stdout: bounded(result?.stdout), stderr: bounded(result?.stderr), durationMs: Date.now() - started, ...extra,
      };
      return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
    } catch (cause) {
      const base = {
        schema: 'forge.worktree-integration-step.v1', operation, status: 'fail', command, args: Object.freeze(args.map(String)), cwd,
        stdout: bounded(cause?.stdout), stderr: bounded(cause?.stderr ?? cause?.message), durationMs: Date.now() - started, ...extra,
      };
      const step = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
      throw codedError('WORKTREE_INTEGRATION_COMMAND_FAILED', `${operation} failed`, { cause, step });
    }
  }

  async #git(args, cwd, operation, extra = {}) { return this.#run('git', args, cwd, operation, extra); }

  async integrate({ missionId, targetRef = 'HEAD', verificationCommands, principal = null, collisionIdempotencyKey = null } = {}) {
    const plan = this.plan(missionId);
    let collisionMap = null;
    if (this.collisionGovernance) {
      collisionMap = await this.collisionGovernance.collisionMap({ missionId: plan.mission.id, principal, targetRef, idempotencyKey: collisionIdempotencyKey ?? `integration:${plan.mission.id}:${String(targetRef)}` });
      if (collisionMap.ready !== true) throw codedError('WORKTREE_INTEGRATION_PREFLIGHT_BLOCKED', 'Git collision or review preflight blocked integration', { collisionMap });
    }
    const commands = Array.isArray(verificationCommands) ? verificationCommands.map(validateCommand) : [];
    if (commands.length === 0) throw codedError('WORKTREE_INTEGRATION_VERIFICATION_REQUIRED', 'At least one post-merge verification command is required');
    const project = this.store.getProject(plan.mission.projectId);
    if (!project) throw codedError('WORKTREE_INTEGRATION_PROJECT_UNKNOWN', `Unknown project: ${plan.mission.projectId}`);
    const decision = await this.approval(Object.freeze({
      schema: 'forge.worktree-integration-approval.v1', missionId: plan.mission.id, projectId: project.id,
      targetRef: String(targetRef), taskOrder: plan.taskOrder, impact: 'Rebase builder branches and merge them into an isolated integration worktree.',
    }));
    if (!decision || decision.approved !== true) throw codedError('WORKTREE_INTEGRATION_APPROVAL_DENIED', 'Worktree integration approval was denied');

    await mkdir(this.integrationsRoot, { recursive: true });
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
    const integrationWorkspace = path.join(this.integrationsRoot, `${plan.mission.id}-${suffix}`);
    const steps = [];
    const runStep = async (...input) => { const step = await this.#git(...input); steps.push(step); return step; };
    await runStep(['worktree', 'add', '--detach', integrationWorkspace, String(targetRef)], project.workspaceRoot, 'integration-worktree-create');
    const targetHead = (await runStep(['rev-parse', 'HEAD'], integrationWorkspace, 'integration-target-head')).stdout.trim();

    try {
      for (const task of plan.tasks) {
        const worktree = path.resolve(task.metadata.worktree.path);
        const status = await runStep(['status', '--porcelain=v1', '--untracked-files=all'], worktree, 'builder-status', { taskId: task.id });
        if (status.stdout.trim()) throw codedError('WORKTREE_INTEGRATION_DIRTY_BUILDER', `Builder worktree ${task.id} is dirty`, { taskId: task.id, integrationWorkspace, step: status });
        const integrationHead = (await runStep(['rev-parse', 'HEAD'], integrationWorkspace, 'integration-head-before-task', { taskId: task.id })).stdout.trim();
        try {
          await runStep(['rebase', integrationHead], worktree, 'rebase', { taskId: task.id, onto: integrationHead });
        } catch (error) {
          await this.#git(['rebase', '--abort'], worktree, 'rebase-abort', { taskId: task.id }).catch(() => null);
          throw codedError('WORKTREE_INTEGRATION_REBASE_FAILED', `Rebase failed for ${task.id}`, { taskId: task.id, integrationWorkspace, cause: error });
        }
        await runStep(['merge', '--ff-only', task.metadata.worktree.branch], integrationWorkspace, 'merge', { taskId: task.id });
        for (const command of commands) {
          const cwd = path.resolve(integrationWorkspace, command.cwd);
          const relative = path.relative(integrationWorkspace, cwd);
          if (relative.startsWith('..') || path.isAbsolute(relative)) throw codedError('WORKTREE_INTEGRATION_VERIFY_CWD_OUTSIDE', 'Verification command cwd is outside integration workspace', { taskId: task.id });
          try {
            const step = await this.#run(command.command, [...command.args], cwd, 'verify', { taskId: task.id });
            steps.push(step);
          } catch (error) {
            if (error.step) steps.push(error.step);
            throw codedError('WORKTREE_INTEGRATION_VERIFICATION_FAILED', `Post-merge verification failed after ${task.id}`, { taskId: task.id, integrationWorkspace, cause: error, steps: Object.freeze([...steps]) });
          }
        }
      }
    } catch (error) {
      this.store.updateMission(plan.mission.id, { metadata: {
        ...plan.mission.metadata, integrationStatus: 'failed', integrationWorkspace, integrationTaskOrder: plan.taskOrder,
        integrationTargetHead: targetHead, integrationFailedAt: this.now(), integrationFailureCode: error.code ?? 'WORKTREE_INTEGRATION_FAILED',
      } });
      if (!error.integrationWorkspace) error.integrationWorkspace = integrationWorkspace;
      throw error;
    }

    const integratedHead = (await runStep(['rev-parse', 'HEAD'], integrationWorkspace, 'integration-head-final')).stdout.trim();
    const completedAt = this.now();
    const base = {
      schema: 'forge.worktree-integration-result.v1', missionId: plan.mission.id, projectId: project.id, status: 'pass',
      targetRef: String(targetRef), targetHead, integratedHead, integrationWorkspace, taskOrder: plan.taskOrder,
      approvalId: decision.id ? String(decision.id) : null, collisionMapReceiptSha256: collisionMap?.receiptSha256 ?? null, completedAt, steps: Object.freeze(steps),
    };
    const result = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.store.updateMission(plan.mission.id, { metadata: {
      ...plan.mission.metadata, integrationStatus: 'pass', integrationWorkspace, integrationTaskOrder: plan.taskOrder,
      integrationTargetHead: targetHead, integratedHead, integrationReceiptSha256: result.receiptSha256, integratedAt: completedAt,
    } });
    return result;
  }
}
