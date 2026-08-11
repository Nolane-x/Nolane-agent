import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserWorkspaceController, renderBrowserWorkspace } from '../ui-v3/views/browser/browser-view.mjs';

function createApi(fixtures = {}) {
  const calls = [];
  return {
    calls,
    async get(path) {
      calls.push({ method: 'GET', path });
      if (Object.hasOwn(fixtures, path)) {
        const value = fixtures[path];
        if (value instanceof Error) throw value;
        return structuredClone(value);
      }
      return {};
    },
    async post(path, body) {
      calls.push({ method: 'POST', path, body });
      if (Object.hasOwn(fixtures, path)) {
        const value = fixtures[path];
        if (value instanceof Error) throw value;
        return structuredClone(value);
      }
      return {};
    },
  };
}

test('Browser workspace loads bounded runtime, session, tabs, and permission state', async () => {
  const api = createApi({
    '/api/browser/runtime': { available: true, installed: true, version: '1.2.3', state: 'ready' },
    '/api/browser/detect': { available: true, version: '1.2.3', driver: 'playwright-cli' },
    '/api/browser/status?projectId=project-a': { available: true, sessionName: 'forge-project-a', sessions: [{ name: 'tab-1', url: 'https://example.test/?token=must-never-render', title: 'Example' }] },
    '/api/browser/tabs': { available: true, tabs: [{ id: 'tab-1', url: 'https://example.test/?token=must-never-render', title: 'Example' }] },
    '/api/permissions/browser?goalId=mission-a': { goalId: 'mission-a', actions: ['open', 'snapshot'], denied: ['fill', 'type'] },
  });
  const controller = createBrowserWorkspaceController({ api, projectId: 'project-a', missionId: 'mission-a', language: 'vi-VN' });
  await controller.load();
  const snapshot = controller.snapshot();
  const html = renderBrowserWorkspace(snapshot);

  assert.equal(snapshot.status, 'ready');
  assert.equal(snapshot.language, 'vi');
  assert.equal(snapshot.tabs.length, 1);
  assert.equal(snapshot.tabs[0].title, 'Example');
  assert.match(html, /Không gian trình duyệt/);
  assert.match(html, /example\.test/);
  assert.match(html, /fill/);
  assert.match(html, /Làm mới/);
  assert.doesNotMatch(html, /apiKey|password|must-never-render|cookie/i);
  assert.ok(api.calls.some((call) => call.path === '/api/browser/status?projectId=project-a'));
});

test('Browser workspace renders empty and offline states without inventing a session', async () => {
  const api = createApi({
    '/api/browser/runtime': { ready: false, version: '0.1.17', reason: 'not-installed' },
    '/api/browser/detect': { available: false, reason: 'driver missing' },
    '/api/browser/status?projectId=project-a': new Error('Playwright CLI is not installed'),
    '/api/browser/tabs': new Error('Playwright CLI is not installed'),
    '/api/permissions/browser?goalId=mission-a': { goalId: 'mission-a', actions: [], denied: [] },
  });
  const controller = createBrowserWorkspaceController({ api, projectId: 'project-a', missionId: 'mission-a', language: 'en' });
  await controller.load();
  const snapshot = controller.snapshot();
  const html = renderBrowserWorkspace(snapshot);

  assert.equal(snapshot.status, 'offline');
  assert.equal(snapshot.tabs.length, 0);
  assert.match(html, /Browser runtime unavailable/);
  assert.match(html, /No active browser session/);
  assert.doesNotMatch(html, /tab-1|example\.test/);
});

test('Browser workspace close action is explicit and scoped to the selected project', async () => {
  const api = createApi({
    '/api/browser/runtime': { available: true, installed: true },
    '/api/browser/detect': { available: true },
    '/api/browser/status?projectId=project-a': { available: true, sessions: [{ name: 'tab-1', url: 'about:blank', title: '' }] },
    '/api/browser/tabs': { available: true, tabs: [] },
    '/api/permissions/browser?goalId=mission-a': { actions: [], denied: [] },
    '/api/browser/close': { available: true, output: 'closed' },
  });
  const controller = createBrowserWorkspaceController({ api, projectId: 'project-a', missionId: 'mission-a' });
  await controller.load();
  await controller.close();
  const closeCall = api.calls.find((call) => call.path === '/api/browser/close');
  assert.deepEqual(closeCall.body, { projectId: 'project-a' });
  assert.equal(controller.snapshot().sessionOpen, false);
});

test('Browser workspace starts a visible project session and keeps sensitive URL parameters out of the UI', async () => {
  const api = createApi({
    '/api/browser/runtime': { available: true, installed: true },
    '/api/browser/detect': { available: true, driver: 'playwright-cli' },
    '/api/browser/status?projectId=project-a': { available: true, sessions: [{ name: 'tab-1', url: 'https://example.test', title: 'Example' }] },
    '/api/browser/tabs': { available: true, tabs: [{ id: 'tab-1', url: 'https://example.test', title: 'Example' }] },
    '/api/permissions/browser?goalId=mission-a': { allowedActions: ['open', 'goto', 'screenshot'], denied: [] },
    '/api/browser/open': { available: true, sessionName: 'forge-project-a', headed: true, persistent: true },
  });
  const controller = createBrowserWorkspaceController({ api, projectId: 'project-a', missionId: 'mission-a' });
  await controller.load();
  controller.setUrl('https://example.test/work?token=must-never-render&view=overview');
  await controller.open();

  const openCall = api.calls.find((call) => call.path === '/api/browser/open');
  assert.deepEqual(openCall.body, { projectId: 'project-a', url: 'https://example.test/work?view=overview', headed: true, persistent: true });
  const html = renderBrowserWorkspace(controller.snapshot());
  assert.match(html, /Open browser/);
  assert.match(html, /Go to URL/);
  assert.match(html, /Sign in directly in the visible browser window/);
  assert.doesNotMatch(html, /must-never-render|token=/i);
  assert.doesNotMatch(html, /type="password"|cookie/i);
});

test('Browser workspace escapes project, tab, and error content before rendering', async () => {
  const projectId = '<project>'; const api = createApi({
    '/api/browser/runtime': { ready: true },
    '/api/browser/detect': { available: true },
    [`/api/browser/status?projectId=${encodeURIComponent(projectId)}`]: new Error('bad <script>alert(1)</script>'),
    '/api/browser/tabs': { tabs: [{ id: '1', title: '<tab>', url: 'https://example.test/?q=%3Cunsafe%3E' }] },
  });
  const controller = createBrowserWorkspaceController({ api, projectId });
  await controller.load();
  const html = renderBrowserWorkspace(controller.snapshot());
  assert.doesNotMatch(html, /<script>|<tab>/i);
  assert.match(html, /&lt;project&gt;/);
});

test('Browser workspace captures and renders a bounded project-scoped screenshot artifact', async () => {
  const api = createApi({
    '/api/browser/runtime': { ready: true },
    '/api/browser/detect': { available: true },
    '/api/browser/status?projectId=project-a': { available: true, sessions: [{ name: 'tab-1', url: 'https://example.test', title: 'Example' }] },
    '/api/browser/tabs': { tabs: [{ id: 'tab-1', url: 'https://example.test', title: 'Example' }] },
    '/api/permissions/browser?goalId=mission-a': { allowedActions: ['screenshot', 'close', 'status', 'tabs'], readActions: ['screenshot', 'close', 'status', 'tabs'], writeActions: [] },
    '/api/browser/screenshot': { available: true, artifactPath: 'workspace.png' },
    '/api/browser/artifact': { available: true, mimeType: 'image/png', bytes: 5, contentBase64: 'aW1hZ2U=', sha256: 'a'.repeat(64) },
  });
  const controller = createBrowserWorkspaceController({ api, projectId: 'project-a', missionId: 'mission-a' });
  await controller.load();
  await controller.captureScreenshot();
  const html = renderBrowserWorkspace(controller.snapshot());
  const screenshotCall = api.calls.find((call) => call.path === '/api/browser/screenshot');
  const artifactCall = api.calls.find((call) => call.path === '/api/browser/artifact');
  assert.deepEqual(screenshotCall.body, { projectId: 'project-a', filename: 'workspace.png' });
  assert.deepEqual(artifactCall.body, { projectId: 'project-a', filename: 'workspace.png' });
  assert.match(html, /data:image\/png;base64,aW1hZ2U=/);
  assert.match(html, /Screenshot/);
});

test('Browser workspace keeps user-operated screenshots available when an agent goal omits that read action', async () => {
  const api = createApi({
    '/api/browser/runtime': { ready: true },
    '/api/browser/detect': { available: true },
    '/api/browser/status?projectId=project-a': { available: true, sessions: [{ name: 'tab-1', url: 'https://example.test', title: 'Example' }] },
    '/api/browser/tabs': { tabs: [{ id: 'tab-1', url: 'https://example.test', title: 'Example' }] },
    '/api/permissions/browser?goalId=mission-a': { allowedActions: ['open', 'snapshot'], denied: ['screenshot'] },
    '/api/browser/screenshot': { available: true, artifactPath: 'workspace.png' },
    '/api/browser/artifact': { available: true, mimeType: 'image/png', bytes: 5, contentBase64: 'aW1hZ2U=', sha256: 'b'.repeat(64) },
  });
  const controller = createBrowserWorkspaceController({ api, projectId: 'project-a', missionId: 'mission-a' });
  await controller.load();
  await controller.captureScreenshot();

  assert.deepEqual(api.calls.find((call) => call.path === '/api/browser/screenshot')?.body, { projectId: 'project-a', filename: 'workspace.png' });
  assert.equal(controller.snapshot().screenshot.status, 'ready');
});
