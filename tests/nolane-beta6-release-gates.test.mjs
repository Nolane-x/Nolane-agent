import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultReleaseGates } from '../src/release/full-release-matrix.mjs';

const REQUIRED = [
  'native-core-runtime-wave6',
  'native-core-wave6-production-wiring',
  'native-core-wave6-parity-mapping',
  'beta6-release-docs',
  'native-core-wave6-decomposition-checkpoint',
  'native-core-wave7-execution-checkpoint',
  'native-core-wave8-session-checkpoint',
  'native-core-wave9-provider-checkpoint',
  'native-core-wave10-gateway-checkpoint',
  'native-core-wave11-browser-checkpoint',
  'native-core-wave12-adapter-checkpoint',
  'native-core-wave13-trust-checkpoint',
  'native-core-wave14-media-checkpoint',
  'native-core-wave15-product-config-checkpoint',
  'native-core-waves16-19-fail-closed-checkpoint',
  'nolane-proof-intelligence',
  'deep-superiority-wave-batch',
  'forensic-recovery-checkpoint-1',
  'forensic-recovery-checkpoint-2',
  'forensic-recovery-checkpoint-3',
  'forensic-recovery-checkpoint-4',
  'forensic-recovery-checkpoint-5',
  'forensic-recovery-checkpoint-6',
  'forensic-recovery-checkpoint-7',
  'forensic-recovery-checkpoint-8',
  'forensic-recovery-checkpoint-9',
  'forensic-recovery-checkpoint-10',
  'checkpoint-10-ux-foundation',
];

test('beta.6 matrix retains beta.5 gates, replaces current docs gate and adds runtime wave6 gates', () => {
  const beta5 = defaultReleaseGates({ rootDirectory: process.cwd(), version: '5.0.0-beta.5' });
  const beta6 = defaultReleaseGates({ rootDirectory: process.cwd(), version: '5.0.0-beta.6' });
  assert.equal(beta5.length, 131);
  assert.equal(beta6.length, 161);
  const ids = new Set(beta6.map((gate) => gate.id));
  for (const id of REQUIRED) assert.ok(ids.has(id), id);
  for (const gate of beta5) if (gate.id !== 'beta5-release-docs') assert.ok(ids.has(gate.id), `retained ${gate.id}`);
  assert.equal(ids.has('beta5-release-docs'), false);
});

test('the initial 0.0.0 stable release retains the full current evidence gate set', () => {
  const stable = defaultReleaseGates({ rootDirectory: process.cwd(), version: '0.0.0' });
  const ids = new Set(stable.map((gate) => gate.id));
  for (const id of REQUIRED.filter((id) => id !== 'beta6-release-docs')) assert.ok(ids.has(id), id);
  assert.ok(ids.has('current-release-docs'));
  assert.equal(ids.has('beta6-release-docs'), false);
  assert.ok(stable.some((gate) => /4\.0\.0 retention/.test(gate.label)));
});
