import test from 'node:test';
import assert from 'node:assert/strict';

import { renderProjectCreateDialog } from '../ui-v3/components/project-create-dialog.mjs';

test('project creation dialog provides an accessible local-folder fallback outside Electron', () => {
  const html = renderProjectCreateDialog({ language: 'en', canBrowse: false });

  assert.match(html, /<dialog[^>]*aria-modal="true"/);
  assert.match(html, /name="workspaceRoot"/);
  assert.match(html, /Enter the full path/i);
  assert.match(html, /type="submit"/);
  assert.doesNotMatch(html, /data-project-select-directory/);
});

test('project creation dialog retains native browsing when the desktop bridge is available', () => {
  const html = renderProjectCreateDialog({ language: 'vi', canBrowse: true });

  assert.match(html, /data-project-select-directory/);
  assert.match(html, /Thêm dự án/);
});
