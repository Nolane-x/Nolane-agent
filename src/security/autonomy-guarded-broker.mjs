import path from 'node:path';

const GIT_READ_COMMANDS = new Set(['status', 'diff', 'log', 'show', 'rev-parse', 'ls-files', 'grep', 'blame', 'remote', 'branch']);

function tokensOf(input) {
  return (Array.isArray(input?.args) ? input.args : []).map((item) => String(item).toLowerCase());
}

function hasToken(tokens, values) {
  return tokens.some((token) => values.some((value) => token === value || token.includes(value)));
}

export function classifyCommand(input = {}) {
  const command = path.basename(String(input.command ?? '')).replace(/\.exe$/i, '').toLowerCase();
  const tokens = tokensOf(input);
  if (command === 'git') {
    const operation = tokens.find((token) => !token.startsWith('-')) ?? '';
    if (GIT_READ_COMMANDS.has(operation)) return Object.freeze({ commandClass: 'git-read', readOnly: true, gitOperation: operation });
    return Object.freeze({ commandClass: 'git', readOnly: false, gitOperation: operation });
  }
  if (command === 'pytest' || hasToken(tokens, ['--test', 'test', 'pytest'])) return Object.freeze({ commandClass: 'test', readOnly: false });
  if (hasToken(tokens, ['typecheck', 'tsc'])) return Object.freeze({ commandClass: 'typecheck', readOnly: false });
  if (hasToken(tokens, ['lint'])) return Object.freeze({ commandClass: 'lint', readOnly: false });
  if (hasToken(tokens, ['format', 'prettier', 'fmt'])) return Object.freeze({ commandClass: 'format', readOnly: false });
  if (hasToken(tokens, ['build', 'compile'])) return Object.freeze({ commandClass: 'build', readOnly: false });
  if (hasToken(tokens, ['install', 'ci', 'add'])) return Object.freeze({ commandClass: 'dependency-install', readOnly: false });
  if (hasToken(tokens, ['dev', 'serve', 'start'])) return Object.freeze({ commandClass: 'dev-server', readOnly: false });
  if (hasToken(tokens, ['generate', 'codegen'])) return Object.freeze({ commandClass: 'codegen', readOnly: false });
  if (['node', 'python', 'python3', 'npx'].includes(command)) return Object.freeze({ commandClass: 'codegen', readOnly: false });
  return Object.freeze({ commandClass: 'arbitrary', readOnly: false });
}

function actionFor(request, task, grant) {
  const tool = String(request?.tool ?? '');
  const managed = Boolean(task?.metadata?.worktree?.path);
  if (tool === 'fs.read') return Object.freeze({ kind: 'fs.read', toolGroup: 'read' });
  if (tool === 'fs.write' || tool === 'fs.patch' || tool === 'fs.patchSet' || tool === 'fs.delete') return Object.freeze({ kind: tool, reversible: managed, toolGroup: 'edit' });
  if (tool === 'process.run' || tool === 'process.startManaged') {
    const classified = tool === 'process.startManaged'
      ? Object.freeze({ commandClass: 'dev-server', readOnly: false })
      : classifyCommand(request.input);
    const declaredNetwork = grant?.scope?.network ?? 'deny';
    const network = classified.commandClass === 'dependency-install' && task?.metadata?.networkPolicyEnforced !== true ? 'allow' : declaredNetwork;
    const toolGroup = classified.commandClass === 'test' || classified.commandClass === 'typecheck' || classified.commandClass === 'lint' || classified.commandClass === 'build' ? 'test' : classified.commandClass === 'git' || classified.commandClass === 'git-read' ? 'git' : classified.commandClass === 'dependency-install' ? 'dependency' : classified.commandClass === 'format' || classified.commandClass === 'codegen' ? 'edit' : 'terminal';
    return Object.freeze({ kind: tool, ...classified, network, toolGroup });
  }
  if (tool === 'process.stopManaged') return Object.freeze({ kind: 'process.stopManaged', toolGroup: 'terminal' });
  if (tool === 'process.listManaged') return Object.freeze({ kind: 'process.listManaged', toolGroup: 'read' });
  return Object.freeze({ kind: tool || 'unknown' });
}

export class AutonomyGuardedBroker {
  constructor({ broker, policy, store, task } = {}) {
    if (!broker?.execute || !policy?.evaluate || !store?.getAutonomyGrant || !task?.projectId) {
      throw new TypeError('AutonomyGuardedBroker broker, policy, store, and task are required');
    }
    this.broker = broker;
    this.policy = policy;
    this.store = store;
    this.task = task;
  }

  async execute(request, context = {}) {
    const grant = this.store.getAutonomyGrant(this.task.projectId) ?? { profile: 'guided', scope: {} };
    const action = actionFor(request, this.task, grant);
    const evaluation = this.policy.evaluate(action, {
      profile: grant.profile,
      withinWorkspace: true,
      inManagedWorktree: Boolean(this.task.metadata?.worktree?.path),
      inSandbox: this.task.metadata?.sandbox === true,
      modeId: this.task.metadata?.modeId ?? null,
      modePolicy: this.task.metadata?.modePolicy ?? null,
    });
    if (evaluation.decision !== 'allow') {
      const error = new Error(evaluation.reason);
      error.code = evaluation.category?.startsWith('mode-') ? 'AGENT_MODE_ACTION_DENIED' : evaluation.hardStop ? 'AUTONOMY_HARD_STOP' : 'AUTONOMY_APPROVAL_REQUIRED';
      error.statusCode = 409;
      error.autonomyDecision = evaluation;
      throw error;
    }
    return this.broker.execute(request, { ...context, principalId: context.principalId ?? `agent:${this.task.id}`, projectId: context.projectId ?? this.task.projectId, taskId: context.taskId ?? this.task.id, sessionId: context.sessionId ?? context.refs?.runId ?? `task:${this.task.id}`, origin: context.origin ?? 'agent', refs: { ...(context.refs ?? {}), autonomyProfile: grant.profile, autonomyCategory: evaluation.category, modeId: this.task.metadata?.modeId ?? null } });
  }
}
