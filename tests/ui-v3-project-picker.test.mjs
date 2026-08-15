import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createProjectPickerModel, renderProjectPicker } from '../ui-v3/shell/project-picker.mjs';

const projects = [
  { id: 'nolane', name: 'Nolane Agent', workspaceRoot: 'C:/work/nolane', trusted: true, lastOpenedAt: 20 },
  { id: 'voice', name: 'Vietvoice', workspaceRoot: 'C:/work/vietvoice', trusted: false, lastOpenedAt: 10 },
  { id: 'forge', name: 'ForgeOS', workspaceRoot: 'C:/work/forge', trusted: true, lastOpenedAt: 30 },
];

test('project picker keeps trusted recent projects first and filters by name/path', () => {
  const model = createProjectPickerModel({ projects, selectedProjectId: 'nolane', query: 'forge' });
  assert.deepEqual(model.snapshot().projects.map((item) => item.id), ['forge']);
  assert.equal(model.snapshot().selectedProjectId, 'nolane');
  assert.equal(model.snapshot().newProjectLabel, 'New project');
  assert.equal(model.snapshot().noneLabel, "Don't work in a project");
});

test('project picker renders a Codex-like searchable menu with explicit active state', () => {
  const html = renderProjectPicker({ id: 'home-project-picker', projects, selectedProjectId: 'nolane', language: 'en', open: true });
  assert.match(html, /data-project-picker="home-project-picker"/);
  assert.match(html, /data-project-search/);
  assert.match(html, /data-project-id="nolane"/);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /data-project-action="new"/);
  assert.match(html, /data-project-action="none"/);
});

test('project picker localizes actions and can represent no active project', () => {
  const model = createProjectPickerModel({ projects, selectedProjectId: null, language: 'vi' });
  const snapshot = model.snapshot();
  assert.equal(snapshot.newProjectLabel, 'Dự án mới');
  assert.equal(snapshot.noneLabel, 'Không làm việc trong dự án');
  assert.equal(snapshot.selectedProjectId, '');
  const html = renderProjectPicker({ id: 'sidebar-project-picker', projects, selectedProjectId: null, language: 'vi' });
  assert.match(html, /Dự án mới/);
  assert.match(html, /Không làm việc trong dự án/);
});

test('empty project picker directs people to add a local folder from this workspace', () => {
  const english = renderProjectPicker({ id: 'empty-project-picker', projects: [], language: 'en', open: true });
  const vietnamese = renderProjectPicker({ id: 'empty-project-picker-vi', projects: [], language: 'vi', open: true });

  assert.match(english, /No projects yet\. Add a local folder to give Nolane a workspace\./);
  assert.match(vietnamese, /Chưa có dự án\. Hãy thêm thư mục cục bộ để Nolane có không gian làm việc\./);
  assert.doesNotMatch(`${english}\n${vietnamese}`, /desktop launcher/i);
});

test('project registry owns its Add project action without a duplicate legacy global listener', async () => {
  const source = await readFile(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /action==='add'/);
  assert.match(source, /action==='add'[\s\S]{0,260}nolane:project-create-requested/);
  assert.doesNotMatch(source, /\['new',\s*'add',\s*'none'\]/);
});
