import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSourceCustodyRecord, verifySourceCustodyRecord } from '../src/forensics/source-custody.mjs';
import { evaluateRecoveryClaims } from '../src/forensics/recovery-claim-policy.mjs';

test('required missing upstream source becomes an explicit blocker', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-custody-'));
  const record = createSourceCustodyRecord({
    id: 'nolane-native-canonical',
    kind: 'upstream-source',
    path: 'missing.zip',
    expectedSha256: '1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9',
    expectedBytes: 67431284,
    origin: 'historical-manifest',
    required: true,
  });
  const result = await verifySourceCustodyRecord(record, { root });
  assert.equal(result.status, 'missing');
  assert.match(result.blocker, /canonical upstream source/i);
});

test('custody verifies content address and byte count', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-custody-'));
  await writeFile(path.join(root, 'source.txt'), 'nolane\n');
  const record = createSourceCustodyRecord({
    id: 'nolane-current',
    kind: 'product-source',
    path: 'source.txt',
    expectedSha256: 'e996801ea98235154cad4ceb7bc2e344113777208fa36f39622122cf2b933ff7',
    expectedBytes: 7,
    origin: 'checkpoint-source',
    required: true,
  });
  const result = await verifySourceCustodyRecord(record, { root });
  assert.equal(result.status, 'verified');
  assert.equal(result.actualBytes, 7);
});

test('recovery claims remain locked without canonical upstream and external receipts', () => {
  const claims = evaluateRecoveryClaims({
    custody: [{ id: 'nolane-native-canonical', kind: 'upstream-source', required: true, status: 'missing' }],
    truthLedger: [],
    uiAudit: { complete: false },
    externalReceipts: [],
  });
  assert.equal(claims.completeParityClaimAllowed, false);
  assert.equal(claims.comparativeSuperiorityClaimAllowed, false);
  assert.equal(claims.windowsUiCertified, false);
  assert.equal(claims.providerRealCertified, false);
  assert.ok(claims.blockers.length >= 4);
});

test('recovery claims distinguish source-local UI completion from external UI certification', () => {
  const claims = evaluateRecoveryClaims({
    custody: [{ id: 'nolane-native-canonical', kind: 'upstream-source', required: true, status: 'missing' }],
    truthLedger: [{ id: 'x', status: 'upstream-source-unavailable' }],
    uiAudit: { sourceLocalComplete: true, complete: false, defaultUiVersion: 'v3' },
    externalReceipts: [],
  });
  assert.equal(claims.uiV3SourceLocalComplete, true);
  assert.equal(claims.uiV3Complete, false);
  assert.ok(claims.blockers.some((item) => /external UI certification/i.test(item)));
});
