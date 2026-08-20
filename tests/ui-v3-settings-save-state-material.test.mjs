import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderSettingsView } from '../ui-v3/views/settings/settings-view.mjs';

function state(overrides = {}) {
  return {
    status: 'ready',
    visibleCategories: [],
    query: '',
    activeCategory: null,
    experience: 'workspace',
    draft: { general: { language: 'en' } },
    provenance: {},
    layer: 'user',
    projectId: null,
    action: null,
    saving: false,
    dirty: false,
    warnings: [],
    errors: [],
    statusMessage: 'Settings are ready.',
    ...overrides,
  };
}

test('Settings save control exposes explicit saved dirty and saving semantics', () => {
  const saved = renderSettingsView(state());
  const dirty = renderSettingsView(state({ dirty: true }));
  const saving = renderSettingsView(state({ dirty: true, saving: true }));

  assert.match(saved, /data-settings-action="save"[^>]*data-settings-save-state="saved"[^>]*disabled/);
  assert.doesNotMatch(saved, /class="primary"[^>]*data-settings-action="save"/);
  assert.match(saved, />Saved<\/button>/);

  assert.match(dirty, /class="primary"[^>]*data-settings-action="save"[^>]*data-settings-save-state="dirty"/);
  assert.doesNotMatch(dirty, /data-settings-action="save"[^>]*disabled/);
  assert.match(dirty, />Save changes<\/button>/);

  assert.match(saving, /data-settings-action="save"[^>]*data-settings-save-state="saving"[^>]*disabled/);
  assert.doesNotMatch(saving, /class="primary"[^>]*data-settings-action="save"/);
  assert.match(saving, />Saving…<\/button>/);
});

test('Settings saved and saving states have bounded material treatments distinct from dirty primary', async () => {
  const css = await readFile(new URL('../ui-v3/styles/pages/settings.css', import.meta.url), 'utf8');
  assert.match(css, /\.settings-actions>button\[data-settings-save-state="saved"\]\{[^}]*background:var\(--surface-raised\)[^}]*color:var\(--text-secondary\)/);
  assert.match(css, /\.settings-actions>button\[data-settings-save-state="saving"\]\{[^}]*background:var\(--accent-soft\)[^}]*color:var\(--text-primary\)/);
  assert.match(css, /\.settings-actions>button\.primary\[data-settings-save-state="dirty"\]\{[^}]*background:var\(--accent\)/);
});

test('Vietnamese save-state labels preserve the same semantic material states', () => {
  const base = state({ draft: { general: { language: 'vi' } } });
  const saved = renderSettingsView(base);
  const dirty = renderSettingsView({ ...base, dirty: true });
  const saving = renderSettingsView({ ...base, dirty: true, saving: true });
  assert.match(saved, /data-settings-save-state="saved"[^>]*disabled[^>]*>Đã lưu<\/button>/);
  assert.match(dirty, /data-settings-save-state="dirty"[^>]*>Lưu thay đổi<\/button>/);
  assert.match(saving, /data-settings-save-state="saving"[^>]*disabled[^>]*>Đang lưu…<\/button>/);
});
