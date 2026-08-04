import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

import { GoalEvidenceContract } from '../native-core/goal-evidence-contract.mjs';
import { NolaneAgentLoop } from './agent-loop.mjs';
import { createFileTools } from './file-tools.mjs';
import { ProviderRegistry as NativeProviderRegistry } from './provider-registry.mjs';
import { createExistingProviderAdapter } from './provider-adapters.mjs';
import { createGovernedShellTool } from './shell-tool.mjs';
import { ToolRegistry } from './tool-registry.mjs';

const execFileAsync = promisify(execFile);

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw Object.assign(new Error(`${label} is required`), { statusCode: 400 });
  return text;
}

export class NolaneNativeAgentService {
  constructor({ store, sessionStore, providerSource, allowedCommands = [], shellExecutor = null, eventSink = () => {} } = {}) {
    if (!store?.getProject || !sessionStore?.getSession || !providerSource?.list) throw new TypeError('store, sessionStore and providerSource are required');
    this.store = store;
    this.sessionStore = sessionStore;
    this.providerSource = providerSource;
    this.allowedCommands = new Set(allowedCommands.map(String));
    this.shellExecutor = shellExecutor ?? (async (file, args, options) => {
      if (!this.allowedCommands.has(file)) throw new Error(`command is not allowlisted: ${file}`);
      const result = await execFileAsync(file, args, { ...options, maxBuffer: 2_000_000, encoding: 'utf8' });
      return Object.freeze({ exitCode: 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '' });
    });
    this.eventSink = eventSink;
  }

  #providers() {
    const registry = new NativeProviderRegistry();
    const source = this.providerSource.list();
    source.forEach((provider, index) => {
      const detection = this.providerSource.detection?.(provider.id);
      if (detection && (detection.available === false || detection.healthy === false || detection.authenticated === false)) return;
      const view = typeof provider?.publicView === 'function' ? { ...provider.publicView(), ...(provider.profile ?? {}) } : { ...(provider.profile ?? {}) };
      const quality = Number(view.qualityTier ?? 0);
      registry.register(createExistingProviderAdapter({ provider, priority: Math.max(0, 100 - quality * 10 + index) }));
    });
    return registry;
  }

  #tools(workspaceRoot, maxCalls) {
    const files = createFileTools({ workspaceRoot });
    const shell = createGovernedShellTool({ workspaceRoot, executor: this.shellExecutor });
    return new ToolRegistry({ maxCalls })
      .register({ name: 'file.read', capability: 'file:read', risk: 'low', description: 'Read a UTF-8 file inside the project workspace.', parameters: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } }, execute: ({ path }) => files.read(path) })
      .register({ name: 'file.write', capability: 'file:write', risk: 'medium', description: 'Replace an existing UTF-8 file using an optional optimistic SHA.', parameters: { type: 'object', required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' }, expectedSha256: { type: 'string' } } }, execute: ({ path, content, expectedSha256 }) => files.write(path, content, { expectedSha256 }) })
      .register({ name: 'file.search', capability: 'file:read', risk: 'low', description: 'Search text inside regular non-symlink project files.', parameters: { type: 'object', required: ['query'], properties: { query: { type: 'string' } } }, execute: ({ query }) => files.search(query) })
      .register({ name: 'shell.execute', capability: 'shell:execute', risk: 'high', reversible: false, description: 'Execute one allowlisted command inside the project workspace.', parameters: { type: 'object', required: ['command'], properties: { command: { type: 'array', items: { type: 'string' } }, cwd: { type: 'string' } } }, execute: (input, context) => shell.execute(input, { capabilities: context.grantedCapabilities, approvals: context.approvals }) });
  }

  async run(input = {}) {
    const missionId = required(input.missionId, 'missionId');
    const sessionId = required(input.sessionId, 'sessionId');
    const projectId = required(input.projectId, 'projectId');
    const objective = required(input.objective, 'objective');
    const project = this.store.getProject(projectId);
    if (!project) throw Object.assign(new Error(`Unknown project: ${projectId}`), { statusCode: 404 });
    const session = this.sessionStore.getSession(sessionId);
    if (!session) throw Object.assign(new Error(`Unknown session: ${sessionId}`), { statusCode: 404 });
    if (session.projectId !== projectId) throw Object.assign(new Error('Session project does not match run project'), { statusCode: 409 });
    const budgets = { ...(input.budgets ?? {}), maxWallMs: input.budgets?.maxWallMs ?? input.budgets?.timeoutMs };
    const events = [];
    const traceSink = (event) => { events.push(event); this.eventSink(Object.freeze({ type: 'nolane.native-agent.trace', ...event, projectId, sessionId })); };
    await this.sessionStore.appendMessage(sessionId, { id: randomUUID(), role: 'user', text: objective });
    const loop = new NolaneAgentLoop({
      providers: this.#providers(),
      tools: this.#tools(project.workspaceRoot, Number(budgets.maxToolCalls ?? 50)),
      verifier: ({ missionId: verifiedMissionId, objective: verifiedObjective, criteria, response, effects }) => new GoalEvidenceContract({
        missionId: verifiedMissionId,
        objective: verifiedObjective,
        criteria,
      }).verify({
        actorId: `provider:${response?.providerId ?? 'unknown'}`,
        verifierId: 'nolane:goal-evidence-verifier',
        response,
        effects,
      }),
      traceSink,
    });
    const result = await loop.run({
      missionId, objective, criteria: input.criteria ?? [], requiredCapabilities: input.requiredCapabilities ?? [],
      grantedCapabilities: input.grantedCapabilities ?? [], approvals: input.approvals ?? [], budgets,
      context: Object.freeze({ projectId, sessionId, ...(input.context ?? {}) }), signal: input.signal,
    });
    await this.sessionStore.appendMessage(sessionId, { id: randomUUID(), role: 'assistant', text: String(result.answer ?? result.stopReason ?? result.status) });
    return Object.freeze({ ...result, projectId, sessionId, events: Object.freeze(events) });
  }
}
