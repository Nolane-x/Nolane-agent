import test from 'node:test';
import assert from 'node:assert/strict';
import { importNolaneNativeTransformationLedger } from '../src/forensics/nolane-native-ledger-importer.mjs';

const archiveSha = '1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9';
const sourceSha = 'a'.repeat(64);

function line(overrides = {}) {
  return JSON.stringify({
    source: 'agent/core.py',
    sourceArchiveSha256: archiveSha,
    sourceArchiveEntrySha256: sourceSha,
    bytes: 100,
    directory: false,
    action: 'reimplement',
    target: 'src/agent/core.mjs',
    status: 'not_implemented',
    reason: null,
    ...overrides,
  });
}

test('historical NolaneNative entries remain unresolved when canonical source bytes are unavailable', () => {
  const result = importNolaneNativeTransformationLedger({
    jsonlText: `${line()}\n`,
    expectedArchiveSha256: archiveSha,
    canonicalSourceAvailable: false,
  });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].state, 'upstream-source-unavailable');
  assert.equal(result.records[0].evidenceClass, 'historical-path-ledger');
  assert.equal(result.records[0].isFunctionInventory, false);
  assert.deepEqual(result.records[0].allowedParityStates, ['excluded-with-reason', 'external-unverified', 'upstream-source-unavailable']);
});

test('explicit non-product exclusions remain visible but never become exact mappings', () => {
  const result = importNolaneNativeTransformationLedger({
    jsonlText: `${line({ source: 'docs/readme.md', action: 'exclude-with-reason', target: null, reason: 'documentation-only' })}\n`,
    expectedArchiveSha256: archiveSha,
    canonicalSourceAvailable: false,
  });
  assert.equal(result.records[0].state, 'excluded-with-reason');
  assert.equal(result.records[0].exclusionReason, 'documentation-only');
  assert.equal(result.records[0].allowedParityStates.includes('exact'), false);
});

test('importer rejects duplicate entries, archive mismatches, and unsafe paths', () => {
  assert.throws(() => importNolaneNativeTransformationLedger({ jsonlText: `${line()}\n${line()}\n`, expectedArchiveSha256: archiveSha, canonicalSourceAvailable: false }), /duplicate/i);
  assert.throws(() => importNolaneNativeTransformationLedger({ jsonlText: `${line({ sourceArchiveSha256: 'b'.repeat(64) })}\n`, expectedArchiveSha256: archiveSha, canonicalSourceAvailable: false }), /archive sha-256 mismatch/i);
  assert.throws(() => importNolaneNativeTransformationLedger({ jsonlText: `${line({ source: '../escape.py' })}\n`, expectedArchiveSha256: archiveSha, canonicalSourceAvailable: false }), /unsafe/i);
});
