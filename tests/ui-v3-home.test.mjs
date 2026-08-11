import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { INTENT_PRESETS, createMissionRequest } from '../ui-v3/core/intent-presets.mjs';
import { buildHomeViewModel, createHomeController, modelDeploymentKey, renderHomeView } from '../ui-v3/views/home/home-view.mjs';

test('four intent presets map to enforceable backend boundaries', () => {
  assert.deepEqual(Object.keys(INTENT_PRESETS), ['ask', 'plan', 'build', 'verify']);
  assert.equal(INTENT_PRESETS.ask.writeFiles, false);
  assert.equal(INTENT_PRESETS.plan.executeChanges, false);
  assert.equal(INTENT_PRESETS.build.writeFiles, true);
  assert.equal(INTENT_PRESETS.verify.expandScope, false);
});

test('mission request validates objective, project and provider availability', () => {
  assert.throws(() => createMissionRequest({ objective: '', projectId: 'p1' }), /objective/i);
  assert.throws(() => createMissionRequest({ objective: 'Fix tests', projectId: '' }), /project/i);
  assert.throws(() => createMissionRequest({ objective: 'Fix tests', projectId: 'p1', providerState: 'unavailable' }), /provider/i);
  const request = createMissionRequest({ objective: 'Fix tests', projectId: 'p1', intent: 'build', modelChoice: 'auto' });
  assert.equal(request.product, 'Nolane Agent');
  assert.equal(request.intent, 'build');
  assert.equal(request.boundaries.writeFiles, true);
});

test('repository suggestions render only when backed by evidence', () => {
  const hidden = buildHomeViewModel({ repositoryState: 'indexing', suggestions: [{ title: 'Fix tests', evidenceIds: [] }] });
  assert.deepEqual(hidden.suggestions, []);
  const visible = buildHomeViewModel({ repositoryState: 'ready', suggestions: [{ title: 'Fix 3 tests', evidenceIds: ['e1'] }, { title: 'Generic', evidenceIds: [] }] });
  assert.deepEqual(visible.suggestions.map((item) => item.title), ['Fix 3 tests']);
});

test('home composer preserves a distinct deployment key for every provider model', () => {
  const models = [
    { key: 'codex/cli-selected', providerId: 'codex', modelId: 'cli-selected', displayName: 'Codex selected' },
    { key: 'claude/claude-sonnet', providerId: 'claude', modelId: 'claude-sonnet', displayName: 'Claude Sonnet' },
    { key: 'gemini/gemini-2.5-pro', providerId: 'gemini', modelId: 'gemini-2.5-pro', displayName: 'Gemini Pro' },
    { key: 'opencode/default', providerId: 'opencode', modelId: 'default', displayName: 'OpenCode' },
    { key: 'codex-app-server/gpt-5.6-sol', providerId: 'codex-app-server', modelId: 'gpt-5.6-sol', displayName: 'GPT-5.6 Sol' },
  ];
  const html = renderHomeView(buildHomeViewModel({ models }));
  const modelMenu = html.match(/data-composer-picker="modelChoice"[\s\S]*?<div id="composer-modelChoice-menu"[\s\S]*?<\/div>/)?.[0] ?? '';
  const values = [...modelMenu.matchAll(/data-composer-picker-option[^>]*data-picker-value="([^"]+)"/g)].map(([, value]) => value);

  assert.ok(values.includes('auto'));
  assert.deepEqual(values.slice(1), models.map(modelDeploymentKey));
  assert.equal(new Set(values).size, values.length);
  assert.match(html, /<strong>Codex selected<\/strong><small>codex · cli-selected<\/small>/);
  assert.match(html, /<strong>GPT-5\.6 Sol<\/strong><small>codex-app-server · gpt-5\.6-sol<\/small>/);
  assert.doesNotMatch(html, /<select\b/);
});

test('home composer keeps every ready discovered model selectable', () => {
  const models = Array.from({ length: 51 }, (_value, index) => ({
    providerId: 'codex', modelId: `model-${index + 1}`, displayName: `Model ${index + 1}`,
  }));
  const html = renderHomeView(buildHomeViewModel({
    providers: [{ id: 'codex', available: true, authenticated: true, healthy: true }],
    models,
  }));
  const modelMenu = html.match(/data-composer-picker="modelChoice"[\s\S]*?<div id="composer-modelChoice-menu"[\s\S]*?<\/div>/)?.[0] ?? '';

  assert.match(modelMenu, /data-picker-value="codex\/model-51"/);
});

test('home composer offers only ready provider deployments and disables send until a provider is usable', () => {
  const html = renderHomeView(buildHomeViewModel({
    projects: [{ id: 'p1', name: 'Project' }],
    providers: [
      { id: 'ready', available: true, authenticated: true, healthy: true },
      { id: 'login-required', available: true, authenticated: false, healthy: false },
      { id: 'plan-required', available: true, authenticated: true, healthy: true, executionSafety: 'external-plan-config-required' },
    ],
    models: [
      { providerId: 'ready', modelId: 'safe-model', displayName: 'Safe model' },
      { providerId: 'login-required', modelId: 'blocked-model', displayName: 'Blocked model' },
      { providerId: 'plan-required', modelId: 'unsafe-model', displayName: 'Unsafe model' },
    ],
  }));
  const modelMenu = html.match(/data-composer-picker="modelChoice"[\s\S]*?<div id="composer-modelChoice-menu"[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.match(modelMenu, /data-picker-value="ready\/safe-model"/);
  assert.doesNotMatch(modelMenu, /login-required\/blocked-model|plan-required\/unsafe-model/);

  const blocked = renderHomeView(buildHomeViewModel({
    projects: [{ id: 'p1', name: 'Project' }],
    providers: [{ id: 'login-required', available: true, authenticated: false, healthy: false }],
  }));
  assert.match(blocked, /class="composer-submit" type="submit" disabled/);
});

test('home composer preserves an unavailable saved model instead of silently routing it automatically', () => {
  const html = renderHomeView(buildHomeViewModel({
    projects: [{ id: 'p1', name: 'Project' }],
    selectedModel: 'login-required/blocked-model',
    providers: [
      { id: 'ready', available: true, authenticated: true, healthy: true },
      { id: 'login-required', available: true, authenticated: false, healthy: false },
    ],
    models: [
      { providerId: 'ready', modelId: 'safe-model', displayName: 'Safe model' },
      { providerId: 'login-required', modelId: 'blocked-model', displayName: 'Blocked model' },
    ],
  }));
  const modelMenu = html.match(/data-composer-picker="modelChoice"[\s\S]*?<div id="composer-modelChoice-menu"[\s\S]*?<\/div>/)?.[0] ?? '';

  assert.match(html, /<input type="hidden" name="modelChoice" value="login-required\/blocked-model"/);
  assert.match(html, /data-picker-label="Blocked model — Not ready"/);
  assert.match(modelMenu, /data-picker-value="login-required\/blocked-model"[^>]*aria-selected="true"[^>]*disabled/);
  assert.match(modelMenu, /<small>login-required · blocked-model · Not ready<\/small>/);
  assert.match(html, /class="composer-submit" type="submit" disabled/);
});

test('home uses a compact task-first composition instead of an oversized generic hero', async () => {
  const html = renderHomeView(buildHomeViewModel());
  const styles = await readFile(new URL('../ui-v3/styles/pages/home.css', import.meta.url), 'utf8');
  assert.match(html, /class="home-intro"/);
  assert.doesNotMatch(html, /home-ambient|home-hero/);
  assert.match(styles, /\.home-intro\{display:grid/);
  assert.match(styles, /font-size:clamp\(32px,3\.6vw,52px\)/);
  assert.doesNotMatch(styles, /font-size:clamp\(38px,5\.2vw,72px\)/);
});

test('home composer sends provider and model separately for the selected deployment', async () => {
  const calls = [];
  const api = {
    async get(path) {
      if (path === '/api/projects') return [{ id: 'p1', name: 'Project' }];
      if (path === '/api/model-profiles') return [{ key: 'codex-app-server/gpt-5.6-sol', providerId: 'codex-app-server', modelId: 'gpt-5.6-sol', displayName: 'GPT-5.6 Sol' }];
      if (path === '/api/provider-connections') return [{ id: 'codex-app-server', state: 'ready' }];
      return [];
    },
    async post(path, body) { calls.push([path, body]); return { id: 'mission-1', objective: body.objective }; },
  };
  const controller = createHomeController({ api });
  await controller.load();
  await controller.submit({ objective: 'Plan this', projectId: 'p1', modelChoice: 'codex-app-server/gpt-5.6-sol' });
  assert.deepEqual(calls, [['/api/missions/plan', { projectId: 'p1', objective: 'Plan this', planningProviderId: 'codex-app-server', planningModelId: 'gpt-5.6-sol', deploymentKey: 'codex-app-server/gpt-5.6-sol', mcpAllowedTools: [] }]]);
});

test('home composer turns an explicit Skill selection into a removable mission context receipt request', async () => {
  const calls = [];
  const api = {
    async get(path) {
      if (path === '/api/projects') return [{ id: 'p1', name: 'Project' }];
      if (path === '/api/provider-connections') return [{ id: 'codex', state: 'ready' }];
      if (path === '/api/skills/catalog?limit=120') return [{ id: 'browser-audit', title: 'Browser audit', source: 'nolane', catalog: 'local' }];
      return [];
    },
    async post(path, body) { calls.push([path, body]); return { id: 'mission-1', objective: body.objective }; },
  };
  const controller = createHomeController({ api });
  await controller.load();
  controller.addSkill('browser-audit');
  const html = renderHomeView(controller.snapshot());
  assert.match(html, /Browser audit/);
  assert.match(html, /data-selected-skill-remove="browser-audit"/);
  await controller.submit({ objective: 'Review this flow', projectId: 'p1' });
  assert.deepEqual(calls, [['/api/missions/plan', { projectId: 'p1', objective: 'Review this flow', planningProviderId: 'auto', mcpAllowedTools: [], skillIds: ['browser-audit'] }]]);
});

test('home composer rejects an unavailable selected model before making a mission request', async () => {
  const calls = [];
  const api = {
    async get(path) {
      if (path === '/api/projects') return [{ id: 'p1', name: 'Project' }];
      if (path === '/api/provider-connections') return [{ id: 'cline', available: true, authenticated: false, healthy: false }];
      if (path === '/api/model-profiles') return [{ key: 'cline/claude-sonnet', providerId: 'cline', modelId: 'claude-sonnet', displayName: 'Claude Sonnet' }];
      return [];
    },
    async post(path, body) { calls.push([path, body]); return { id: 'mission-1' }; },
  };
  const controller = createHomeController({ api, language: 'vi' });
  await controller.load();
  await assert.rejects(() => controller.submit({ objective: 'Lập kế hoạch', projectId: 'p1', modelChoice: 'cline/claude-sonnet' }), /chưa sẵn sàng/);
  assert.deepEqual(calls, []);
  assert.equal(controller.snapshot().error, 'Model đã chọn chưa sẵn sàng. Hãy đăng nhập hoặc kiểm tra provider trước khi gửi.');
});

test('Vietnamese home renders composer labels without leftover English copy', () => {
  const html = renderHomeView(buildHomeViewModel({ language: 'vi', providers: [{ state: 'ready' }] }));
  assert.match(html, /aria-label="Dự án"/);
  assert.match(html, /Không có dự án khả dụng/);
  assert.match(html, /1 provider sẵn sàng/);
  assert.match(html, /Mục tiêu nhiệm vụ/);
  assert.match(html, /data-picker-label="Hỏi"/);
  assert.doesNotMatch(html, /No project available|1 provider ready|Mission objective|>Ask<\/option>/);
});

test('English home keeps composer menus free of Vietnamese copy', () => {
  const html = renderHomeView(buildHomeViewModel({
    language: 'en',
    menu: { type: 'command', query: '' },
    providers: [{ state: 'ready' }],
  }));
  assert.match(html, /aria-label="Commands"/);
  assert.match(html, /Run a command/);
  assert.match(html, /Ask without changing files/);
  assert.doesNotMatch(html, /Thêm ngữ cảnh|Chạy một lệnh|Không có mục phù hợp|Hỏi mà không đổi tệp/);
});

test('Vietnamese composer command menu translates local commands and empty state', () => {
  const menu = renderHomeView(buildHomeViewModel({ language: 'vi', menu: { type: 'command', query: 'missing' } }));
  assert.match(menu, /aria-label="Lệnh"/);
  assert.match(menu, /Chạy một lệnh/);
  assert.match(menu, /Không có mục phù hợp/);
  const commands = renderHomeView(buildHomeViewModel({ language: 'vi', menu: { type: 'command', query: 'hỏi' } }));
  assert.match(commands, /Hỏi mà không đổi tệp/);
  assert.doesNotMatch(commands, /Ask without changing files|Run a command|No matching items/);
});

test('home counts only authenticated healthy providers as ready', () => {
  const html = renderHomeView(buildHomeViewModel({ providers: [
    { id: 'healthy', available: true, authenticated: true, healthy: true },
    { id: 'missing-auth', available: true, authenticated: false, healthy: false },
    { id: 'legacy-ready', state: 'ready' },
  ] }));
  assert.match(html, /2 providers ready/);
});

test('composer context menu exposes ForgeOS skills and keeps provenance visible', () => {
  const html = renderHomeView(buildHomeViewModel({
    menu: { type: 'context', query: '' },
    skills: [{ id: 'forgeos:v2:browser', name: 'Browser control', source: 'ForgeOS v2', maturity: 'candidate' }],
  }));
  assert.match(html, /Browser control/);
  assert.match(html, /ForgeOS v2 · candidate/);
  assert.match(html, /data-menu-kind="skill"/);
});

test('composer project creation event is wired to the desktop picker', async () => {
  const source = await readFile(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /addEventListener\('nolane:project-create-requested',\s*requestProjectCreation\)/);
});

test('composer surfaces planning-input failures instead of a generic internal error', async () => {
  const api = {
    async get(path) {
      if (path === '/api/projects') return [{ id: 'p1', name: 'Project' }];
      if (path === '/api/provider-connections') return [{ id: 'codex', state: 'ready' }];
      return [];
    },
    async post() { throw Object.assign(new Error('Planning requires additional user input'), { payload: { code: 'PLANNING_INPUT_REQUIRED' } }); },
  };
  const controller = createHomeController({ api, language: 'vi' });
  await controller.load();
  await assert.rejects(() => controller.submit({ objective: 'xin chào', projectId: 'p1' }), /Planning requires additional user input/);
  assert.equal(controller.snapshot().error, 'Mục tiêu cần rõ kết quả mong muốn, hành vi bị ảnh hưởng và điều kiện thành công.');
});

test('composer explains a temporary runtime admission block', async () => {
  const api = {
    async get(path) {
      if (path === '/api/projects') return [{ id: 'p1', name: 'Project' }];
      if (path === '/api/provider-connections') return [{ id: 'codex', state: 'ready' }];
      return [];
    },
    async post() { throw Object.assign(new Error('Runtime is temporarily conserving resources. Try again shortly.'), { payload: { code: 'RUNTIME_ADMISSION_BLOCKED' } }); },
  };
  const controller = createHomeController({ api, language: 'vi' });
  await controller.load();
  await assert.rejects(() => controller.submit({ objective: 'Plan this safely', projectId: 'p1' }), /Runtime is temporarily conserving resources/);
  assert.equal(controller.snapshot().error, 'Runtime đang giảm tải để bảo vệ bộ nhớ. Hãy chờ một lát rồi thử lại.');
});
