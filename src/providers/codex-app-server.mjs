import { spawn } from 'node:child_process';
import { JsonlRpcProcess } from '../protocol/jsonl-rpc-process.mjs';
import { buildForgeActionPrompt, parseForgeActionEnvelope } from './forge-action-protocol.mjs';

const APPROVALS = new Set(['accept', 'acceptForSession', 'acceptWithExecpolicyAmendment', 'applyNetworkPolicyAmendment', 'decline', 'cancel']);

export function isRetryableCodexError(error) {
  return Number(error?.code) === -32001 || /overloaded|retry later|temporar|timeout|rate limit/i.test(String(error?.message ?? error));
}

function versionOf(value) { return String(value ?? '').match(/\b(\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?)\b/)?.[1] ?? null; }

function normalizeSandboxPolicy(policy) {
  const normalized = policy ?? { type: 'read-only' };
  return normalized?.type === 'readOnly' ? { ...normalized, type: 'read-only' } : normalized;
}

function tokenUsage(params) {
  const raw = params?.tokenUsage?.total ?? params?.tokenUsage ?? {};
  const promptTokens = Number(raw.inputTokens ?? raw.promptTokens ?? 0) || 0;
  const completionTokens = Number(raw.outputTokens ?? raw.completionTokens ?? 0) || 0;
  const totalTokens = Number(raw.totalTokens ?? (promptTokens + completionTokens)) || 0;
  return Object.freeze({ promptTokens, completionTokens, totalTokens });
}

export class CodexAppServerClient {
  constructor({ id = 'codex-app-server', label = 'OpenAI Codex App Server', executable = 'codex', args = ['app-server', '--stdio'], cwd = null, env = {}, timeoutMs = 10 * 60_000, approvalHandler = null } = {}) {
    this.id = id; this.label = label; this.kind = 'codex-app-server'; this.executable = executable; this.args = [...args]; this.cwd = cwd; this.timeoutMs = timeoutMs; this.credentialOwner = 'official-cli';
    this.profile = Object.freeze({ capabilities: Object.freeze(['coding', 'structured-events', 'subscription-auth', 'threads', 'interrupts', 'governed-actions']), qualityTier: 4.5, costTier: 0, latencyTier: 2, local: false });
    this.approvalHandler = approvalHandler; this.initialized = null; this.state = 'idle'; this.turnStates = new Map();
    this.rpc = new JsonlRpcProcess({ executable, args, cwd, env, timeoutMs, includeJsonrpc: false, requestHandler: (method, params) => this.#serverRequest(method, params) });
    this.rpc.on('notification', (message) => this.#notification(message));
    this.rpc.on('closed', () => { this.state = 'closed'; });
  }

  publicView() { return Object.freeze({ id: this.id, label: this.label, kind: this.kind, executable: this.executable, credentialOwner: this.credentialOwner, state: this.state, capabilities: this.profile.capabilities, qualityTier: this.profile.qualityTier, costTier: this.profile.costTier, latencyTier: this.profile.latencyTier, local: this.profile.local }); }

  async detect() {
    try {
      const output = await new Promise((resolve, reject) => {
        const child = spawn(this.executable, ['--version'], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
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

  async startThread({ cwd = this.cwd, ephemeral = false, sandboxPolicy = undefined, approvalPolicy = 'untrusted' } = {}) {
    await this.connect();
    const result = await this.rpc.request('thread/start', { cwd: cwd ?? undefined, ephemeral: Boolean(ephemeral), sandbox: normalizeSandboxPolicy(sandboxPolicy), approvalPolicy });
    return Object.freeze(result.thread ?? result);
  }

  async resumeThread(threadId, options = {}) {
    await this.connect();
    const result = await this.rpc.request('thread/resume', { threadId: String(threadId), ...options });
    return Object.freeze(result.thread ?? result);
  }

  async startTurn({ threadId, input, cwd = this.cwd, model = undefined, sandboxPolicy = undefined, approvalPolicy = undefined, signal = null } = {}) {
    await this.connect();
    if (!String(threadId ?? '').trim()) throw new TypeError('threadId is required');
    const text = typeof input === 'string' ? input : JSON.stringify(input ?? '');
    const params = { threadId: String(threadId), input: [{ type: 'text', text }], ...(cwd ? { cwd } : {}), ...(model ? { model } : {}), sandboxPolicy: normalizeSandboxPolicy(sandboxPolicy), ...(approvalPolicy ? { approvalPolicy } : {}) };
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
    const thread = await this.startThread({ cwd: scope.cwd ?? this.cwd, ephemeral: false, sandboxPolicy: { type: 'read-only' }, approvalPolicy: 'untrusted' });
    return Object.freeze({ id: thread.id, threadId: thread.id, cwd: scope.cwd ?? this.cwd, openedFor: Object.freeze({ projectId: scope.projectId ?? null, missionId: scope.missionId ?? null, repositoryId: scope.repositoryId ?? null }), signalBound: Boolean(signal) });
  }

  async completeInSession(session, { messages = [], tools = [], signal = null, model = undefined, cwd = undefined } = {}) {
    const threadId = String(session?.threadId ?? session?.id ?? '').trim();
    if (!threadId) throw new TypeError('session threadId is required');
    const prompt = buildForgeActionPrompt(messages, tools);
    const result = await this.startTurn({ threadId, input: prompt, cwd: cwd ?? session?.cwd ?? this.cwd, model, signal });
    const envelope = parseForgeActionEnvelope(result.text, tools);
    return Object.freeze({ providerId: this.id, model: model ?? 'codex-subscription', text: envelope ? envelope.text : result.text, toolCalls: envelope?.toolCalls ?? Object.freeze([]), finishReason: result.status === 'completed' ? 'stop' : result.status, usage: result.usage, raw: Object.freeze({ ...result, prompt }) });
  }

  async closeSession(_session, _options = {}) { return Object.freeze({ closed: true, processRetained: this.state === 'ready' }); }

  async complete({ messages = [], tools = [], signal = null, model = undefined } = {}) {
    const thread = await this.startThread({ cwd: this.cwd, ephemeral: true, sandboxPolicy: { type: 'read-only' }, approvalPolicy: 'untrusted' });
    return this.completeInSession({ id: thread.id, threadId: thread.id, cwd: this.cwd }, { messages, tools, signal, model });
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
    if (typeof this.approvalHandler === 'function') response = await this.approvalHandler(Object.freeze({ method, ...structuredClone(params) }));
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
