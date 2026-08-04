import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function ensurePassed(result, label) {
  if (result.status !== 'pass') {
    const detail = String(result.output?.stderr || result.output?.stdout || '').trim();
    throw new Error(`${label} failed${detail ? `: ${detail.slice(0, 500)}` : ''}`);
  }
  return String(result.output.stdout ?? '');
}

function parseStatus(text) {
  return Object.freeze(String(text).split(/\r?\n/).filter(Boolean).map((line) => {
    const code = line.slice(0, 2);
    const rawPath = line.slice(3);
    const path = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) : rawPath;
    return Object.freeze({ code, path, rawPath });
  }));
}

export class GitInspector {
  constructor({ store, brokerFactory } = {}) {
    if (!store || typeof brokerFactory !== 'function') throw new TypeError('GitInspector store and brokerFactory are required');
    this.store = store;
    this.brokerFactory = brokerFactory;
  }

  async snapshot({ projectId, taskId = null, signal = null } = {}) {
    const id = String(projectId ?? '').trim();
    if (!id) throw Object.assign(new TypeError('projectId is required'), { statusCode: 400, code: 'PROJECT_ID_REQUIRED' });
    const project = this.store.getProject(id);
    if (!project) throw Object.assign(new Error(`Unknown project: ${id}`), { statusCode: 404, code: 'PROJECT_NOT_FOUND' });
    const task = taskId ? this.store.getTask(String(taskId)) : null;
    if (taskId && !task) throw Object.assign(new Error(`Unknown task: ${taskId}`), { statusCode: 404, code: 'TASK_NOT_FOUND' });
    if (task && task.projectId !== project.id) throw Object.assign(new Error(`Task ${task.id} does not belong to project ${project.id}`), { statusCode: 409, code: 'TASK_PROJECT_MISMATCH' });
    const broker = this.brokerFactory(task ?? Object.freeze({ projectId: project.id, metadata: { executionWorkspace: project.workspaceRoot } }));
    const refs = { projectId: project.id, ...(task ? { taskId: task.id } : {}), operation: 'git-inspection' };
    const run = (args) => broker.execute({ tool: 'process.run', input: { command: 'git', args, cwd: '.', timeoutMs: 30_000 } }, { signal, refs });

    const headResult = await run(['rev-parse', 'HEAD']);
    const branchResult = await run(['branch', '--show-current']);
    const statusResult = await run(['status', '--porcelain=v1', '--untracked-files=normal']);
    const statResult = await run(['diff', '--stat', 'HEAD', '--', '.']);
    const diffResult = await run(['diff', '--no-ext-diff', '--unified=3', 'HEAD', '--', '.']);
    const results = [headResult, branchResult, statusResult, statResult, diffResult];

    const head = ensurePassed(headResult, 'git rev-parse').trim();
    const branch = ensurePassed(branchResult, 'git branch').trim() || null;
    const status = parseStatus(ensurePassed(statusResult, 'git status'));
    const diffStat = ensurePassed(statResult, 'git diff --stat');
    const diff = ensurePassed(diffResult, 'git diff');
    const receiptHashes = results.map((result) => result.receipt.receiptSha256);
    const base = Object.freeze({
      schema: 'forge.git.snapshot.v1',
      projectId: project.id,
      taskId: task?.id ?? null,
      workspaceRoot: task?.metadata?.executionWorkspace ?? project.workspaceRoot,
      head,
      branch,
      dirty: status.length > 0,
      status,
      diffStat,
      diff,
      truncated: results.some((result) => result.output.truncated === true),
      receiptHashes,
    });
    return Object.freeze({ ...base, receipts: Object.freeze(results.map((result) => result.receipt)), snapshotSha256: canonicalSha256(base) });
  }
}
