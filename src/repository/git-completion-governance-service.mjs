import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { createEvent } from '../protocol/events.mjs';
import { assertTaskActionAllowed } from '../orchestration/task-contract.mjs';

const exec = promisify(execFile);

const COMPLETION_KINDS = new Set(['checkpoint', 'final']);
const ARTIFACT_SEGMENTS = new Set(['node_modules', 'dist', 'build', 'coverage', '.next', '.nuxt', '.cache', 'target', 'vendor']);
const ARTIFACT_EXTENSIONS = /\.(?:zip|tar|tgz|gz|7z|rar|dmg|exe|msi|deb|rpm|appimage|db|sqlite|sqlite3|log|tmp|bak)$/i;
const MESSAGE_PATTERN = /^(?:feat|fix|refactor|test|docs|chore|build|ci|perf|style|revert)(?:\([a-z0-9._/-]{1,80}\))?!?: [^\r\n]{1,160}$/i;

function codedError(code, message, details = {}, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  Object.assign(error, details);
  return error;
}

function required(value, label, max = 2_000) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  if (text.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return text;
}

function principalSubject(principal) {
  const subject = String(principal?.subject ?? '').trim();
  if (!subject) throw codedError('GIT_COMPLETION_PRINCIPAL_REQUIRED', 'An authenticated principal is required', {}, 401);
  return subject;
}

function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

function matchGlob(pattern, candidate) {
  const escaped = String(pattern).replaceAll('\\', '/').replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('**', '\u0000').replaceAll('*', '[^/]*').replaceAll('\u0000', '.*').replaceAll('?', '[^/]');
  return new RegExp(`^${escaped}$`).test(candidate);
}

function normalizeRelativePath(root, value) {
  const absolute = path.resolve(root, required(value, 'path', 2_000));
  const relative = path.relative(root, absolute).replaceAll(path.sep, '/');
  if (!relative || relative === '.git' || relative.startsWith('../') || path.isAbsolute(relative) || relative.startsWith('.git/')) {
    throw codedError('GIT_COMPLETION_PATH_OUTSIDE', `Path is outside the managed worktree: ${value}`);
  }
  return relative;
}

function artifactReason(relative) {
  const segments = relative.split('/');
  if (segments.some((segment) => ARTIFACT_SEGMENTS.has(segment))) return `generated directory ${segments.find((segment) => ARTIFACT_SEGMENTS.has(segment))}`;
  if (ARTIFACT_EXTENSIONS.test(relative)) return 'generated or binary artifact extension';
  if (/^(?:release|artifacts?|tmp|temp)\//i.test(relative)) return 'release or temporary artifact directory';
  return null;
}

function normalizeRisks(value) {
  if (!Array.isArray(value) || value.length > 64) throw new TypeError('residualRisks must be an array with at most 64 entries');
  return Object.freeze(value.map((item, index) => required(item, `residualRisks[${index}]`, 2_000)));
}

function normalizeTestReceipts(value, { requiredPass }) {
  if (!Array.isArray(value) || value.length > 128) throw new TypeError('testReceipts must be an array with at most 128 entries');
  const receipts = value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError(`testReceipts[${index}] must be an object`);
    const receiptSha256 = String(item.receiptSha256 ?? item.receipt?.receiptSha256 ?? '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(receiptSha256)) throw new TypeError(`testReceipts[${index}].receiptSha256 is invalid`);
    const status = String(item.status ?? item.receipt?.status ?? '').toLowerCase();
    return freeze({ status, receiptSha256, command: item.command ? String(item.command) : null, args: Array.isArray(item.args) ? item.args.map(String) : [] });
  });
  if (requiredPass && !receipts.some((item) => item.status === 'pass')) {
    throw codedError('GIT_COMPLETION_VERIFICATION_REQUIRED', 'A final commit requires at least one passing test receipt');
  }
  return Object.freeze(receipts);
}

function generatedMessage(task, kind) {
  const scope = String(task.id).toLowerCase().replace(/[^a-z0-9._/-]+/g, '-').slice(0, 80) || 'task';
  const subject = String(task.title ?? task.objective ?? 'update task').replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
  return `chore(${scope}): ${kind === 'checkpoint' ? `checkpoint ${subject}` : subject}`;
}

function normalizeMessage(value, task, kind) {
  const message = value == null || String(value).trim() === '' ? generatedMessage(task, kind) : String(value).trim();
  if (!MESSAGE_PATTERN.test(message)) throw codedError('GIT_COMPLETION_MESSAGE_INVALID', 'Commit message must be one conventional-style line up to 160 subject characters');
  return message;
}

function bounded(value, max = 500_000) {
  const buffer = Buffer.from(String(value ?? ''));
  return buffer.length <= max ? buffer.toString('utf8') : `${buffer.subarray(0, max).toString('utf8')}\n[TRUNCATED]`;
}

function rowToCollisionMap(row) {
  if (!row) return null;
  return freeze(JSON.parse(row.map_json));
}

function rowToConflictResolution(row) {
  if (!row) return null;
  return freeze(JSON.parse(row.resolution_json));
}

function rowToCompletion(row) {
  if (!row) return null;
  return freeze({
    schema: 'forge.git-completion.v1',
    id: row.id,
    kind: row.kind,
    projectId: row.project_id,
    missionId: row.mission_id,
    taskId: row.task_id,
    principalId: row.principal_id,
    status: row.status,
    beforeHead: row.before_head,
    afterHead: row.after_head,
    message: row.message,
    paths: JSON.parse(row.paths_json),
    remotes: JSON.parse(row.remotes_json),
    testReceipts: JSON.parse(row.test_receipts_json),
    residualRisks: JSON.parse(row.residual_risks_json),
    verificationPending: row.verification_pending === 1,
    gitReceipt: row.git_receipt_json ? JSON.parse(row.git_receipt_json) : null,
    requestSha256: row.request_sha256,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    receiptSha256: row.receipt_sha256,
  });
}

export class GitCompletionGovernanceService {
  constructor({ store, gatewayFactory, commandRunner = null, clock = () => new Date() } = {}) {
    if (!store?.db || !store?.getTask || !store?.getProject || !store?.addEvidence || !store?.appendEvent) throw new TypeError('GitCompletionGovernanceService store is required');
    if (typeof gatewayFactory !== 'function') throw new TypeError('GitCompletionGovernanceService gatewayFactory is required');
    this.store = store;
    this.gatewayFactory = gatewayFactory;
    this.commandRunner = commandRunner ?? (async ({ args, cwd, allowFailure = false }) => {
      try {
        const result = await exec('git', args.map(String), { cwd, timeout: 120_000, maxBuffer: 2_000_000, windowsHide: true, env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', GIT_TERMINAL_PROMPT: '0' } });
        return freeze({ status: 'pass', stdout: bounded(result.stdout), stderr: bounded(result.stderr), args: args.map(String), shell: false });
      } catch (cause) {
        const result = freeze({ status: 'fail', stdout: bounded(cause.stdout), stderr: bounded(cause.stderr ?? cause.message), args: args.map(String), shell: false, exitCode: cause.code });
        if (allowFailure) return result;
        throw codedError('GIT_COMPLETION_COMMAND_FAILED', `git ${args[0]} failed: ${result.stderr || result.stdout}`, { result, cause });
      }
    });
    this.clock = clock;
    this.#migrate();
  }

  #migrate() {
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS git_completion_records(
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        project_id TEXT NOT NULL,
        mission_id TEXT,
        task_id TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        status TEXT NOT NULL,
        before_head TEXT NOT NULL,
        after_head TEXT,
        message TEXT NOT NULL,
        paths_json TEXT NOT NULL,
        remotes_json TEXT NOT NULL,
        test_receipts_json TEXT NOT NULL,
        residual_risks_json TEXT NOT NULL,
        verification_pending INTEGER NOT NULL,
        git_receipt_json TEXT,
        request_sha256 TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        created_at TEXT NOT NULL,
        receipt_sha256 TEXT,
        UNIQUE(project_id,principal_id,idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS git_completion_task_time ON git_completion_records(task_id,created_at,id);
      CREATE TABLE IF NOT EXISTS git_collision_maps(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        target_ref TEXT NOT NULL,
        request_sha256 TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        map_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        receipt_sha256 TEXT NOT NULL,
        UNIQUE(project_id,principal_id,idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS git_collision_mission_time ON git_collision_maps(mission_id,created_at,id);
      CREATE TABLE IF NOT EXISTS git_conflict_resolutions(
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        left_task_id TEXT NOT NULL,
        right_task_id TEXT NOT NULL,
        expected_conflict_receipt_sha256 TEXT NOT NULL,
        request_sha256 TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        resolution_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        receipt_sha256 TEXT NOT NULL,
        UNIQUE(project_id,principal_id,idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS git_conflict_resolution_mission_time ON git_conflict_resolutions(mission_id,created_at,id);
    `);
  }

  #scope(taskId, principal) {
    const task = this.store.getTask(required(taskId, 'taskId', 256));
    if (!task) throw codedError('GIT_COMPLETION_TASK_NOT_FOUND', `Unknown task: ${taskId}`, {}, 404);
    const project = this.store.getProject(task.projectId);
    if (!project) throw codedError('GIT_COMPLETION_PROJECT_NOT_FOUND', `Unknown project: ${task.projectId}`, {}, 404);
    const principalId = principalSubject(principal);
    const projectRoot = path.resolve(task.metadata?.executionWorkspace ?? project.workspaceRoot);
    return { task, project, projectRoot, principalId };
  }

  #normalizePaths(task, projectRoot, paths) {
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > 256) throw new TypeError('paths must contain between 1 and 256 entries');
    const allowed = Array.isArray(task.allowedPaths) && task.allowedPaths.length ? task.allowedPaths : ['**'];
    const denied = Array.isArray(task.deniedPaths) ? task.deniedPaths : [];
    const result = [];
    for (const input of paths) {
      const relative = normalizeRelativePath(projectRoot, input);
      const reason = artifactReason(relative);
      if (reason) throw codedError('GIT_COMPLETION_ARTIFACT_DENIED', `Artifact path is denied: ${relative}`, { path: relative, reason });
      if (denied.some((pattern) => matchGlob(pattern, relative)) || !allowed.some((pattern) => matchGlob(pattern, relative))) {
        throw codedError('GIT_COMPLETION_PATH_DENIED', `Path is outside task scope: ${relative}`, { path: relative });
      }
      if (task.metadata?.taskContract?.scope) assertTaskActionAllowed(task.metadata.taskContract, { kind: 'file.write', path: relative });
      result.push(relative);
    }
    return Object.freeze([...new Set(result)].sort());
  }

  #existing(projectId, principalId, idempotencyKey) {
    return this.store.db.prepare('SELECT * FROM git_completion_records WHERE project_id=? AND principal_id=? AND idempotency_key=?').get(projectId, principalId, idempotencyKey);
  }

  async #complete(kind, input = {}) {
    if (!COMPLETION_KINDS.has(kind)) throw new TypeError(`Unsupported completion kind: ${kind}`);
    const { task, project, projectRoot, principalId } = this.#scope(input.taskId, input.principal);
    if (kind === 'final' && task.metadata?.taskContract) assertTaskActionAllowed(task.metadata.taskContract, { kind: 'git.commit' });
    const idempotencyKey = required(input.idempotencyKey, 'idempotencyKey', 256);
    const paths = this.#normalizePaths(task, projectRoot, input.paths);
    const expectedHead = required(input.expectedHead, 'expectedHead', 128);
    const message = normalizeMessage(input.message, task, kind);
    const testReceipts = normalizeTestReceipts(input.testReceipts ?? [], { requiredPass: kind === 'final' });
    const residualRisks = normalizeRisks(input.residualRisks);
    const verificationPending = kind === 'checkpoint' && !testReceipts.some((item) => item.status === 'pass');
    const request = freeze({ schema: 'forge.git-completion-request.v1', kind, projectId: project.id, missionId: task.missionId ?? null, taskId: task.id, principalId, expectedHead, message, paths, testReceipts, residualRisks, verificationPending });
    const requestSha256 = canonicalSha256(request);
    const existing = this.#existing(project.id, principalId, idempotencyKey);
    if (existing) {
      if (existing.request_sha256 !== requestSha256) throw codedError('GIT_COMPLETION_IDEMPOTENCY_MISMATCH', 'Idempotency key was reused with a different request', { idempotencyKey }, 409);
      if (existing.status !== 'committed') throw codedError('GIT_COMPLETION_INCOMPLETE_RECORD', 'An earlier completion attempt did not finish', { idempotencyKey, status: existing.status }, 409);
      return rowToCompletion(existing);
    }

    const gateway = this.gatewayFactory({ task, project, projectRoot });
    if (!gateway?.head || !gateway?.commit || !gateway?.remotes) throw new TypeError('gatewayFactory must return a GitGateway-compatible object');
    const remotes = freeze(await gateway.remotes());
    const id = `git_completion_${randomUUID().replaceAll('-', '')}`;
    const createdAt = this.clock().toISOString();
    this.store.db.prepare(`INSERT INTO git_completion_records(id,kind,project_id,mission_id,task_id,principal_id,status,before_head,after_head,message,paths_json,remotes_json,test_receipts_json,residual_risks_json,verification_pending,git_receipt_json,request_sha256,idempotency_key,created_at,receipt_sha256)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, kind, project.id, task.missionId ?? null, task.id, principalId, 'pending', expectedHead, null, message,
      JSON.stringify(paths), JSON.stringify(remotes), JSON.stringify(testReceipts), JSON.stringify(residualRisks), verificationPending ? 1 : 0,
      null, requestSha256, idempotencyKey, createdAt, null,
    );

    let gitReceipt;
    try {
      gitReceipt = await gateway.commit({ message, paths, expectedHead });
    } catch (error) {
      this.store.db.prepare('UPDATE git_completion_records SET status=? WHERE id=?').run('failed', id);
      throw error;
    }

    const base = freeze({
      schema: 'forge.git-completion.v1', id, kind, projectId: project.id, missionId: task.missionId ?? null, taskId: task.id, principalId,
      status: 'committed', beforeHead: expectedHead, afterHead: gitReceipt.afterHead, message, paths, remotes, testReceipts, residualRisks,
      verificationPending, gitReceiptSha256: gitReceipt.receiptSha256, requestSha256, idempotencyKey, createdAt,
    });
    const receiptSha256 = canonicalSha256(base);
    this.store.db.prepare('UPDATE git_completion_records SET status=?,after_head=?,git_receipt_json=?,receipt_sha256=? WHERE id=?')
      .run('committed', gitReceipt.afterHead, JSON.stringify(gitReceipt), receiptSha256, id);
    const result = rowToCompletion(this.store.db.prepare('SELECT * FROM git_completion_records WHERE id=?').get(id));
    this.store.addEvidence({ projectId: project.id, taskId: task.id, kind: 'git-completion', status: kind === 'final' ? 'verified' : 'checkpoint', payload: { kind, beforeHead: expectedHead, afterHead: gitReceipt.afterHead, message, paths, testReceiptSha256: testReceipts.map((entry) => entry.receiptSha256), residualRisks, verificationPending }, receiptSha256 });
    this.store.appendEvent(createEvent('git.completion.committed', { kind, beforeHead: expectedHead, afterHead: gitReceipt.afterHead, message, paths, verificationPending, receiptSha256 }, { projectId: project.id, missionId: task.missionId ?? undefined, taskId: task.id }));
    return result;
  }



  #missionScope(missionId, principal) {
    const mission = this.store.getMission(required(missionId, 'missionId', 256));
    if (!mission) throw codedError('GIT_COLLISION_MISSION_NOT_FOUND', `Unknown mission: ${missionId}`, {}, 404);
    const project = this.store.getProject(mission.projectId);
    if (!project) throw codedError('GIT_COLLISION_PROJECT_NOT_FOUND', `Unknown project: ${mission.projectId}`, {}, 404);
    return { mission, project, principalId: principalSubject(principal) };
  }

  async #git(args, cwd, { allowFailure = false } = {}) {
    return this.commandRunner({ args: args.map(String), cwd: path.resolve(cwd), allowFailure });
  }

  async #taskChange(task, project, targetRef) {
    const worktreePath = path.resolve(String(task.metadata?.worktree?.path ?? task.metadata?.executionWorkspace ?? ''));
    const branch = required(task.metadata?.worktree?.branch, `task ${task.id} worktree branch`, 256);
    const statusResult = await this.#git(['status', '--porcelain=v1', '--untracked-files=all'], worktreePath);
    const head = (await this.#git(['rev-parse', 'HEAD'], worktreePath)).stdout.trim();
    const baseHead = (await this.#git(['merge-base', String(targetRef), branch], project.workspaceRoot)).stdout.trim();
    const changedResult = await this.#git(['diff', '--name-only', '--diff-filter=ACMRD', `${baseHead}..${head}`, '--'], project.workspaceRoot);
    const changedPaths = Object.freeze([...new Set(changedResult.stdout.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))].sort());
    const base = { taskId: task.id, role: task.role, branch, worktreePath, baseHead, head, dirty: Boolean(statusResult.stdout.trim()), changedPaths };
    return freeze({ ...base, snapshotSha256: canonicalSha256(base) });
  }

  #reviewCoverage(mission, tasks) {
    const records = [
      ...Object.values(mission.metadata?.gitReviewDecisions ?? {}),
      ...Object.values(mission.metadata?.diffReviewDecisions ?? {}),
    ].filter((item) => item && typeof item === 'object');
    const coverage = [];
    for (const task of tasks) for (const relative of task.changedPaths) {
      const matches = records.filter((record) => String(record.taskId ?? '') === task.taskId && String(record.path ?? '') === relative);
      const status = matches.some((record) => record.decision === 'reject') ? 'rejected' : matches.length > 0 && matches.every((record) => record.decision === 'accept') ? 'accepted' : 'pending';
      coverage.push(freeze({ taskId: task.taskId, path: relative, status, decisionReceiptSha256: Object.freeze(matches.map((record) => record.receiptSha256).filter((value) => /^[a-f0-9]{64}$/i.test(String(value)))) }));
    }
    return Object.freeze(coverage.sort((a, b) => a.path.localeCompare(b.path) || a.taskId.localeCompare(b.taskId)));
  }

  async #pairwise(tasks, project) {
    const pairs = [];
    for (let i = 0; i < tasks.length; i += 1) for (let j = i + 1; j < tasks.length; j += 1) {
      const left = tasks[i]; const right = tasks[j];
      const mergeBase = (await this.#git(['merge-base', left.head, right.head], project.workspaceRoot)).stdout.trim();
      const tree = await this.#git(['merge-tree', mergeBase, left.head, right.head], project.workspaceRoot, { allowFailure: true });
      const conflict = tree.status !== 'pass' || /(?:changed in both|<<<<<<< \.our|^CONFLICT\b)/mi.test(`${tree.stdout}\n${tree.stderr}`);
      const overlap = left.changedPaths.filter((relative) => right.changedPaths.includes(relative)).sort();
      const conflictPaths = conflict ? overlap : [];
      const base = { leftTaskId: left.taskId, rightTaskId: right.taskId, leftHead: left.head, rightHead: right.head, mergeBase, status: conflict ? 'conflict' : 'clean', conflictPaths: Object.freeze(conflictPaths), outputSha256: canonicalSha256({ stdout: tree.stdout, stderr: tree.stderr, status: tree.status }) };
      pairs.push(freeze({ ...base, receiptSha256: canonicalSha256(base) }));
    }
    return Object.freeze(pairs);
  }

  async collisionMap({ missionId, principal, targetRef = 'HEAD', idempotencyKey } = {}) {
    const { mission, project, principalId } = this.#missionScope(missionId, principal);
    const target = required(targetRef, 'targetRef', 256);
    const key = required(idempotencyKey, 'idempotencyKey', 256);
    const candidates = this.store.listTasks({ missionId: mission.id }).filter((task) => ['builder', 'integrator'].includes(task.role) && task.metadata?.worktree?.path && task.metadata?.worktree?.branch).sort((a, b) => a.id.localeCompare(b.id));
    if (candidates.length === 0) throw codedError('GIT_COLLISION_TASKS_REQUIRED', 'Mission has no managed builder or integrator worktrees');
    const tasks = Object.freeze(await Promise.all(candidates.map((task) => this.#taskChange(task, project, target))));
    const pairs = await this.#pairwise(tasks, project);
    const owners = new Map();
    for (const task of tasks) for (const relative of task.changedPaths) {
      if (!owners.has(relative)) owners.set(relative, []);
      owners.get(relative).push(task.taskId);
    }
    const overlaps = Object.freeze([...owners.entries()].filter(([, taskIds]) => taskIds.length > 1).map(([relative, taskIds]) => freeze({ path: relative, taskIds: Object.freeze(taskIds.sort()) })).sort((a, b) => a.path.localeCompare(b.path)));
    const reviewCoverage = this.#reviewCoverage(mission, tasks);
    const ready = tasks.every((task) => !task.dirty) && pairs.every((pair) => pair.status === 'clean') && reviewCoverage.every((entry) => entry.status === 'accepted');
    const request = freeze({ schema: 'forge.git-collision-map-request.v1', projectId: project.id, missionId: mission.id, principalId, targetRef: target, taskSnapshots: tasks.map((task) => task.snapshotSha256) });
    const requestSha256 = canonicalSha256(request);
    const existing = this.store.db.prepare('SELECT * FROM git_collision_maps WHERE project_id=? AND principal_id=? AND idempotency_key=?').get(project.id, principalId, key);
    if (existing) {
      if (existing.request_sha256 !== requestSha256) throw codedError('GIT_COLLISION_IDEMPOTENCY_MISMATCH', 'Collision idempotency key was reused after mission state changed', { idempotencyKey: key }, 409);
      return rowToCollisionMap(existing);
    }
    const createdAt = this.clock().toISOString();
    const id = `git_collision_${randomUUID().replaceAll('-', '')}`;
    const base = freeze({ schema: 'forge.git-collision-map.v1', id, projectId: project.id, missionId: mission.id, principalId, targetRef: target, tasks, overlaps, pairs, reviewCoverage, ready, requestSha256, idempotencyKey: key, createdAt });
    const result = freeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.store.db.prepare('INSERT INTO git_collision_maps(id,project_id,mission_id,principal_id,target_ref,request_sha256,idempotency_key,map_json,created_at,receipt_sha256) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(id, project.id, mission.id, principalId, target, requestSha256, key, JSON.stringify(result), createdAt, result.receiptSha256);
    this.store.addEvidence({ projectId: project.id, kind: 'git-collision-map', status: ready ? 'verified' : 'blocked', payload: { missionId: mission.id, targetRef: target, taskCount: tasks.length, overlapCount: overlaps.length, conflictCount: pairs.filter((pair) => pair.status === 'conflict').length, pendingReviewCount: reviewCoverage.filter((entry) => entry.status !== 'accepted').length, ready }, receiptSha256: result.receiptSha256 });
    this.store.appendEvent(createEvent('git.collision-map.created', { targetRef: target, taskCount: tasks.length, overlapCount: overlaps.length, conflictCount: pairs.filter((pair) => pair.status === 'conflict').length, pendingReviewCount: reviewCoverage.filter((entry) => entry.status !== 'accepted').length, ready, receiptSha256: result.receiptSha256 }, { projectId: project.id, missionId: mission.id }));
    return result;
  }

  async recordConflictResolution({ missionId, leftTaskId, rightTaskId, principal, expectedConflictReceiptSha256, resolutionSummary, testReceipts = [], idempotencyKey } = {}) {
    const { mission, project, principalId } = this.#missionScope(missionId, principal);
    const taskIds = Object.freeze([required(leftTaskId, 'leftTaskId', 256), required(rightTaskId, 'rightTaskId', 256)].sort());
    if (taskIds[0] === taskIds[1]) throw codedError('GIT_CONFLICT_PAIR_INVALID', 'Conflict resolution requires two different task IDs');
    const expectedReceipt = String(expectedConflictReceiptSha256 ?? '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedReceipt)) throw new TypeError('expectedConflictReceiptSha256 is invalid');
    const summary = required(resolutionSummary, 'resolutionSummary', 4_000);
    const receipts = normalizeTestReceipts(testReceipts, { requiredPass: true });
    const key = required(idempotencyKey, 'idempotencyKey', 256);
    const request = freeze({ schema: 'forge.git-conflict-resolution-request.v1', projectId: project.id, missionId: mission.id, principalId, taskIds, expectedConflictReceiptSha256: expectedReceipt, resolutionSummary: summary, testReceipts: receipts });
    const requestSha256 = canonicalSha256(request);
    const existing = this.store.db.prepare('SELECT * FROM git_conflict_resolutions WHERE project_id=? AND principal_id=? AND idempotency_key=?').get(project.id, principalId, key);
    if (existing) {
      if (existing.request_sha256 !== requestSha256) throw codedError('GIT_CONFLICT_RESOLUTION_IDEMPOTENCY_MISMATCH', 'Conflict resolution idempotency key was reused with a different request', { idempotencyKey: key }, 409);
      return rowToConflictResolution(existing);
    }
    const priorRow = this.store.db.prepare('SELECT * FROM git_collision_maps WHERE mission_id=? AND principal_id=? AND receipt_sha256=?').get(mission.id, principalId, expectedReceipt);
    if (!priorRow) throw codedError('GIT_CONFLICT_RECEIPT_NOT_FOUND', 'Expected conflict map receipt was not found for this mission', {}, 404);
    const priorMap = rowToCollisionMap(priorRow);
    const matchesPair = (pair) => [pair.leftTaskId, pair.rightTaskId].sort().join('\0') === taskIds.join('\0');
    const priorPair = priorMap.pairs.find(matchesPair);
    if (!priorPair || priorPair.status !== 'conflict') throw codedError('GIT_CONFLICT_RECEIPT_INVALID', 'Expected receipt does not contain a conflict for this task pair', {}, 409);

    const currentMap = await this.collisionMap({ missionId: mission.id, principal, targetRef: priorMap.targetRef, idempotencyKey: `${key}:verify:${randomUUID()}` });
    const currentPair = currentMap.pairs.find(matchesPair);
    const involvedTasks = currentMap.tasks.filter((task) => taskIds.includes(task.taskId));
    const involvedReview = currentMap.reviewCoverage.filter((entry) => taskIds.includes(entry.taskId));
    if (!currentPair || currentPair.status !== 'clean' || involvedTasks.some((task) => task.dirty) || involvedReview.some((entry) => entry.status !== 'accepted')) {
      throw codedError('GIT_CONFLICT_STILL_PRESENT', 'Conflict resolution cannot be recorded until merge-tree is clean, worktrees are clean, and related diffs are accepted', { currentCollisionReceiptSha256: currentMap.receiptSha256 }, 409);
    }

    const createdAt = this.clock().toISOString();
    const id = `git_resolution_${randomUUID().replaceAll('-', '')}`;
    const base = freeze({ schema: 'forge.git-conflict-resolution.v1', id, projectId: project.id, missionId: mission.id, principalId, taskIds, resolvedPaths: Object.freeze([...priorPair.conflictPaths].sort()), expectedConflictReceiptSha256: expectedReceipt, verificationCollisionReceiptSha256: currentMap.receiptSha256, resolutionSummary: summary, testReceipts: receipts, requestSha256, idempotencyKey: key, createdAt });
    const result = freeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.store.db.prepare('INSERT INTO git_conflict_resolutions(id,project_id,mission_id,principal_id,left_task_id,right_task_id,expected_conflict_receipt_sha256,request_sha256,idempotency_key,resolution_json,created_at,receipt_sha256) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, project.id, mission.id, principalId, taskIds[0], taskIds[1], expectedReceipt, requestSha256, key, JSON.stringify(result), createdAt, result.receiptSha256);
    this.store.addEvidence({ projectId: project.id, kind: 'git-conflict-resolution', status: 'verified', payload: { missionId: mission.id, taskIds, resolvedPaths: result.resolvedPaths, expectedConflictReceiptSha256: expectedReceipt, verificationCollisionReceiptSha256: currentMap.receiptSha256, testReceiptCount: receipts.length }, receiptSha256: result.receiptSha256 });
    this.store.appendEvent(createEvent('git.conflict.resolved', { taskIds, resolvedPaths: result.resolvedPaths, expectedConflictReceiptSha256: expectedReceipt, verificationCollisionReceiptSha256: currentMap.receiptSha256, receiptSha256: result.receiptSha256 }, { projectId: project.id, missionId: mission.id }));
    return result;
  }

  getMissionCollisionMap({ missionId, principal } = {}) {
    const { mission, principalId } = this.#missionScope(missionId, principal);
    const row = this.store.db.prepare('SELECT * FROM git_collision_maps WHERE mission_id=? AND principal_id=? ORDER BY created_at DESC,id DESC LIMIT 1').get(mission.id, principalId);
    if (!row) throw codedError('GIT_COLLISION_MAP_NOT_FOUND', `No collision map exists for mission ${mission.id}`, {}, 404);
    return rowToCollisionMap(row);
  }

  async checkpoint(input = {}) { return this.#complete('checkpoint', input); }
  async commit(input = {}) { return this.#complete('final', input); }

  listTaskCompletions({ taskId, principal } = {}) {
    const { task, principalId } = this.#scope(taskId, principal);
    return Object.freeze(this.store.db.prepare('SELECT * FROM git_completion_records WHERE task_id=? AND principal_id=? AND status=? ORDER BY created_at,id').all(task.id, principalId, 'committed').map(rowToCompletion));
  }
}
