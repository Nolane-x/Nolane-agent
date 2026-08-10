import test from 'node:test';
import assert from 'node:assert/strict';
import { renderModelProfilesPanel } from '../ui-v3/views/settings/model-profiles-panel.mjs';
import { createSettingsController } from '../ui-v3/views/settings/settings-controller.mjs';

test('model profile panel distinguishes unknown capabilities and exposes discovery and probes', async () => {
  const html=renderModelProfilesPanel({models:[{key:'p/m',providerId:'p',modelId:'m',displayName:'Model M',lifecycle:'unknown',capabilities:{tools:'unknown',vision:false,text:true},context:{inputTokens:1000},metadata:{}}],providers:[{id:'p',label:'Provider P',configured:true}]},{experience:'research'});
  assert.match(html,/Model M/); assert.match(html,/Unknown/); assert.match(html,/Discover models/); assert.match(html,/Probe/); assert.match(html,/Routing diagnostics/); assert.match(html,/data-model-action="configure"/); assert.match(html,/name="apiKey"/);
  assert.match(renderModelProfilesPanel({}, { lang: 'vi' }), /Thêm provider API/);
  const calls=[]; const api={get:async(path)=>path.includes('catalog')?{categories:[],experienceLevels:[]}:path.includes('effective')?{value:{experience:{level:'research'}}}:path.includes('provider-connections')?[]:{models:[]},put:async()=>({}),post:async(path,body)=>{calls.push([path,body]);return path.includes('discover')?{profiles:{models:[{key:'p/m'}]}}:{profile:{key:'p/m'}};}};
  const controller=createSettingsController({api}); await controller.load(); await controller.configureProvider({id:'local-api',kind:'openai-compatible',model:'qwen',baseUrl:'http://127.0.0.1:1234/v1',apiKey:'secret'}); await controller.discoverModels('p'); await controller.probeModel('p','m',['text']);
  assert.deepEqual(calls.map((x)=>x[0]),['/api/provider-connections/configure','/api/model-profiles/discover','/api/model-profiles/probe']);
  assert.deepEqual(calls[0][1],{id:'local-api',kind:'openai-compatible',model:'qwen',baseUrl:'http://127.0.0.1:1234/v1',apiKey:'secret',testConnection:true});
  assert.equal(controller.snapshot().errors.length,0);
});

test('CLI model profiles expose discovery and a manual model entry point with Vietnamese copy', () => {
  const html = renderModelProfilesPanel({ models: [], providers: [{ id: 'codex', kind: 'cli', label: 'Codex CLI', available: true, authenticated: true, healthy: true }] }, { lang: 'vi' });
  assert.match(html, /Thêm model CLI/);
  assert.match(html, /name="modelId"/);
  assert.match(html, /Thêm model/);
  assert.match(html, /data-model-action="discover"/);
  assert.doesNotMatch(html, /Not configured|No discovered models/);
});

test('Vietnamese model profiles do not leak English lifecycle and truth placeholders', () => {
  const html = renderModelProfilesPanel({ models: [{ providerId: 'codex', modelId: 'cli-selected', lifecycle: 'inferred', tokenizerId: 'Unknown', capabilities: {}, truth: { evaluations: 0 } }], providers: [{ id: 'codex', kind: 'cli', label: 'Codex CLI', available: true, authenticated: true, healthy: true }] }, { lang: 'vi' });
  assert.match(html, /Suy luận/);
  assert.match(html, /Chưa biết/);
  assert.match(html, /0 lượt đánh giá/);
  assert.doesNotMatch(html, />unknown<|>inferred<|>0 evals<|>Unknown</);
});

test('provider cards expose account login and logout actions from backend capabilities', () => {
  const html = renderModelProfilesPanel({
    models: [],
    providers: [
      { id: 'codex-app-server', kind: 'codex-app-server', label: 'Codex App Server', available: true, authenticated: false, loginModes: ['chatgpt', 'chatgptDeviceCode'], logoutSupported: true },
      { id: 'claude', kind: 'cli', label: 'Claude Code', available: true, authenticated: true, email: 'user@example.test', planType: 'max', loginModes: ['claudeai', 'console'], logoutSupported: true },
    ],
  });

  assert.match(html, /data-provider-auth-action="login"[^>]*data-provider-id="codex-app-server"[^>]*data-provider-login-mode="chatgpt"/);
  assert.match(html, /Sign in with ChatGPT/);
  assert.match(html, /Use device code/);
  assert.match(html, /data-provider-auth-action="logout"[^>]*data-provider-id="claude"/);
  assert.match(html, /user@example\.test/);
  assert.match(html, /Claude Max/);
});

test('settings controller keeps provider login receipts bounded and drives login, refresh, and logout routes', async () => {
  const calls = [];
  const providers = [{ id: 'codex-app-server', label: 'Codex App Server', loginModes: ['chatgpt'], authenticated: false }];
  const api = {
    get: async (path) => path.includes('catalog') ? { categories: [] } : path.includes('effective') ? { value: { experience: { level: 'everyday' } }, provenance: {} } : path.includes('provider-connections') ? providers : { models: [] },
    put: async () => ({}),
    post: async (path, body) => {
      calls.push([path, body]);
      if (path.endsWith('/login')) return { loginId: 'login-1', authUrl: 'https://auth.example.test/start', userCode: 'ABCD-EFGH', launched: true, ignored: 'not surfaced' };
      return { loggedOut: true };
    },
  };
  const controller = createSettingsController({ api });
  await controller.load();
  await controller.startProviderLogin('codex-app-server', 'chatgpt');
  assert.deepEqual(controller.snapshot().providerLogin, {
    providerId: 'codex-app-server',
    type: 'chatgpt',
    loginId: 'login-1',
    authUrl: 'https://auth.example.test/start',
    userCode: 'ABCD-EFGH',
    launched: true,
  });
  await controller.refreshProviders();
  await controller.logoutProvider('codex-app-server');
  assert.deepEqual(calls.map(([path]) => path), [
    '/api/provider-connections/codex-app-server/login',
    '/api/provider-connections/refresh',
    '/api/provider-connections/codex-app-server/logout',
  ]);
  assert.equal(controller.snapshot().providerLogin, null);
});
