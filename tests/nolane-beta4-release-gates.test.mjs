import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultReleaseGates } from '../src/release/full-release-matrix.mjs';

const NEW = [
  'native-core-agent-behavior-wave4',
  'native-core-session-lifecycle-wave4',
  'native-core-tool-governance-wave4',
  'native-core-profile-oauth-wave4',
  'native-core-wave4-production-wiring',
  'native-core-wave4-parity-mapping',
  'beta4-release-docs',
];

test('beta.4 matrix retains beta.3 gates, replaces current docs gate and adds six runtime wave4 gates', () => {
  const beta3 = defaultReleaseGates({ rootDirectory: process.cwd(), version: '5.0.0-beta.3' });
  const beta4 = defaultReleaseGates({ rootDirectory: process.cwd(), version: '5.0.0-beta.4' });
  assert.equal(beta3.length, 122);
  assert.equal(beta4.length, 128);
  const ids = new Set(beta4.map((gate) => gate.id));
  for (const id of NEW) assert.ok(ids.has(id), id);
  for (const gate of beta3) {
    if (gate.id !== 'beta3-release-docs') assert.ok(ids.has(gate.id), `retained ${gate.id}`);
  }
  assert.equal(ids.has('beta3-release-docs'), false);
  assert.equal(ids.has('beta4-release-docs'), true);
});
