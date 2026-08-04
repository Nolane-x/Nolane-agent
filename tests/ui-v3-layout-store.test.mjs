import test from 'node:test';
import assert from 'node:assert/strict';
import { createLayoutStore, clampLayoutValue } from '../ui-v3/core/layout-store.mjs';

test('layout store persists sizes and recovers from corrupt storage', () => {
  const memory = new Map([['nolane.ui.layout.v1', '{bad']]);
  const storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: (k) => memory.delete(k) };
  const store = createLayoutStore(storage);
  assert.equal(store.snapshot().sidebarWidth, 288);
  store.update({ sidebarWidth: 420, dockWidth: 9999 });
  assert.equal(store.snapshot().sidebarWidth, 420);
  assert.equal(store.snapshot().dockWidth, 720);
  assert.equal(JSON.parse(memory.get('nolane.ui.layout.v1')).sidebarWidth, 420);
  store.reset();
  assert.equal(store.snapshot().sidebarWidth, 288);
  assert.equal(clampLayoutValue('bottomHeight', 5), 160);
});
