import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

test('generated NolaneNative-native wave checkpoint documents preserve local proof and external blockers', async () => {
  const checkpoint = await readJson('requirements/nolane-native-wave-checkpoint.json');
  const report = await readFile('docs/NOLANE-NATIVE-WAVE-CHECKPOINT.md', 'utf8');
  assert.equal(checkpoint.schema, 'nolane.nolane_native-native-waves.checkpoint.v1');
  assert.equal(checkpoint.localCore.wavesCompletedThrough, 15);
  assert.equal(checkpoint.localCore.verifiedContracts, 100);
  assert.equal(checkpoint.external.externalContracts, 15);
  assert.equal(checkpoint.external.openNolaneRequirements.length, 5);
  assert.equal(checkpoint.claims.completeParityClaimAllowed, false);
  assert.match(report, /Waves 6–15: local core implemented and verified/);
  assert.match(report, /Waves 16–19: blocked by external certification/);
  assert.match(report, /Không tuyên bố complete parity/);
  assert.match(report, /NOL-AUDIT-012/);
});
