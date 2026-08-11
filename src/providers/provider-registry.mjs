import { CliProvider } from './cli-provider.mjs';

export function inferHarnessFamily(provider = {}) {
  const explicit = String(provider?.harnessFamily ?? '').trim();
  if (explicit) return explicit;
  const id = String(provider?.id ?? '').toLowerCase();
  const kind = String(provider?.kind ?? provider?.publicView?.()?.kind ?? '').toLowerCase();
  if (id === 'codex-app-server' || kind === 'codex-app-server') return 'codex-app-server';
  if (id === 'codex') return 'codex-cli';
  if (id === 'claude') return 'claude-code';
  if (id === 'gemini') return 'gemini-cli';
  if (kind === 'openai-responses' || kind === 'openai-compatible') return 'openai-api';
  if (kind === 'anthropic-messages') return 'anthropic-api';
  if (kind === 'gemini-generate-content') return 'gemini-api';
  return 'generic-local';
}

export class ProviderRegistry {
  #providers = new Map();
  #proxies = new Map();
  #detections = new Map();
  #families = new Map();
  #executionPool;
  #sessionHost;

  constructor({ executionPool = null, sessionHost = null } = {}) {
    if (executionPool !== null && typeof executionPool?.run !== 'function') throw new TypeError('executionPool must expose run()');
    if (sessionHost !== null && typeof sessionHost?.complete !== 'function') throw new TypeError('sessionHost must expose complete()');
    this.#executionPool = executionPool;
    this.#sessionHost = sessionHost;
  }

  #createProxy(provider, harnessFamily) {
    const functionCache = new Map();
    const pool = this.#executionPool;
    const sessionHost = this.#sessionHost;
    return new Proxy(provider, {
      get(target, property, receiver) {
        if (property === 'harnessFamily') return harnessFamily;
        if (property === 'publicView') {
          if (!functionCache.has(property)) functionCache.set(property, () => Object.freeze({ ...target.publicView(), harnessFamily }));
          return functionCache.get(property);
        }
        if (property === 'complete' && (pool || sessionHost) && typeof target.complete === 'function') {
          if (!functionCache.has(property)) functionCache.set(property, async (input = {}) => {
            const { leaseContext = null, ...request } = input ?? {};
            const context = leaseContext && typeof leaseContext === 'object' ? leaseContext : {};
            const { missionId = null, taskId = null, projectId = null, repositoryId = null, workspaceHash = null, repositoryFingerprint = '', harnessProfileSha256 = '', toolSchemaSha256 = '', ...metadata } = context;
            const invoke = () => sessionHost
              ? sessionHost.complete({
                  provider: target, request, signal: request.signal ?? null,
                  scope: { projectId, missionId, taskId, repositoryId, workspaceHash },
                  fingerprint: [repositoryFingerprint, harnessProfileSha256, toolSchemaSha256].filter(Boolean).join(':'),
                })
              : target.complete(request);
            const leaseMetadata = { ...metadata };
            if (projectId != null) leaseMetadata.projectId = projectId;
            if (repositoryId != null) leaseMetadata.repositoryId = repositoryId;
            return pool ? pool.run({ key: target.id, missionId, taskId, signal: request.signal ?? null, metadata: leaseMetadata }, invoke) : invoke();
          });
          return functionCache.get(property);
        }
        const value = Reflect.get(target, property, target);
        if (typeof value !== 'function') return value;
        if (!functionCache.has(property)) functionCache.set(property, value.bind(target));
        return functionCache.get(property);
      },
      set(target, property, value) { return Reflect.set(target, property, value, target); },
    });
  }

  register(provider) {
    if (!provider?.id) throw new TypeError('provider id is required');
    if (this.#providers.has(provider.id)) throw new Error(`Duplicate provider: ${provider.id}`);
    const family = inferHarnessFamily(provider);
    this.#providers.set(provider.id, provider);
    this.#families.set(provider.id, family);
    const proxy = this.#createProxy(provider, family);
    this.#proxies.set(provider.id, proxy);
    return proxy;
  }

  upsert(provider) {
    if (!provider?.id) throw new TypeError('provider id is required');
    const previous = this.#providers.get(provider.id);
    if (previous && previous !== provider) previous.close?.().catch?.(() => {});
    const family = inferHarnessFamily(provider);
    this.#providers.set(provider.id, provider);
    this.#families.set(provider.id, family);
    const proxy = this.#createProxy(provider, family);
    this.#proxies.set(provider.id, proxy);
    this.#detections.delete(provider.id);
    return proxy;
  }

  remove(id) {
    const key = String(id);
    const provider = this.#providers.get(key);
    if (!provider) return false;
    this.#providers.delete(key);
    this.#proxies.delete(key);
    this.#detections.delete(key);
    this.#families.delete(key);
    provider.close?.().catch?.(() => {});
    return true;
  }

  setDetection(id, detection) {
    const key = String(id);
    if (!this.#providers.has(key)) throw new Error(`Unknown provider: ${id}`);
    this.#detections.set(key, Object.freeze({ id: key, ...structuredClone(detection ?? {}) }));
    return this.#detections.get(key);
  }

  raw(id) {
    const provider = this.#providers.get(String(id));
    if (!provider) throw new Error(`Unknown provider: ${id}`);
    return provider;
  }

  get(id) {
    const provider = this.#proxies.get(String(id));
    if (!provider) throw new Error(`Unknown provider: ${id}`);
    return provider;
  }

  list() { return [...this.#proxies.values()]; }
  publicView() {
    return this.list().map((provider) => {
      const detection = this.#detections.get(provider.id);
      const safeDetection = detection ? {
        available: Boolean(detection.available),
        authenticated: detection.authenticated === undefined ? undefined : Boolean(detection.authenticated),
        healthy: detection.healthy === undefined ? undefined : Boolean(detection.healthy),
        version: detection.version ?? null,
        authMode: detection.authMode == null ? null : String(detection.authMode).slice(0, 80),
        planType: detection.planType == null ? null : String(detection.planType).slice(0, 80),
        error: detection.error == null ? null : String(detection.error).slice(0, 240),
      } : {};
      return Object.freeze({ ...provider.publicView(), harnessFamily: provider.harnessFamily, ...safeDetection });
    });
  }
  detection(id) { return this.#detections.get(String(id)) ?? null; }
  async detectAll() {
    const results = await Promise.all(this.list().map(async (provider) => {
      try { return await (provider.detect?.() ?? { ...provider.publicView(), available: true, authenticated: true, healthy: true }); }
      catch (error) { return { ...provider.publicView(), available: false, authenticated: false, healthy: false, error: String(error?.message ?? error) }; }
    }));
    for (const result of results) this.#detections.set(result.id, Object.freeze({ ...result, harnessFamily: result.harnessFamily ?? this.#families.get(result.id) ?? 'generic-local' }));
    return results;
  }
}

export function createBuiltInCliProviders(overrides = {}) {
  const definitions = [
    { id: 'codex', label: 'OpenAI Codex CLI', executable: 'codex', harnessFamily: 'codex-cli', baseArgs: ['exec', '--json', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '-'], promptMode: 'stdin', profile: { capabilities: ['coding', 'structured-output', 'subscription-auth', 'governed-actions'], qualityTier: 4, costTier: 0, latencyTier: 2 } },
    { id: 'claude', label: 'Anthropic Claude Code', executable: 'claude', harnessFamily: 'claude-code', baseArgs: ['-p', '--output-format', 'json', '--permission-mode', 'plan'], promptMode: 'stdin', profile: { capabilities: ['coding', 'structured-output', 'subscription-auth', 'long-context', 'governed-actions'], qualityTier: 4, costTier: 0, latencyTier: 2 } },
    { id: 'gemini', label: 'Google Gemini CLI', executable: 'gemini', harnessFamily: 'gemini-cli', baseArgs: ['--output-format', 'json', '--approval-mode', 'plan'], promptMode: 'arg', promptFlag: '-p', profile: { capabilities: ['coding', 'structured-output', 'subscription-auth', 'long-context', 'governed-actions'], qualityTier: 3, costTier: 0, latencyTier: 2 } },
    { id: 'opencode', label: 'OpenCode', executable: 'opencode', harnessFamily: 'opencode-cli', baseArgs: ['run'], promptMode: 'arg', modelDiscoveryArgs: ['models', '--refresh'], profile: { capabilities: ['coding', 'structured-output', 'governed-actions'], qualityTier: 3, costTier: 1, latencyTier: 2 } },
    { id: 'github-copilot', label: 'GitHub Copilot CLI', executable: 'copilot', harnessFamily: 'github-copilot-cli', baseArgs: ['--mode', 'plan', '--sandbox', 'on', '--allow-tool', 'read', '--output-format', 'json', '--no-remote', '--no-remote-export', '--no-ask-user'], promptMode: 'arg', promptFlag: '--prompt', profile: { capabilities: ['coding', 'structured-output', 'subscription-auth', 'governed-actions'], qualityTier: 4, costTier: 0, latencyTier: 2 } },
    { id: 'cursor-agent', label: 'Cursor Agent CLI', executable: 'agent', harnessFamily: 'cursor-agent-cli', baseArgs: ['-p', '--output-format', 'json'], promptMode: 'arg', modelFlag: '--model', profile: { capabilities: ['coding', 'structured-output', 'subscription-auth'], qualityTier: 4, costTier: 0, latencyTier: 2 } },
    { id: 'kiro-cli', label: 'Kiro CLI', executable: 'kiro-cli', harnessFamily: 'kiro-cli', baseArgs: ['chat', '--no-interactive', '--trust-tools=read,grep'], promptMode: 'arg', modelFlag: null, modelSelection: 'cli-config', modelDiscoveryArgs: ['chat', '--list-models', '--format', 'json'], profile: { capabilities: ['coding', 'structured-output', 'subscription-auth'], qualityTier: 4, costTier: 0, latencyTier: 2 } },
    { id: 'factory-droid', label: 'Factory Droid', executable: 'droid', harnessFamily: 'factory-droid-cli', baseArgs: ['exec', '--use-spec', '--output-format', 'json'], promptMode: 'arg', modelFlag: '--model', profile: { capabilities: ['coding', 'structured-output', 'subscription-auth'], qualityTier: 4, costTier: 0, latencyTier: 2 } },
    { id: 'qwen-code', label: 'Qwen Code', executable: 'qwen', harnessFamily: 'qwen-code', baseArgs: ['--output-format', 'json'], promptMode: 'arg', promptFlag: '--prompt', executionSafety: 'external-plan-config-required', profile: { capabilities: ['coding', 'structured-output'], qualityTier: 3, costTier: 1, latencyTier: 2 } },
    { id: 'continue-cli', label: 'Continue CLI', executable: 'cn', harnessFamily: 'continue-cli', baseArgs: ['--format', 'json', '--exclude', 'Write', '--exclude', 'Edit', '--exclude', 'Bash'], promptMode: 'arg', promptFlag: '-p', modelFlag: null, modelSelection: 'cli-config', profile: { capabilities: ['coding', 'structured-output', 'governed-actions'], qualityTier: 3, costTier: 1, latencyTier: 2 } },
    { id: 'cline', label: 'Cline CLI', executable: 'cline', harnessFamily: 'cline-cli', baseArgs: ['--json', '--plan', '--auto-approve', 'false'], promptMode: 'arg', promptFlag: null, modelFlag: '-m', profile: { capabilities: ['coding', 'structured-output', 'governed-actions'], qualityTier: 3, costTier: 1, latencyTier: 2 } },
    { id: 'mistral-vibe-code', label: 'Mistral Vibe Code', executable: 'vibe', harnessFamily: 'mistral-vibe-code-cli', baseArgs: ['--agent', 'plan', '--max-turns', '5', '--output', 'json'], promptMode: 'arg', promptFlag: '--prompt', modelFlag: null, modelSelection: 'cli-config', profile: { capabilities: ['coding', 'structured-output', 'governed-actions'], qualityTier: 3, costTier: 1, latencyTier: 2 } },
    { id: 'aider', label: 'Aider', executable: 'aider', harnessFamily: 'aider-cli', baseArgs: ['--no-auto-commits'], promptMode: 'arg', promptFlag: '--message', executionSafety: 'external-plan-config-required', profile: { capabilities: ['coding'], qualityTier: 3, costTier: 1, latencyTier: 2 } },
    { id: 'goose', label: 'Block Goose', executable: 'goose', harnessFamily: 'block-goose-cli', baseArgs: ['run', '--output-format', 'json', '--no-session'], promptMode: 'arg', promptFlag: '-t', modelFlag: null, modelSelection: 'cli-config', executionSafety: 'external-plan-config-required', profile: { capabilities: ['coding', 'structured-output'], qualityTier: 3, costTier: 1, latencyTier: 2 } },
  ];
  return definitions.map((definition) => new CliProvider({ ...definition, credentialOwner: 'official-cli', ...(overrides[definition.id] ?? {}) }));
}
