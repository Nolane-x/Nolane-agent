import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultReleaseGates } from '../src/release/full-release-matrix.mjs';

const REQUIRED = [
  'native-core-runtime-wave5',
  'native-core-wave5-production-wiring',
  'native-core-wave5-parity-mapping',
  'beta5-release-docs',
];

test('beta.5 matrix retains beta.4 gates, replaces current docs gate and adds runtime wave5 gates', () => {
  const beta4 = defaultReleaseGates({ rootDirectory: process.cwd(), version: '5.0.0-beta.4' });
  const beta5 = defaultReleaseGates({ rootDirectory: process.cwd(), version: '5.0.0-beta.5' });
  assert.equal(beta4.length, 128);
  assert.equal(beta5.length, 131);
  const ids = new Set(beta5.map((gate) => gate.id));
  for (const id of REQUIRED) assert.ok(ids.has(id), id);
  for (const gate of beta4) if (gate.id !== 'beta4-release-docs') assert.ok(ids.has(gate.id), `retained ${gate.id}`);
  assert.equal(ids.has('beta4-release-docs'), false);
});
