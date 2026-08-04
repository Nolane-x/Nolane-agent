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
