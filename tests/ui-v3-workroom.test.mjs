import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorkroomModel, renderWorkroomView } from '../ui-v3/views/workroom/workroom-view.mjs';
import { createFileTreeModel } from '../ui-v3/views/workroom/file-tree.mjs';
import { createEditorHost } from '../ui-v3/views/workroom/editor-host.mjs';
import { createTerminalHost } from '../ui-v3/views/workroom/terminal-host.mjs';

test('Workroom preserves mission route continuity and panel state', () => {
  const model = createWorkroomModel({ projectId: 'p1', missionId: 'm1', returnPath: '/missions/m1' });
  model.setPanel('files', false); model.setPanelSize('agent', 420); model.openFile('src/a.mjs');
  const value = model.snapshot();
  assert.equal(value.returnPath, '/missions/m1');
  assert.equal(value.panels.files.open, false);
  assert.equal(value.panels.agent.size, 420);
  assert.equal(value.activeFile, 'src/a.mjs');
});

test('Workroom renders a real project tree and editable file surface in both locales', () => {
  const model = createWorkroomModel({ projectId: 'p1', language: 'en' });
  model.setTree([{ name: 'src', path: 'src', type: 'directory' }, { name: 'main.mjs', path: 'src/main.mjs', type: 'file', bytes: 21 }]);
  model.setFile({ path: 'src/main.mjs', content: 'export const ok = true;', bytes: 23, sha256: 'a'.repeat(64) });
  model.setDraftContent('export const ok = false;');
  const english = renderWorkroomView(model.snapshot(), { language: 'en' });
  assert.match(english, /data-workroom-directory="src"/);
  assert.match(english, /data-workroom-file="src\/main\.mjs"/);
  assert.match(english, /data-workroom-editor/);
  assert.match(english, />Save<\/button>/);
  const vietnamese = renderWorkroomView(model.snapshot(), { language: 'vi' });
  assert.match(vietnamese, />Tệp<\/strong>/);
  assert.match(vietnamese, />Lưu<\/button>/);
  assert.doesNotMatch(vietnamese, /Back to mission|Filter files|No file open|Save<\/button>/);
});

test('Workroom diff and preview tabs are bounded and use the selected draft', () => {
  const model = createWorkroomModel({ projectId: 'p1' });
  model.setFile({ path: 'README.md', content: 'old', bytes: 3, sha256: 'b'.repeat(64) });
  model.setDraftContent('new');
  model.setDiff({ path: 'README.md', original: 'old', modified: 'new', changed: true });
  model.setTab('changes');
  const diff = renderWorkroomView(model.snapshot());
  assert.match(diff, /Original/);
  assert.match(diff, /Draft/);
  assert.match(diff, /new/);
  model.setTab('preview');
  assert.match(renderWorkroomView(model.snapshot()), /<div class="workroom-preview">[\s\S]*new/);
});

test('Workroom renders a bounded, interactive terminal surface after a local session opens', () => {
  const model = createWorkroomModel({ projectId: 'p1' });
  model.setTerminal({ id: 'terminal-1', title: 'pwsh', status: 'connected' });
  model.setAgentTab('terminal');
  model.appendTerminalOutput('PS C:\\work> ');
  const html = renderWorkroomView(model.snapshot());
  assert.match(html, /data-workroom-agent-tab="terminal"/);
  assert.match(html, /data-workroom-terminal-output/);
  assert.match(html, /PS C:\\work&gt; /);
  assert.match(html, /data-workroom-terminal-form/);
});

test('Workroom opens the governed terminal socket only from an explicit terminal action', async () => {
  const source = await readFile(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /createTerminalClient/);
  assert.match(source, /request\('create', \{ projectId: project\.id, shell, cwd: '\.'[,}]?/);
  assert.match(source, /request\('input', \{ sessionId: current\.id, data:/);
  assert.match(source, /request\('terminate', \{ sessionId: current\.id \}\)/);
});

test('Workroom terminal inherits the configured application color tokens', async () => {
  const css = await readFile(new URL('../ui-v3/styles/pages/workroom-terminal.css', import.meta.url), 'utf8');
  assert.match(css, /\.workroom-terminal pre\{[^}]*background:var\(--surface-canvas\);color:var\(--text-primary\)/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
});

test('file tree windows large repositories and preserves keyed nodes', () => {
  const tree = createFileTreeModel();
  tree.update(Array.from({ length: 5000 }, (_, index) => ({ id: `n${index}`, path: `src/f${index}.mjs`, kind: 'file' })));
  const first = tree.snapshot({ offset: 4990, limit: 10 });
  const key = first.nodeKeys.get('n4999');
  tree.update([{ id: 'n4999', path: 'src/f4999.mjs', kind: 'file', changed: true }]);
  const second = tree.snapshot({ offset: 4990, limit: 10 });
  assert.equal(second.total, 5000);
  assert.equal(second.nodes.length, 10);
  assert.equal(second.nodeKeys.get('n4999'), key);
});

test('editor and terminal hosts load lazily and enforce local resource bounds', async () => {
  let editorLoads = 0;
  const editor = createEditorHost({ loader: async () => ({ name: 'Monaco' }), maxModels: 4, onLoad: () => editorLoads++ });
  await editor.open({ path: 'a.mjs', content: 'a' });
  await editor.open({ path: 'b.mjs', content: 'b' });
  assert.equal(editorLoads, 1);
  assert.equal(editor.snapshot().models.length, 2);

  const terminal = createTerminalHost({ maxVisible: 2 });
  terminal.register({ id: 't1' }); terminal.register({ id: 't2' }); terminal.register({ id: 't3' });
  terminal.show('t1'); terminal.show('t2'); terminal.show('t3');
  const snapshot = terminal.snapshot();
  assert.deepEqual(snapshot.visible, ['t2', 't3']);
  assert.equal(snapshot.sessions.find((item) => item.id === 't1').suspended, true);
});
