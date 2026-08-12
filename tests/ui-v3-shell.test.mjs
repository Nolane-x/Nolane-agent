import test from 'node:test';
import assert from 'node:assert/strict';
import { GLOBAL_DESTINATIONS, createAppShellModel, localizeRouteTitle, renderAppShell } from '../ui-v3/shell/app-shell.mjs';

test('Nolane Agent rail contains exactly the approved top-level destinations', () => {
  assert.deepEqual(GLOBAL_DESTINATIONS.map((item) => item.id), [
    'home', 'missions', 'projects', 'review', 'workroom', 'control-plane', 'search', 'settings',
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
