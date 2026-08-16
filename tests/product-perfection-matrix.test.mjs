import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePerfectionObservation,
  buildPerfectionMatrix,
} from '../src/product-perfection/matrix-store.mjs';
import { loadPerfectionCatalog } from '../src/product-perfection/catalog.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';

test('PASS requires evidence', () => {
  assert.throws(() => normalizePerfectionObservation({
    id: 'PFX-SHELL-001',
    status: 'PASS',
    evidence: [],
    revision: SHA,
    notes: 'test',
  }), /PASS requires evidence/);
});

test('PASS requires exact 40-character Git revision', () => {
  assert.throws(() => normalizePerfectionObservation({
    id: 'PFX-SHELL-001',
    status: 'PASS',
    evidence: [{ class: 'VIS', ref: 'run-1' }],
    revision: 'abc1234',
    notes: 'test',
  }), /exact 40-character Git revision/);
});

test('matrix covers every catalog id and defaults to UNKNOWN', async () => {
  const catalog = await loadPerfectionCatalog(process.cwd());
  const matrix = buildPerfectionMatrix({ catalog, observations: [] });
  assert.equal(matrix.items.length, catalog.ids.size);
  assert.equal(matrix.items.every((item) => item.status === 'UNKNOWN'), true);
});
