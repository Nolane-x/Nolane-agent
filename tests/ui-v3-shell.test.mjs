import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLOBAL_DESTINATIONS, createAppShellModel, localizeRouteTitle, renderAppShell } from '../ui-v3/shell/app-shell.mjs';

test('Nolane Agent rail contains exactly the approved top-level destinations', () => {
  assert.deepEqual(GLOBAL_DESTINATIONS.map((item) => item.id), [
    'home', 'missions', 'projects', 'review', 'workroom', 'browser', 'control-plane', 'search', 'settings',
  ]);
  const forbidden = ['runtime', 'sandbox', 'secrets', 'repository-intelligence', 'context-memory', 'trace-evidence'];
  assert.equal(GLOBAL_DESTINATIONS.some((item) => forbidden.includes(item.id)), false);
});

test('AppShell keeps rail and sidebar identities stable across route changes', () => {
  const shell = createAppShellModel();
  const initial = shell.snapshot();
  shell.activate('/missions');
  const next = shell.snapshot();
  assert.equal(next.product, 'Nolane Agent');
  assert.equal(next.railInstanceId, initial.railInstanceId);
  assert.equal(next.sidebarInstanceId, initial.sidebarInstanceId);
  assert.equal(next.activePath, '/missions');
});

test('browser workspace is a visible expert destination rather than a hidden control-plane deep link', () => {
  const browser = GLOBAL_DESTINATIONS.find((item) => item.id === 'browser');
  assert.deepEqual(browser && { path: browser.path, minExperience: browser.minExperience, icon: browser.icon }, {
    path: '/browser', minExperience: 'expert', icon: 'globe',
  });
});

test('AppShell localizes the onboarding route title before setup is completed', () => {
  assert.equal(localizeRouteTitle('/onboarding', 'Welcome', 'vi'), 'Chào mừng');
  assert.equal(localizeRouteTitle('/onboarding', 'Welcome', 'en'), 'Welcome');
});

test('AppShell makes global search and local runtime state visible in the desktop command bar', () => {
  const english = renderAppShell({ language: 'en', runtimeState: 'online' });
  const vietnamese = renderAppShell({ language: 'vi', runtimeState: 'offline' });

  assert.match(english, /data-command="global-search"/);
  assert.match(english, /Search projects, files, and conversations…/);
  assert.match(english, /shell-command-search/);
  assert.match(english, /shell-runtime-status[^>]*data-state="online"/);
  assert.match(english, /Local runtime online/);
  assert.match(vietnamese, /Tìm dự án, tệp và cuộc trò chuyện…/);
  assert.match(vietnamese, /Runtime không khả dụng/);
});

test('workspace command bar uses accessible contrast tokens for its visible text and shortcut', async () => {
  const css = await readFile(new URL('../ui-v3/styles/layout/app-shell.css', import.meta.url), 'utf8');
  assert.match(css, /\.shell-command-search\{[^}]*color:var\(--text-secondary\)/);
  assert.match(css, /\.shell-command-search>kbd\{[^}]*color:var\(--text-secondary\)/);
});
