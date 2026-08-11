import { OpenAIResponsesProvider } from './openai-responses.mjs';
import { AnthropicMessagesProvider } from './anthropic-messages.mjs';
import { GeminiGenerateContentProvider } from './gemini-generate-content.mjs';
import { OpenAICompatibleProvider } from './openai-compatible.mjs';

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const API_KINDS = new Set(['openai-responses', 'anthropic-messages', 'gemini-generate-content', 'openai-compatible']);
const DEFAULTS = Object.freeze({
  'openai-responses': { id: 'openai-api', label: 'OpenAI API', baseUrl: 'https://api.openai.com/v1' },
  'anthropic-messages': { id: 'anthropic-api', label: 'Anthropic API', baseUrl: 'https://api.anthropic.com/v1' },
  'gemini-generate-content': { id: 'gemini-api', label: 'Google Gemini API', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  'openai-compatible': { id: 'openai-compatible', label: 'OpenAI-compatible API', baseUrl: 'http://127.0.0.1:11434/v1' },
});

function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function providerId(value) { const text = required(value, 'provider id'); if (!ID.test(text)) throw new TypeError('provider id is invalid'); return text; }
function safeError(error) { return String(error?.message ?? error).replace(/(?:sk|key|token)-[A-Za-z0-9._-]+/gi, '[REDACTED]').slice(0, 300); }
function isLoopback(hostname) { return ['localhost', '127.0.0.1', '::1'].includes(hostname); }
function endpoint(value, fallback) {
  const url = new URL(String(value ?? fallback));
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback(url.hostname))) throw new TypeError('Remote provider endpoints must use HTTPS');
  return url.toString().replace(/\/$/, '');
}
function accountState(result) {
  const account = result?.account ?? result?.value?.account ?? result?.data?.account ?? null;
  const authenticated = Boolean(account && (account.type || account.email || account.planType || account.id));
  return Object.freeze({
    authenticated,
    authMode: account?.type == null ? null : String(account.type).slice(0, 80),
    planType: account?.planType == null ? null : String(account.planType).slice(0, 80),
    email: account?.email == null ? null : String(account.email).slice(0, 200),
  });
}

export class ProviderConnectionService {
  constructor({ store, registry, credentialVault, codexAppServer = null, cliAuthAdapters = {}, fetchImpl = fetch, clock = () => new Date().toISOString(), modelProfiles = null, modelDiscovery = null, modelProbes = null } = {}) {
    if (!store?.listProviderConfigs || !registry?.upsert || !credentialVault?.set) throw new TypeError('store, registry, and credentialVault are required');
    this.store = store; this.registry = registry; this.credentialVault = credentialVault; this.codexAppServer = codexAppServer; this.cliAuthAdapters = { ...cliAuthAdapters }; this.fetchImpl = fetchImpl; this.clock = clock; this.modelProfiles = modelProfiles; this.modelDiscovery = modelDiscovery; this.modelProbes = modelProbes;
  }

  #factory(record, { model = null } = {}) {
    const config = record.config ?? {}; const common = {
      id: record.id,
      model: required(model ?? config.model, 'model'),
      baseUrl: config.baseUrl,
      credentialRef: config.vaultRef,
      credentialResolver: (ref) => this.credentialVault.resolve(ref),
      fetchImpl: this.fetchImpl,
    };
    if (record.kind === 'openai-responses') return new OpenAIResponsesProvider(common);
    if (record.kind === 'anthropic-messages') return new AnthropicMessagesProvider(common);
    if (record.kind === 'gemini-generate-content') return new GeminiGenerateContentProvider(common);
    if (record.kind === 'openai-compatible') return new OpenAICompatibleProvider({ ...common, secretRef: config.vaultRef, credentialRef: undefined, headers: config.headers ?? {} });
    throw new TypeError(`Unsupported provider kind: ${record.kind}`);
  }

  async load() {
    for (const record of this.store.listProviderConfigs()) {
      if (!API_KINDS.has(record.kind)) continue;
      try {
        const provider = this.#factory(record); this.registry.upsert(provider);
        const present = record.config?.vaultRef ? Boolean(await this.credentialVault.resolve(record.config.vaultRef)) : record.kind === 'openai-compatible';
        const tested = record.config?.lastTestStatus === 'pass';
        this.registry.setDetection(record.id, { ...provider.publicView(), available: true, authenticated: present, healthy: present && tested, error: present ? (tested ? null : 'connection-test-required') : 'credential-missing' });
      } catch (error) {
        const existing = this.registry.list().find((item) => item.id === record.id);
        if (existing) this.registry.setDetection(record.id, { ...existing.publicView(), available: false, authenticated: false, healthy: false, error: safeError(error) });
      }
    }
    await this.refreshAll({ apiProviders: false });
    return this.list();
  }

  async configureApi({ id, kind, model, baseUrl = undefined, apiKey = undefined, account = 'default', headers = {}, testConnection = true } = {}) {
    const cleanKind = required(kind, 'provider kind'); if (!API_KINDS.has(cleanKind)) throw new TypeError(`Unsupported provider kind: ${cleanKind}`);
    const cleanId = providerId(id ?? DEFAULTS[cleanKind].id); const cleanModel = required(model, 'model');
    const cleanBaseUrl = endpoint(baseUrl, DEFAULTS[cleanKind].baseUrl);
    const candidateVaultRef = { service: `forge.provider.${cleanId}`, account: required(account, 'account') };
    const key = String(apiKey ?? '');
    if (key) await this.credentialVault.set({ ...candidateVaultRef, secret: key });
    const existingCredential = key ? key : await this.credentialVault.resolve(candidateVaultRef);
    if (cleanKind !== 'openai-compatible' && !existingCredential) throw new TypeError('apiKey is required');
    const vaultRef = existingCredential ? candidateVaultRef : null;
    const record = this.store.upsertProvider({ id: cleanId, kind: cleanKind, config: { model: cleanModel, baseUrl: cleanBaseUrl, vaultRef, headers: cleanKind === 'openai-compatible' ? headers : {}, lastTestStatus: 'pending', lastTestedAt: null } });
    const provider = this.#factory(record); this.registry.upsert(provider);
    this.registry.setDetection(cleanId, { ...provider.publicView(), available: true, authenticated: cleanKind === 'openai-compatible' || Boolean(existingCredential), healthy: false, error: 'connection-test-required' });
    return testConnection ? this.test(cleanId) : this.#connection(cleanId);
  }

  async deleteApi(id) {
    const cleanId = providerId(id); const record = this.store.getProviderConfig(cleanId);
    if (!record || !API_KINDS.has(record.kind)) return false;
    if (record.config?.vaultRef) await this.credentialVault.delete(record.config.vaultRef);
    this.registry.remove(cleanId); this.store.deleteProviderConfig(cleanId); return true;
  }

  async test(id) {
    const cleanId = providerId(id); const provider = this.registry.get(cleanId);
    try {
      const result = await provider.complete({ messages: [{ role: 'user', content: 'Reply with exactly OK.' }], tools: [] });
      const detection = this.registry.setDetection(cleanId, { ...provider.publicView(), available: true, authenticated: true, healthy: true, error: null, lastTestedAt: this.clock() });
      const record = this.store.getProviderConfig(cleanId);
      if (record) this.store.upsertProvider({ id: record.id, kind: record.kind, config: { ...record.config, lastTestStatus: 'pass', lastTestedAt: detection.lastTestedAt } });
      return this.#connection(cleanId, { testOutput: String(result?.text ?? '').slice(0, 120) });
    } catch (error) {
      const message = safeError(error);
      this.registry.setDetection(cleanId, { ...provider.publicView(), available: true, authenticated: false, healthy: false, error: message, lastTestedAt: this.clock() });
      const record = this.store.getProviderConfig(cleanId);
      if (record) this.store.upsertProvider({ id: record.id, kind: record.kind, config: { ...record.config, lastTestStatus: 'fail', lastTestedAt: this.clock(), lastTestError: message } });
      throw Object.assign(new Error(message), { statusCode: 400, code: 'provider_test_failed' });
    }
  }

  async refreshAll({ apiProviders = true } = {}) {
    if (this.codexAppServer && this.registry.list().some((item) => item.id === 'codex-app-server')) await this.#refreshCodex();
    for (const [id, adapter] of Object.entries(this.cliAuthAdapters)) {
      if (!this.registry.list().some((item) => item.id === id)) continue;
      try { const status = await adapter.status(); const provider = this.registry.get(id); this.registry.setDetection(id, { ...provider.publicView(), ...status }); }
      catch (error) { const provider = this.registry.get(id); this.registry.setDetection(id, { ...provider.publicView(), available: false, authenticated: false, healthy: false, error: safeError(error) }); }
    }
    if (apiProviders) {
      for (const record of this.store.listProviderConfigs()) {
        if (!API_KINDS.has(record.kind) || !this.registry.list().some((item) => item.id === record.id)) continue;
        const provider = this.registry.get(record.id); const detection = await provider.detect();
        const tested = record.config?.lastTestStatus === 'pass';
        this.registry.setDetection(record.id, { ...detection, healthy: detection.authenticated === true && tested, error: detection.authenticated !== true ? detection.error : (tested ? null : 'connection-test-required') });
      }
    }
    const handled = new Set(['codex', 'codex-app-server', ...Object.keys(this.cliAuthAdapters), ...this.store.listProviderConfigs().map((item) => item.id)]);
    for (const provider of this.registry.list()) {
      if (handled.has(provider.id) || this.registry.detection(provider.id)) continue;
      try {
        const detected = await (provider.detect?.() ?? { ...provider.publicView(), available: true });
        this.registry.setDetection(provider.id, { ...provider.publicView(), ...detected, authenticated: false, healthy: false, error: detected.error ?? (detected.available === false ? 'not-installed' : 'authentication-status-unavailable') });
      } catch (error) {
        this.registry.setDetection(provider.id, { ...provider.publicView(), available: false, authenticated: false, healthy: false, error: safeError(error) });
      }
    }
    return this.list();
  }

  async #refreshCodex() {
    const provider = this.registry.get('codex-app-server');
    try {
      const detected = await this.codexAppServer.detect();
      if (!detected.available) return this.registry.setDetection(provider.id, { ...provider.publicView(), ...detected, authenticated: false, healthy: false });
      const state = accountState(await this.codexAppServer.accountRead({ refreshToken: false }));
      let modelCatalog = { status: state.authenticated ? 'not-supported' : 'not-authenticated', modelCount: 0, observedAt: null, error: null };
      if (state.authenticated && typeof this.codexAppServer.listModels === 'function') {
        try {
          const catalog = await this.codexAppServer.listModels();
          this.modelProfiles?.mergeDiscovery?.(provider.id, catalog.models ?? []);
          modelCatalog = { status: catalog.status ?? 'fresh', modelCount: Array.isArray(catalog.models) ? catalog.models.length : 0, observedAt: catalog.observedAt ?? null, error: null };
        } catch (error) {
          modelCatalog = { status: 'unavailable', modelCount: 0, observedAt: null, error: safeError(error) };
        }
      }
      const detection = this.registry.setDetection(provider.id, { ...provider.publicView(), ...detected, ...state, modelCatalog, healthy: state.authenticated, error: state.authenticated ? null : 'login-required' });
      // Codex CLI and Codex App Server share the official account, but they do
      // not share a provider profile. Keep the CLI's own kind/capabilities so
      // the router cannot accidentally require App Server-only capabilities.
      if (this.registry.list().some((item) => item.id === 'codex')) {
        const cli = this.registry.get('codex').publicView();
        this.registry.setDetection('codex', {
          ...cli,
          available: detection.available,
          authenticated: state.authenticated,
          healthy: state.authenticated,
          version: detection.version ?? null,
          authMode: state.authMode,
          planType: state.planType,
          error: state.authenticated ? null : 'login-required',
          id: 'codex',
        });
      }
      return detection;
    } catch (error) { return this.registry.setDetection(provider.id, { ...provider.publicView(), available: true, authenticated: false, healthy: false, error: safeError(error) }); }
  }

  async startLogin(id, options = {}) {
    const cleanId = providerId(id);
    if (cleanId === 'codex-app-server' || cleanId === 'codex') {
      if (!this.codexAppServer) throw Object.assign(new Error('Codex app-server is not configured'), { statusCode: 503 });
      return this.codexAppServer.loginStart(options);
    }
    const adapter = this.cliAuthAdapters[cleanId]; if (!adapter) throw Object.assign(new Error(`Login is not supported for ${cleanId}`), { statusCode: 400 });
    return adapter.startLogin(options);
  }

  async cancelLogin(id, { loginId } = {}) {
    const cleanId = providerId(id);
    if (cleanId !== 'codex-app-server' && cleanId !== 'codex') throw Object.assign(new Error('Login cancellation is only supported for Codex browser/device login'), { statusCode: 400 });
    return this.codexAppServer.loginCancel(required(loginId, 'loginId'));
  }

  async logout(id) {
    const cleanId = providerId(id);
    if (cleanId === 'codex-app-server' || cleanId === 'codex') { await this.codexAppServer.logout(); await this.#refreshCodex(); return this.#connection('codex-app-server'); }
    const adapter = this.cliAuthAdapters[cleanId]; if (!adapter) throw Object.assign(new Error(`Logout is not supported for ${cleanId}`), { statusCode: 400 });
    await adapter.logout(); await this.refreshAll({ apiProviders: false }); return this.#connection(cleanId);
  }


  async discoverModels(id) {
    const cleanId = providerId(id);
    const registered = this.registry.get(cleanId);
    const registeredKind = registered?.kind ?? registered?.publicView?.().kind;
    if ((cleanId === 'codex-app-server' || registeredKind === 'codex-app-server') && typeof this.codexAppServer?.listModels === 'function') {
      const result = await this.codexAppServer.listModels();
      this.modelProfiles?.mergeDiscovery?.(cleanId, result.models ?? []);
      return Object.freeze({ ...result, profiles: this.modelProfiles?.publicView?.({ providerId: cleanId }) ?? null });
    }
    if (registered?.kind === 'cli' && typeof registered.discoverModels === 'function') {
      const result = await registered.discoverModels();
      if (this.modelProfiles?.mergeDiscovery) this.modelProfiles.mergeDiscovery(cleanId, result.models);
      return Object.freeze({ ...result, profiles: this.modelProfiles?.publicView?.({ providerId: cleanId }) ?? null });
    }
    if (!this.modelDiscovery || !this.modelProfiles) throw Object.assign(new Error('Model discovery is not configured'), { statusCode: 503, code: 'model_discovery_unavailable' });
    const record = this.store.getProviderConfig(cleanId);
    if (!record || !API_KINDS.has(record.kind)) throw Object.assign(new Error(`Provider ${cleanId} does not support model discovery`), { statusCode: 400, code: 'model_discovery_unsupported' });
    const key = record.config?.vaultRef ? await this.credentialVault.resolve(record.config.vaultRef) : null;
    const headers = { ...(record.config?.headers ?? {}) };
    let apiKey = key;
    if (record.kind === 'anthropic-messages' && key) {
      headers['x-api-key'] = key; headers['anthropic-version'] = headers['anthropic-version'] ?? '2023-06-01'; apiKey = null;
    }
    const result = await this.modelDiscovery.discover({ providerId: cleanId, kind: record.kind, baseUrl: record.config.baseUrl, headers, apiKey });
    this.modelProfiles.mergeDiscovery(cleanId, result.models);
    return Object.freeze({ ...result, profiles: this.modelProfiles.publicView?.({ providerId: cleanId }) ?? null });
  }

  async probeModel(id, { modelId = null, probes = ['text', 'tools', 'structuredOutput'] } = {}) {
    if (!this.modelProbes || !this.modelProfiles) throw Object.assign(new Error('Model capability probes are not configured'), { statusCode: 503, code: 'model_probe_unavailable' });
    const cleanId = providerId(id); const record = this.store.getProviderConfig(cleanId);
    const cleanModel = required(modelId ?? record?.config?.model, 'modelId');
    const provider = record && API_KINDS.has(record.kind) ? this.#factory(record, { model: cleanModel }) : this.registry.get(cleanId);
    const result = await this.modelProbes.probe({ providerId: cleanId, modelId: cleanModel, probes, provider });
    if (this.modelProfiles.get && this.modelProfiles.upsert) { try { this.modelProfiles.get(`${cleanId}/${cleanModel}`); } catch { this.modelProfiles.upsert({ providerId: cleanId, modelId: cleanModel }); } }
    this.modelProfiles.recordProbe(`${cleanId}/${cleanModel}`, result);
    return Object.freeze({ ...result, profile: this.modelProfiles.get?.(`${cleanId}/${cleanModel}`) ?? null });
  }

  readiness({ providerId: requested = 'auto', requiredCapabilities = ['coding', 'governed-actions'] } = {}) {
    const needed = new Set(requiredCapabilities.map(String));
    const candidates = this.registry.publicView().map((view) => ({
      ...view,
      eligible: view.available === true && view.authenticated === true && view.healthy === true && [...needed].every((capability) => (view.capabilities ?? []).includes(capability)),
    }));
    const eligible = requested && requested !== 'auto' ? candidates.filter((item) => item.id === requested && item.eligible) : candidates.filter((item) => item.eligible);
    return Object.freeze({ ready: eligible.length > 0, providerId: String(requested ?? 'auto'), requiredCapabilities: Object.freeze([...needed]), readyProviders: Object.freeze(eligible.map((item) => item.id)), providers: Object.freeze(candidates) });
  }

  #connection(id, extra = {}) {
    const view = this.registry.publicView().find((item) => item.id === id);
    if (!view) throw new Error(`Unknown provider: ${id}`);
    const record = this.store.getProviderConfig(id);
    const codexAccount = id === 'codex' || id === 'codex-app-server';
    const adapter = this.cliAuthAdapters[id] ?? null;
    const loginModes = codexAccount ? ['chatgpt', 'chatgptDeviceCode'] : Object.keys(adapter?.loginArgs ?? {});
    const logoutSupported = codexAccount || Array.isArray(adapter?.logoutArgs);
    return Object.freeze({
      ...view,
      configured: Boolean(record) || view.credentialOwner === 'official-cli',
      loginSupported: loginModes.length > 0,
      loginModes: Object.freeze(loginModes),
      logoutSupported,
      config: record ? { model: record.config.model, baseUrl: record.config.baseUrl, lastTestStatus: record.config.lastTestStatus ?? null, lastTestedAt: record.config.lastTestedAt ?? null } : null,
      ...extra,
    });
  }

  list() {
    const actual = this.registry.publicView().map((view) => this.#connection(view.id));
    const existingKinds = new Set(this.store.listProviderConfigs().map((item) => item.kind));
    const templates = Object.entries(DEFAULTS).filter(([kind]) => !existingKinds.has(kind)).map(([kind, value]) => Object.freeze({ id: value.id, kind, label: value.label, configured: false, available: true, authenticated: false, healthy: false, baseUrl: value.baseUrl, capabilities: ['coding', 'tool-calling', 'governed-actions'] }));
    return Object.freeze([...actual, ...templates]);
  }
}
