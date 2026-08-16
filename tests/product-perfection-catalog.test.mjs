import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPerfectionCatalog } from '../src/product-perfection/catalog.mjs';

test('approved micro-detail catalog has unique stable PFX ids', async () => {
  const catalog = await loadPerfectionCatalog(process.cwd());
  assert.ok(catalog.ids.size > 200);
  assert.equal([...catalog.ids.keys()].every((id) => /^PFX-[A-Z]+-\d{3}$/.test(id)), true);
  assert.equal(catalog.ids.size, new Set(catalog.ids.keys()).size);
});
