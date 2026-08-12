import path from 'node:path';

export { createTaskEnvironmentAttester } from './task-environment-attester.mjs';

const GIT_READ_COMMANDS = new Set(['status', 'diff', 'log', 'show', 'rev-parse', 'ls-files', 'grep', 'blame']);
const GIT_REMOTE_READ_COMMANDS = new Set(['get-url', 'show']);
const GIT_BRANCH_READ_FLAGS = new Set(['--show-current', '--list', '-l', '--all', '-a', '--remotes', '-r', '--verbose', '-v', '-vv']);

function tokensOf(input) {
  return (Array.isArray(input?.args) ? input.args : []).map((item) => String(item).toLowerCase());
}

function hasToken(tokens, values) {
  return tokens.some((token) => values.includes(token));
}

function gitReadOnlyOperation(operation, following) {
  if (GIT_READ_COMMANDS.has(operation)) return true;
  if (operation === 'remote') {
    const subcommand = following.find((token) => !token.startsWith('-'));
    return !subcommand || GIT_REMOTE_READ_COMMANDS.has(subcommand);
  }
  if (operation === 'branch') return following.length === 0 || following.every((token) => GIT_BRANCH_READ_FLAGS.has(token));
  return false;
}

export function classifyCommand(input = {}) {
  const command = path.basename(String(input.command ?? '')).replace(/\.exe$/i, '').toLowerCase();
  const tokens = tokensOf(input);
  if (command === 'git') {
    const operationIndex = tokens.findIndex((token) => !token.startsWith('-'));
    const operation = operationIndex === -1 ? '' : tokens[operationIndex];
    if (gitReadOnlyOperation(operation, tokens.slice(operationIndex + 1))) return Object.freeze({ commandClass: 'git-read', readOnly: true, gitOperation: operation });
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
  if (['node', 'python', 'python3', 'npx'].includes(command)) return Object.freeze({ commandClass: 'arbitrary-code-execution', readOnly: false });
  return Object.freeze({ commandClass: 'arbitrary', readOnly: false });
}

function actionFor(request, task, grant) {
  const tool = String(request?.tool ?? '');
  if (tool === 'fs.read') return Object.freeze({ kind: 'fs.read', toolGroup: 'read' });
  if (tool === 'fs.write' || tool === 'fs.patch' || tool === 'fs.patchSet' || tool === 'fs.delete') return Object.freeze({ kind: tool, reversible: false, toolGroup: 'edit' });
  if (tool === 'process.run' || tool === 'process.startManaged') {
    const classified = classifyCommand(request.input);
    const declaredNetwork = grant?.scope?.network ?? 'deny';
    const network = declaredNetwork;
    const toolGroup = classified.commandClass === 'test' || classified.commandClass === 'typecheck' || classified.commandClass === 'lint' || classified.commandClass === 'build' ? 'test' : classified.commandClass === 'git' || classified.commandClass === 'git-read' ? 'git' : classified.commandClass === 'dependency-install' ? 'dependency' : classified.commandClass === 'format' || classified.commandClass === 'codegen' ? 'edit' : 'terminal';
    return Object.freeze({ kind: tool, ...classified, network, toolGroup });
  }
  if (tool === 'process.stopManaged') return Object.freeze({ kind: 'process.stopManaged', toolGroup: 'terminal' });
  if (tool === 'process.listManaged') return Object.freeze({ kind: 'process.listManaged', toolGroup: 'read' });
  return Object.freeze({ kind: tool || 'unknown' });
}

function untrustedEnvironment() {
  return Object.freeze({ withinWorkspace: false, inManagedWorktree: false, inSandbox: false });
}

async function environmentFacts(attester, task, request) {
  const receipt = await attester(Object.freeze({ taskId: task.id, projectId: task.projectId, request }));
  if (!receipt || typeof receipt !== 'object') return untrustedEnvironment();
  return Object.freeze({
    withinWorkspace: receipt.withinWorkspace === true,
    inManagedWorktree: receipt.inManagedWorktree === true,
    inSandbox: receipt.inSandbox === true,
  });
}

export class AutonomyGuardedBroker {
  constructor({ broker, policy, store, task, environmentAttester = null } = {}) {
    if (!broker?.execute || !policy?.evaluate || !store?.getAutonomyGrant || !task?.projectId) {
      throw new TypeError('AutonomyGuardedBroker broker, policy, store, and task are required');
    }
    if (environmentAttester !== null && typeof environmentAttester !== 'function') throw new TypeError('environmentAttester must be a function');
    this.broker = broker;
    this.policy = policy;
    this.store = store;
    this.task = task;
    this.environmentAttester = environmentAttester;
  }

  async execute(request, context = {}) {
    const grant = this.store.getAutonomyGrant(this.task.projectId) ?? { profile: 'guided', scope: {} };
    const action = actionFor(request, this.task, grant);
    const environment = this.environmentAttester
      ? await environmentFacts(this.environmentAttester, this.task, request)
      : untrustedEnvironment();
    const evaluation = this.policy.evaluate(action, {
      profile: grant.profile,
      withinWorkspace: environment.withinWorkspace,
      inManagedWorktree: environment.inManagedWorktree,
      inSandbox: environment.inSandbox,
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
