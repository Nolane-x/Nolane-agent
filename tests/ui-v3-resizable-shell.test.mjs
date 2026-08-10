import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAppShell } from '../ui-v3/shell/app-shell.mjs';
import { calculateResize } from '../ui-v3/core/resizable-region.mjs';

test('shell renders keyboard accessible resize separators and two-level switch', () => {
  const html = renderAppShell({ content: '<p>x</p>', experienceLevel: 'research' });
  assert.match(html, /role="separator"/);
  assert.match(html, /aria-orientation="vertical"/);
  assert.match(html, /data-resize-region="sidebar"/);
  assert.match(html, /data-experience-level="research"/);
  assert.equal(calculateResize({ region: 'sidebar', start: 288, delta: 50 }), 338);
  assert.equal(calculateResize({ region: 'sidebar', start: 288, delta: -1000 }), 220);
});

test('Vietnamese shell localizes the sidebar and current route title', () => {
  const html = renderAppShell({ activePath: '/', routeTitle: 'Chat', language: 'vi', content: '<p>x</p>' });
  assert.match(html, /aria-label="Các phiên nhiệm vụ"/);
  assert.match(html, /<small>Không gian làm việc AI<\/small>/);
  assert.match(html, /app-topbar__title">Trò chuyện<\/div>/);
  assert.doesNotMatch(html, /Mission sessions|Agent workspace|app-topbar__title">Chat<\/div>/);
});

test('shell renders a project picker and a real sidebar collapse contract', () => {
  const html = renderAppShell({
    content: '<p>x</p>',
    projects: [{ id: 'p1', name: 'Nolane Agent', workspaceRoot: 'C:/work/nolane' }],
    selectedProjectId: 'p1',
    sidebarCollapsed: true,
  });
  assert.match(html, /data-project-picker="sidebar-project-picker"/);
  assert.match(html, /data-command="collapse-sidebar"/);
  assert.match(html, /data-sidebar-collapsed="true"/);
  assert.match(html, /data-command="open-sidebar"/);
});
