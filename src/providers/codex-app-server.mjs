import { spawn } from 'node:child_process';
import { JsonlRpcProcess } from '../protocol/jsonl-rpc-process.mjs';
import { buildForgeActionPrompt, parseForgeActionEnvelope } from './forge-action-protocol.mjs';

const APPROVALS = new Set(['accept', 'acceptForSession', 'acceptWithExecpolicyAmendment', 'applyNetworkPolicyAmendment', 'decline', 'cancel']);

export function isRetryableCodexError(error) {
  return Number(error?.code) === -32001 || /overloaded|retry later|temporar|timeout|rate limit/i.test(String(error?.message ?? error));
}

function codexExecutionError(error) {
  if (error?.code === 'PROVIDER_EXECUTION_FAILED' || error?.code === 'PROVIDER_WORKSPACE_TRUST_REQUIRED') return error;
  const message = String(error?.message ?? error ?? 'unknown Codex app-server failure');
  const code = /not inside a trusted directory|skip-git-repo-check/i.test(message)
    ? 'PROVIDER_WORKSPACE_TRUST_REQUIRED'
    : 'PROVIDER_EXECUTION_FAILED';
  const wrapped = Object.assign(new Error('Codex app server execution failed'), { code });
  wrapped.cause = error;
  return wrapped;
}

function versionOf(value) { return String(value ?? '').match(/\b(\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?)\b/)?.[1] ?? null; }

function clientEnvironment(env = {}) {
  const names = process.platform === 'win32'
    ? ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'CODEX_HOME']
    : ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'CODEX_HOME'];
  const base = {};
  for (const name of names) {
    const value = process.env[name];
    if (typeof value !== 'string' || !value) continue;
    if (name === 'Path' && base.PATH) continue;
    base[name === 'Path' ? 'PATH' : name] = value;
  }
  return { ...base, ...env };
}

function normalizeThreadSandbox(policy) {
  const value = typeof policy === 'string' ? policy : policy?.type;
  if (value === undefined || value === null || value === 'readOnly' || value === 'read-only') return 'read-only';
  if (value === 'workspaceWrite' || value === 'workspace-write') return 'workspace-write';
  if (value === 'dangerFullAccess' || value === 'danger-full-access') return 'danger-full-access';
  return value;
}

function normalizeTurnSandboxPolicy(policy) {
  if (policy === undefined || policy === null) return { type: 'readOnly' };
  if (typeof policy === 'string') {
    if (policy === 'readOnly' || policy === 'read-only') return { type: 'readOnly' };
    if (policy === 'workspaceWrite' || policy === 'workspace-write') return { type: 'workspaceWrite' };
    if (policy === 'dangerFullAccess' || policy === 'danger-full-access') return { type: 'dangerFullAccess' };
  }
  if (policy?.type === 'read-only') return { ...policy, type: 'readOnly' };
  if (policy?.type === 'workspace-write') return { ...policy, type: 'workspaceWrite' };
  if (policy?.type === 'danger-full-access') return { ...policy, type: 'dangerFullAccess' };
  return policy;
}

function normalizeExecutionPolicy(value, fallbackSandboxPolicy = undefined) {
  const candidate = value && typeof value === 'object' ? value : {};
  const sandboxPolicy = normalizeTurnSandboxPolicy(candidate.sandboxPolicy ?? fallbackSandboxPolicy);
  const fullAccess = candidate.modeId === 'deep'
    && candidate.automaticApproval === true
    && normalizeThreadSandbox(sandboxPolicy) === 'danger-full-access';
  return Object.freeze({
    modeId: fullAccess ? 'deep' : null,
    sandboxPolicy: Object.freeze({ ...sandboxPolicy }),
    automaticApproval: fullAccess,
  });
}

export function decideCodexAppServerApproval(request) {
  const policy = request?.executionPolicy;
  const automaticApproval = policy?.modeId === 'deep'
    && policy?.automaticApproval === true
    && policy?.sandboxPolicy?.type === 'dangerFullAccess';
  return Object.freeze({ decision: automaticApproval ? 'accept' : 'decline' });
}

function tokenUsage(params) {
  const raw = params?.tokenUsage?.total ?? params?.tokenUsage ?? {};
  const promptTokens = Number(raw.inputTokens ?? raw.promptTokens ?? 0) || 0;
  const completionTokens = Number(raw.outputTokens ?? raw.completionTokens ?? 0) || 0;
  const totalTokens = Number(raw.totalTokens ?? (promptTokens + completionTokens)) || 0;
  return Object.freeze({ promptTokens, completionTokens, totalTokens });
}

function boundedStringList(value, limit = 32) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze([...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))].slice(0, limit));
}

function boundedReasoningEfforts(value, limit = 32) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze([...new Set(value.map((item) => String(typeof item === 'object' ? item?.reasoningEffort : item).trim()).filter(Boolean))].slice(0, limit));
}

function catalogEntries(result) {
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.models)) return result.models;
  if (Array.isArray(result)) return result;
  return [];
}

function normalizeCatalogModel(model, observedAt) {
  const id = String(model?.id ?? model?.modelId ?? '').trim();
  if (!id) return null;
  return Object.freeze({
    id,
    displayName: String(model?.displayName ?? model?.name ?? id).trim() || id,
    discoveredAt: observedAt,
    metadata: Object.freeze({
      source: 'codex-app-server',
      hidden: model?.hidden === true,
      defaultReasoningEffort: model?.defaultReasoningEffort == null ? null : String(model.defaultReasoningEffort),
      supportedReasoningEfforts: boundedReasoningEfforts(model?.supportedReasoningEfforts),
      additionalSpeedTiers: boundedStringList(model?.additionalSpeedTiers),
      serviceTiers: boundedStringList(model?.serviceTiers),
      defaultServiceTier: model?.defaultServiceTier == null ? null : String(model.defaultServiceTier),
      modelSpecialty: model?.modelSpecialty == null ? null : String(model.modelSpecialty),
      multiAgentVersion: model?.multiAgentVersion == null ? null : String(model.multiAgentVersion),
      upgrade: model?.upgrade == null ? null : String(model.upgrade),
      upgradeInfo: model?.upgradeInfo == null ? null : structuredClone(model.upgradeInfo),
      availabilityNux: model?.availabilityNux == null ? null : structuredClone(model.availabilityNux),
    }),
  });
}

export class CodexAppServerClient {
  constructor({ id = 'codex-app-server', label = 'OpenAI Codex App Server', executable = 'codex', args = ['app-server', '--stdio'], detectArgs = ['--version'], cwd = null, env = {}, timeoutMs = 10 * 60_000, approvalHandler = null } = {}) {
    if (!Array.isArray(detectArgs) || detectArgs.some((item) => typeof item !== 'string')) throw new TypeError('detectArgs must be strings');
    this.id = id; this.label = label; this.kind = 'codex-app-server'; this.executable = executable; this.args = [...args]; this.detectArgs = [...detectArgs]; this.cwd = cwd; this.env = { ...env }; this.timeoutMs = timeoutMs; this.credentialOwner = 'official-cli';
    this.profile = Object.freeze({ capabilities: Object.freeze(['coding', 'structured-events', 'subscription-auth', 'threads', 'interrupts', 'governed-actions']), qualityTier: 4.5, costTier: 0, latencyTier: 2, local: false });
    this.approvalHandler = approvalHandler; this.initialized = null; this.state = 'idle'; this.turnStates = new Map(); this.threadExecutionPolicies = new Map();
    this.rpc = new JsonlRpcProcess({ executable, args, cwd, env: clientEnvironment(this.env), inheritEnvironment: false, timeoutMs, includeJsonrpc: false, requestHandler: (method, params) => this.#serverRequest(method, params) });
    this.rpc.on('notification', (message) => this.#notification(message));
    this.rpc.on('closed', () => { this.state = 'closed'; });
  }

  publicView() { return Object.freeze({ id: this.id, label: this.label, kind: this.kind, executable: this.executable, credentialOwner: this.credentialOwner, state: this.state, capabilities: this.profile.capabilities, qualityTier: this.profile.qualityTier, costTier: this.profile.costTier, latencyTier: this.profile.latencyTier, local: this.profile.local }); }

  async detect() {
    try {
      const output = await new Promise((resolve, reject) => {
        const child = spawn(this.executable, this.detectArgs, { env: clientEnvironment(this.env), shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let text = ''; const timer = setTimeout(() => child.kill('SIGKILL'), 5_000); timer.unref?.();
        child.stdout.on('data', (chunk) => { text += chunk; }); child.stderr.on('data', (chunk) => { text += chunk; });
        child.once('error', reject); child.once('close', (code) => { clearTimeout(timer); resolve({ code, text }); });
      });
      return Object.freeze({ ...this.publicView(), available: output.code === 0, version: versionOf(output.text), versionOutput: String(output.text).trim().slice(0, 500) });
    } catch (error) { return Object.freeze({ ...this.publicView(), available: false, version: null, error: error.code === 'ENOENT' ? 'not-found' : String(error.message ?? error) }); }
  }

  async connect() {
    if (this.state === 'ready') return this.initialized;
    this.state = 'connecting'; await this.rpc.start();
    this.initialized = Object.freeze(await this.rpc.request('initialize', { clientInfo: { name: 'forge_studio', title: 'Forge Studio', version: '0.2.0' }, capabilities: { experimentalApi: false } }));
    this.rpc.notify('initialized', {}); this.state = 'ready'; return this.initialized;
  }

  async accountRead({ refreshToken = false } = {}) { await this.connect(); return this.rpc.request('account/read', { refreshToken: Boolean(refreshToken) }); }

  async listModels({ includeHidden = false, limit = 500 } = {}) {
    await this.connect();
    const maximum = Math.min(Math.max(Number(limit) || 0, 1), 500);
    const pageLimit = Math.min(maximum, 100);
    const observedAt = new Date().toISOString();
    const models = [];
    const seen = new Set();
    let cursor = null;
    let nextCursor = null;
    let pages = 0;
    do {
      const result = await this.rpc.request('model/list', { cursor, limit: pageLimit, includeHidden: Boolean(includeHidden) });
      for (const raw of catalogEntries(result)) {
        const model = normalizeCatalogModel(raw, observedAt);
        if (!model || (!includeHidden && model.metadata.hidden) || seen.has(model.id) || models.length >= maximum) continue;
        seen.add(model.id); models.push(model);
      }
      nextCursor = result?.nextCursor ?? result?.next_cursor ?? null;
      cursor = nextCursor;
      pages += 1;
    } while (cursor && pages < 5 && models.length < maximum);
    return Object.freeze({ status: 'fresh', observedAt, models: Object.freeze(models), nextCursor: models.length >= maximum || pages >= 5 ? nextCursor : null });
  }

  async loginStart({ type = 'chatgpt', apiKey = undefined, region = undefined } = {}) {
    await this.connect();
    const allowed = new Set(['chatgpt', 'chatgptDeviceCode', 'apiKey', 'amazonBedrock']);
    if (!allowed.has(type)) throw new TypeError(`Unsupported Codex login type: ${type}`);
    const params = { type };
    if (type === 'apiKey' || type === 'amazonBedrock') {
      if (!String(apiKey ?? '').trim()) throw new TypeError('apiKey is required');
      params.apiKey = String(apiKey);
    }
    if (type === 'amazonBedrock') params.region = String(region ?? '').trim();
    return Object.freeze(await this.rpc.request('account/login/start', params));
  }

  async loginCancel(loginId) { await this.connect(); return this.rpc.request('account/login/cancel', { loginId: String(loginId) }); }
  async logout() { await this.connect(); return this.rpc.request('account/logout', {}); }

  async startThread({ cwd = this.cwd, ephemeral = false, sandboxPolicy = undefined, approvalPolicy = 'untrusted', executionPolicy = undefined } = {}) {
    await this.connect();
    const normalizedExecutionPolicy = normalizeExecutionPolicy(executionPolicy, sandboxPolicy);
    const result = await this.rpc.request('thread/start', { cwd: cwd ?? undefined, ephemeral: Boolean(ephemeral), sandbox: normalizeThreadSandbox(normalizedExecutionPolicy.sandboxPolicy), approvalPolicy });
    const thread = Object.freeze(result.thread ?? result);
    if (thread?.id) this.threadExecutionPolicies.set(String(thread.id), normalizedExecutionPolicy);
    return thread;
  }

  async resumeThread(threadId, options = {}) {
    await this.connect();
    const result = await this.rpc.request('thread/resume', { threadId: String(threadId), ...options });
    return Object.freeze(result.thread ?? result);
  }

  async startTurn({ threadId, input, cwd = this.cwd, model = undefined, effort = undefined, sandboxPolicy = undefined, approvalPolicy = undefined, executionPolicy = undefined, signal = null } = {}) {
    await this.connect();
    if (!String(threadId ?? '').trim()) throw new TypeError('threadId is required');
    const text = typeof input === 'string' ? input : JSON.stringify(input ?? '');
    const key = String(threadId);
    const normalizedExecutionPolicy = normalizeExecutionPolicy(executionPolicy ?? this.threadExecutionPolicies.get(key), sandboxPolicy);
    this.threadExecutionPolicies.set(key, normalizedExecutionPolicy);
    const params = { threadId: key, input: [{ type: 'text', text }], ...(cwd ? { cwd } : {}), ...(model ? { model } : {}), ...(effort ? { effort: String(effort) } : {}), sandboxPolicy: normalizedExecutionPolicy.sandboxPolicy, ...(approvalPolicy ? { approvalPolicy } : {}) };
    const started = await this.rpc.request('turn/start', params, { signal, timeoutMs: this.timeoutMs });
    const turn = started.turn ?? started;
    const state = this.#turnState(threadId, turn.id);
    if (signal) {
      const abort = () => this.interrupt(threadId, turn.id).catch(() => {});
      if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
      state.cleanup = () => signal.removeEventListener('abort', abort);
    }
    const final = state.completed ? state : await new Promise((resolve, reject) => state.waiters.push({ resolve, reject }));
    state.cleanup?.();
    return Object.freeze({ threadId: String(threadId), turnId: turn.id, status: final.status, text: final.text, usage: final.usage, approvals: Object.freeze([...final.approvals]), turn: final.turn });
  }

  async interrupt(threadId, turnId) { await this.connect(); return this.rpc.request('turn/interrupt', { threadId: String(threadId), turnId: String(turnId) }); }

  sessionCapabilities() { return Object.freeze({ logicalSessions: true, persistentProcess: true, affinity: 'repository-mission' }); }

  processDescriptor() { return Object.freeze({ rootPid: Number(this.rpc?.child?.pid) || null, state: this.state, runtimeKind: 'codex-app-server' }); }

  async openSession({ scope = {}, signal = null } = {}) {
    const executionPolicy = normalizeExecutionPolicy(scope.codexAppServerExecutionPolicy);
    const thread = await this.startThread({ cwd: scope.cwd ?? this.cwd, ephemeral: false, approvalPolicy: 'untrusted', executionPolicy });
    return Object.freeze({ id: thread.id, threadId: thread.id, cwd: scope.cwd ?? this.cwd, executionPolicy, openedFor: Object.freeze({ projectId: scope.projectId ?? null, missionId: scope.missionId ?? null, repositoryId: scope.repositoryId ?? null }), signalBound: Boolean(signal) });
  }

  async completeInSession(session, { messages = [], tools = [], signal = null, model = undefined, effort = undefined, cwd = undefined } = {}) {
    const threadId = String(session?.threadId ?? session?.id ?? '').trim();
    if (!threadId) throw new TypeError('session threadId is required');
    const prompt = buildForgeActionPrompt(messages, tools);
    try {
      const result = await this.startTurn({ threadId, input: prompt, cwd: cwd ?? session?.cwd ?? this.cwd, model, effort, executionPolicy: session?.executionPolicy, signal });
      const envelope = parseForgeActionEnvelope(result.text, tools);
      return Object.freeze({ providerId: this.id, model: model ?? 'codex-subscription', text: envelope ? envelope.text : result.text, toolCalls: envelope?.toolCalls ?? Object.freeze([]), finishReason: result.status === 'completed' ? 'stop' : result.status, usage: result.usage, raw: Object.freeze({ ...result, prompt }) });
    } catch (error) {
      throw codexExecutionError(error);
    }
  }

  async closeSession(session, _options = {}) { this.threadExecutionPolicies.delete(String(session?.threadId ?? session?.id ?? '')); return Object.freeze({ closed: true, processRetained: this.state === 'ready' }); }

  async complete({ messages = [], tools = [], signal = null, model = undefined, effort = undefined, cwd = this.cwd, codexAppServerExecutionPolicy = undefined } = {}) {
    try {
      const executionPolicy = normalizeExecutionPolicy(codexAppServerExecutionPolicy);
      const thread = await this.startThread({ cwd, ephemeral: true, approvalPolicy: 'untrusted', executionPolicy });
      return await this.completeInSession({ id: thread.id, threadId: thread.id, cwd, executionPolicy }, { messages, tools, signal, model, effort, cwd });
    } catch (error) {
      throw codexExecutionError(error);
    }
  }

  async close() { await this.rpc.close(); this.state = 'closed'; }

  #key(threadId, turnId) { return `${threadId}:${turnId}`; }
  #turnState(threadId, turnId) {
    const key = this.#key(threadId, turnId);
    let state = this.turnStates.get(key);
    if (!state) { state = { threadId, turnId, text: '', usage: Object.freeze({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }), approvals: [], status: 'inProgress', turn: null, completed: false, waiters: [], cleanup: null }; this.turnStates.set(key, state); }
    return state;
  }

  async #serverRequest(method, params) {
    if (!/requestApproval$/i.test(method) && method !== 'tool/requestUserInput' && method !== 'openai/form') throw Object.assign(new Error(`Unsupported Codex server request: ${method}`), { code: -32601 });
    let response = { decision: 'decline' };
    const executionPolicy = params?.threadId ? this.threadExecutionPolicies.get(String(params.threadId)) ?? null : null;
    if (typeof this.approvalHandler === 'function') response = await this.approvalHandler(Object.freeze({ method, ...structuredClone(params), executionPolicy: executionPolicy ? structuredClone(executionPolicy) : null }));
    const decision = String(response?.decision ?? 'decline');
    if (!APPROVALS.has(decision)) throw new Error(`Invalid Codex approval decision: ${decision}`);
    const state = params?.threadId && params?.turnId ? this.#turnState(params.threadId, params.turnId) : null;
    state?.approvals.push(Object.freeze({ method, decision, request: structuredClone(params) }));
    return { ...response, decision };
  }

  #notification(message) {
    const params = message.params ?? {};
    const turnId = params.turnId ?? params.turn?.id; const threadId = params.threadId ?? params.thread?.id;
    if (!turnId || !threadId) return;
    const state = this.#turnState(threadId, turnId);
    if (message.method === 'item/agentMessage/delta') state.text += typeof params.delta === 'string' ? params.delta : String(params.delta?.text ?? '');
    else if (message.method === 'thread/tokenUsage/updated') state.usage = tokenUsage(params);
    else if (message.method === 'turn/completed') {
      state.turn = params.turn; state.status = params.turn?.status ?? 'completed'; state.completed = true;
      const waiters = state.waiters.splice(0); for (const waiter of waiters) waiter.resolve(state);
    }
  }
}
