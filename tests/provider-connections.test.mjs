import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StudioStore } from '../src/storage/studio-store.mjs';

test('StudioStore persists secret-free provider definitions and supports replacement', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-provider-store-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));

  const first = store.upsertProvider({
    id: 'openai-main',
    kind: 'openai-responses',
    config: {
      model: 'gpt-5',
      baseUrl: 'https://api.openai.com/v1',
      credentialRef: { service: 'forge.provider.openai-main', account: 'default' },
      apiKey: 'must-never-persist',
      nested: { refreshToken: 'also-secret', safe: 'value' },
    },
  });

  assert.equal(first.id, 'openai-main');
  assert.equal(first.config.model, 'gpt-5');
  assert.equal(first.config.apiKey, undefined);
  assert.equal(first.config.nested.refreshToken, undefined);
  assert.equal(first.config.nested.safe, 'value');
  assert.deepEqual(store.listProviderConfigs().map((item) => item.id), ['openai-main']);

  const second = store.upsertProvider({ id: 'openai-main', kind: 'openai-responses', config: { model: 'gpt-5.1', enabled: true } });
  assert.equal(second.config.model, 'gpt-5.1');
  assert.equal(store.getProviderConfig('openai-main').config.enabled, true);
  assert.equal(store.deleteProviderConfig('openai-main'), true);
  assert.equal(store.getProviderConfig('openai-main'), null);
  assert.equal(store.deleteProviderConfig('openai-main'), false);
});

import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { ProviderConnectionService } from '../src/providers/provider-connection-service.mjs';
import { CredentialVault, MemoryCredentialBackend } from '../src/security/credential-vault.mjs';
import { CliAuthAdapter } from '../src/providers/cli-auth-adapter.mjs';
import { CliProvider } from '../src/providers/cli-provider.mjs';

test('ProviderConnectionService stores API keys only in the vault, restores providers, and reports readiness', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-provider-service-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const vault = new CredentialVault({ backend: new MemoryCredentialBackend() });
  t.after(() => vault.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const fetchImpl = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(init.headers.authorization, 'Bearer sk-provider-test');
    return new Response(JSON.stringify({ id: 'resp_1', model: 'gpt-test', status: 'completed', output_text: 'OK', output: [], usage: { input_tokens: 2, output_tokens: 1, total_tokens: 3 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const registry = new ProviderRegistry();
  const service = new ProviderConnectionService({ store, registry, credentialVault: vault, fetchImpl });
  const configured = await service.configureApi({ id: 'openai-api', kind: 'openai-responses', model: 'gpt-test', apiKey: 'sk-provider-test' });
  assert.equal(configured.authenticated, true);
  assert.equal(configured.healthy, true);
  assert.equal(JSON.stringify(store.getProviderConfig('openai-api')).includes('sk-provider-test'), false);
  assert.deepEqual(store.getProviderConfig('openai-api').config.vaultRef, { service: 'forge.provider.openai-api', account: 'default' });
  assert.equal(await vault.resolve({ service: 'forge.provider.openai-api', account: 'default' }), 'sk-provider-test');
  assert.equal(service.readiness().ready, true);

  const restoredRegistry = new ProviderRegistry();
  const restored = new ProviderConnectionService({ store, registry: restoredRegistry, credentialVault: vault, fetchImpl });
  await restored.load();
  assert.equal(restoredRegistry.get('openai-api').kind, 'openai-responses');
  assert.equal(restored.readiness().ready, true);

  await restored.deleteApi('openai-api');
  assert.equal(store.getProviderConfig('openai-api'), null);
  assert.equal(await vault.resolve({ service: 'forge.provider.openai-api', account: 'default' }), null);
});

test('ProviderConnectionService exposes Codex login and fixed-command Claude auth status without reading OAuth tokens', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-provider-auth-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const registry = new ProviderRegistry();
  registry.register({ id: 'codex-app-server', publicView: () => ({ id: 'codex-app-server', label: 'Codex', capabilities: ['coding', 'governed-actions'] }) });
  registry.register({ id: 'claude', publicView: () => ({ id: 'claude', label: 'Claude', capabilities: ['coding', 'governed-actions'] }) });
  const calls = [];
  const codex = {
    async detect() { return { id: 'codex-app-server', available: true }; },
    async accountRead() { return { account: { type: 'chatgpt', email: 'user@example.test', planType: 'plus' } }; },
    async loginStart(input) { calls.push(['codex-login', input]); return { loginId: 'login-1', authUrl: 'https://auth.example.test' }; },
    async loginCancel(id) { calls.push(['codex-cancel', id]); return {}; },
    async logout() { calls.push(['codex-logout']); return {}; },
  };
  const adapter = new CliAuthAdapter({
    id: 'claude', label: 'Claude Code', executable: 'claude', statusArgs: ['auth', 'status'], loginArgs: { claudeai: ['auth', 'login', '--claudeai'] }, logoutArgs: ['auth', 'logout'],
    runner: async ({ args }) => {
      calls.push(['claude-run', args]);
      if (args[1] === 'status') return { exitCode: 0, stdout: JSON.stringify({ authenticated: true, email: 'claude@example.test', subscriptionType: 'max' }), stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    },
    launcher: async ({ args }) => { calls.push(['claude-launch', args]); return { launched: true }; },
  });
  const service = new ProviderConnectionService({ store, registry, credentialVault: new CredentialVault({ backend: new MemoryCredentialBackend() }), codexAppServer: codex, cliAuthAdapters: { claude: adapter } });
  t.after(() => rm(root, { recursive: true, force: true }));
  await service.refreshAll();
  assert.equal(registry.detection('codex-app-server').authenticated, true);
  assert.equal(registry.detection('claude').authenticated, true);
  assert.equal(registry.publicView().some((item) => JSON.stringify(item).includes('OAuth')), false);
  const connections = service.list();
  assert.deepEqual(connections.find((item) => item.id === 'codex-app-server').loginModes, ['chatgpt', 'chatgptDeviceCode']);
  assert.equal(connections.find((item) => item.id === 'codex-app-server').logoutSupported, true);
  assert.deepEqual(connections.find((item) => item.id === 'claude').loginModes, ['claudeai']);
  assert.equal(connections.find((item) => item.id === 'claude').logoutSupported, true);

  const login = await service.startLogin('codex-app-server', { type: 'chatgpt' });
  assert.equal(login.authUrl, 'https://auth.example.test');
  await service.cancelLogin('codex-app-server', { loginId: 'login-1' });
  await service.logout('codex-app-server');
  await service.startLogin('claude', { type: 'claudeai' });
  assert.deepEqual(calls.find((item) => item[0] === 'claude-launch')[1], ['auth', 'login', '--claudeai']);
});

test('ProviderConnectionService keeps shared Codex account detection isolated per harness', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-provider-codex-shared-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const registry = new ProviderRegistry();
  registry.register({ id: 'codex', publicView: () => ({ id: 'codex', kind: 'cli', capabilities: ['coding', 'structured-output', 'governed-actions'] }) });
  registry.register({ id: 'codex-app-server', publicView: () => ({ id: 'codex-app-server', kind: 'codex-app-server', capabilities: ['coding', 'structured-events', 'threads', 'governed-actions'] }) });
  const codexAppServer = {
    async detect() { return { id: 'codex-app-server', kind: 'codex-app-server', capabilities: ['coding', 'structured-events', 'threads', 'governed-actions'], available: true, version: 'test' }; },
    async accountRead() { return { account: { type: 'chatgpt', planType: 'plus' } }; },
  };
  const service = new ProviderConnectionService({ store, registry, credentialVault: new CredentialVault({ backend: new MemoryCredentialBackend() }), codexAppServer });
  await service.refreshAll({ apiProviders: false });
  const cliDetection = registry.detection('codex');
  assert.deepEqual(cliDetection.capabilities, ['coding', 'structured-output', 'governed-actions']);
  assert.equal(cliDetection.kind, 'cli');
  assert.deepEqual(registry.detection('codex-app-server').capabilities, ['coding', 'structured-events', 'threads', 'governed-actions']);
});

test('ProviderConnectionService preserves an installed CLI configuration diagnostic', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-provider-cli-diagnostic-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  const vault = new CredentialVault({ backend: new MemoryCredentialBackend() });
  t.after(() => store.close());
  t.after(() => vault.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const registry = new ProviderRegistry();
  registry.register({ id: 'gemini', kind: 'cli', publicView: () => ({ id: 'gemini', kind: 'cli', label: 'Gemini CLI' }), detect: async () => ({ available: true, version: 'test', error: 'configuration-error' }) });
  const service = new ProviderConnectionService({ store, registry, credentialVault: vault });
  await service.refreshAll({ apiProviders: false });
  assert.equal(registry.detection('gemini').error, 'configuration-error');
});

test('ProviderConnectionService permits a keyless loopback OpenAI-compatible endpoint', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-provider-local-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const vault = new CredentialVault({ backend: new MemoryCredentialBackend() });
  t.after(() => vault.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const registry = new ProviderRegistry();
  const fetchImpl = async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:11434/v1/chat/completions');
    assert.equal(init.headers.authorization, undefined);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const service = new ProviderConnectionService({ store, registry, credentialVault: vault, fetchImpl });

  const configured = await service.configureApi({
    id: 'ollama-local',
    kind: 'openai-compatible',
    model: 'qwen-local',
    baseUrl: 'http://127.0.0.1:11434/v1',
    apiKey: '',
  });

  assert.equal(configured.authenticated, true);
  assert.equal(configured.healthy, true);
  assert.equal(store.getProviderConfig('ollama-local').config.vaultRef, null);
  assert.equal(service.readiness().ready, true);
});

test('ProviderConnectionService discovers and probes configured models without exposing credentials', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-provider-models-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const vault = new CredentialVault({ backend: new MemoryCredentialBackend() });
  t.after(() => vault.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const registry = new ProviderRegistry();
  const calls = [];
  const modelProfiles = {
    mergeDiscovery(providerId, models) { calls.push(['merge', providerId, models]); return models; },
    recordProbe(key, result) { calls.push(['recordProbe', key, result]); return result; },
  };
  const modelDiscovery = { async discover(input) { calls.push(['discover', input]); return { providerId: input.providerId, models: [{ id: 'model-a' }] }; } };
  const modelProbes = { async probe(input) { calls.push(['probe', input]); return { ...input, capabilities: { text: true } }; } };
  const service = new ProviderConnectionService({ store, registry, credentialVault: vault, modelProfiles, modelDiscovery, modelProbes });
  await service.configureApi({ id: 'local-models', kind: 'openai-compatible', model: 'model-a', baseUrl: 'http://127.0.0.1:1234/v1', testConnection: false });
  const discovered = await service.discoverModels('local-models');
  assert.equal(discovered.models[0].id, 'model-a');
  const discoveryInput = calls.find((item) => item[0] === 'discover')[1];
  assert.equal(discoveryInput.baseUrl, 'http://127.0.0.1:1234/v1');
  assert.equal(JSON.stringify(discoveryInput).includes('apiKey'), true);
  assert.equal(discoveryInput.apiKey, null);
  const probed = await service.probeModel('local-models', { modelId: 'model-a', probes: ['text'] });
  assert.equal(probed.capabilities.text, true);
  assert.ok(calls.some((item) => item[0] === 'recordProbe' && item[1] === 'local-models/model-a'));
});

test('ProviderConnectionService discovers models from an installed CLI and merges a secret-free catalog', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-provider-cli-models-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const vault = new CredentialVault({ backend: new MemoryCredentialBackend() });
  t.after(() => vault.close());
  const registry = new ProviderRegistry();
  registry.register(new CliProvider({ id: 'opencode', label: 'OpenCode', executable: process.execPath, modelCatalog: ['openai/gpt-test', 'anthropic/claude-test'] }));
  const calls = [];
  const service = new ProviderConnectionService({
    store, registry, credentialVault: vault,
    modelProfiles: { mergeDiscovery(providerId, models) { calls.push({ providerId, models }); }, publicView: () => ({ models: [] }) },
  });

  const result = await service.discoverModels('opencode');
  assert.equal(result.status, 'compatibility');
  assert.deepEqual(result.models.map((item) => item.id), ['openai/gpt-test', 'anthropic/claude-test']);
  assert.equal(calls[0].providerId, 'opencode');
  assert.equal(JSON.stringify(result).includes('secret'), false);
});
