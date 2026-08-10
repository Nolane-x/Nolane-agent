import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { WindowStateStore, resolveWindowBounds } = require('../desktop/window-state-store.cjs');

test('window bounds stay visible and move to an active display when a monitor disappears', () => {
  const displays = [
    { id: 1, primary: true, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 2, workArea: { x: 1920, y: 0, width: 2560, height: 1440 } }
  ];
  const secondary = resolveWindowBounds({ bounds: { x: 2200, y: 100, width: 1400, height: 900 }, displayId: 2, maximized: false }, displays, { width: 1480, height: 940, minWidth: 980, minHeight: 680 });
  assert.equal(secondary.displayId, '2');
  assert.ok(secondary.bounds.x >= 1920);

  const recovered = resolveWindowBounds({ bounds: { x: 2200, y: 100, width: 1400, height: 900 }, displayId: 2, maximized: false }, [displays[0]], { width: 1480, height: 940, minWidth: 980, minHeight: 680 });
  assert.equal(recovered.displayId, '1');
  assert.ok(recovered.bounds.x >= 0 && recovered.bounds.x + recovered.bounds.width <= 1920);
  assert.ok(recovered.bounds.y >= 0 && recovered.bounds.y + recovered.bounds.height <= 1080);
});

test('window state is atomically stored outside the installation tree with a receipt', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-window-state-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new WindowStateStore({ userDataDir: root, clock: () => '2026-08-03T18:00:00.000Z' });
  const saved = store.save({ bounds: { x: 10, y: 20, width: 1200, height: 800 }, maximized: true, displayId: 1 });
  assert.match(saved.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(store.read().maximized, true);
  const file = path.join(root, 'session', 'window-state.json');
  if (process.platform !== 'win32') assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).displayId, '1');
});
