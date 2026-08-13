import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderModelProfilesPanel } from '../ui-v3/views/settings/model-profiles-panel.mjs';
import { createSettingsController } from '../ui-v3/views/settings/settings-controller.mjs';

test('model catalog auxiliary copy uses the contrast-safe secondary text token', async () => {
  const css = await readFile(new URL('../ui-v3/styles/pages/settings.css', import.meta.url), 'utf8');
  for (const selector of [
    '.setting-number span',
    '.model-profiles-intro .eyebrow',
    '.model-profile-count,.summary-count',
    '.provider-catalog__counts li',
    '.provider-catalog__meta',
    '.provider-catalog__meta strong[data-provider-catalog-state="not-installed"]',
  ]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(css, new RegExp(`${escaped}\\{[^}]*color:var\\(--text-secondary\\)`));
  }
});

test('provider catalog cards preserve their full name and status instead of clipping either in a narrow card', async () => {
  const css = await readFile(new URL('../ui-v3/styles/pages/settings.css', import.meta.url), 'utf8');
  assert.match(css, /\.provider-catalog__list a\{[^}]*flex-direction:column/);
  assert.match(css, /\.provider-catalog__meta\{[^}]*width:100%[^}]*flex-direction:row[^}]*justify-content:space-between/);
  assert.match(css, /\.provider-catalog__meta strong\{[^}]*max-width:none[^}]*overflow:visible[^}]*text-overflow:clip[^}]*white-space:normal/);
});

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
  const html = renderModelProfilesPanel({ models: [{ key: 'codex/gpt-5.6-codex', providerId: 'codex', modelId: 'gpt-5.6-codex', capabilities: {} }], providers: [{ id: 'codex', kind: 'cli', label: 'Codex CLI', available: true, authenticated: true, healthy: true, modelSelection: { mode: 'forwarded' } }] }, { lang: 'vi' });
  assert.match(html, /Thêm model CLI/);
  assert.match(html, /name="modelId"/);
  assert.match(html, /Thêm model/);
  assert.match(html, /data-model-action="discover"/);
  assert.match(html, /data-model-action="set-routing-default"[^>]*data-model-key="codex\/gpt-5\.6-codex"/);
  assert.match(html, /Dùng để định tuyến/);
  assert.doesNotMatch(html, /Not configured|No discovered models/);
});

test('CLI cards expose an explicit safe connection verification after sign-in', async () => {
  const html = renderModelProfilesPanel({
    models: [],
    providers: [{ id: 'github-copilot', kind: 'cli', label: 'GitHub Copilot CLI', available: true, authenticated: false, healthy: false, error: 'connection-test-required', loginModes: ['github'] }],
  });
  assert.match(html, /Sign in to Github Copilot/);
  assert.match(html, /data-model-action="verify-provider"[^>]*data-provider-id="github-copilot"/);
  assert.match(html, /Verify CLI connection/);

  const calls = [];
  const api = {
    get: async (path) => path.includes('catalog') ? { categories: [] } : path.includes('effective') ? { value: { experience: { level: 'everyday' } } } : path.includes('provider-connections') ? [{ id: 'github-copilot', kind: 'cli' }] : { models: [] },
    put: async () => ({}),
    post: async (path, body) => { calls.push([path, body]); return { id: 'github-copilot', healthy: true }; },
  };
  const controller = createSettingsController({ api });
  await controller.load();
  await controller.verifyProvider('github-copilot');
  assert.deepEqual(calls, [['/api/provider-connections/github-copilot/test', {}]]);
  assert.equal(controller.snapshot().errors.length, 0);
});

test('CLI-configured model selection is explicit instead of offering a model field Nolane cannot forward', () => {
  const html = renderModelProfilesPanel({
    models: [],
    providers: [{ id: 'continue-cli', kind: 'cli', label: 'Continue CLI', available: true, authenticated: false, modelSelection: { mode: 'cli-config' } }],
  });
  assert.match(html, /Model is selected in the Continue CLI configuration/);
  assert.doesNotMatch(html, /data-model-action="add"[^>]*data-provider-id="continue-cli"/);
});

test('CLI entries with an externally configured plan policy explain why they are not yet runnable', () => {
  const html = renderModelProfilesPanel({
    models: [],
    providers: [{ id: 'qwen-code', kind: 'cli', label: 'Qwen Code', available: true, authenticated: false, executionSafety: 'external-plan-config-required' }],
  });
  assert.match(html, /Configure Qwen Code plan approval before enabling governed execution/);
  assert.doesNotMatch(html, /data-model-action="verify-provider"[^>]*data-provider-id="qwen-code"/);
});

test('provider cards expose execution, model-selection, and catalog semantics before a model is configured', () => {
  const html = renderModelProfilesPanel({
    models: [],
    providers: [
      { id: 'kiro-cli', kind: 'cli', label: 'Kiro CLI', available: true, authenticated: false, executionSafety: 'verified', modelSelection: { mode: 'cli-config' }, modelDiscovery: { supported: true, live: true } },
      { id: 'cursor-agent', kind: 'cli', label: 'Cursor Agent CLI', available: true, authenticated: false, executionSafety: 'verified', modelSelection: { mode: 'forwarded' }, modelDiscovery: { supported: false, live: false } },
      { id: 'gemini', kind: 'cli', label: 'Gemini CLI', available: true, authenticated: false, executionSafety: 'verified', modelSelection: { mode: 'forwarded' }, modelDiscovery: { supported: true, mode: 'compatibility-catalog', live: false } },
      { id: 'qwen-code', kind: 'cli', label: 'Qwen Code', available: true, authenticated: false, executionSafety: 'external-plan-config-required', modelSelection: { mode: 'forwarded' }, modelDiscovery: { supported: false, live: false } },
    ],
  });

  assert.match(html, /data-provider-fact="execution">Guarded, read-only/);
  assert.match(html, /data-provider-fact="models">Live model catalog/);
  assert.match(html, /data-provider-fact="models">Compatibility model catalog/);
  assert.match(html, /data-provider-fact="models">Add models manually/);
  assert.match(html, /data-provider-fact="execution">Safe plan configuration required/);
  assert.match(renderModelProfilesPanel({ models: [], providers: [{ id: 'kiro-cli', kind: 'cli', label: 'Kiro CLI', executionSafety: 'verified', modelSelection: { mode: 'cli-config' }, modelDiscovery: { supported: true, live: true } }] }, { lang: 'vi' }), /Được bảo vệ, chỉ đọc/);
});

test('provider catalog gives every discovered connector a truthful, direct settings destination', () => {
  const html = renderModelProfilesPanel({
    models: [],
    providers: [
      { id: 'codex', kind: 'cli', label: 'OpenAI Codex CLI', available: true, authenticated: true, healthy: true, executionSafety: 'verified', modelSelection: { mode: 'forwarded' }, modelDiscovery: { supported: true, live: true } },
      { id: 'aider', kind: 'cli', label: 'Aider', available: false, authenticated: false, error: 'not-found', executionSafety: 'external-plan-config-required', modelSelection: { mode: 'forwarded' }, modelDiscovery: { supported: false, live: false } },
      { id: 'openai-api', kind: 'openai-responses', label: 'OpenAI API', configured: false },
    ],
  });

  assert.match(html, /Agents &amp; providers/);
  assert.match(html, /data-provider-catalog-count="cli">2 CLI agents/);
  assert.match(html, /data-provider-catalog-count="api">1 API provider/);
  assert.match(html, /href="#provider-codex"/);
  assert.match(html, /data-provider-catalog-state="ready">Ready/);
  assert.match(html, /data-provider-catalog-state="not-installed">Not installed/);
  assert.match(html, /data-provider-catalog-state="not-configured">Not configured/);
  assert.match(renderModelProfilesPanel({ models: [], providers: [{ id: 'codex', kind: 'cli', label: 'OpenAI Codex CLI', available: true, authenticated: true, healthy: true, executionSafety: 'verified' }] }, { lang: 'vi' }), /Tác nhân &amp; provider/);
});

test('settings controller selects a discovered API model as the provider default', async () => {
  const calls = [];
  const api = {
    get: async (path) => path.includes('catalog') ? { categories: [] } : path.includes('effective') ? { value: { experience: { level: 'everyday' } } } : path.includes('provider-connections') ? [{ id: 'openai-picker', kind: 'openai-responses', configured: true }] : { models: [] },
    put: async () => ({}),
    post: async (path, body) => { calls.push([path, body]); return { config: { model: 'gpt-live' } }; },
  };
  const controller = createSettingsController({ api });
  await controller.load();

  await controller.selectProviderModel('openai-picker', 'gpt-live');

  assert.deepEqual(calls, [['/api/provider-connections/select-model', { providerId: 'openai-picker', modelId: 'gpt-live', testConnection: true }]]);
  assert.equal(controller.snapshot().errors.length, 0);
});

test('settings controller can make a forwarded CLI model the routing default without calling an API-model endpoint', async () => {
  const api = {
    get: async (path) => path.includes('catalog') ? { categories: [] } : path.includes('effective') ? { value: { agent: { model: 'auto' }, experience: { level: 'everyday' } } } : path.includes('provider-connections') ? [{ id: 'codex', kind: 'cli' }] : { models: [] },
    put: async () => ({}),
    post: async () => { throw new Error('routing default should remain a pending settings change'); },
  };
  const controller = createSettingsController({ api });
  await controller.load();
  controller.setRoutingDefault('codex/gpt-5.6-codex');
  const snapshot = controller.snapshot();
  assert.equal(snapshot.draft.agent.model, 'codex/gpt-5.6-codex');
  assert.equal(snapshot.dirty, true);
  assert.match(snapshot.statusMessage, /Routing default set to codex\/gpt-5\.6-codex/);
});

test('API model setup discovers before default selection and exposes an explicit default action', () => {
  const html = renderModelProfilesPanel({
    providers: [{ id: 'openai-picker', kind: 'openai-responses', label: 'OpenAI API', configured: true, authenticated: true, healthy: false, error: 'model-selection-required' }],
    models: [{ providerId: 'openai-picker', modelId: 'gpt-live', displayName: 'GPT Live', capabilities: {}, lifecycle: 'unknown' }],
  });

  assert.doesNotMatch(html, /name="model"[^>]*required/);
  assert.match(html, /Save credentials & discover models/);
  assert.match(html, /data-model-action="select"[^>]*data-provider-id="openai-picker"[^>]*data-model-id="gpt-live"/);
  assert.match(html, /Use as default/);
});

test('settings event router sends an API default-model choice to the controller', async () => {
  const app = await readFile(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');

  assert.match(app, /modelAction\.dataset\.modelAction==='select'[\s\S]{0,160}controller\.selectProviderModel\(modelAction\.dataset\.providerId,modelAction\.dataset\.modelId\)/);
  assert.match(app, /modelAction\.dataset\.modelAction==='set-routing-default'[\s\S]{0,160}controller\.setRoutingDefault\(modelAction\.dataset\.modelKey\)/);
  assert.match(app, /modelAction\.dataset\.modelAction==='verify-provider'[\s\S]{0,120}controller\.verifyProvider\(modelAction\.dataset\.providerId\)/);
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
