import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkroomModel } from '../ui-v3/views/workroom/workroom-view.mjs';
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
