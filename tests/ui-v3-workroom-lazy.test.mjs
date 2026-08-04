import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkroomController } from '../ui-v3/views/workroom/workroom-controller.mjs';

test('workroom loads editor and terminal only when opened and destroys resources', async () => {
  const events = [];
  const controller = createWorkroomController({
    projectId: 'p1', missionId: 'm1',
    loadEditor: async () => ({ open: (path) => events.push(['editor-open', path]), destroy: () => events.push(['editor-destroy']) }),
    loadTerminal: async () => ({ open: (id) => events.push(['terminal-open', id]), destroy: () => events.push(['terminal-destroy']) }),
  });
  assert.deepEqual(controller.snapshot().loaded, []);
  await controller.openFile('src/a.mjs');
  assert.deepEqual(events, [['editor-open', 'src/a.mjs']]);
  await controller.openTerminal('t1');
  assert.deepEqual(events.at(-1), ['terminal-open', 't1']);
  await controller.destroy();
  assert.deepEqual(events.slice(-2), [['editor-destroy'], ['terminal-destroy']]);
  await assert.rejects(() => controller.openFile('src/b.mjs'), /destroyed/i);
});
