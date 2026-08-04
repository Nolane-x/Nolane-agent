import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PRODUCT, STAGES, ASSURANCE_LEVELS, ARTIFACT_STATES, CORE_PACKS, DOMAIN_PACKS } from '../src/core/constants.mjs';

test('ForgeOS identity, lifecycle, and assurance vocabulary are frozen', async () => {
  assert.equal(PRODUCT.name, 'ForgeOS');
  assert.equal(PRODUCT.license, 'MIT');
  assert.deepEqual(STAGES, ['intent','discovery','research','divergence','synthesis','selection','product-definition','ux-design','architecture','planning','implementation','verification','release-readiness','released']);
  assert.deepEqual(ASSURANCE_LEVELS, ['A0','A1','A2','A3','A4']);
  assert.deepEqual(ARTIFACT_STATES, ['draft','review','verified','superseded','invalidated']);
  assert.equal(CORE_PACKS.length, 12);
  assert.equal(DOMAIN_PACKS.length, 16);
  assert.match(await readFile('LICENSE', 'utf8'), /MIT License/);
});
