import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReleaseNonClaimManifest } from '../src/release/non-claim-manifest.mjs';

const H = (char) => char.repeat(64);

test('release non-claim manifest publishes protected false claims, external gates and failure evidence', () => {
  const value = buildReleaseNonClaimManifest({
    version: '5.0.0-beta.6',
    claims: {
      completeParityClaimAllowed: false,
      comparativeSuperiorityClaimAllowed: false,
      windowsUiCertified: false,
      providerRealCertified: false,
    },
    externalGates: [
      { id: 'windows-ui', reason: 'Windows runner unavailable', evidenceSha256: H('a') },
      { id: 'provider-real', reason: 'Credentials unavailable', evidenceSha256: H('b') },
    ],
    failures: [{ id: 'nolane-native-source-missing', stage: 'custody', evidenceSha256: H('c') }],
  });
  assert.equal(value.claims.completeParityClaimAllowed, false);
  assert.equal(value.externalGates.length, 2);
  assert.equal(value.failures.length, 1);
  assert.match(value.receiptSha256, /^[a-f0-9]{64}$/);
});

test('release non-claim manifest rejects unlocked protected claims and missing failure evidence', () => {
  assert.throws(() => buildReleaseNonClaimManifest({
    version: '5.0.0-beta.6',
    claims: { completeParityClaimAllowed: true },
    externalGates: [],
    failures: [],
  }), /protected claim.*false/i);
  assert.throws(() => buildReleaseNonClaimManifest({
    version: '5.0.0-beta.6',
    claims: { completeParityClaimAllowed: false },
    externalGates: [],
    failures: [{ id: 'missing-hash', stage: 'verification' }],
  }), /evidenceSha256/i);
});
